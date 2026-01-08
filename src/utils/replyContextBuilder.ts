/**
 * Reply Context Builder
 * 
 * Fetches conversation context for reply generation:
 * - Target tweet text
 * - Quoted tweet text (if any)
 * - Root tweet text (if target is part of thread)
 * - Previous tweet in thread (if available)
 */

import { getSupabaseClient } from '../db/index';
import { UnifiedBrowserPool, BrowserPriority } from '../browser/UnifiedBrowserPool';

export interface ReplyContext {
  target_tweet_id: string;
  target_text: string;
  target_author: string;
  quoted_tweet_text?: string;
  root_tweet_id?: string;
  root_tweet_text?: string;
  thread_prev_tweet_id?: string;
  thread_prev_text?: string;
  context_fetch_error?: string;
}

/**
 * Build reply context by fetching conversation data
 */
export async function buildReplyContext(tweetId: string, authorHandle: string): Promise<ReplyContext> {
  const supabase = getSupabaseClient();
  
  const context: ReplyContext = {
    target_tweet_id: tweetId,
    target_text: '',
    target_author: authorHandle,
  };
  
  try {
    // First, try to get target tweet from DB
    const { data: oppData } = await supabase
      .from('reply_opportunities')
      .select('target_tweet_content, root_tweet_id, target_in_reply_to_tweet_id')
      .eq('target_tweet_id', tweetId)
      .single();
    
    if (oppData?.target_tweet_content) {
      context.target_text = oppData.target_tweet_content;
      context.root_tweet_id = oppData.root_tweet_id || tweetId; // Default to self if root
    }
    
    // If target is a reply, fetch root tweet
    if (oppData?.target_in_reply_to_tweet_id && oppData.root_tweet_id && oppData.root_tweet_id !== tweetId) {
      context.root_tweet_id = oppData.root_tweet_id;
      
      // Try to get root tweet text from DB
      const { data: rootOppData } = await supabase
        .from('reply_opportunities')
        .select('target_tweet_content')
        .eq('target_tweet_id', oppData.root_tweet_id)
        .single();
      
      if (rootOppData?.target_tweet_content) {
        context.root_tweet_text = rootOppData.target_tweet_content;
      }
    }
    
    // If we don't have target text from DB, fetch from Twitter
    if (!context.target_text) {
      const fetched = await fetchTweetFromTwitter(tweetId);
      if (fetched) {
        context.target_text = fetched.text;
        if (fetched.quoted_text) {
          context.quoted_tweet_text = fetched.quoted_text;
        }
        if (fetched.root_text && fetched.root_id !== tweetId) {
          context.root_tweet_text = fetched.root_text;
          context.root_tweet_id = fetched.root_id;
        }
      } else {
        context.context_fetch_error = 'Failed to fetch tweet from Twitter';
      }
    }
    
  } catch (error: any) {
    console.error(`[REPLY_CONTEXT] ❌ Error building context for ${tweetId}:`, error.message);
    context.context_fetch_error = error.message;
  }
  
  return context;
}

/**
 * Fetch tweet content from Twitter using browser automation
 */
async function fetchTweetFromTwitter(tweetId: string): Promise<{
  text: string;
  quoted_text?: string;
  root_text?: string;
  root_id?: string;
} | null> {
  try {
    const pool = UnifiedBrowserPool.getInstance();
    const { page } = await pool.acquirePage(BrowserPriority.REPLY_GENERATION);
    
    try {
      const tweetUrl = `https://x.com/i/web/status/${tweetId}`;
      await page.goto(tweetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2000); // Wait for content to load
      
      // Extract tweet text
      const tweetText = await page.evaluate(() => {
        // Try multiple selectors for tweet text
        const selectors = [
          '[data-testid="tweetText"]',
          'article[data-testid="tweet"] [lang]',
          'article div[lang]',
        ];
        
        for (const selector of selectors) {
          const element = document.querySelector(selector);
          if (element) {
            return element.textContent?.trim() || '';
          }
        }
        return '';
      });
      
      if (!tweetText) {
        return null;
      }
      
      // Extract quoted tweet if present
      const quotedText = await page.evaluate(() => {
        const quoted = document.querySelector('[data-testid="tweet"] [data-testid="tweet"]');
        return quoted?.textContent?.trim() || undefined;
      });
      
      // Extract root tweet if this is a reply
      const rootInfo = await page.evaluate(() => {
        // Look for "Replying to @username" indicator
        const replyIndicator = document.querySelector('[data-testid="reply"]');
        if (replyIndicator) {
          // Try to find the root tweet in the conversation
          const rootTweet = document.querySelector('article[data-testid="tweet"]:first-of-type');
          if (rootTweet) {
            const rootText = rootTweet.querySelector('[data-testid="tweetText"]')?.textContent?.trim();
            return rootText || undefined;
          }
        }
        return undefined;
      });
      
      return {
        text: tweetText,
        quoted_text: quotedText,
        root_text: rootInfo,
        root_id: rootInfo ? tweetId : undefined, // Simplified - would need actual root ID extraction
      };
      
    } finally {
      await pool.releasePage(page);
    }
    
  } catch (error: any) {
    console.error(`[REPLY_CONTEXT] Failed to fetch tweet ${tweetId} from Twitter:`, error.message);
    return null;
  }
}

