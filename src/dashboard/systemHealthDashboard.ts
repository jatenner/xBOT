/**
 * 🔧 SYSTEM HEALTH DASHBOARD
 * Real-time view into the "mind of the boss" - what's actually happening in the system
 */

import { getSupabaseClient } from '../db/index';
import { UnifiedBrowserPool } from '../browser/UnifiedBrowserPool';
import { BrowserSemaphore } from '../browser/BrowserSemaphore';

export async function generateSystemHealthDashboard(): Promise<string> {
  try {
    const supabase = getSupabaseClient();
    const now = new Date();
    
    // Parallel fetch all system status
    const [
      queueStatus,
      scraperStatus,
      harvesterStatus,
      browserStatus,
      recentActivity,
      jobTimings
    ] = await Promise.all([
      getQueueStatus(supabase),
      getScraperStatus(supabase),
      getHarvesterStatus(supabase),
      getBrowserPoolStatus(),
      getRecentSystemActivity(supabase),
      getJobScheduleStatus(supabase)
    ]);
    
    return generateHealthHTML({
      queueStatus,
      scraperStatus,
      harvesterStatus,
      browserStatus,
      recentActivity,
      jobTimings,
      timestamp: now
    });
    
  } catch (error: any) {
    console.error('[HEALTH_DASHBOARD] Error:', error.message);
    return generateErrorHTML(error.message);
  }
}

// ============================================================
// DATA FETCHERS
// ============================================================

async function getQueueStatus(supabase: any) {
  const now = new Date().toISOString();
  
  // Get queued items by type
  const { data: queued } = await supabase
    .from('content_metadata')
    .select('decision_type, scheduled_at, quality_score, created_at')
    .eq('status', 'queued')
    .order('scheduled_at', { ascending: true });
  
  const byType = {
    singles: queued?.filter((q: any) => q.decision_type === 'single') || [],
    threads: queued?.filter((q: any) => q.decision_type === 'thread') || [],
    replies: queued?.filter((q: any) => q.decision_type === 'reply') || []
  };
  
  // Get ready-to-post counts (within next 5 minutes)
  const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  const readySingles = byType.singles.filter((s: any) => s.scheduled_at <= fiveMinutesFromNow);
  const readyThreads = byType.threads.filter((t: any) => t.scheduled_at <= fiveMinutesFromNow);
  const readyReplies = byType.replies.filter((r: any) => r.scheduled_at <= fiveMinutesFromNow);
  
  return {
    total: queued?.length || 0,
    singles: {
      total: byType.singles.length,
      ready: readySingles.length,
      upcoming: byType.singles.slice(0, 5) // Next 5
    },
    threads: {
      total: byType.threads.length,
      ready: readyThreads.length,
      upcoming: byType.threads.slice(0, 3) // Next 3
    },
    replies: {
      total: byType.replies.length,
      ready: readyReplies.length,
      upcoming: byType.replies.slice(0, 5) // Next 5
    }
  };
}

async function getScraperStatus(supabase: any) {
  // Check when scraper last ran
  const { data: lastScrape } = await supabase
    .from('outcomes')
    .select('collected_at, tweet_id')
    .eq('data_source', 'orchestrator_v2')
    .order('collected_at', { ascending: false })
    .limit(1)
    .single();
  
  // Check how many posts need scraping
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
  const { data: needsScraping } = await supabase
    .from('content_metadata')
    .select('tweet_id, posted_at, actual_impressions')
    .eq('status', 'posted')
    .not('tweet_id', 'is', null)
    .gte('created_at', threeDaysAgo);
  
  const unscraped = needsScraping?.filter((p: any) => !p.actual_impressions) || [];
  const scraped = needsScraping?.filter((p: any) => p.actual_impressions) || [];
  
  const lastScrapeTime = lastScrape?.collected_at ? new Date(String(lastScrape.collected_at)) : null;
  const minutesSinceLastScrape = lastScrapeTime 
    ? Math.round((Date.now() - lastScrapeTime.getTime()) / (1000 * 60))
    : 999;
  
  return {
    lastScrapeTime: lastScrapeTime?.toISOString() || 'Never',
    minutesSinceLastScrape,
    isHealthy: minutesSinceLastScrape < 30, // Should run every 20min
    needsScraping: unscraped.length,
    scraped: scraped.length,
    totalRecent: needsScraping?.length || 0,
    coverage: needsScraping?.length > 0 
      ? Math.round((scraped.length / needsScraping.length) * 100) 
      : 0,
    nextBatch: unscraped.slice(0, 15).map((p: any) => ({
      tweet_id: p.tweet_id,
      posted_at: p.posted_at,
      age_minutes: Math.round((Date.now() - new Date(p.posted_at).getTime()) / (1000 * 60))
    }))
  };
}

