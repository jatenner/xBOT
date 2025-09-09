/**
 * 🎯 POSTING FACADE - Single entry point for all content posting
 * Routes to ThreadComposer for unified thread handling
 */

import ThreadComposer from './threadComposer';
import ThreadBuilder from '../utils/threadBuilder';
import { POSTING_DISABLED, DRY_RUN } from '../config/flags';

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
          segments
        };
      }

      // Get browser page for ThreadComposer
      const page = await PostingFacade.getBrowserPage();
      const threadComposer = new ThreadComposer(page, {
        dryRun: DRY_RUN
      });

      // Use ThreadComposer for ALL content (handles single vs thread automatically)
      const contentString = segments.join('\n\n');
      console.log(`🧵 POSTING_FACADE: Routing to ThreadComposer...`);
      
      const result = await threadComposer.postContent(contentString);
      
      console.log(`✅ POSTING_FACADE_RESULT: mode=${result.mode}, success=${result.success}`);
      
      return {
        success: result.success,
        mode: result.mode,
        rootTweetUrl: result.rootTweetUrl,
        tweetIds: result.tweetIds,
        segments: result.segments,
        error: result.error
      };
      
    } catch (error) {
      console.error('❌ POSTING_FACADE_ERROR:', error);
      return {
        success: false,
        mode: 'single',
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
