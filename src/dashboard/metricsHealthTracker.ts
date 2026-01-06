/**
 * 📊 METRICS HEALTH TRACKER
 * 
 * Comprehensive tracking system to monitor metrics scraping health
 * across different time windows (12h, 14h, 24h, etc.)
 * 
 * Tracks:
 * - Scraped: Has metrics (actual_impressions > 0)
 * - Updated: Metrics updated recently (within threshold)
 * - Stale: Has metrics but not updated recently
 * - Missing: No metrics at all
 */

import { getSupabaseClient } from '../db/index';

export interface TimeWindowMetrics {
  windowHours: number;
  total: number;
  scraped: number;
  updated: number;
  stale: number;
  missing: number;
  scrapeRate: number;
  freshnessRate: number;
  status: 'healthy' | 'warning' | 'critical';
}

export interface MetricsHealthReport {
  timestamp: string;
  windows: TimeWindowMetrics[];
  overall: {
    totalPosts: number;
    totalReplies: number;
    overallScrapeRate: number;
    overallFreshnessRate: number;
    status: 'healthy' | 'warning' | 'critical';
  };
  breakdown: {
    posts: TimeWindowMetrics[];
    replies: TimeWindowMetrics[];
  };
  lastScrapeTime: string | null;
  scrapeFrequency24h: number;
}

const STALE_THRESHOLD_HOURS = 6; // Metrics older than 6h are considered stale
const FRESH_THRESHOLD_HOURS = 2; // Metrics updated within 2h are considered fresh

/**
 * Get comprehensive metrics health report for multiple time windows
 */