async function getHarvesterStatus(supabase: any) {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  
  // Tweet harvester opportunities
  const { data: tweetHarvested } = await supabase
    .from('reply_opportunities')
    .select('created_at, tier, like_count')
    .eq('discovery_method', 'tweet_based_harvester')
    .gte('created_at', oneDayAgo);
  
  // Account harvester opportunities
  const { data: accountHarvested } = await supabase
    .from('reply_opportunities')
    .select('created_at, tier, like_count, account_username')
    .or('discovery_method.is.null,discovery_method.neq.tweet_based_harvester')
    .gte('created_at', oneDayAgo);
  
  // Available opportunities (not replied to yet)
  const { data: available } = await supabase
    .from('reply_opportunities')
    .select('tier, target_username, like_count, created_at')
    .eq('replied_to', false)
    .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(10);
  
  const tweetHarvestLast24h = tweetHarvested?.length || 0;
  const accountHarvestLast24h = accountHarvested?.length || 0;
  const last1h = [...(tweetHarvested || []), ...(accountHarvested || [])].filter(
    (o: any) => new Date(o.created_at) > new Date(oneHourAgo)
  );
  
  return {
    tweetHarvester: {
      last24h: tweetHarvestLast24h,
      last1h: last1h.filter((o: any) => tweetHarvested?.includes(o)).length,
      isActive: tweetHarvestLast24h > 0
    },
    accountHarvester: {
      last24h: accountHarvestLast24h,
      last1h: last1h.filter((o: any) => accountHarvested?.includes(o)).length,
      isActive: accountHarvestLast24h > 0
    },
    pool: {
      total: available?.length || 0,
      platinum: available?.filter((a: any) => a.tier === 'Platinum' || a.tier === 'golden').length || 0,
      diamond: available?.filter((a: any) => a.tier === 'Diamond').length || 0,
      golden: available?.filter((a: any) => a.tier === 'Golden' || a.tier === 'acceptable').length || 0
    },
    recentOpportunities: available || []
  };
}

function getBrowserPoolStatus() {
  const pool = UnifiedBrowserPool.getInstance();
  const semaphore = BrowserSemaphore.getInstance();
  
  const poolMetrics = pool.getMetrics();
  const semaphoreStatus = semaphore.getStatus();
  
  return {
    pool: {
      totalOperations: poolMetrics.totalOperations,
      successfulOperations: poolMetrics.successfulOperations,
      failedOperations: poolMetrics.failedOperations,
      successRate: poolMetrics.totalOperations > 0 
        ? Math.round((poolMetrics.successfulOperations / poolMetrics.totalOperations) * 100)
        : 100,
      activeContexts: poolMetrics.activeContexts,
      maxContexts: 8,
      queueLength: poolMetrics.queueLength,
      peakQueue: poolMetrics.peakQueue
    },
    semaphore: {
      active: semaphoreStatus.active,
      queued: semaphoreStatus.queued,
      capacity: semaphoreStatus.capacity
    }
  };
}

async function getRecentSystemActivity(supabase: any) {
  const last30min = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  
  const { data: recentPosts } = await supabase
    .from('content_metadata')
    .select('decision_type, posted_at, content, generator_name, status')
    .eq('status', 'posted')
    .gte('posted_at', last30min)
    .order('posted_at', { ascending: false })
    .limit(10);
  
  const { data: recentFailures } = await supabase
    .from('content_metadata')
    .select('decision_type, error_message, updated_at')
    .eq('status', 'failed')
    .gte('updated_at', last30min)
    .order('updated_at', { ascending: false })
    .limit(5);
  
  return {
    recentPosts: recentPosts || [],
    recentFailures: recentFailures || [],
    postsLast30min: recentPosts?.length || 0,
    failuresLast30min: recentFailures?.length || 0
  };
}

