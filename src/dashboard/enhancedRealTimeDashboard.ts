/**
 * 🚀 ENHANCED REAL-TIME SYSTEM DASHBOARD
 * 
 * Features:
 * - Live data updates (auto-refreshing every 5 seconds)
 * - Action buttons for system control
 * - Real-time error logs
 * - System performance metrics
 * - Manual job triggers
 * - Browser restart controls
 * - Queue management
 */

import { getSupabaseClient } from '../db/index';
import { UnifiedBrowserPool } from '../browser/UnifiedBrowserPool';
import { BrowserSemaphore } from '../browser/BrowserSemaphore';

interface DashboardData {
  queueStatus: any;
  scraperStatus: any;
  harvesterStatus: any;
  browserStatus: any;
  recentActivity: any;
  jobTimings: any;
  systemErrors: any;
  performanceMetrics: any;
  timestamp: Date;
}

export async function generateEnhancedDashboard(): Promise<string> {
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
      jobTimings,
      systemErrors,
      performanceMetrics
    ] = await Promise.all([
      getQueueStatus(supabase),
      getScraperStatus(supabase),
      getHarvesterStatus(supabase),
      getBrowserPoolStatus(),
      getRecentSystemActivity(supabase),
      getJobScheduleStatus(supabase),
      getSystemErrors(supabase),
      getPerformanceMetrics()
    ]);
    
    const data: DashboardData = {
      queueStatus,
      scraperStatus,
      harvesterStatus,
      browserStatus,
      recentActivity,
      jobTimings,
      systemErrors,
      performanceMetrics,
      timestamp: now
    };
    
    return generateEnhancedHTML(data);
    
  } catch (error: any) {
    console.error('[ENHANCED_DASHBOARD] Error:', error.message);
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
    .select('decision_type, scheduled_at, quality_score, created_at, content')
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
      upcoming: byType.singles.slice(0, 5)
    },
    threads: {
      total: byType.threads.length,
      ready: readyThreads.length,
      upcoming: byType.threads.slice(0, 3)
    },
    replies: {
      total: byType.replies.length,
      ready: readyReplies.length,
      upcoming: byType.replies.slice(0, 5)
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
    isHealthy: minutesSinceLastScrape < 30,
    needsScraping: unscraped.length,
    scraped: scraped.length,
    totalRecent: needsScraping?.length || 0,
    coverage: needsScraping?.length > 0 
      ? Math.round((scraped.length / needsScraping.length) * 100) 
      : 0,
    nextBatch: unscraped.slice(0, 10)
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
  
  // Available opportunities
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
  try {
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
  } catch (error) {
    return {
      pool: {
        totalOperations: 0,
        successfulOperations: 0,
        failedOperations: 0,
        successRate: 0,
        activeContexts: 0,
        maxContexts: 8,
        queueLength: 0,
        peakQueue: 0
      },
      semaphore: {
        active: [],
        queued: 0,
        capacity: 3
      }
    };
  }
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
    .select('decision_type, error_message, updated_at, content')
    .eq('status', 'failed')
    .gte('updated_at', last30min)
    .order('updated_at', { ascending: false })
    .limit(10);
  
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
      isHealthy: minutesSinceContentGen < 130,
      nextExpected: lastContentGen ? new Date(lastContentGen.getTime() + 120 * 60 * 1000).toISOString() : 'Unknown'
    },
    replyGeneration: {
      lastRun: lastReplyGen?.toISOString() || 'Never',
      minutesAgo: minutesSinceReplyGen,
      isHealthy: minutesSinceReplyGen < 35,
      nextExpected: lastReplyGen ? new Date(lastReplyGen.getTime() + 30 * 60 * 1000).toISOString() : 'Unknown'
    }
  };
}

async function getSystemErrors(supabase: any) {
  const last1hour = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  
  // Get recent failures
  const { data: failures } = await supabase
    .from('content_metadata')
    .select('decision_type, error_message, updated_at, content')
    .eq('status', 'failed')
    .gte('updated_at', last1hour)
    .order('updated_at', { ascending: false })
    .limit(20);
  
  // Group errors by type
  const errorGroups: Record<string, number> = {};
  failures?.forEach((f: any) => {
    const errorType = f.error_message?.split(':')[0] || 'Unknown';
    errorGroups[errorType] = (errorGroups[errorType] || 0) + 1;
  });
  
  return {
    totalErrors: failures?.length || 0,
    recentFailures: failures || [],
    errorGroups,
    criticalErrors: failures?.filter((f: any) => 
      f.error_message?.toLowerCase().includes('crash') ||
      f.error_message?.toLowerCase().includes('timeout') ||
      f.error_message?.toLowerCase().includes('connection')
    ) || []
  };
}