export async function getMetricsHealthReport(
  windows: number[] = [12, 14, 24, 48, 72]
): Promise<MetricsHealthReport> {
  const supabase = getSupabaseClient();
  const now = new Date();

  // Get last scrape time
  const { data: lastScrape } = await supabase
    .from('outcomes')
    .select('collected_at')
    .order('collected_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // Count scrapes in last 24h
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const { count: scrapeFrequency24h } = await supabase
    .from('outcomes')
    .select('*', { count: 'exact', head: true })
    .gte('collected_at', twentyFourHoursAgo.toISOString());

  // Calculate metrics for each time window
  const postsWindows: TimeWindowMetrics[] = [];
  const repliesWindows: TimeWindowMetrics[] = [];

  for (const windowHours of windows) {
    const windowStart = new Date(now.getTime() - windowHours * 60 * 60 * 1000);
    const staleThreshold = new Date(now.getTime() - STALE_THRESHOLD_HOURS * 60 * 60 * 1000);
    const freshThreshold = new Date(now.getTime() - FRESH_THRESHOLD_HOURS * 60 * 60 * 1000);

    // Posts metrics
    const { data: posts } = await supabase
      .from('content_metadata')
      .select('decision_id, tweet_id, posted_at, actual_impressions, updated_at')
      .in('decision_type', ['single', 'thread'])
      .eq('status', 'posted')
      .not('tweet_id', 'is', null)
      .gte('posted_at', windowStart.toISOString());

    const postsData = posts || [];
    const total = postsData.length;
    const scraped = postsData.filter(p => 
      p.actual_impressions !== null && p.actual_impressions > 0
    ).length;
    
    const updated = postsData.filter(p => {
      if (!p.actual_impressions || p.actual_impressions === 0) return false;
      if (!p.updated_at) return false;
      return new Date(p.updated_at) > freshThreshold;
    }).length;
    
    const stale = postsData.filter(p => {
      if (!p.actual_impressions || p.actual_impressions === 0) return false;
      if (!p.updated_at) return false;
      const updatedAt = new Date(p.updated_at);
      return updatedAt <= freshThreshold && updatedAt > staleThreshold;
    }).length;
    
    const missing = postsData.filter(p => 
      p.actual_impressions === null || p.actual_impressions === 0
    ).length;

    const scrapeRate = total > 0 ? Math.round((scraped / total) * 100) : 0;
    const freshnessRate = scraped > 0 ? Math.round((updated / scraped) * 100) : 0;

    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (scrapeRate < 70 || freshnessRate < 50) {
      status = 'critical';
    } else if (scrapeRate < 85 || freshnessRate < 70) {
      status = 'warning';
    }

    postsWindows.push({
      windowHours,
      total,
      scraped,
      updated,
      stale,
      missing,
      scrapeRate,
      freshnessRate,
      status
    });

    // Replies metrics
    const { data: replies } = await supabase
      .from('content_metadata')
      .select('decision_id, tweet_id, posted_at, actual_impressions, updated_at')
      .eq('decision_type', 'reply')
      .eq('status', 'posted')
      .not('tweet_id', 'is', null)
      .gte('posted_at', windowStart.toISOString());

    const repliesData = replies || [];
    const repliesTotal = repliesData.length;
    const repliesScraped = repliesData.filter(r => 
      r.actual_impressions !== null && r.actual_impressions > 0
    ).length;
    
    const repliesUpdated = repliesData.filter(r => {
      if (!r.actual_impressions || r.actual_impressions === 0) return false;
      if (!r.updated_at) return false;
      return new Date(r.updated_at) > freshThreshold;
    }).length;
    
    const repliesStale = repliesData.filter(r => {
      if (!r.actual_impressions || r.actual_impressions === 0) return false;
      if (!r.updated_at) return false;
      const updatedAt = new Date(r.updated_at);
      return updatedAt <= freshThreshold && updatedAt > staleThreshold;
    }).length;
    
    const repliesMissing = repliesData.filter(r => 
      r.actual_impressions === null || r.actual_impressions === 0
    ).length;

    const repliesScrapeRate = repliesTotal > 0 ? Math.round((repliesScraped / repliesTotal) * 100) : 0;
    const repliesFreshnessRate = repliesScraped > 0 ? Math.round((repliesUpdated / repliesScraped) * 100) : 0;

    let repliesStatus: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (repliesScrapeRate < 70 || repliesFreshnessRate < 50) {
      repliesStatus = 'critical';
    } else if (repliesScrapeRate < 85 || repliesFreshnessRate < 70) {
      repliesStatus = 'warning';
    }

    repliesWindows.push({
      windowHours,
      total: repliesTotal,
      scraped: repliesScraped,
      updated: repliesUpdated,
      stale: repliesStale,
      missing: repliesMissing,
      scrapeRate: repliesScrapeRate,
      freshnessRate: repliesFreshnessRate,
      status: repliesStatus
    });
  }

  // Calculate overall metrics
  const allPosts = postsWindows[windows.indexOf(24)] || postsWindows[0];
  const allReplies = repliesWindows[windows.indexOf(24)] || repliesWindows[0];
  
  const overallScrapeRate = allPosts && allReplies
    ? Math.round(((allPosts.scraped + allReplies.scraped) / (allPosts.total + allReplies.total)) * 100)
    : 0;
  
  const overallFreshnessRate = allPosts && allReplies && (allPosts.scraped + allReplies.scraped) > 0
    ? Math.round(((allPosts.updated + allReplies.updated) / (allPosts.scraped + allReplies.scraped)) * 100)
    : 0;

  let overallStatus: 'healthy' | 'warning' | 'critical' = 'healthy';
  if (overallScrapeRate < 70 || overallFreshnessRate < 50) {
    overallStatus = 'critical';
  } else if (overallScrapeRate < 85 || overallFreshnessRate < 70) {
    overallStatus = 'warning';
  }

  return {
    timestamp: now.toISOString(),
    windows: postsWindows.map((p, i) => ({
      ...p,
      windowHours: windows[i]
    })),
    overall: {
      totalPosts: allPosts?.total || 0,
      totalReplies: allReplies?.total || 0,
      overallScrapeRate,
      overallFreshnessRate,
      status: overallStatus
    },
    breakdown: {
      posts: postsWindows,
      replies: repliesWindows
    },
    lastScrapeTime: lastScrape?.collected_at || null,
    scrapeFrequency24h: scrapeFrequency24h || 0
  };
}

/**
 * Get detailed breakdown for a specific time window
 */
export async function getTimeWindowDetails(
  windowHours: number,
  decisionType: 'post' | 'reply' | 'all' = 'all'
): Promise<{
  scraped: Array<{ decision_id: string; tweet_id: string; posted_at: string; updated_at: string | null; impressions: number }>;
  updated: Array<{ decision_id: string; tweet_id: string; posted_at: string; updated_at: string | null; impressions: number }>;
  stale: Array<{ decision_id: string; tweet_id: string; posted_at: string; updated_at: string | null; impressions: number }>;
  missing: Array<{ decision_id: string; tweet_id: string; posted_at: string; updated_at: string | null }>;
}> {
  const supabase = getSupabaseClient();
  const now = new Date();
  const windowStart = new Date(now.getTime() - windowHours * 60 * 60 * 1000);
  const staleThreshold = new Date(now.getTime() - STALE_THRESHOLD_HOURS * 60 * 60 * 1000);
  const freshThreshold = new Date(now.getTime() - FRESH_THRESHOLD_HOURS * 60 * 60 * 1000);

  const decisionTypes = decisionType === 'all' 
    ? ['single', 'thread', 'reply']
    : decisionType === 'post'
    ? ['single', 'thread']
    : ['reply'];

  const { data: allContent } = await supabase
    .from('content_metadata')
    .select('decision_id, tweet_id, posted_at, actual_impressions, updated_at, decision_type')
    .in('decision_type', decisionTypes)
    .eq('status', 'posted')
    .not('tweet_id', 'is', null)
    .gte('posted_at', windowStart.toISOString());

  const content = allContent || [];

  const scraped = content
    .filter(c => c.actual_impressions !== null && c.actual_impressions > 0)
    .map(c => ({
      decision_id: c.decision_id,
      tweet_id: c.tweet_id,
      posted_at: c.posted_at,
      updated_at: c.updated_at,
      impressions: c.actual_impressions || 0
    }));

  const updated = scraped.filter(c => {
    if (!c.updated_at) return false;
    return new Date(c.updated_at) > freshThreshold;
  });

  const stale = scraped.filter(c => {
    if (!c.updated_at) return false;
    const updatedAt = new Date(c.updated_at);
    return updatedAt <= freshThreshold && updatedAt > staleThreshold;
  });

  const missing = content
    .filter(c => c.actual_impressions === null || c.actual_impressions === 0)
    .map(c => ({
      decision_id: c.decision_id,
      tweet_id: c.tweet_id,
      posted_at: c.posted_at,
      updated_at: c.updated_at
    }));

  return { scraped, updated, stale, missing };
}






