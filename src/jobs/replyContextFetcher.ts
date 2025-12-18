/**
 * Reply Context Fetcher
 * 
 * Fetches target tweet text + parent tweet text (1 hop) for reply generation
 */

import { Page } from 'playwright';

export interface ReplyContext {
  targetTweetText: string;
  targetTweetAuthor: string;
  parentTweetText?: string;
  parentTweetAuthor?: string;
}

/**
 * Fetch reply context from a tweet URL
 * @param page Playwright page
 * @param targetTweetUrl URL of the tweet to reply to
 * @returns Reply context with target and parent tweet text
 */
export async function fetchReplyContext(page: Page, targetTweetUrl: string): Promise<ReplyContext> {
  console.log(`[REPLY_CTX] Fetching context for ${targetTweetUrl}...`);
  
  try {
    // Navigate to tweet
    await page.goto(targetTweetUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000); // Wait for dynamic content
    
    // Extract target tweet text
    const targetTweetText = await page.evaluate(() => {
      // Try multiple selectors for tweet text
      const selectors = [
        '[data-testid="tweetText"]',
        'article [lang]',
        'div[data-testid="tweet"] span'
      ];
      
      for (const selector of selectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          // Get first tweet text (main tweet)
          const text = elements[0].textContent?.trim() || '';
          if (text.length > 10) {
            return text;
          }
        }
      }
      
      return '';
    });
    
    // Extract target tweet author
    const targetTweetAuthor = await page.evaluate(() => {
      const authorElement = document.querySelector('[data-testid="User-Name"] a[role="link"]');
      return authorElement?.textContent?.trim().replace('@', '') || 'unknown';
    });
    
    // Try to extract parent tweet (if this is a reply)
    const parentTweetText = await page.evaluate(() => {
      // Look for "Replying to" indicator
      const replyingToElement = document.querySelector('[data-testid="reply-to"]');
      if (!replyingToElement) return undefined;
      
      // Try to find parent tweet text (usually above the main tweet)
      const tweetTexts = document.querySelectorAll('[data-testid="tweetText"]');
      if (tweetTexts.length > 1) {
        return tweetTexts[0].textContent?.trim() || undefined;
      }
      
      return undefined;
    });
    
    const parentTweetAuthor = parentTweetText ? await page.evaluate(() => {
      const authorElements = document.querySelectorAll('[data-testid="User-Name"] a[role="link"]');
      if (authorElements.length > 1) {
        return authorElements[0].textContent?.trim().replace('@', '') || undefined;
      }
      return undefined;
    }) : undefined;
    
    const targetExcerpt = targetTweetText.substring(0, 100) + (targetTweetText.length > 100 ? '...' : '');
    const parentExcerpt = parentTweetText ? parentTweetText.substring(0, 100) + (parentTweetText.length > 100 ? '...' : '') : 'N/A';
    
    console.log(`[REPLY_CTX] Target: @${targetTweetAuthor} - "${targetExcerpt}"`);
    console.log(`[REPLY_CTX] Parent: ${parentTweetAuthor ? `@${parentTweetAuthor}` : 'N/A'} - "${parentExcerpt}"`);
    
    return {
      targetTweetText,
      targetTweetAuthor,
      parentTweetText,
      parentTweetAuthor
    };
  } catch (error: any) {
    console.error(`[REPLY_CTX] ❌ Failed to fetch context: ${error.message}`);
    // Return minimal context on error
    return {
      targetTweetText: '',
      targetTweetAuthor: 'unknown'
    };
  }
}

/**
 * Calculate keyword overlap score between reply and target tweet
 * @param replyText Reply text
 * @param targetText Target tweet text
 * @returns Overlap score (0-1)
 */
export function calculateOverlapScore(replyText: string, targetText: string): number {
  const replyWords = replyText.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  const targetWords = targetText.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  
  if (targetWords.length === 0) return 0;
  
  const overlaps = replyWords.filter(word => targetWords.includes(word));
  return overlaps.length / targetWords.length;
}

