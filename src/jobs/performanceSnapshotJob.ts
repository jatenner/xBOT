/**
 * 📊 PERFORMANCE SNAPSHOT JOB
 * 
 * Collects performance metrics for posted decisions at specific time horizons (1h, 24h).
 * Triggered by POST_SUCCESS events or scheduled checks.
 */

import 'dotenv/config';
import { getSupabaseClient } from '../db/index';
import { launchRunnerPersistent } from '../infra/playwright/runnerLauncher';

interface PerformanceSnapshot {
  decision_id: string;
  tweet_id: string;
  collected_at: Date;
  horizon_minutes: number;
  impressions: number;
  likes: number;
  reposts: number;
  replies: number;
  bookmarks: number;
  engagement_rate: number;
  profile_clicks: number;
  source: 'scraped' | 'estimated';
}

/**
 * Enqueue snapshot tasks for a POST_SUCCESS event
 */
export async function enqueuePerformanceSnapshots(decisionId: string, tweetId: string, postedAt: Date): Promise<void> {
  console.log(`[PERFORMANCE_SNAPSHOT] 📋 Enqueueing snapshots for decision_id=${decisionId} tweet_id=${tweetId}`);
  
  const supabase = getSupabaseClient();
  
  // Check if snapshots already exist
  const { data: existing } = await supabase
    .from('performance_snapshots')
    .select('horizon_minutes')
    .eq('decision_id', decisionId);
  
  const existingHorizons = new Set((existing || []).map(s => s.horizon_minutes));
  
  // Schedule 1h snapshot
  if (!existingHorizons.has(60)) {
    const oneHourAt = new Date(postedAt.getTime() + 60 * 60 * 1000);
    console.log(`[PERFORMANCE_SNAPSHOT] ⏰ Scheduled 1h snapshot for ${oneHourAt.toISOString()}`);
    
    // Store in a queue table or use system_events
    await supabase.from('system_events').insert({
      event_type: 'PERFORMANCE_SNAPSHOT_SCHEDULED',
      severity: 'info',
      message: `Scheduled 1h snapshot for decision_id=${decisionId}`,
      event_data: {
        decision_id: decisionId,
        tweet_id: tweetId,
        horizon_minutes: 60,
        scheduled_for: oneHourAt.toISOString(),
      },
      created_at: new Date().toISOString(),
    });
  }
  
  // Schedule 24h snapshot
  if (!existingHorizons.has(1440)) {
    const twentyFourHoursAt = new Date(postedAt.getTime() + 24 * 60 * 60 * 1000);
    console.log(`[PERFORMANCE_SNAPSHOT] ⏰ Scheduled 24h snapshot for ${twentyFourHoursAt.toISOString()}`);
    
    await supabase.from('system_events').insert({
      event_type: 'PERFORMANCE_SNAPSHOT_SCHEDULED',
      severity: 'info',
      message: `Scheduled 24h snapshot for decision_id=${decisionId}`,
      event_data: {
        decision_id: decisionId,
        tweet_id: tweetId,
        horizon_minutes: 1440,
        scheduled_for: twentyFourHoursAt.toISOString(),
      },
      created_at: new Date().toISOString(),
    });
  }
}

/**
 * Process scheduled snapshots (runs periodically)
 */
