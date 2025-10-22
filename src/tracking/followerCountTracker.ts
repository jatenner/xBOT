/**
 * FOLLOWER COUNT TRACKER
 * Tracks follower count changes over time for attribution
 */

import { getSupabaseClient } from '../db/index';
import { UnifiedBrowserPool } from '../browser/UnifiedBrowserPool';

interface FollowerSnapshot {
  timestamp: Date;
  follower_count: number;
  following_count: number;
  tweet_count: number;
  source: 'scraped' | 'estimated';
}

let lastKnownFollowerCount = 0;
let lastCheckTime: Date | null = null;

/**
 * Get current follower count from Twitter
 */
export async function getCurrentFollowerCount(): Promise<number> {
  // Check cache (don't scrape too frequently)
  if (lastCheckTime && Date.now() - lastCheckTime.getTime() < 5 * 60 * 1000) {
    console.log(`[FOLLOWER_TRACKER] Using cached count: ${lastKnownFollowerCount} (${Math.round((Date.now() - lastCheckTime.getTime()) / 1000)}s ago)`);
    return lastKnownFollowerCount;
  }
  
  try {
    const count = await scrapeFollowerCount();
    lastKnownFollowerCount = count;
    lastCheckTime = new Date();
    
    // Store snapshot in database
    await storeFollowerSnapshot({
      timestamp: new Date(),
      follower_count: count,
      following_count: 0, // TODO: scrape this too
      tweet_count: 0, // TODO: scrape this too
      source: 'scraped'
    });
    
    console.log(`[FOLLOWER_TRACKER] ✅ Current follower count: ${count}`);
    return count;
    
  } catch (error: any) {
    console.error(`[FOLLOWER_TRACKER] ❌ Failed to get follower count: ${error.message}`);
    
    // Return last known count or estimate
    if (lastKnownFollowerCount > 0) {
      console.log(`[FOLLOWER_TRACKER] Using last known count: ${lastKnownFollowerCount}`);
      return lastKnownFollowerCount;
    }
    
    // Estimate based on historical data
    return await estimateFollowerCount();
  }
}

/**
 * Scrape follower count from Twitter profile
 */
async function scrapeFollowerCount(): Promise<number> {
  const pool = UnifiedBrowserPool.getInstance();
  const page = await pool.acquirePage('follower_count');
  
  try {
    // Navigate to our profile
    await page.goto('https://twitter.com/home', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);
    
    // Try to find follower count
    // Twitter has multiple possible selectors for follower count
    const selectors = [
      'a[href$="/followers"] span span',
      '[data-testid="UserProfileHeader_Items"] a:has-text("Followers") span',
      'a[href*="/followers"] span:not([aria-hidden])',
    ];
    
    for (const selector of selectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          const text = await element.textContent();
          if (text) {
            const count = parseFollowerCount(text);
            if (count >= 0) {
              return count;
            }
          }
        }
      } catch (e) {
        // Try next selector
        continue;
      }
    }
    
    throw new Error('Could not find follower count element');
    
  } catch (error: any) {
    console.error('❌ Failed to scrape follower count:', error.message);
    throw error;
  } finally {
    await pool.releasePage(page);
  }
}

/**
 * Parse follower count text (handles "1.2K", "5.3M", etc.)
 */
function parseFollowerCount(text: string): number {
  const cleaned = text.trim().toLowerCase();
  
  // Handle abbreviated numbers
  if (cleaned.includes('k')) {
    return Math.round(parseFloat(cleaned) * 1000);
  }
  if (cleaned.includes('m')) {
    return Math.round(parseFloat(cleaned) * 1000000);
  }
  
  // Handle plain numbers
  const num = parseInt(cleaned.replace(/,/g, ''));
  if (!isNaN(num)) {
    return num;
  }
  
  return -1;
}

/**
 * Store follower snapshot in database
 */
async function storeFollowerSnapshot(snapshot: FollowerSnapshot): Promise<void> {
  const supabase = getSupabaseClient();
  
  await supabase.from('follower_snapshots').insert({
    timestamp: snapshot.timestamp.toISOString(),
    follower_count: snapshot.follower_count,
    following_count: snapshot.following_count,
    tweet_count: snapshot.tweet_count,
    source: snapshot.source
  });
}

/**
 * Estimate follower count based on historical data
 */
async function estimateFollowerCount(): Promise<number> {
  const supabase = getSupabaseClient();
  
  // Get last 3 snapshots
  const { data } = await supabase
    .from('follower_snapshots')
    .select('follower_count, timestamp')
    .order('timestamp', { ascending: false })
    .limit(3);
  
  if (!data || data.length === 0) {
    console.log('[FOLLOWER_TRACKER] No historical data, starting at 0');
    return 0;
  }
  
  // Simple linear extrapolation
  const latest = data[0];
  const estimate = Number(latest.follower_count) || 0;
  
  console.log(`[FOLLOWER_TRACKER] Estimated count: ${estimate} (based on last snapshot)`);
  return estimate;
}

/**
 * Get follower growth between two timestamps
 */
export async function getFollowerGrowth(startTime: Date, endTime: Date): Promise<number> {
  const supabase = getSupabaseClient();
  
  const { data: snapshots } = await supabase
    .from('follower_snapshots')
    .select('follower_count, timestamp')
    .gte('timestamp', startTime.toISOString())
    .lte('timestamp', endTime.toISOString())
    .order('timestamp', { ascending: true });
  
  if (!snapshots || snapshots.length < 2) {
    return 0;
  }
  
  const first = Number(snapshots[0].follower_count) || 0;
  const last = Number(snapshots[snapshots.length - 1].follower_count) || 0;
  
  return last - first;
}