async function getJobScheduleStatus(supabase: any) {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  
  // Get last posting times to infer job health
  const { data: lastContent } = await supabase
    .from('content_metadata')
    .select('created_at')
    .in('decision_type', ['single', 'thread'])
    .eq('status', 'queued')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  
  const { data: lastReply } = await supabase
    .from('content_metadata')
    .select('created_at')
    .eq('decision_type', 'reply')
    .eq('status', 'queued')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  
  const lastContentGen = lastContent?.created_at ? new Date(String(lastContent.created_at)) : null;
  const lastReplyGen = lastReply?.created_at ? new Date(String(lastReply.created_at)) : null;
  
  const minutesSinceContentGen = lastContentGen 
    ? Math.round((Date.now() - lastContentGen.getTime()) / (1000 * 60))
    : 999;
  const minutesSinceReplyGen = lastReplyGen
    ? Math.round((Date.now() - lastReplyGen.getTime()) / (1000 * 60))
    : 999;
  
  return {
    contentGeneration: {
      lastRun: lastContentGen?.toISOString() || 'Never',
      minutesAgo: minutesSinceContentGen,
      isHealthy: minutesSinceContentGen < 130, // Should run every 120min
      nextExpected: lastContentGen ? new Date(lastContentGen.getTime() + 120 * 60 * 1000).toISOString() : 'Unknown'
    },
    replyGeneration: {
      lastRun: lastReplyGen?.toISOString() || 'Never',
      minutesAgo: minutesSinceReplyGen,
      isHealthy: minutesSinceReplyGen < 35, // Should run every 30min
      nextExpected: lastReplyGen ? new Date(lastReplyGen.getTime() + 30 * 60 * 1000).toISOString() : 'Unknown'
    }
  };
}

// ============================================================
// HTML GENERATOR
// ============================================================

