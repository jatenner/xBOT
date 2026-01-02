/**
 * 🎯 ROOT TWEET RESOLVER
 * Ensures replies always target the ROOT tweet, not other replies
 */

import { UnifiedBrowserPool } from '../browser/UnifiedBrowserPool';

export interface RootTweetResolution {
  originalTweetId: string;
  rootTweetId: string;
  isRootTweet: boolean;
  rootTweetUrl: string;
  rootTweetAuthor: string | null;
  rootTweetContent: string | null;
}

/**
 * Resolve a tweet ID to its root tweet using Playwright permalink inspection
 */
export async function resolveRootTweetId(tweetId: string): Promise<RootTweetResolution> {
  const tweetUrl = `https://x.com/i/web/status/${tweetId}`;
  
  console.log(`[REPLY_SELECT] Resolving root for tweet ${tweetId}...`);
  
  const pool = UnifiedBrowserPool.getInstance();
  let page;
  
  try {
    page = await pool.acquirePage('resolve_root_tweet');
    
    await page.goto(tweetUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000); // Let page settle
    
    // Check if this is a reply by looking for "Replying to" text
    const isReply = await page.evaluate(() => {
      const replyingTo = document.querySelector('[data-testid="reply"]') || 
                         document.querySelector('a[href*="/status/"]');
      return !!replyingTo;
    });
    
    if (!isReply) {
      // This is already a root tweet
      console.log(`[REPLY_SELECT] ✅ ${tweetId} is already a root tweet`);
      
      const author = await page.evaluate(() => {
        const authorElement = document.querySelector('[data-testid="User-Name"] a');
        return authorElement?.textContent?.replace('@', '') || null;
      });
      
      const content = await page.evaluate(() => {
        const tweetText = document.querySelector('[data-testid="tweetText"]');
        return tweetText?.textContent || null;
      });
      
      return {
        originalTweetId: tweetId,
        rootTweetId: tweetId,
        isRootTweet: true,
        rootTweetUrl: tweetUrl,
        rootTweetAuthor: author,
        rootTweetContent: content,
      };
    }
    
    // This is a reply, find the root tweet
    const rootTweetData = await page.evaluate(() => {
      // Look for the first tweet in the thread (the one being replied to)
      const articles = Array.from(document.querySelectorAll('article[data-testid="tweet"]'));
      
      if (articles.length > 0) {
        const rootArticle = articles[0]; // First tweet is the root
        
        // Extract tweet ID from the link
        const tweetLink = rootArticle.querySelector('a[href*="/status/"]');
        const href = tweetLink?.getAttribute('href') || '';
        const match = href.match(/\/status\/(\d+)/);
        const rootId = match ? match[1] : null;
        
        // Extract author
        const authorElement = rootArticle.querySelector('[data-testid="User-Name"] a');
        const author = authorElement?.textContent?.replace('@', '') || null;
        
        // Extract content
        const tweetText = rootArticle.querySelector('[data-testid="tweetText"]');
        const content = tweetText?.textContent || null;
        
        return { rootId, author, content };
      }
      
      return { rootId: null, author: null, content: null };
    });
    
    if (rootTweetData.rootId) {
      console.log(`[REPLY_SELECT] ✅ Resolved ${tweetId} → root ${rootTweetData.rootId}`);
      
      return {
        originalTweetId: tweetId,
        rootTweetId: rootTweetData.rootId,
        isRootTweet: false,
        rootTweetUrl: `https://x.com/i/web/status/${rootTweetData.rootId}`,
        rootTweetAuthor: rootTweetData.author,
        rootTweetContent: rootTweetData.content,
      };
    }
    
    // Fallback: couldn't resolve, return original
    console.warn(`[REPLY_SELECT] ⚠️ Could not resolve root for ${tweetId}, using original`);
    return {
      originalTweetId: tweetId,
      rootTweetId: tweetId,
      isRootTweet: true, // Assume it's root if we can't determine
      rootTweetUrl: tweetUrl,
      rootTweetAuthor: null,
      rootTweetContent: null,
    };
    
  } catch (error: any) {
    console.error(`[REPLY_SELECT] ❌ Error resolving root for ${tweetId}:`, error.message);
    
    // Fallback: return original on error
    return {
      originalTweetId: tweetId,
      rootTweetId: tweetId,
      isRootTweet: true,
      rootTweetUrl: tweetUrl,
      rootTweetAuthor: null,
      rootTweetContent: null,
    };
  } finally {
    if (page) {
      await pool.releasePage(page);
    }
  }
}

/**
 * Check if a tweet content looks like a reply (starts with @)
 */
export function looksLikeReply(tweetContent: string): boolean {
  const trimmed = tweetContent.trim();
  return trimmed.startsWith('@');
}

