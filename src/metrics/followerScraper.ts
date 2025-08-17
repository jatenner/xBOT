/**
 * Follower Count Fallback Scraper
 * Resilient scraping when API/primary methods fail
 */

import { browserManager } from '../posting/BrowserManager';

/**
 * Parse abbreviated numbers like "1.2K", "15M", "3.4B"
 */
function parseAbbrevNumber(s: string): number {
  const cleaned = s.trim().replace(/,/g, '').toUpperCase();
  const match = cleaned.match(/^([\d.]+)\s*([KMB])?$/);
  
  if (!match) {
    // Try parsing as regular number
    const num = parseInt(cleaned, 10);
    return isNaN(num) ? 0 : num;
  }
  
  const value = parseFloat(match[1]);
  const multiplier = match[2];
  
  switch (multiplier) {
    case 'K': return Math.round(value * 1000);
    case 'M': return Math.round(value * 1000000);
    case 'B': return Math.round(value * 1000000000);
    default: return Math.round(value);
  }
}

/**
 * Scrape follower count from X.com profile page as fallback
 */
export async function getFollowersFallback(handle: string): Promise<number> {
  try {
    return await browserManager.withSharedContext(async ({ page }) => {
      const cleanHandle = handle.replace('@', '');
      const url = `https://x.com/${cleanHandle}`;
      
      console.log(`🔍 Scraping follower count for @${cleanHandle}...`);
      
      await page.goto(url, { 
        waitUntil: 'domcontentloaded', 
        timeout: 30000 
      });
      
      // Wait for profile to load
      await page.waitForTimeout(2000);
      
      // Multiple selectors for follower count
      const selectors = [
        'a[href$="/followers"] span',
        'a[href*="/followers"] span',
        '[data-testid="UserName"] + div a span',
        'div[data-testid="UserName"] + div span',
        // Legacy selectors
        '.ProfileNav-item--followers .ProfileNav-value',
        '.ProfileCardStats-statLink[data-nav="followers"] .ProfileCardStats-statValue'
      ];
      
      let followerText = '';
      
      for (const selector of selectors) {
        try {
          const elements = await page.locator(selector).all();
          for (const el of elements) {
            const text = await el.innerText().catch(() => '');
            // Look for numbers with K/M/B or large numbers
            if (text && /[\d,]+[KMB]?/.test(text.trim())) {
              followerText = text.trim();
              break;
            }
          }
          if (followerText) break;
        } catch (e) {
          // Try next selector
        }
      }
      
      if (!followerText) {
        throw new Error(`Could not find follower count on ${url}`);
      }
      
      const count = parseAbbrevNumber(followerText);
      console.log(`📊 Scraped follower count: ${followerText} → ${count}`);
      
      return count;
    });
  } catch (error: any) {
    console.error(`❌ Follower scraping failed for @${handle}: ${error.message}`);
    return 0; // Return 0 instead of throwing to prevent system crashes
  }
}

/**
 * Get current bot's follower count (reads from env or config)
 */
export async function getCurrentFollowerCount(): Promise<number> {
  try {
    // Try to get handle from environment or config
    const handle = process.env.TWITTER_USERNAME || process.env.BOT_HANDLE || 'SignalAndSynapse';
    
    // First try any existing API methods
    try {
      // Check if there's an existing follower API
      const { getFollowerCount } = await import('../utils/metrics').catch(() => ({}));
      if (getFollowerCount && typeof getFollowerCount === 'function') {
        const apiCount = await getFollowerCount();
        if (apiCount > 0) {
          console.log(`📊 API follower count: ${apiCount}`);
          return apiCount;
        }
      }
    } catch (apiError) {
      console.warn(`⚠️ API follower count failed: ${apiError}`);
    }
    
    // Fallback to scraping
    return await getFollowersFallback(handle);
    
  } catch (error: any) {
    console.error(`❌ Failed to get current follower count: ${error.message}`);
    return 0;
  }
}

/**
 * Batch scrape multiple accounts for competitive analysis
 */
export async function batchScrapFollowers(handles: string[]): Promise<Record<string, number>> {
  const results: Record<string, number> = {};
  
  for (const handle of handles) {
    try {
      results[handle] = await getFollowersFallback(handle);
      // Add delay between requests to be respectful
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      console.warn(`⚠️ Failed to scrape @${handle}, skipping...`);
      results[handle] = 0;
    }
  }
  
  return results;
}

/**
 * Validate follower count for sanity check
 */
export function validateFollowerCount(count: number, previousCount?: number): boolean {
  // Basic sanity checks
  if (count < 0 || count > 1_000_000_000) return false;
  
  // If we have previous count, check for reasonable change
  if (previousCount !== undefined) {
    const change = Math.abs(count - previousCount);
    const changePercent = change / Math.max(previousCount, 1);
    
    // Flag suspicious changes (>50% change)
    if (changePercent > 0.5) {
      console.warn(`⚠️ Suspicious follower count change: ${previousCount} → ${count} (${Math.round(changePercent * 100)}%)`);
      return false;
    }
  }
  
  return true;
}