function generateHealthHTML(data: any): string {
  const timestamp = new Date(data.timestamp).toLocaleString();
  
  return `<!DOCTYPE html>
<html>
<head>
    <title>xBOT System Health - Real-Time</title>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        ${getHealthStyles()}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🧠 xBOT System Health - Real-Time</h1>
            <p>The "mind of the boss" - Live system monitoring</p>
            <p style="color: #666; font-size: 14px;">Last updated: ${timestamp}</p>
        </div>

        <div class="nav-tabs">
            <a href="/dashboard/recent?token=xbot-admin-2025" class="nav-tab">📅 Recent</a>
            <a href="/dashboard/posts?token=xbot-admin-2025" class="nav-tab">📊 Posts</a>
            <a href="/dashboard/replies?token=xbot-admin-2025" class="nav-tab">💬 Replies</a>
            <a href="/dashboard/formatting?token=xbot-admin-2025" class="nav-tab">🎨 Formatting</a>
            <a href="/dashboard/health?token=xbot-admin-2025" class="nav-tab active">🔧 System Health</a>
        </div>

        <!-- POSTING QUEUE STATUS -->
        <div class="section">
            <h2>📮 Posting Queue Status</h2>
            <div class="grid-3">
                <div class="health-card ${data.queueStatus.singles.ready > 0 ? 'status-good' : 'status-warning'}">
                    <div class="health-label">Singles Queued</div>
                    <div class="health-value">${data.queueStatus.singles.total}</div>
                    <div class="health-detail">Ready now: ${data.queueStatus.singles.ready}</div>
                </div>
                <div class="health-card ${data.queueStatus.threads.ready > 0 ? 'status-good' : 'status-neutral'}">
                    <div class="health-label">Threads Queued</div>
                    <div class="health-value">${data.queueStatus.threads.total}</div>
                    <div class="health-detail">Ready now: ${data.queueStatus.threads.ready}</div>
                </div>
                <div class="health-card ${data.queueStatus.replies.ready > 0 ? 'status-good' : 'status-warning'}">
                    <div class="health-label">Replies Queued</div>
                    <div class="health-value">${data.queueStatus.replies.total}</div>
                    <div class="health-detail">Ready now: ${data.queueStatus.replies.ready}</div>
                </div>
            </div>
            
            <h3>📋 Next Up:</h3>
            <div class="upcoming-grid">
                <div class="upcoming-section">
                    <h4>Singles (${data.queueStatus.singles.upcoming.length})</h4>
                    ${data.queueStatus.singles.upcoming.map((item: any) => {
                        const scheduledTime = new Date(item.scheduled_at);
                        const minutesUntil = Math.round((scheduledTime.getTime() - Date.now()) / (1000 * 60));
                        const timeLabel = minutesUntil < 0 ? 'NOW' : `in ${minutesUntil}m`;
                        return `<div class="upcoming-item">
                            <span class="time-badge ${minutesUntil <= 0 ? 'ready-now' : ''}">${timeLabel}</span>
                            Quality: ${((item.quality_score || 0) * 100).toFixed(0)}%
                        </div>`;
                    }).join('')}
                    ${data.queueStatus.singles.upcoming.length === 0 ? '<div class="no-data">None queued</div>' : ''}
                </div>
                <div class="upcoming-section">
                    <h4>Threads (${data.queueStatus.threads.upcoming.length})</h4>
                    ${data.queueStatus.threads.upcoming.map((item: any) => {
                        const scheduledTime = new Date(item.scheduled_at);
                        const minutesUntil = Math.round((scheduledTime.getTime() - Date.now()) / (1000 * 60));
                        const timeLabel = minutesUntil < 0 ? 'NOW' : `in ${minutesUntil}m`;
                        return `<div class="upcoming-item">
                            <span class="time-badge ${minutesUntil <= 0 ? 'ready-now' : ''}">${timeLabel}</span>
                            Quality: ${((item.quality_score || 0) * 100).toFixed(0)}%
                        </div>`;
                    }).join('')}
                    ${data.queueStatus.threads.upcoming.length === 0 ? '<div class="no-data">None queued</div>' : ''}
                </div>
                <div class="upcoming-section">
                    <h4>Replies (${data.queueStatus.replies.upcoming.length})</h4>
                    ${data.queueStatus.replies.upcoming.map((item: any) => {
                        const scheduledTime = new Date(item.scheduled_at);
                        const minutesUntil = Math.round((scheduledTime.getTime() - Date.now()) / (1000 * 60));
                        const timeLabel = minutesUntil < 0 ? 'NOW' : `in ${minutesUntil}m`;
                        return `<div class="upcoming-item">
                            <span class="time-badge ${minutesUntil <= 0 ? 'ready-now' : ''}">${timeLabel}</span>
                            Quality: ${((item.quality_score || 0) * 100).toFixed(0)}%
                        </div>`;
                    }).join('')}
                    ${data.queueStatus.replies.upcoming.length === 0 ? '<div class="no-data">None queued</div>' : ''}
                </div>
            </div>
        </div>

        <!-- METRICS SCRAPER STATUS -->
        <div class="section">
            <h2>📊 Metrics Scraper Status</h2>
            <div class="grid-4">
                <div class="health-card ${data.scraperStatus.isHealthy ? 'status-good' : 'status-critical'}">
                    <div class="health-label">Scraper Status</div>
                    <div class="health-value">${data.scraperStatus.isHealthy ? '✅ HEALTHY' : '❌ STALE'}</div>
                    <div class="health-detail">Last ran: ${data.scraperStatus.minutesSinceLastScrape < 999 ? data.scraperStatus.minutesSinceLastScrape + 'm ago' : 'Never'}</div>
                </div>
                <div class="health-card ${data.scraperStatus.needsScraping === 0 ? 'status-good' : 'status-warning'}">
                    <div class="health-label">Needs Scraping</div>
                    <div class="health-value">${data.scraperStatus.needsScraping}</div>
                    <div class="health-detail">Out of ${data.scraperStatus.totalRecent} recent posts</div>
                </div>
                <div class="health-card ${data.scraperStatus.coverage > 70 ? 'status-good' : 'status-warning'}">
                    <div class="health-label">Coverage</div>
                    <div class="health-value">${data.scraperStatus.coverage}%</div>
                    <div class="health-detail">${data.scraperStatus.scraped} posts have metrics</div>
                </div>
                <div class="health-card status-neutral">
                    <div class="health-label">Next Scrape</div>
                    <div class="health-value">20m cycle</div>
                    <div class="health-detail">Auto-runs every 20 minutes</div>
                </div>
            </div>
            
            <h3>🔍 Next Batch to Scrape (Top 10):</h3>
            <table class="compact-table">
                <thead>
                    <tr>
                        <th>Tweet ID</th>
                        <th>Age</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.scraperStatus.nextBatch.slice(0, 10).map((item: any) => `
                        <tr>
                            <td><code>${item.tweet_id.substring(0, 16)}...</code></td>
                            <td>${item.age_minutes}m old</td>
                            <td><span class="badge badge-warning">Awaiting scrape</span></td>
                        </tr>
                    `).join('')}
                    ${data.scraperStatus.nextBatch.length === 0 ? '<tr><td colspan="3" style="text-align: center; color: #999;">All caught up!</td></tr>' : ''}
                </tbody>
            </table>
        </div>

        <!-- HARVESTERS STATUS -->
        <div class="section">
            <h2>🌾 Harvesters Status</h2>
            <div class="grid-2">
                <div class="health-card ${data.harvesterStatus.tweetHarvester.isActive ? 'status-good' : 'status-warning'}">
                    <div class="health-label">Tweet Harvester</div>
                    <div class="health-value">${data.harvesterStatus.tweetHarvester.last24h}</div>
                    <div class="health-detail">Last 24h: ${data.harvesterStatus.tweetHarvester.last24h} opps</div>
                    <div class="health-detail">Last 1h: ${data.harvesterStatus.tweetHarvester.last1h} opps</div>
                </div>
                <div class="health-card ${data.harvesterStatus.accountHarvester.isActive ? 'status-good' : 'status-warning'}">
                    <div class="health-label">Account Harvester</div>
                    <div class="health-value">${data.harvesterStatus.accountHarvester.last24h}</div>
                    <div class="health-detail">Last 24h: ${data.harvesterStatus.accountHarvester.last24h} opps</div>
                    <div class="health-detail">Last 1h: ${data.harvesterStatus.accountHarvester.last1h} opps</div>
                </div>
            </div>
            
            <h3>🎯 Opportunity Pool:</h3>
            <div class="grid-4">
                <div class="pool-card">
                    <div class="pool-label">Total Available</div>
                    <div class="pool-value">${data.harvesterStatus.pool.total}</div>
                </div>
                <div class="pool-card tier-platinum">
                    <div class="pool-label">Platinum Tier</div>
                    <div class="pool-value">${data.harvesterStatus.pool.platinum}</div>
                </div>
                <div class="pool-card tier-diamond">
                    <div class="pool-label">Diamond Tier</div>
                    <div class="pool-value">${data.harvesterStatus.pool.diamond}</div>
                </div>
                <div class="pool-card tier-golden">
                    <div class="pool-label">Golden Tier</div>
                    <div class="pool-value">${data.harvesterStatus.pool.golden}</div>
                </div>
            </div>
            
            <h3>🔥 Recent Opportunities:</h3>
            <table class="compact-table">
                <thead>
                    <tr>
                        <th>Account</th>
                        <th>Tier</th>
                        <th>Likes</th>
                        <th>Found</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.harvesterStatus.recentOpportunities.slice(0, 10).map((opp: any) => {
                        const age = Math.round((Date.now() - new Date(opp.created_at).getTime()) / (1000 * 60));
                        return `
                        <tr>
                            <td><strong>@${opp.target_username}</strong></td>
                            <td><span class="tier-badge tier-${(opp.tier || 'unknown').toLowerCase()}">${opp.tier || 'Unknown'}</span></td>
                            <td>${(opp.like_count || 0).toLocaleString()}</td>
                            <td>${age}m ago</td>
                        </tr>
                    `}).join('')}
                    ${data.harvesterStatus.recentOpportunities.length === 0 ? '<tr><td colspan="4" style="text-align: center; color: #999;">No opportunities</td></tr>' : ''}
                </tbody>
            </table>
        </div>

        <!-- BROWSER POOL STATUS -->
        <div class="section">
            <h2>🌐 Browser Pool Status</h2>
            <div class="grid-4">
                <div class="health-card ${data.browserStatus.pool.successRate > 80 ? 'status-good' : 'status-warning'}">
                    <div class="health-label">Success Rate</div>
                    <div class="health-value">${data.browserStatus.pool.successRate}%</div>
                    <div class="health-detail">${data.browserStatus.pool.successfulOperations}/${data.browserStatus.pool.totalOperations} ops</div>
                </div>
                <div class="health-card ${data.browserStatus.pool.activeContexts < data.browserStatus.pool.maxContexts ? 'status-good' : 'status-warning'}">
                    <div class="health-label">Active Contexts</div>
                    <div class="health-value">${data.browserStatus.pool.activeContexts}/${data.browserStatus.pool.maxContexts}</div>
                    <div class="health-detail">${data.browserStatus.pool.maxContexts - data.browserStatus.pool.activeContexts} available</div>
                </div>
                <div class="health-card ${data.browserStatus.pool.queueLength === 0 ? 'status-good' : 'status-warning'}">
                    <div class="health-label">Queue Length</div>
                    <div class="health-value">${data.browserStatus.pool.queueLength}</div>
                    <div class="health-detail">Peak: ${data.browserStatus.pool.peakQueue}</div>
                </div>
                <div class="health-card ${data.browserStatus.semaphore.queued === 0 ? 'status-good' : 'status-warning'}">
                    <div class="health-label">Semaphore Queue</div>
                    <div class="health-value">${data.browserStatus.semaphore.queued}</div>
                    <div class="health-detail">Active: ${data.browserStatus.semaphore.active.join(', ') || 'None'}</div>
                </div>
            </div>
            
            ${data.browserStatus.pool.failedOperations > 0 ? `
            <div class="alert alert-warning">
                ⚠️ ${data.browserStatus.pool.failedOperations} browser operations failed recently
            </div>
            ` : ''}
        </div>

        <!-- JOB SCHEDULE STATUS -->
        <div class="section">
            <h2>⏰ Job Schedule Status</h2>
            <div class="grid-2">
                <div class="health-card ${data.jobTimings.contentGeneration.isHealthy ? 'status-good' : 'status-critical'}">
                    <div class="health-label">Content Generation</div>
                    <div class="health-value">${data.jobTimings.contentGeneration.isHealthy ? '✅ ACTIVE' : '❌ STALE'}</div>
                    <div class="health-detail">Last run: ${data.jobTimings.contentGeneration.minutesAgo < 999 ? data.jobTimings.contentGeneration.minutesAgo + 'm ago' : 'Never'}</div>
                    <div class="health-detail">Expected: Every 120 minutes</div>
                </div>
                <div class="health-card ${data.jobTimings.replyGeneration.isHealthy ? 'status-good' : 'status-critical'}">
                    <div class="health-label">Reply Generation</div>
                    <div class="health-value">${data.jobTimings.replyGeneration.isHealthy ? '✅ ACTIVE' : '❌ STALE'}</div>
                    <div class="health-detail">Last run: ${data.jobTimings.replyGeneration.minutesAgo < 999 ? data.jobTimings.replyGeneration.minutesAgo + 'm ago' : 'Never'}</div>
                    <div class="health-detail">Expected: Every 30 minutes</div>
                </div>
            </div>
        </div>

        <!-- RECENT ACTIVITY -->
        <div class="section">
            <h2>🔄 Recent Activity (Last 30 Minutes)</h2>
            <div class="grid-2">
                <div class="health-card ${data.recentActivity.postsLast30min > 0 ? 'status-good' : 'status-neutral'}">
                    <div class="health-label">Posts Published</div>
                    <div class="health-value">${data.recentActivity.postsLast30min}</div>
                    <div class="health-detail">System is posting</div>
                </div>
                <div class="health-card ${data.recentActivity.failuresLast30min === 0 ? 'status-good' : 'status-warning'}">
                    <div class="health-label">Failures</div>
                    <div class="health-value">${data.recentActivity.failuresLast30min}</div>
                    <div class="health-detail">${data.recentActivity.failuresLast30min === 0 ? 'All systems operational' : 'Some errors detected'}</div>
                </div>
            </div>
            
            <h3>📝 Recent Posts:</h3>
            <table class="compact-table">
                <thead>
                    <tr>
                        <th>Type</th>
                        <th>Generator</th>
                        <th>Content</th>
                        <th>Posted</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.recentActivity.recentPosts.map((post: any) => {
                        const age = Math.round((Date.now() - new Date(post.posted_at).getTime()) / (1000 * 60));
                        return `
                        <tr>
                            <td><span class="type-badge type-${post.decision_type}">${post.decision_type}</span></td>
                            <td><span class="badge">${post.generator_name || 'unknown'}</span></td>
                            <td style="max-width: 300px;">${(post.content || '').substring(0, 60)}...</td>
                            <td>${age}m ago</td>
                        </tr>
                    `}).join('')}
                    ${data.recentActivity.recentPosts.length === 0 ? '<tr><td colspan="4" style="text-align: center; color: #999;">No recent posts</td></tr>' : ''}
                </tbody>
            </table>
            
            ${data.recentActivity.failuresLast30min > 0 ? `
            <h3>❌ Recent Failures:</h3>
            <div class="failures-list">
                ${data.recentActivity.recentFailures.map((failure: any) => {
                    const age = Math.round((Date.now() - new Date(failure.updated_at).getTime()) / (1000 * 60));
                    return `
                    <div class="failure-item">
                        <strong>${failure.decision_type}</strong> - ${age}m ago
                        <div class="error-msg">${failure.error_message || 'Unknown error'}</div>
                    </div>
                `}).join('')}
            </div>
            ` : ''}
        </div>

        <!-- SYSTEM HEALTH SUMMARY -->
        <div class="section">
            <h2>🎯 System Health Summary</h2>
            <div class="health-summary">
                <div class="summary-item ${data.queueStatus.singles.total >= 4 ? 'summary-good' : 'summary-warning'}">
                    <span class="summary-icon">${data.queueStatus.singles.total >= 4 ? '✅' : '⚠️'}</span>
                    <span class="summary-text">Content Queue: ${data.queueStatus.singles.total >= 4 ? 'Healthy' : 'Low'} (${data.queueStatus.singles.total} queued, need 4+ for 2hr buffer)</span>
                </div>
                <div class="summary-item ${data.queueStatus.replies.total >= 8 ? 'summary-good' : 'summary-warning'}">
                    <span class="summary-icon">${data.queueStatus.replies.total >= 8 ? '✅' : '⚠️'}</span>
                    <span class="summary-text">Reply Queue: ${data.queueStatus.replies.total >= 8 ? 'Healthy' : 'Low'} (${data.queueStatus.replies.total} queued, need 8+ for 2hr buffer)</span>
                </div>
                <div class="summary-item ${data.scraperStatus.isHealthy ? 'summary-good' : 'summary-critical'}">
                    <span class="summary-icon">${data.scraperStatus.isHealthy ? '✅' : '❌'}</span>
                    <span class="summary-text">Metrics Scraper: ${data.scraperStatus.isHealthy ? 'Running' : 'NOT RUNNING'} (last ran ${data.scraperStatus.minutesSinceLastScrape}m ago)</span>
                </div>
                <div class="summary-item ${data.harvesterStatus.pool.total > 20 ? 'summary-good' : 'summary-warning'}">
                    <span class="summary-icon">${data.harvesterStatus.pool.total > 20 ? '✅' : '⚠️'}</span>
                    <span class="summary-text">Opportunity Pool: ${data.harvesterStatus.pool.total > 20 ? 'Healthy' : 'Low'} (${data.harvesterStatus.pool.total} available)</span>
                </div>
                <div class="summary-item ${data.browserStatus.pool.successRate > 80 ? 'summary-good' : 'summary-warning'}">
                    <span class="summary-icon">${data.browserStatus.pool.successRate > 80 ? '✅' : '⚠️'}</span>
                    <span class="summary-text">Browser Pool: ${data.browserStatus.pool.successRate}% success rate (${data.browserStatus.pool.activeContexts}/${data.browserStatus.pool.maxContexts} active)</span>
                </div>
                <div class="summary-item ${data.recentActivity.failuresLast30min === 0 ? 'summary-good' : 'summary-warning'}">
                    <span class="summary-icon">${data.recentActivity.failuresLast30min === 0 ? '✅' : '⚠️'}</span>
                    <span class="summary-text">Error Rate: ${data.recentActivity.failuresLast30min === 0 ? 'Clean' : data.recentActivity.failuresLast30min + ' errors'} (last 30 minutes)</span>
                </div>
            </div>
        </div>

        <div class="footer">
            <p>🔄 Auto-refreshes every 30 seconds | Last updated: ${timestamp}</p>
        </div>
    </div>
    
    <script>
        // Auto-refresh every 30 seconds
        setTimeout(() => location.reload(), 30000);
    </script>
</body>
</html>`;
}