export async function processScheduledSnapshots(): Promise<number> {
  console.log('[PERFORMANCE_SNAPSHOT] 🔍 Processing scheduled snapshots...');
  
  const supabase = getSupabaseClient();
  const now = new Date();
  
  // Find scheduled snapshots that are due
  const { data: scheduled } = await supabase
    .from('system_events')
    .select('event_data, created_at')
    .eq('event_type', 'PERFORMANCE_SNAPSHOT_SCHEDULED')
    .lte('event_data->>scheduled_for', now.toISOString())
    .order('created_at', { ascending: true })
    .limit(10); // Process up to 10 at a time
  
  if (!scheduled || scheduled.length === 0) {
    console.log('[PERFORMANCE_SNAPSHOT] ✅ No scheduled snapshots due');
    return 0;
  }
  
  let processed = 0;
  
  for (const event of scheduled) {
    const eventData = typeof event.event_data === 'string' 
      ? JSON.parse(event.event_data)
      : event.event_data;
    
    const decisionId = eventData.decision_id;
    const tweetId = eventData.tweet_id;
    const horizonMinutes = eventData.horizon_minutes;
    
    try {
      // Check if snapshot already exists (idempotency)
      const { data: existing } = await supabase
        .from('performance_snapshots')
        .select('id')
        .eq('decision_id', decisionId)
        .eq('horizon_minutes', horizonMinutes)
        .maybeSingle();
      
      if (existing) {
        console.log(`[PERFORMANCE_SNAPSHOT] ⏭️ Snapshot already exists: decision_id=${decisionId} horizon=${horizonMinutes}m`);
        continue;
      }
      
      // Collect snapshot
      const snapshot = await collectPerformanceSnapshot(decisionId, tweetId, horizonMinutes);
      
      if (snapshot) {
        // Store snapshot
        const { error } = await supabase
          .from('performance_snapshots')
          .insert({
            decision_id: snapshot.decision_id,
            tweet_id: snapshot.tweet_id,
            collected_at: snapshot.collected_at.toISOString(),
            horizon_minutes: snapshot.horizon_minutes,
            impressions: snapshot.impressions,
            likes: snapshot.likes,
            reposts: snapshot.reposts,
            replies: snapshot.replies,
            bookmarks: snapshot.bookmarks,
            engagement_rate: snapshot.engagement_rate,
            profile_clicks: snapshot.profile_clicks,
            source: snapshot.source,
          });
        
        if (error) {
          console.error(`[PERFORMANCE_SNAPSHOT] ❌ Failed to store snapshot: ${error.message}`);
          continue;
        }
        
        console.log(`[PERFORMANCE_SNAPSHOT] ✅ Collected snapshot: decision_id=${decisionId} horizon=${horizonMinutes}m impressions=${snapshot.impressions}`);
        processed++;
      }
      
    } catch (error: any) {
      console.error(`[PERFORMANCE_SNAPSHOT] ❌ Error processing snapshot: ${error.message}`);
      // Continue with next snapshot
    }
  }
  
  return processed;
}

/**
 * Collect performance snapshot for a specific decision and horizon
 */
async function collectPerformanceSnapshot(
  decisionId: string,
  tweetId: string,
  horizonMinutes: number
): Promise<PerformanceSnapshot | null> {
  console.log(`[PERFORMANCE_SNAPSHOT] 📊 Collecting snapshot: decision_id=${decisionId} tweet_id=${tweetId} horizon=${horizonMinutes}m`);
  
  // Only run on Mac Runner for scraping
  if (process.env.RUNNER_MODE !== 'true') {
    console.log('[PERFORMANCE_SNAPSHOT] ⏭️ Skipping scraping (not in RUNNER_MODE), will try to get from existing metrics');
    
    // Try to get from existing metrics tables
    return await getSnapshotFromExistingMetrics(decisionId, tweetId, horizonMinutes);
  }
  
  try {
    // Scrape from Twitter
    const metrics = await scrapeTweetMetrics(tweetId);
    
    return {
      decision_id: decisionId,
      tweet_id: tweetId,
      collected_at: new Date(),
      horizon_minutes: horizonMinutes,
      impressions: metrics.impressions,
      likes: metrics.likes,
      reposts: metrics.reposts,
      replies: metrics.replies,
      bookmarks: metrics.bookmarks,
      engagement_rate: metrics.engagement_rate,
      profile_clicks: metrics.profile_clicks,
      source: 'scraped',
    };
    
  } catch (error: any) {
    console.error(`[PERFORMANCE_SNAPSHOT] ❌ Scraping failed: ${error.message}, trying existing metrics`);
    
    // Fallback to existing metrics
    return await getSnapshotFromExistingMetrics(decisionId, tweetId, horizonMinutes);
  }
}

/**
 * Get snapshot from existing metrics tables
 */
