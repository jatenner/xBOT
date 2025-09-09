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
      // Build thread segments if not provided
      let segments: string[];
      let isThread: boolean;
      
      if (draft.segments && draft.segments.length > 0) {
        segments = draft.segments;
        isThread = draft.isThread || segments.length > 1;
      } else {
        const threadResult = ThreadBuilder.buildThreadSegments(draft.content);
        segments = threadResult.segments;
        isThread = threadResult.isThread;
        
        console.log(`🧵 POSTING_FACADE: Built ${segments.length} segments, isThread=${isThread}`);
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