function getHealthStyles(): string {
  return `
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
        }
        .container {
            max-width: 1400px;
            margin: 0 auto;
            background: white;
            border-radius: 20px;
            padding: 30px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }
        .header {
            text-align: center;
            margin-bottom: 40px;
            padding-bottom: 20px;
            border-bottom: 3px solid #667eea;
        }
        .header h1 {
            margin: 0;
            color: #2d3748;
            font-size: 36px;
        }
        .nav-tabs {
            display: flex;
            gap: 10px;
            margin-bottom: 30px;
            flex-wrap: wrap;
        }
        .nav-tab {
            padding: 12px 24px;
            background: white;
            border-radius: 8px;
            text-decoration: none;
            color: #333;
            font-weight: 600;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            transition: all 0.3s;
        }
        .nav-tab.active {
            background: #667eea;
            color: white;
        }
        .nav-tab:hover {
            background: #5568d3;
            color: white;
            transform: translateY(-2px);
        }
        .section {
            margin-bottom: 40px;
        }
        .section h2 {
            color: #2d3748;
            border-left: 4px solid #667eea;
            padding-left: 15px;
            margin-bottom: 20px;
        }
        .section h3 {
            color: #4a5568;
            font-size: 18px;
            margin-top: 25px;
            margin-bottom: 15px;
        }
        .grid-2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
        .grid-3 { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; }
        .grid-4 { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; }
        
        .health-card {
            background: white;
            padding: 20px;
            border-radius: 12px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            border-left: 5px solid #cbd5e0;
            transition: transform 0.2s;
        }
        .health-card:hover {
            transform: translateY(-4px);
            box-shadow: 0 6px 20px rgba(0,0,0,0.15);
        }
        .status-good { border-left-color: #48bb78; background: #f0fff4; }
        .status-warning { border-left-color: #ed8936; background: #fffaf0; }
        .status-critical { border-left-color: #f56565; background: #fff5f5; }
        .status-neutral { border-left-color: #4299e1; background: #ebf8ff; }
        
        .health-label {
            font-size: 14px;
            color: #718096;
            text-transform: uppercase;
            font-weight: 600;
            letter-spacing: 0.5px;
            margin-bottom: 8px;
        }
        .health-value {
            font-size: 32px;
            font-weight: bold;
            color: #2d3748;
            margin-bottom: 8px;
        }
        .health-detail {
            font-size: 13px;
            color: #a0aec0;
        }
        
        .upcoming-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin-top: 15px;
        }
        .upcoming-section {
            background: #f7fafc;
            padding: 15px;
            border-radius: 8px;
        }
        .upcoming-section h4 {
            margin: 0 0 10px 0;
            color: #2d3748;
        }
        .upcoming-item {
            padding: 8px 12px;
            background: white;
            border-radius: 6px;
            margin-bottom: 8px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .time-badge {
            background: #4299e1;
            color: white;
            padding: 4px 10px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 600;
        }
        .time-badge.ready-now {
            background: #48bb78;
            animation: pulse 2s infinite;
        }
        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.7; }
        }
        
        .compact-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 15px;
            background: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .compact-table thead {
            background: #667eea;
            color: white;
        }
        .compact-table th {
            padding: 12px;
            text-align: left;
            font-weight: 600;
        }
        .compact-table td {
            padding: 10px 12px;
            border-bottom: 1px solid #e2e8f0;
        }
        .compact-table tbody tr:hover {
            background: #f7fafc;
        }
        
        .badge {
            background: #667eea;
            color: white;
            padding: 4px 12px;
            border-radius: 6px;
            font-size: 12px;
            font-weight: 600;
        }
        .badge-warning {
            background: #ed8936;
        }
        
        .tier-badge {
            padding: 4px 10px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
        }
        .tier-platinum { background: #e6fffa; color: #047857; }
        .tier-diamond { background: #fef3c7; color: #92400e; }
        .tier-golden { background: #fef3c7; color: #b45309; }
        .tier-acceptable { background: #e0e7ff; color: #3730a3; }
        
        .type-badge {
            padding: 4px 10px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 600;
        }
        .type-single { background: #dbeafe; color: #1e40af; }
        .type-thread { background: #fce7f3; color: #9f1239; }
        .type-reply { background: #d1fae5; color: #065f46; }
        
        .pool-card {
            background: #f7fafc;
            padding: 15px;
            border-radius: 8px;
            text-align: center;
        }
        .pool-label {
            font-size: 12px;
            color: #718096;
            margin-bottom: 8px;
            text-transform: uppercase;
            font-weight: 600;
        }
        .pool-value {
            font-size: 28px;
            font-weight: bold;
            color: #2d3748;
        }
        
        .alert {
            padding: 15px;
            border-radius: 8px;
            margin-top: 15px;
        }
        .alert-warning {
            background: #fffbeb;
            border-left: 4px solid #f59e0b;
            color: #92400e;
        }
        
        .health-summary {
            background: #f7fafc;
            padding: 20px;
            border-radius: 12px;
        }
        .summary-item {
            padding: 12px;
            margin-bottom: 10px;
            background: white;
            border-radius: 8px;
            display: flex;
            align-items: center;
            gap: 12px;
        }
        .summary-icon {
            font-size: 24px;
        }
        .summary-text {
            color: #2d3748;
            font-weight: 500;
        }
        .summary-good { border-left: 4px solid #48bb78; }
        .summary-warning { border-left: 4px solid #ed8936; }
        .summary-critical { border-left: 4px solid #f56565; }
        
        .failures-list {
            margin-top: 15px;
        }
        .failure-item {
            background: #fff5f5;
            padding: 12px;
            border-radius: 8px;
            border-left: 4px solid #f56565;
            margin-bottom: 10px;
        }
        .error-msg {
            font-size: 12px;
            color: #742a2a;
            margin-top: 5px;
            font-family: monospace;
        }
        
        .no-data {
            text-align: center;
            color: #a0aec0;
            padding: 20px;
            font-style: italic;
        }
        
        .footer {
            text-align: center;
            padding-top: 20px;
            border-top: 2px solid #e2e8f0;
            color: #718096;
            font-size: 14px;
        }
        
        code {
            background: #edf2f7;
            padding: 2px 6px;
            border-radius: 4px;
            font-family: 'Courier New', monospace;
            font-size: 12px;
        }
  `;
}

function generateErrorHTML(error: string): string {
  return `<!DOCTYPE html>
<html>
<head>
    <title>System Health - Error</title>
    <meta charset="UTF-8">
</head>
<body style="font-family: sans-serif; padding: 40px; background: #f7fafc;">
    <div style="max-width: 800px; margin: 0 auto; background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
        <h1 style="color: #f56565;">❌ Dashboard Error</h1>
        <p>Failed to generate system health dashboard.</p>
        <pre style="background: #fff5f5; padding: 20px; border-radius: 8px; overflow-x: auto;">${error}</pre>
        <a href="/dashboard/health?token=xbot-admin-2025" style="display: inline-block; margin-top: 20px; padding: 12px 24px; background: #667eea; color: white; text-decoration: none; border-radius: 8px;">Retry</a>
    </div>
</body>
</html>`;
}