async function getSnapshotFromExistingMetrics(
  decisionId: string,
  tweetId: string,
  horizonMinutes: number
): Promise<PerformanceSnapshot | null> {
  const supabase = getSupabaseClient();
  
  // Try content_metadata first
  const { data: content } = await supabase
    .from('content_metadata')
    .select('actual_impressions, actual_likes, actual_retweets, actual_replies, actual_engagement_rate')
    .eq('decision_id', decisionId)
    .maybeSingle();
  
  if (content) {
    return {
      decision_id: decisionId,
      tweet_id: tweetId,
      collected_at: new Date(),
      horizon_minutes: horizonMinutes,
      impressions: Number(content.actual_impressions) || 0,
      likes: Number(content.actual_likes) || 0,
      reposts: Number(content.actual_retweets) || 0,
      replies: Number(content.actual_replies) || 0,
      bookmarks: 0, // Not in content_metadata
      engagement_rate: Number(content.actual_engagement_rate) || 0,
      profile_clicks: 0, // Not in content_metadata
      source: 'estimated',
    };
  }
  
  // Try outcomes table
  const { data: outcome } = await supabase
    .from('outcomes')
    .select('impressions, likes, retweets, replies, bookmarks, engagement_rate, profile_clicks')
    .eq('decision_id', decisionId)
    .order('collected_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  
  if (outcome) {
    return {
      decision_id: decisionId,
      tweet_id: tweetId,
      collected_at: new Date(),
      horizon_minutes: horizonMinutes,
      impressions: Number(outcome.impressions) || 0,
      likes: Number(outcome.likes) || 0,
      reposts: Number(outcome.retweets) || 0,
      replies: Number(outcome.replies) || 0,
      bookmarks: Number(outcome.bookmarks) || 0,
      engagement_rate: Number(outcome.engagement_rate) || 0,
      profile_clicks: Number(outcome.profile_clicks) || 0,
      source: 'estimated',
    };
  }
  
  console.warn(`[PERFORMANCE_SNAPSHOT] ⚠️ No metrics found for decision_id=${decisionId}`);
  return null;
}

/**
 * Scrape tweet metrics from Twitter
 */
async function scrapeTweetMetrics(tweetId: string): Promise<{
  impressions: number;
  likes: number;
  reposts: number;
  replies: number;
  bookmarks: number;
  engagement_rate: number;
  profile_clicks: number;
}> {
  const tweetUrl = `https://x.com/i/status/${tweetId}`;
  
  console.log(`[PERFORMANCE_SNAPSHOT] 🔍 Scraping metrics: ${tweetUrl}`);
  
  const context = await launchRunnerPersistent(true); // headless
  const page = await context.newPage();
  
  try {
    await page.goto(tweetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    
    // Scrape engagement metrics
    // Note: Twitter's UI doesn't show all metrics publicly, so we'll get what we can
    const likes = await scrapeMetric(page, 'like', 'data-testid="like"');
    const reposts = await scrapeMetric(page, 'repost', 'data-testid="retweet"');
    const replies = await scrapeMetric(page, 'reply', 'data-testid="reply"');
    
    // Impressions and other metrics are not publicly visible
    // We'll use estimates or get from analytics if available
    
    return {
      impressions: 0, // Not publicly visible
      likes,
      reposts,
      replies,
      bookmarks: 0, // Not publicly visible
      engagement_rate: 0, // Calculate later
      profile_clicks: 0, // Not publicly visible
    };
    
  } finally {
    await page.close();
  }
}

/**
 * Scrape a specific metric from tweet page
 */
async function scrapeMetric(page: any, metricName: string, selector: string): Promise<number> {
  try {
    const element = await page.locator(`[${selector}]`).first();
    const text = await element.textContent();
    
    if (text) {
      const match = text.match(/(\d+(?:[.,]\d+)?[KMB]?)/);
      if (match) {
        return parseCount(match[1]);
      }
    }
  } catch (e) {
    // Metric not found
  }
  
  return 0;
}

/**
 * Parse count text
 */
function parseCount(text: string): number {
  const cleaned = text.trim().toLowerCase().replace(/,/g, '');
  
  if (cleaned.includes('k')) {
    return Math.round(parseFloat(cleaned) * 1000);
  }
  if (cleaned.includes('m')) {
    return Math.round(parseFloat(cleaned) * 1000000);
  }
  
  const num = parseInt(cleaned);
  return isNaN(num) ? 0 : num;
}

/**
 * Main entry point for running the job
 */
export async function runPerformanceSnapshotJob(): Promise<void> {
  try {
    const processed = await processScheduledSnapshots();
    console.log(`[PERFORMANCE_SNAPSHOT] ✅ Processed ${processed} snapshots`);
  } catch (error: any) {
    console.error(`[PERFORMANCE_SNAPSHOT] ❌ Job failed: ${error.message}`);
    throw error;
  }
}
