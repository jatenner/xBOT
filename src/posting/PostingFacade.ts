/**
 * 🎯 POSTING FACADE - Single entry point for all content posting
 * Routes to ThreadComposer for unified thread handling
 */

import BulletproofThreadComposer from './BulletproofThreadComposer';
import ThreadBuilder from '../utils/threadBuilder';
import { POSTING_DISABLED, DRY_RUN, SINGLE_POST_HARD_BLOCK_IF_SEGMENTS_GT1 } from '../config/flags';
import { PostAttemptStatus } from '../types/posting';
import { checkAndSanitizeContent } from '../content/contentSafety';

export interface Draft {
  id: string;
  content: string;
  segments?: string[];
  isThread?: boolean;
  attemptStatus?: PostAttemptStatus;
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
      // 🛡️ FACT-CHECK CONTENT SAFETY
      console.log('🛡️ POSTING_FACADE: Running fact-check...');
      const safetyResult = checkAndSanitizeContent(draft.content);
      
      if (!safetyResult.ok) {
        console.log(`🚫 FACT_CHECK_BLOCKED: ${safetyResult.reasons.join(', ')}`);
        draft.attemptStatus = PostAttemptStatus.BLOCKED_FACTCHECK;
        return {
          success: false,
          mode: 'single',
          tweetId: undefined,
          error: `Content blocked by fact-check: ${safetyResult.reasons.join(', ')}`
        };
      }
      
      // Use sanitized content
      draft.content = safetyResult.sanitized;
      console.log(`✅ FACT_CHECK_PASSED: ${safetyResult.originalLength}→${safetyResult.sanitizedLength} chars`);

      // Build thread segments if not provided - ENHANCED with metadata + 1/N parsing
      let segments: string[];
      let isThread: boolean;
      
      if (draft.segments && draft.segments.length > 0) {
        segments = draft.segments;
        isThread = draft.isThread || segments.length > 1;
      } else {
        // Enhanced segment building with metadata support + env toggles
        const enforcedCount = draft.meta?.threadCount || draft.meta?.threadSegments;
        const force = process.env.THREAD_FORCE_SEGMENTS === 'true';
        const delim = process.env.THREAD_SEGMENT_DELIMITER ?? '---';
        const reNumber = new RegExp(process.env.THREAD_NUMBERING_REGEX ?? '^\\s*\\d+/\\d+\\b', 'm');
        const minForce = Number(process.env.THREAD_FORCE_SEGMENTS_MIN_CHARS ?? 220);
        const width = Number(process.env.THREAD_WIDTH_CHAR_LIMIT ?? 240);

        const looksNumbered = reNumber.test(draft.content);
        const hasDelim = draft.content.includes(delim);
        const overLimit = draft.content.length > 280;

        let enforced: 'none'|'numbering'|'length'|'delim'|'force' = 'none';

        if (looksNumbered) { 
          segments = this.splitByNumbering(draft.content); 
          enforced = 'numbering'; 
        }
        else if (hasDelim) { 
          segments = this.splitByDelim(draft.content, delim); 
          enforced = 'delim'; 
        }
        else if (overLimit) { 
          segments = this.splitByWidth(draft.content, 270); 
          enforced = 'length'; 
        }
        else if (force && draft.content.length >= minForce) { 
          segments = this.splitByWidth(draft.content, width); 
          enforced = 'force'; 
        }
        else { 
          segments = [draft.content]; 
        }

        isThread = segments.length > 1;
        console.log(`📊 SEGMENT_BUILDER: Generated ${segments.length} segments via ${enforced}`);

        // ENHANCED THREAD GUARD - Only guard when truly expected to be multi-segment
        const shouldBeMultiSegment = looksNumbered || hasDelim || overLimit;
        if (shouldBeMultiSegment && segments.length <= 1) {
          const errorMsg = `THREAD_GUARD: Multi-segment content detected but segmentation failed. ` +
            `Triggers: numbered=${looksNumbered}, delim=${hasDelim}, overLimit=${overLimit}. ` +
            `Content preview: "${draft.content.slice(0, 100)}..."`;
          
          console.error('🚨 THREAD_GUARD_FAILED:', errorMsg);
          draft.attemptStatus = PostAttemptStatus.BLOCKED_FACTCHECK;
          throw new Error(errorMsg);
        }

        console.log(`🧵 POSTING_FACADE: Built ${segments.length} segments, isThread=${isThread}, enforced=${enforced}`);
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
    const parts = s.split(/\n(?=\s*\d+\/\d+\b)/g).map(p => p.trim()).filter(Boolean);
    return parts.length > 1 ? parts : [s];
  }

  /**
   * 📏 SPLIT BY CHARACTER WIDTH
   */
  private static splitByWidth(s: string, max = 240): string[] {
    if (s.length <= max) return [s];
    const out: string[] = [];
    let i = 0;
    while (i < s.length) { 
      out.push(s.slice(i, i + max)); 
      i += max; 
    }
    return out;
  }

  /**
   * 🔪 SPLIT BY DELIMITER
   */
  private static splitByDelim(s: string, d: string): string[] {
    const parts = s.split(d).map(x => x.trim()).filter(Boolean);
    return parts.length > 1 ? parts : [s];
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