function getPerformanceMetrics() {
  const mem = process.memoryUsage();
  const uptime = process.uptime();
  
  return {
    memory: {
      heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
      heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
      rss: Math.round(mem.rss / 1024 / 1024),
      external: Math.round(mem.external / 1024 / 1024)
    },
    uptime: {
      seconds: Math.round(uptime),
      formatted: formatUptime(uptime)
    },
    cpu: {
      user: process.cpuUsage().user,
      system: process.cpuUsage().system
    }
  };
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

// ============================================================
// HTML GENERATOR
// ============================================================

function generateEnhancedHTML(data: DashboardData): string {
  const timestamp = new Date(data.timestamp).toLocaleString();
  
  return `<!DOCTYPE html>
<html>
<head>
    <title>🚀 xBOT Real-Time Dashboard</title>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        ${getEnhancedStyles()}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 xBOT Real-Time System Dashboard</h1>
            <p>Live monitoring and control center for your autonomous Twitter bot</p>
            <p style="color: #666; font-size: 14px;">Last updated: <span id="timestamp">${timestamp}</span></p>
            <div class="auto-refresh-indicator">
                <span class="pulse-dot"></span>
                <span>Auto-refresh: <span id="countdown">5</span>s</span>
            </div>
        </div>

        <!-- NAVIGATION -->
        <div class="nav-tabs">
            <a href="/dashboard/health?token=xbot-admin-2025" class="nav-tab active">🚀 Real-Time Control</a>
            <a href="/dashboard/recent?token=xbot-admin-2025" class="nav-tab">📅 Recent</a>
            <a href="/dashboard/posts?token=xbot-admin-2025" class="nav-tab">📊 Posts</a>
            <a href="/dashboard/replies?token=xbot-admin-2025" class="nav-tab">💬 Replies</a>
        </div>

        <!-- QUICK ACTIONS BAR -->
        <div class="quick-actions">
            <h2>⚡ Quick Actions</h2>
            <div class="action-buttons">
                <button onclick="forcePost()" class="action-btn primary">
                    <span class="btn-icon">📤</span>
                    <span>Force Post Now</span>
                </button>
                <button onclick="runScraper()" class="action-btn">
                    <span class="btn-icon">📊</span>
                    <span>Run Metrics Scraper</span>
                </button>
                <button onclick="runHarvester()" class="action-btn">
                    <span class="btn-icon">🌾</span>
                    <span>Run Harvester</span>
                </button>
                <button onclick="restartBrowser()" class="action-btn warning">
                    <span class="btn-icon">🔄</span>
                    <span>Restart Browser</span>
                </button>
                <button onclick="runContentJob()" class="action-btn">
                    <span class="btn-icon">✍️</span>
                    <span>Generate Content</span>
                </button>
                <button onclick="clearQueue()" class="action-btn danger">
                    <span class="btn-icon">🗑️</span>
                    <span>Clear Failed Queue</span>
                </button>
            </div>
        </div>

        <!-- SYSTEM HEALTH OVERVIEW -->
        <div class="section">
            <h2>🎯 System Health Overview</h2>
            <div class="health-grid">
                <div class="health-card ${getQueueHealthClass(data.queueStatus)}">
                    <div class="health-icon">📮</div>
                    <div class="health-info">
                        <div class="health-label">Content Queue</div>
                        <div class="health-value">${data.queueStatus.total} items</div>
                        <div class="health-detail">${data.queueStatus.singles.ready + data.queueStatus.threads.ready} ready to post</div>
                    </div>
                </div>
                <div class="health-card ${data.scraperStatus.isHealthy ? 'status-good' : 'status-critical'}">
                    <div class="health-icon">📊</div>
                    <div class="health-info">
                        <div class="health-label">Metrics Scraper</div>
                        <div class="health-value">${data.scraperStatus.isHealthy ? 'Healthy' : 'Stale'}</div>
                        <div class="health-detail">Last ran ${data.scraperStatus.minutesSinceLastScrape}m ago</div>
                    </div>
                </div>
                <div class="health-card ${data.browserStatus.pool.successRate > 80 ? 'status-good' : 'status-warning'}">
                    <div class="health-icon">🌐</div>
                    <div class="health-info">
                        <div class="health-label">Browser Pool</div>
                        <div class="health-value">${data.browserStatus.pool.successRate}%</div>
                        <div class="health-detail">${data.browserStatus.pool.activeContexts}/${data.browserStatus.pool.maxContexts} active</div>
                    </div>
                </div>
                <div class="health-card ${data.systemErrors.totalErrors === 0 ? 'status-good' : 'status-warning'}">
                    <div class="health-icon">${data.systemErrors.totalErrors === 0 ? '✅' : '⚠️'}</div>
                    <div class="health-info">
                        <div class="health-label">System Errors</div>
                        <div class="health-value">${data.systemErrors.totalErrors}</div>
                        <div class="health-detail">Last hour</div>
                    </div>
                </div>
            </div>
        </div>

        <!-- POSTING QUEUE STATUS -->
        <div class="section">
            <h2>📮 Posting Queue Status</h2>
            <div class="grid-3">
                <div class="queue-card">
                    <div class="queue-header">
                        <h3>Singles</h3>
                        <span class="queue-count">${data.queueStatus.singles.total}</span>
                    </div>
                    <div class="queue-stats">
                        <div class="stat-item">
                            <span class="stat-label">Ready now:</span>
                            <span class="stat-value ready">${data.queueStatus.singles.ready}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Upcoming:</span>
                            <span class="stat-value">${data.queueStatus.singles.total - data.queueStatus.singles.ready}</span>
                        </div>
                    </div>
                    ${generateUpcomingList(data.queueStatus.singles.upcoming)}
                </div>
                <div class="queue-card">
                    <div class="queue-header">
                        <h3>Threads</h3>
                        <span class="queue-count">${data.queueStatus.threads.total}</span>
                    </div>
                    <div class="queue-stats">
                        <div class="stat-item">
                            <span class="stat-label">Ready now:</span>
                            <span class="stat-value ready">${data.queueStatus.threads.ready}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Upcoming:</span>
                            <span class="stat-value">${data.queueStatus.threads.total - data.queueStatus.threads.ready}</span>
                        </div>
                    </div>
                    ${generateUpcomingList(data.queueStatus.threads.upcoming)}
                </div>
                <div class="queue-card">
                    <div class="queue-header">
                        <h3>Replies</h3>
                        <span class="queue-count">${data.queueStatus.replies.total}</span>
                    </div>
                    <div class="queue-stats">
                        <div class="stat-item">
                            <span class="stat-label">Ready now:</span>
                            <span class="stat-value ready">${data.queueStatus.replies.ready}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Upcoming:</span>
                            <span class="stat-value">${data.queueStatus.replies.total - data.queueStatus.replies.ready}</span>
                        </div>
                    </div>
                    ${generateUpcomingList(data.queueStatus.replies.upcoming)}
                </div>
            </div>
        </div>

        <!-- SYSTEM ERRORS & LOGS -->
        ${data.systemErrors.totalErrors > 0 ? `
        <div class="section">
            <h2>🚨 Recent System Errors (Last Hour)</h2>
            <div class="error-summary">
                <div class="error-count-card">
                    <div class="error-count">${data.systemErrors.totalErrors}</div>
                    <div class="error-label">Total Errors</div>
                </div>
                <div class="error-groups">
                    ${Object.entries(data.systemErrors.errorGroups).map(([type, count]) => `
                        <div class="error-group">
                            <span class="error-type">${type}</span>
                            <span class="error-badge">${count}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
            
            <h3>Recent Failures:</h3>
            <div class="error-log">
                ${data.systemErrors.recentFailures.slice(0, 10).map((error: any) => {
                    const age = Math.round((Date.now() - new Date(error.updated_at).getTime()) / (1000 * 60));
                    return `
                    <div class="error-item">
                        <div class="error-header">
                            <span class="error-type-badge">${error.decision_type}</span>
                            <span class="error-time">${age}m ago</span>
                        </div>
                        <div class="error-message">${error.error_message || 'Unknown error'}</div>
                        <div class="error-content">${(error.content || '').substring(0, 100)}...</div>
                    </div>
                `;
                }).join('')}
            </div>
        </div>
        ` : ''}

        <!-- RECENT ACTIVITY -->
        <div class="section">
            <h2>🔄 Recent Activity (Last 30 Minutes)</h2>
            <div class="activity-stats">
                <div class="activity-card success">
                    <div class="activity-number">${data.recentActivity.postsLast30min}</div>
                    <div class="activity-label">Posts Published</div>
                </div>
                <div class="activity-card ${data.recentActivity.failuresLast30min > 0 ? 'danger' : 'success'}">
                    <div class="activity-number">${data.recentActivity.failuresLast30min}</div>
                    <div class="activity-label">Failures</div>
                </div>
            </div>
            
            ${data.recentActivity.recentPosts.length > 0 ? `
            <h3>Recent Posts:</h3>
            <div class="activity-list">
                ${data.recentActivity.recentPosts.map((post: any) => {
                    const age = Math.round((Date.now() - new Date(post.posted_at).getTime()) / (1000 * 60));
                    return `
                    <div class="activity-item">
                        <div class="activity-badge type-${post.decision_type}">${post.decision_type}</div>
                        <div class="activity-content">
                            <div class="activity-text">${(post.content || '').substring(0, 100)}...</div>
                            <div class="activity-meta">
                                <span>${post.generator_name || 'unknown'}</span> · 
                                <span>${age}m ago</span>
                            </div>
                        </div>
                    </div>
                `;
                }).join('')}
            </div>
            ` : '<p style="text-align: center; color: #999;">No recent posts</p>'}
        </div>

        <!-- PERFORMANCE METRICS -->
        <div class="section">
            <h2>⚡ Performance Metrics</h2>
            <div class="metrics-grid">
                <div class="metric-card">
                    <div class="metric-label">Memory Usage</div>
                    <div class="metric-value">${data.performanceMetrics.memory.heapUsed} MB</div>
                    <div class="metric-bar">
                        <div class="metric-bar-fill" style="width: ${Math.min(data.performanceMetrics.memory.heapUsed / data.performanceMetrics.memory.heapTotal * 100, 100)}%"></div>
                    </div>
                    <div class="metric-detail">${data.performanceMetrics.memory.heapTotal} MB total</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">System Uptime</div>
                    <div class="metric-value">${data.performanceMetrics.uptime.formatted}</div>
                    <div class="metric-detail">${data.performanceMetrics.uptime.seconds} seconds</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">Browser Operations</div>
                    <div class="metric-value">${data.browserStatus.pool.totalOperations}</div>
                    <div class="metric-detail">${data.browserStatus.pool.successRate}% success rate</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">Scraper Coverage</div>
                    <div class="metric-value">${data.scraperStatus.coverage}%</div>
                    <div class="metric-bar">
                        <div class="metric-bar-fill" style="width: ${data.scraperStatus.coverage}%"></div>
                    </div>
                    <div class="metric-detail">${data.scraperStatus.scraped} / ${data.scraperStatus.totalRecent} posts</div>
                </div>
            </div>
        </div>

        <!-- JOB STATUS -->
        <div class="section">
            <h2>⏰ Scheduled Jobs Status</h2>
            <div class="grid-2">
                <div class="job-card ${data.jobTimings.contentGeneration.isHealthy ? 'job-healthy' : 'job-critical'}">
                    <div class="job-header">
                        <h3>Content Generation</h3>
                        <span class="job-status">${data.jobTimings.contentGeneration.isHealthy ? '✅' : '❌'}</span>
                    </div>
                    <div class="job-info">
                        <div class="job-detail">
                            <span>Last run:</span>
                            <strong>${data.jobTimings.contentGeneration.minutesAgo < 999 ? data.jobTimings.contentGeneration.minutesAgo + 'm ago' : 'Never'}</strong>
                        </div>
                        <div class="job-detail">
                            <span>Schedule:</span>
                            <strong>Every 120 minutes</strong>
                        </div>
                    </div>
                    <button onclick="runContentJob()" class="job-button">▶ Run Now</button>
                </div>
                <div class="job-card ${data.jobTimings.replyGeneration.isHealthy ? 'job-healthy' : 'job-critical'}">
                    <div class="job-header">
                        <h3>Reply Generation</h3>
                        <span class="job-status">${data.jobTimings.replyGeneration.isHealthy ? '✅' : '❌'}</span>
                    </div>
                    <div class="job-info">
                        <div class="job-detail">
                            <span>Last run:</span>
                            <strong>${data.jobTimings.replyGeneration.minutesAgo < 999 ? data.jobTimings.replyGeneration.minutesAgo + 'm ago' : 'Never'}</strong>
                        </div>
                        <div class="job-detail">
                            <span>Schedule:</span>
                            <strong>Every 30 minutes</strong>
                        </div>
                    </div>
                    <button onclick="runReplyJob()" class="job-button">▶ Run Now</button>
                </div>
            </div>
        </div>

        <div class="footer">
            <p>🔄 Auto-refreshes every 5 seconds | Live system monitoring</p>
            <p style="font-size: 12px; color: #999;">For manual actions, ensure you have proper authentication</p>
        </div>
    </div>
    
    <!-- ACTION RESULT TOAST -->
    <div id="toast" class="toast"></div>
    
    <script>
        ${getEnhancedScripts()}
    </script>
</body>
</html>`;
}

function generateUpcomingList(items: any[]): string {
  if (items.length === 0) {
    return '<div class="no-upcoming">No items queued</div>';
  }
  
  return `
    <div class="upcoming-list">
        ${items.slice(0, 3).map((item: any) => {
            const scheduledTime = new Date(item.scheduled_at);
            const minutesUntil = Math.round((scheduledTime.getTime() - Date.now()) / (1000 * 60));
            const timeLabel = minutesUntil <= 0 ? 'NOW' : `in ${minutesUntil}m`;
            const quality = Math.round((item.quality_score || 0) * 100);
            return `
            <div class="upcoming-item ${minutesUntil <= 0 ? 'ready-now' : ''}">
                <span class="time-label">${timeLabel}</span>
                <span class="quality-label">Q: ${quality}%</span>
            </div>
        `;
        }).join('')}
    </div>
  `;
}

function getQueueHealthClass(queueStatus: any): string {
  const total = queueStatus.singles.total + queueStatus.threads.total + queueStatus.replies.total;
  if (total >= 12) return 'status-good';
  if (total >= 6) return 'status-warning';
  return 'status-critical';
}

function getEnhancedStyles(): string {
  return `
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        
        .container {
            max-width: 1600px;
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
            position: relative;
        }
        
        .header h1 {
            margin: 0;
            color: #2d3748;
            font-size: 36px;
            margin-bottom: 10px;
        }
        
        .auto-refresh-indicator {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            background: #f0fff4;
            padding: 8px 16px;
            border-radius: 20px;
            margin-top: 10px;
            font-size: 14px;
            color: #22543d;
        }
        
        .pulse-dot {
            width: 10px;
            height: 10px;
            background: #48bb78;
            border-radius: 50%;
            animation: pulse 2s infinite;
        }
        
        @keyframes pulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.5; transform: scale(1.2); }
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
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
        }
        
        .nav-tab:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        }
        
        .quick-actions {
            background: linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%);
            padding: 25px;
            border-radius: 15px;
            margin-bottom: 30px;
        }
        
        .quick-actions h2 {
            margin-bottom: 15px;
            color: #2d3748;
        }
        
        .action-buttons {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
        }
        
        .action-btn {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 15px 20px;
            border: none;
            border-radius: 10px;
            font-size: 15px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s;
            background: white;
            color: #2d3748;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        
        .action-btn:hover {
            transform: translateY(-3px);
            box-shadow: 0 6px 16px rgba(0,0,0,0.2);
        }
        
        .action-btn:active {
            transform: translateY(-1px);
        }
        
        .action-btn.primary {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
        }
        
        .action-btn.warning {
            background: linear-gradient(135deg, #f6ad55 0%, #ed8936 100%);
            color: white;
        }
        
        .action-btn.danger {
            background: linear-gradient(135deg, #fc8181 0%, #f56565 100%);
            color: white;
        }
        
        .btn-icon {
            font-size: 20px;
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
        
        .health-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 20px;
        }
        
        .health-card {
            display: flex;
            align-items: center;
            gap: 20px;
            padding: 25px;
            border-radius: 15px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            transition: transform 0.3s;
        }
        
        .health-card:hover {
            transform: translateY(-4px);
        }
        
        .health-icon {
            font-size: 48px;
        }
        
        .health-info {
            flex: 1;
        }
        
        .health-label {
            font-size: 14px;
            color: #718096;
            font-weight: 600;
            text-transform: uppercase;
            margin-bottom: 5px;
        }
        
        .health-value {
            font-size: 24px;
            font-weight: bold;
            color: #2d3748;
            margin-bottom: 5px;
        }
        
        .health-detail {
            font-size: 13px;
            color: #a0aec0;
        }
        
        .status-good { background: #f0fff4; border-left: 5px solid #48bb78; }
        .status-warning { background: #fffaf0; border-left: 5px solid #ed8936; }
        .status-critical { background: #fff5f5; border-left: 5px solid #f56565; }
        
        .grid-2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 20px; }
        .grid-3 { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 20px; }
        
        .queue-card {
            background: white;
            padding: 25px;
            border-radius: 15px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        
        .queue-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
            padding-bottom: 15px;
            border-bottom: 2px solid #e2e8f0;
        }
        
        .queue-header h3 {
            margin: 0;
            color: #2d3748;
        }
        
        .queue-count {
            font-size: 32px;
            font-weight: bold;
            color: #667eea;
        }
        
        .queue-stats {
            display: flex;
            justify-content: space-between;
            margin-bottom: 15px;
        }
        
        .stat-item {
            display: flex;
            flex-direction: column;
            gap: 5px;
        }
        
        .stat-label {
            font-size: 12px;
            color: #718096;
        }
        
        .stat-value {
            font-size: 20px;
            font-weight: bold;
            color: #2d3748;
        }
        
        .stat-value.ready {
            color: #48bb78;
        }
        
        .upcoming-list {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        
        .upcoming-item {
            display: flex;
            justify-content: space-between;
            padding: 10px 15px;
            background: #f7fafc;
            border-radius: 8px;
        }
        
        .upcoming-item.ready-now {
            background: #f0fff4;
            border-left: 3px solid #48bb78;
        }
        
        .time-label {
            font-size: 13px;
            font-weight: 600;
            color: #4a5568;
        }
        
        .quality-label {
            font-size: 13px;
            color: #718096;
        }
        
        .no-upcoming {
            text-align: center;
            padding: 20px;
            color: #a0aec0;
            font-style: italic;
        }
        
        .error-summary {
            display: grid;
            grid-template-columns: 200px 1fr;
            gap: 20px;
            margin-bottom: 20px;
            background: #fff5f5;
            padding: 20px;
            border-radius: 12px;
            border-left: 4px solid #f56565;
        }
        
        .error-count-card {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
        }
        
        .error-count {
            font-size: 48px;
            font-weight: bold;
            color: #f56565;
        }
        
        .error-label {
            font-size: 14px;
            color: #742a2a;
            font-weight: 600;
        }
        
        .error-groups {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            align-items: center;
        }
        
        .error-group {
            display: flex;
            align-items: center;
            gap: 8px;
            background: white;
            padding: 8px 15px;
            border-radius: 8px;
        }
        
        .error-type {
            font-size: 13px;
            color: #2d3748;
            font-weight: 600;
        }
        
        .error-badge {
            background: #f56565;
            color: white;
            padding: 2px 8px;
            border-radius: 10px;
            font-size: 12px;
            font-weight: bold;
        }
        
        .error-log {
            display: flex;
            flex-direction: column;
            gap: 12px;
        }
        
        .error-item {
            background: #fff5f5;
            padding: 15px;
            border-radius: 10px;
            border-left: 4px solid #f56565;
        }
        
        .error-header {
            display: flex;
            justify-content: space-between;
            margin-bottom: 8px;
        }
        
        .error-type-badge {
            background: #f56565;
            color: white;
            padding: 4px 10px;
            border-radius: 5px;
            font-size: 12px;
            font-weight: 600;
        }
        
        .error-time {
            font-size: 12px;
            color: #742a2a;
        }
        
        .error-message {
            font-size: 14px;
            color: #c53030;
            margin-bottom: 8px;
            font-family: monospace;
        }
        
        .error-content {
            font-size: 13px;
            color: #742a2a;
        }
        
        .activity-stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 20px;
        }
        
        .activity-card {
            padding: 25px;
            border-radius: 12px;
            text-align: center;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        
        .activity-card.success {
            background: #f0fff4;
            border: 2px solid #48bb78;
        }
        
        .activity-card.danger {
            background: #fff5f5;
            border: 2px solid #f56565;
        }
        
        .activity-number {
            font-size: 48px;
            font-weight: bold;
            margin-bottom: 10px;
        }
        
        .activity-card.success .activity-number {
            color: #48bb78;
        }
        
        .activity-card.danger .activity-number {
            color: #f56565;
        }
        
        .activity-label {
            font-size: 14px;
            color: #4a5568;
            font-weight: 600;
            text-transform: uppercase;
        }
        
        .activity-list {
            display: flex;
            flex-direction: column;
            gap: 12px;
        }
        
        .activity-item {
            display: flex;
            gap: 15px;
            padding: 15px;
            background: #f7fafc;
            border-radius: 10px;
        }
        
        .activity-badge {
            padding: 5px 12px;
            border-radius: 6px;
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            height: fit-content;
        }
        
        .activity-badge.type-single { background: #dbeafe; color: #1e40af; }
        .activity-badge.type-thread { background: #fce7f3; color: #9f1239; }
        .activity-badge.type-reply { background: #d1fae5; color: #065f46; }
        
        .activity-content {
            flex: 1;
        }
        
        .activity-text {
            font-size: 14px;
            color: #2d3748;
            margin-bottom: 5px;
        }
        
        .activity-meta {
            font-size: 12px;
            color: #718096;
        }
        
        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
        }
        
        .metric-card {
            background: white;
            padding: 20px;
            border-radius: 12px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        
        .metric-label {
            font-size: 12px;
            color: #718096;
            font-weight: 600;
            text-transform: uppercase;
            margin-bottom: 10px;
        }
        
        .metric-value {
            font-size: 28px;
            font-weight: bold;
            color: #2d3748;
            margin-bottom: 10px;
        }
        
        .metric-bar {
            width: 100%;
            height: 8px;
            background: #e2e8f0;
            border-radius: 4px;
            overflow: hidden;
            margin-bottom: 8px;
        }
        
        .metric-bar-fill {
            height: 100%;
            background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
            transition: width 0.3s;
        }
        
        .metric-detail {
            font-size: 12px;
            color: #a0aec0;
        }
        
        .job-card {
            background: white;
            padding: 25px;
            border-radius: 15px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        
        .job-healthy {
            border-left: 5px solid #48bb78;
        }
        
        .job-critical {
            border-left: 5px solid #f56565;
        }
        
        .job-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
        }
        
        .job-header h3 {
            margin: 0;
            color: #2d3748;
        }
        
        .job-status {
            font-size: 24px;
        }
        
        .job-info {
            display: flex;
            flex-direction: column;
            gap: 10px;
            margin-bottom: 15px;
        }
        
        .job-detail {
            display: flex;
            justify-content: space-between;
            font-size: 14px;
            color: #718096;
        }
        
        .job-button {
            width: 100%;
            padding: 12px;
            border: none;
            border-radius: 8px;
            background: #667eea;
            color: white;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s;
        }
        
        .job-button:hover {
            background: #5568d3;
            transform: translateY(-2px);
        }
        
        .toast {
            position: fixed;
            bottom: 30px;
            right: 30px;
            padding: 15px 25px;
            border-radius: 10px;
            color: white;
            font-weight: 600;
            box-shadow: 0 8px 20px rgba(0,0,0,0.3);
            opacity: 0;
            transform: translateY(20px);
            transition: all 0.3s;
            z-index: 1000;
        }
        
        .toast.show {
            opacity: 1;
            transform: translateY(0);
        }
        
        .toast.success {
            background: #48bb78;
        }
        
        .toast.error {
            background: #f56565;
        }
        
        .toast.warning {
            background: #ed8936;
        }
        
        .footer {
            text-align: center;
            padding-top: 30px;
            border-top: 2px solid #e2e8f0;
            color: #718096;
            font-size: 14px;
        }
  `;
}

function getEnhancedScripts(): string {
  return `
        // Auto-refresh countdown
        let countdown = 5;
        setInterval(() => {
            countdown--;
            if (countdown <= 0) {
                location.reload();
            }
            document.getElementById('countdown').textContent = countdown;
        }, 1000);
        
        // Update timestamp
        setInterval(() => {
            document.getElementById('timestamp').textContent = new Date().toLocaleString();
        }, 1000);
        
        // Toast notification system
        function showToast(message, type = 'success') {
            const toast = document.getElementById('toast');
            toast.textContent = message;
            toast.className = 'toast ' + type;
            setTimeout(() => toast.classList.add('show'), 100);
            setTimeout(() => {
                toast.classList.remove('show');
            }, 3000);
        }
        
        // Action functions
        async function forcePost() {
            showToast('Triggering force post...', 'warning');
            try {
                const response = await fetch('/api/admin/force-post', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + (new URLSearchParams(window.location.search).get('token') || 'xbot-admin-2025')
                    }
                });
                const data = await response.json();
                if (response.ok) {
                    showToast('✅ Post triggered successfully!', 'success');
                    setTimeout(() => location.reload(), 2000);
                } else {
                    showToast('❌ Failed: ' + (data.error || 'Unknown error'), 'error');
                }
            } catch (error) {
                showToast('❌ Error: ' + error.message, 'error');
            }
        }
        
        async function runScraper() {
            showToast('Running metrics scraper...', 'warning');
            try {
                const response = await fetch('/api/admin/run-job', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + (new URLSearchParams(window.location.search).get('token') || 'xbot-admin-2025')
                    },
                    body: JSON.stringify({ jobName: 'metrics' })
                });
                const data = await response.json();
                if (response.ok) {
                    showToast('✅ Scraper job started!', 'success');
                    setTimeout(() => location.reload(), 3000);
                } else {
                    showToast('❌ Failed: ' + (data.error || 'Unknown error'), 'error');
                }
            } catch (error) {
                showToast('❌ Error: ' + error.message, 'error');
            }
        }
        
        async function runHarvester() {
            showToast('Running harvester...', 'warning');
            try {
                const response = await fetch('/api/admin/run-job', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + (new URLSearchParams(window.location.search).get('token') || 'xbot-admin-2025')
                    },
                    body: JSON.stringify({ jobName: 'harvester' })
                });
                const data = await response.json();
                if (response.ok) {
                    showToast('✅ Harvester job started!', 'success');
                    setTimeout(() => location.reload(), 3000);
                } else {
                    showToast('❌ Failed: ' + (data.error || 'Unknown error'), 'error');
                }
            } catch (error) {
                showToast('❌ Error: ' + error.message, 'error');
            }
        }
        
        async function restartBrowser() {
            if (!confirm('Are you sure you want to restart the browser? This will temporarily interrupt operations.')) {
                return;
            }
            showToast('Restarting browser...', 'warning');
            try {
                const response = await fetch('/restart-browser', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
                const data = await response.json();
                if (response.ok) {
                    showToast('✅ Browser restarted successfully!', 'success');
                    setTimeout(() => location.reload(), 3000);
                } else {
                    showToast('⚠️ Restart completed with warnings', 'warning');
                }
            } catch (error) {
                showToast('❌ Error: ' + error.message, 'error');
            }
        }
        
        async function runContentJob() {
            showToast('Generating content...', 'warning');
            try {
                const response = await fetch('/api/admin/run-job', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + (new URLSearchParams(window.location.search).get('token') || 'xbot-admin-2025')
                    },
                    body: JSON.stringify({ jobName: 'plan' })
                });
                const data = await response.json();
                if (response.ok) {
                    showToast('✅ Content generation started!', 'success');
                    setTimeout(() => location.reload(), 4000);
                } else {
                    showToast('❌ Failed: ' + (data.error || 'Unknown error'), 'error');
                }
            } catch (error) {
                showToast('❌ Error: ' + error.message, 'error');
            }
        }
        
        async function runReplyJob() {
            showToast('Generating replies...', 'warning');
            try {
                const response = await fetch('/api/admin/run-job', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + (new URLSearchParams(window.location.search).get('token') || 'xbot-admin-2025')
                    },
                    body: JSON.stringify({ jobName: 'reply' })
                });
                const data = await response.json();
                if (response.ok) {
                    showToast('✅ Reply generation started!', 'success');
                    setTimeout(() => location.reload(), 3000);
                } else {
                    showToast('❌ Failed: ' + (data.error || 'Unknown error'), 'error');
                }
            } catch (error) {
                showToast('❌ Error: ' + error.message, 'error');
            }
        }
        
        async function clearQueue() {
            if (!confirm('Are you sure you want to clear all failed items from the queue?')) {
                return;
            }
            showToast('Clearing failed queue items...', 'warning');
            // Implement this endpoint if needed
            showToast('⚠️ Feature coming soon!', 'warning');
        }
  `;
}

function generateErrorHTML(error: string): string {
  return `<!DOCTYPE html>
<html>
<head>
    <title>Dashboard Error</title>
    <meta charset="UTF-8">
</head>
<body style="font-family: sans-serif; padding: 40px; background: #f7fafc;">
    <div style="max-width: 800px; margin: 0 auto; background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
        <h1 style="color: #f56565;">❌ Dashboard Error</h1>
        <p>Failed to generate enhanced dashboard.</p>
        <pre style="background: #fff5f5; padding: 20px; border-radius: 8px; overflow-x: auto;">${error}</pre>
        <a href="/dashboard/health?token=xbot-admin-2025" style="display: inline-block; margin-top: 20px; padding: 12px 24px; background: #667eea; color: white; text-decoration: none; border-radius: 8px;">Retry</a>
    </div>
</body>
</html>`;
}

