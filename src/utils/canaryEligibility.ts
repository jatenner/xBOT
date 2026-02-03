/**
 * 🔒 CANARY ELIGIBILITY CHECKER
 * 
 * Determines if a tweet is eligible for canary reply posting.
 * Only root tweets from trusted sources are eligible.
 */

import { Page } from 'playwright';

export interface CanaryEligibilityResult {
  eligible: boolean;
  reason: string;
  isRootTweet: boolean;
  authorHandle: string | null;
  discoverySource: string | null;
}

/**
 * Check if tweet is canary-eligible
 * 
 * Requirements:
 * - Must be a ROOT tweet (NOT a reply)
 * - Author must be in allowlist OR discovery_source='profile' from curated accounts
 * - Thread context must load with required selectors
 */
export async function isCanaryEligibleTweet(
  page: Page,
  tweetId: string,
  discoverySource?: string | null,
  authorHandle?: string | null
): Promise<CanaryEligibilityResult> {
  try {
    // Navigate to tweet if not already there
    const currentUrl = page.url();
    const tweetUrl = `https://x.com/i/web/status/${tweetId}`;
    
    if (!currentUrl.includes(tweetId)) {
      await page.goto(tweetUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(2000); // Wait for content to load
    }
    
    // Check 1: Is this a root tweet? (NOT a reply)
    const isRootTweet = await page.evaluate(() => {
      // Look for "Replying to" text anywhere on page
      const allText = document.body.textContent || '';
      const hasReplyingToText = /Replying to\s+@/i.test(allText);
      
      if (hasReplyingToText) {
        return false; // This is a reply
      }
      
      // Check for social context element (Twitter's official reply indicator)
      const socialContext = document.querySelector('[data-testid="socialContext"]');
      if (socialContext) {
        const contextText = socialContext.textContent || '';
        if (contextText.includes('Replying to')) {
          return false; // This is a reply
        }
      }
      
      // Check main article for reply indicators
      const mainArticle = document.querySelector('article[data-testid="tweet"]:first-of-type');
      if (mainArticle) {
        const articleText = mainArticle.textContent || '';
        if (/Replying to/i.test(articleText)) {
          return false; // This is a reply
        }
      }
      
      // If no "Replying to" indicators found, assume root tweet
      return true;
    });
    
    if (!isRootTweet) {
      return {
        eligible: false,
        reason: 'Tweet is a reply, not a root tweet',
        isRootTweet: false,
        authorHandle: authorHandle || null,
        discoverySource: discoverySource || null,
      };
    }
    
    // Check 2: Author allowlist OR discovery_source='profile'
    const isFromProfileHarvest = discoverySource === 'profile';
    
    // Get author handle from page if not provided
    let detectedAuthorHandle = authorHandle;
    if (!detectedAuthorHandle) {
      detectedAuthorHandle = await page.evaluate(() => {
        // Try to find author handle in tweet
        const authorLink = document.querySelector('a[href^="/"]')?.getAttribute('href');
        if (authorLink && authorLink.startsWith('/') && !authorLink.includes('/status/')) {
          return authorLink.substring(1); // Remove leading slash
        }
        return null;
      });
    }
    
    // For canary, allow profile-harvested tweets OR tweets from known health accounts
    // More lenient: allow any account if from profile harvest
    const healthAccountPattern = /(health|wellness|fitness|nutrition|biohack|longevity|gym|strength|workout|exercise)/i;
    const isHealthAccount = detectedAuthorHandle ? healthAccountPattern.test(detectedAuthorHandle) : false;
    
    // Allow if from profile harvest OR health account OR if no author detected (fallback)
    if (!isFromProfileHarvest && !isHealthAccount && detectedAuthorHandle) {
      return {
        eligible: false,
        reason: `Author not in allowlist (handle: ${detectedAuthorHandle}, source: ${discoverySource})`,
        isRootTweet: true,
        authorHandle: detectedAuthorHandle,
        discoverySource: discoverySource || null,
      };
    }
    
    // Check 3: Thread context loads (verify required selectors exist)
    const hasRequiredSelectors = await page.evaluate(() => {
      // Check for tweet content container
      const tweetContainer = document.querySelector('[data-testid="tweet"]') || 
                            document.querySelector('article[role="article"]');
      return !!tweetContainer;
    });
    
    if (!hasRequiredSelectors) {
      return {
        eligible: false,
        reason: 'Required tweet selectors not found (page may not have loaded)',
        isRootTweet: true,
        authorHandle: detectedAuthorHandle,
        discoverySource: discoverySource || null,
      };
    }
    
    return {
      eligible: true,
      reason: 'Root tweet from trusted source with valid context',
      isRootTweet: true,
      authorHandle: detectedAuthorHandle,
      discoverySource: discoverySource || null,
    };
    
  } catch (error: any) {
    return {
      eligible: false,
      reason: `Error checking eligibility: ${error.message}`,
      isRootTweet: false,
      authorHandle: authorHandle || null,
      discoverySource: discoverySource || null,
    };
  }
}
