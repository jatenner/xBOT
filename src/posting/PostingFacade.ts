/**
 * 🎯 POSTING FACADE - Single entry point for all content posting
 * Routes to ThreadComposer for unified thread handling
 */

import BulletproofThreadComposer from './BulletproofThreadComposer';
import ThreadBuilder from '../utils/threadBuilder';
import { POSTING_DISABLED, DRY_RUN, SINGLE_POST_HARD_BLOCK_IF_SEGMENTS_GT1 } from '../config/flags';

export interface Draft {
  id: string;
  content: string;
  segments?: string[];
  isThread?: boolean;
  meta?: {
    threadCount?: number;
    threadSegments?: number;
    format?: string;
  };
}

export interface PostingResult {
  success: boolean;
  mode: 'single' | 'composer' | 'reply_chain';
  rootTweetUrl?: string;
  tweetId?: string; // Legacy compatibility
  tweetIds?: string[];
  segments?: string[];
  error?: string;
}

export class PostingFacade {
  /**
   * 🎯 MAIN POSTING METHOD - Single entry point for all content
   */
  static async post(draft: Draft): Promise<PostingResult> {
    console.log('🎯 POSTING_FACADE: Processing draft...');
    
    // Safety check: Global posting disabled
    if (POSTING_DISABLED) {
      console.log('🚨 POSTING_FACADE: POSTING_DISABLED=true, skipping post');
      return {
        success: false,
        mode: 'single',
        tweetId: undefined, // Legacy compatibility
        error: 'Posting disabled by global flag'
      };
    }

    try {
      // Build thread segments if not provided - ENHANCED with metadata + 1/N parsing
      let segments: string[];
      let isThread: boolean;
      
      if (draft.segments && draft.segments.length > 0) {
        segments = draft.segments;
        isThread = draft.isThread || segments.length > 1;
      } else {
        // Enhanced segment building with metadata support
        const enforcedCount = draft.meta?.threadCount || draft.meta?.threadSegments;
        const force = process.env.THREAD_FORCE_SEGMENTS === 'true';
        const reNumber = new RegExp(process.env.THREAD_NUMBERING_REGEX ?? '^\\s*\\d+/\\d+\\b', 'm');
        const looksNumbered = reNumber.test(draft.content);
        const overLimit = draft.content.length > 280;
        
        segments = this.splitIntoSegments(draft.content, enforcedCount);
        isThread = segments.length > 1;
        
        // THREAD_GUARD: segmentation failed (multi-segment content must not post as single)
        if ((looksNumbered || overLimit || force) && segments.length <= 1) {
          throw new Error('THREAD_GUARD: segmentation failed (multi-segment content must not post as single)');
        }
        
        // Always route threads through the composer facade:
        console.log(`🧵 POSTING_FACADE: Built ${segments.length} segments, isThread=${isThread}, enforced=${looksNumbered ? 'numbering' : overLimit ? 'length' : (force ? 'force' : 'none')}`);
      }

      // 🚨 HARD BLOCK: Prevent single posts when segments > 1
      const isMultiSegment = segments.length > 1 || isThread;
      if (isMultiSegment && SINGLE_POST_HARD_BLOCK_IF_SEGMENTS_GT1) {
        console.log('🚨 HARD_BLOCK: Multi-segment content MUST be posted as thread');
        console.log(`   segments=${segments.length}, isThread=${isThread}`);
        console.log('   Routing to BulletproofThreadComposer...');
        
        // Force thread posting for multi-segment content
        const threadResult = await BulletproofThreadComposer.post(segments);
        return {
          success: threadResult.success,
          mode: threadResult.mode,
          rootTweetUrl: threadResult.rootTweetUrl,
          tweetId: threadResult.rootTweetUrl, // Legacy compatibility
          tweetIds: threadResult.tweetIds,
          segments,
          error: threadResult.error
        };
      }

      // Log the posting decision
      console.log(`🎯 POSTING_FACADE_DECISION: segments=${segments.length}, isThread=${isThread}`);
      
      if (DRY_RUN) {
        console.log('🧪 POSTING_FACADE: DRY_RUN mode - simulating post');
        segments.forEach((segment, i) => {
          console.log(`   DRY_RUN_SEGMENT_${i + 1}: ${segment.substring(0, 100)}...`);
        });
        
        return {
          success: true,
          mode: isThread ? 'composer' : 'single',
          rootTweetUrl: `https://x.com/dry_run/status/${Date.now()}`,
          tweetId: `https://x.com/dry_run/status/${Date.now()}`, // Legacy compatibility
          segments
        };
      }

      // Route through BulletproofThreadComposer for ALL content
      console.log(`🧵 POSTING_FACADE: Routing to BulletproofThreadComposer...`);
      
      const result = await BulletproofThreadComposer.post(segments);
      
      console.log(`✅ POSTING_FACADE_RESULT: mode=${result.mode}, success=${result.success}`);
      
      return {
        success: result.success,
        mode: result.mode,
        rootTweetUrl: result.rootTweetUrl,
        tweetId: result.rootTweetUrl, // Legacy compatibility
        tweetIds: result.tweetIds,
        segments: segments, // Use the segments we processed
        error: result.error
      };
      
    } catch (error) {
      console.error('❌ POSTING_FACADE_ERROR:', error);
      return {
        success: false,
        mode: 'single',
        tweetId: undefined, // Legacy compatibility
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * 🌐 GET browser page for ThreadComposer
   */
  private static async getBrowserPage(): Promise<any> {
    const { default: browserManager } = await import('../core/BrowserManager');
    
    return await browserManager.withContext(async (context: any) => {
      return await context.newPage();
    });
  }

  /**
   * 🧵 REAL SEGMENTATION - actually splits content by numbering/width; guards singles
   */
  private static splitIntoSegments(text: string, enforcedCount?: number): string[] {
    const force = process.env.THREAD_FORCE_SEGMENTS === 'true';
    const delim = process.env.THREAD_SEGMENT_DELIMITER ?? '---';
    const reNumber = new RegExp(process.env.THREAD_NUMBERING_REGEX ?? '^\\s*\\d+/\\d+\\b', 'm');

    const looksNumbered = reNumber.test(text);
    const overLimit = text.length > 280;

    // Real segmentation - must produce multiple segments
    if (force || looksNumbered || overLimit) {
      let segs = looksNumbered ? this.splitByNumbering(text) : this.splitByWidth(text, 270);
      
      // If delimiter is present, respect it as a secondary hint
      if (segs.length === 1 && text.includes(delim)) {
        segs = text.split(delim).map(x => x.trim()).filter(Boolean);
      }

      console.log(`📊 SEGMENT_BUILDER: Generated ${segs.length} segments via ${looksNumbered ? 'numbering' : overLimit ? 'length' : 'force'}`);
      return segs;
    }

    // Default single segment
    return [text.trim()];
  }

  /**
   * 🔢 SPLIT BY NUMBERING MARKERS
   */
  private static splitByNumbering(s: string): string[] {
    const parts = s
      .split(/\n(?=\s*\d+\/\d+\b)/g)   // split before "2/4", "3/4", etc.
      .map(p => p.trim())
      .filter(Boolean);
    return parts.length > 1 ? parts : [s];
  }

  /**
   * 📏 SPLIT BY CHARACTER WIDTH
   */
  private static splitByWidth(s: string, max = 270): string[] {
    const chunks: string[] = [];
    let i = 0;
    while (i < s.length) {
      chunks.push(s.slice(i, i + max));
      i += max;
    }
    return chunks;
  }

  /**
   * 📊 VALIDATE draft before posting
   */
  static validateDraft(draft: Draft): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!draft.id) {
      errors.push('Draft ID is required');
    }

    if (!draft.content && (!draft.segments || draft.segments.length === 0)) {
      errors.push('Draft content or segments required');
    }

    if (draft.segments) {
      const validation = ThreadBuilder.validateThreadSegments(draft.segments);
      if (!validation.valid) {
        errors.push(...validation.errors);
      }
    }

    return { valid: errors.length === 0, errors };
  }
}

export default PostingFacade;
