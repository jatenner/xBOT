/**
 * 📊 ACCOUNT SNAPSHOT JOB
 * 
 * Captures hourly account-level metrics (follower count, etc.) for cadence learning.
 * Runs on Mac Runner (CDP mode) to avoid consent walls.
 */

import 'dotenv/config';
import { getSupabaseClient } from '../db/index';
import { launchRunnerPersistent } from '../infra/playwright/runnerLauncher';

interface AccountSnapshot {
  timestamp: Date;
  followers_count: number;
  following_count: number;
  total_posts: number;
  source: 'scraped' | 'estimated';
  notes?: Record<string, any>;
}

/**
 * Capture account snapshot (hourly)
 */
export async function captureAccountSnapshot(): Promise<AccountSnapshot | null> {
  console.log('[ACCOUNT_SNAPSHOT] 📊 Starting account snapshot capture...');
  
  // Only run on Mac Runner
  if (process.env.RUNNER_MODE !== 'true') {
    console.log('[ACCOUNT_SNAPSHOT] ⏭️ Skipping (not in RUNNER_MODE)');
    return null;
  }
  
  const supabase = getSupabaseClient();
  
  // Round timestamp to nearest hour for idempotency
  const now = new Date();
  const hourTimestamp = new Date(now);
  hourTimestamp.setMinutes(0, 0, 0);
  
  // Check if snapshot already exists for this hour
  const { data: existing } = await supabase
    .from('account_snapshots')
    .select('id')
    .eq('timestamp', hourTimestamp.toISOString())
    .maybeSingle();
  
  if (existing) {
    console.log(`[ACCOUNT_SNAPSHOT] ✅ Snapshot already exists for ${hourTimestamp.toISOString()}`);
    return null;
  }
  
  try {
    // Scrape follower count using CDP
    const snapshot = await scrapeAccountMetrics();
    
    // Store in database
    const { error } = await supabase
      .from('account_snapshots')
      .insert({
        timestamp: hourTimestamp.toISOString(),
        followers_count: snapshot.followers_count,
        following_count: snapshot.following_count,
        total_posts: snapshot.total_posts,
        source: snapshot.source,
        notes: snapshot.notes || {},
      });
    
    if (error) {
      console.error(`[ACCOUNT_SNAPSHOT] ❌ Failed to store snapshot: ${error.message}`);
      throw error;
    }
    
    console.log(`[ACCOUNT_SNAPSHOT] ✅ Snapshot captured: ${snapshot.followers_count} followers at ${hourTimestamp.toISOString()}`);
    
    // Log to system_events
    await supabase.from('system_events').insert({
      event_type: 'ACCOUNT_SNAPSHOT',
      severity: 'info',
      message: `Account snapshot captured: ${snapshot.followers_count} followers`,
      event_data: {
        timestamp: hourTimestamp.toISOString(),
        followers_count: snapshot.followers_count,
        following_count: snapshot.following_count,
        total_posts: snapshot.total_posts,
      },
      created_at: new Date().toISOString(),
    });
    
    return snapshot;
    
  } catch (error: any) {
    console.error(`[ACCOUNT_SNAPSHOT] ❌ Error: ${error.message}`);
    
    // Try to estimate from last snapshot
    const estimated = await estimateAccountMetrics();
    if (estimated) {
      console.log(`[ACCOUNT_SNAPSHOT] 📊 Using estimated metrics: ${estimated.followers_count} followers`);
      
      await supabase.from('account_snapshots').insert({
        timestamp: hourTimestamp.toISOString(),
        followers_count: estimated.followers_count,
        following_count: estimated.following_count,
        total_posts: estimated.total_posts,
        source: 'estimated',
        notes: { error: error.message, estimated_at: new Date().toISOString() },
      });
      
      return estimated;
    }
    
    throw error;
  }
}

/**
 * Scrape account metrics from Twitter profile
 */
async function scrapeAccountMetrics(): Promise<AccountSnapshot> {
  const username = process.env.TWITTER_USERNAME || 'SignalAndSynapse';
  const profileUrl = `https://x.com/${username}`;
  
  console.log(`[ACCOUNT_SNAPSHOT] 🔍 Scraping profile: ${profileUrl}`);
  
  // Use CDP runner launcher
  const context = await launchRunnerPersistent(true); // headless
  const page = await context.newPage();
  
  try {
    await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000); // Wait for profile to load
    
    // Scrape follower count
    const followerCount = await scrapeFollowerCount(page);
    
    // Scrape following count (optional)
    const followingCount = await scrapeFollowingCount(page).catch(() => 0);
    
    // Scrape total posts (optional)
    const totalPosts = await scrapeTotalPosts(page).catch(() => 0);
    
    return {
      timestamp: new Date(),
      followers_count: followerCount,
      following_count: followingCount,
      total_posts: totalPosts,
      source: 'scraped',
      notes: {},
    };
    
  } finally {
    await page.close();
  }
}

/**
 * Scrape follower count from profile page
 */
async function scrapeFollowerCount(page: any): Promise<number> {
  const selectors = [
    'a[href$="/followers"] span',
    'a[href*="/followers"] span:not([aria-hidden])',
    '[data-testid="UserName"] ~ div a span',
  ];
  
  for (const selector of selectors) {
    try {
      const elements = await page.locator(selector).all();
      for (const element of elements) {
        const text = await element.textContent();
        if (text && /[\d,]+[KMB]?/.test(text.trim())) {
          const count = parseCount(text);
          if (count >= 0) {
            console.log(`[ACCOUNT_SNAPSHOT] ✅ Found followers: ${count} using selector: ${selector}`);
            return count;
          }
        }
      }
    } catch (e) {
      continue;
    }
  }
  
  throw new Error('Could not find follower count element');
}

/**
 * Scrape following count
 */
async function scrapeFollowingCount(page: any): Promise<number> {
  const selectors = [
    'a[href$="/following"] span',
    'a[href*="/following"] span:not([aria-hidden])',
  ];
  
  for (const selector of selectors) {
    try {
      const elements = await page.locator(selector).all();
      for (const element of elements) {
        const text = await element.textContent();
        if (text && /[\d,]+[KMB]?/.test(text.trim())) {
          const count = parseCount(text);
          if (count >= 0) {
            return count;
          }
        }
      }
    } catch (e) {
      continue;
    }
  }
  
  return 0; // Optional metric
}

/**
 * Scrape total posts count
 */
async function scrapeTotalPosts(page: any): Promise<number> {
  // Look for posts count in profile header
  try {
    const text = await page.textContent('body');
    const match = text?.match(/(\d+(?:[.,]\d+)?[KMB]?)\s*(?:posts?|tweets?)/i);
    if (match) {
      return parseCount(match[1]);
    }
  } catch (e) {
    // Ignore
  }
  
  return 0; // Optional metric
}

/**
 * Parse count text (handles "1.2K", "5.3M", etc.)
 */
function parseCount(text: string): number {
  const cleaned = text.trim().toLowerCase().replace(/,/g, '');
  
  if (cleaned.includes('k')) {
    return Math.round(parseFloat(cleaned) * 1000);
  }
  if (cleaned.includes('m')) {
    return Math.round(parseFloat(cleaned) * 1000000);
  }
  if (cleaned.includes('b')) {
    return Math.round(parseFloat(cleaned) * 1000000000);
  }
  
  const num = parseInt(cleaned);
  return isNaN(num) ? -1 : num;
}

/**
 * Estimate account metrics from last snapshot
 */
async function estimateAccountMetrics(): Promise<AccountSnapshot | null> {
  const supabase = getSupabaseClient();
  
  const { data } = await supabase
    .from('account_snapshots')
    .select('followers_count, following_count, total_posts, timestamp')
    .order('timestamp', { ascending: false })
    .limit(1)
    .maybeSingle();
  
  if (!data) {
    return null;
  }
  
  // Simple: use last known values
  return {
    timestamp: new Date(),
    followers_count: Number(data.followers_count) || 0,
    following_count: Number(data.following_count) || 0,
    total_posts: Number(data.total_posts) || 0,
    source: 'estimated',
    notes: { based_on: data.timestamp },
  };
}

/**
 * Main entry point for running the job
 */
export async function runAccountSnapshotJob(): Promise<void> {
  try {
    await captureAccountSnapshot();
  } catch (error: any) {
    console.error(`[ACCOUNT_SNAPSHOT] ❌ Job failed: ${error.message}`);
    throw error;
  }
}
