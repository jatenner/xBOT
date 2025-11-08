/**
 * 🎯 UNIFIED SYSTEM DASHBOARD
 * 
 * Single-page dashboard showing all systems with clear visual separation:
 * - Posting System (queue, recent posts, status)
 * - Reply System (queue, recent replies, status)
 * - Harvesting System (opportunities, tiers, status)
 * - Scraping System (coverage, recent scrapes, status)
 * 
 * Everything on ONE page, clearly separated, with actual data visualization
 */

import { getSupabaseClient } from '../db/index';
import { UnifiedBrowserPool } from '../browser/UnifiedBrowserPool';

interface SystemDashboardData {
  postingSystem: {
    status: string;
    queueCount: number;
    readyToPost: number;
    recentPosts: any[];
    last24h: number;
  };
  replySystem: {
    status: string;
    queueCount: number;
    readyToPost: number;
    recentReplies: any[];
    last24h: number;
  };
  harvestingSystem: {
    status: string;
    opportunitiesAvailable: number;
    byTier: { platinum: number; diamond: number; golden: number };
    recentOpportunities: any[];
    last24h: number;
  };
  scrapingSystem: {
    status: string;
    coverage: number;
    needsScraping: number;
    recentScrapes: any[];
    lastRunMinutes: number;
  };
  browserStatus: {
    healthy: boolean;
    successRate: number;
    activeContexts: number;
  };
  timestamp: Date;
}

export async function generateUnifiedDashboard(): Promise<string> {
  try {
    const supabase = getSupabaseClient();
    const now = new Date();
    
    // Fetch all system data in parallel
    const [
      postingData,
      replyData,
      harvestingData,
      scrapingData,
      browserData
    ] = await Promise.all([
      getPostingSystemData(supabase),
      getReplySystemData(supabase),
      getHarvestingSystemData(supabase),
      getScrapingSystemData(supabase),
      getBrowserSystemData()
    ]);
    
    const dashboardData: SystemDashboardData = {
      postingSystem: postingData,
      replySystem: replyData,
      harvestingSystem: harvestingData,
      scrapingSystem: scrapingData,
      browserStatus: browserData,
      timestamp: now
    };
    
    return generateUnifiedHTML(dashboardData);
    
  } catch (error: any) {
    console.error('[UNIFIED_DASHBOARD] Error:', error.message);
    return generateErrorHTML(error.message);
  }
}

// ============================================================
// DATA FETCHERS - One per system
// ============================================================

async function getPostingSystemData(supabase: any) {
  const now = new Date();
  const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const next5min = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  
  // Get posting queue (singles + threads)
  const { data: queue } = await supabase
    .from('content_metadata')
    .select('decision_type, scheduled_at, quality_score, content, created_at')
    .eq('status', 'queued')
    .in('decision_type', ['single', 'thread'])
    .order('scheduled_at', { ascending: true });
  
  const readyToPost = queue?.filter((q: any) => q.scheduled_at <= next5min).length || 0;
  
  // Get recent posts
  const { data: recentPosts } = await supabase
    .from('content_metadata')
    .select('decision_type, content, posted_at, actual_impressions, actual_likes, generator_name')
    .eq('status', 'posted')
    .in('decision_type', ['single', 'thread'])
    .gte('posted_at', last24h)
    .order('posted_at', { ascending: false })
    .limit(5);
  
  const { count: last24hCount } = await supabase
    .from('content_metadata')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'posted')
    .in('decision_type', ['single', 'thread'])
    .gte('posted_at', last24h);
  
  return {
    status: queue?.length >= 4 ? 'healthy' : 'warning',
    queueCount: queue?.length || 0,
    readyToPost,
    recentPosts: recentPosts || [],
    last24h: last24hCount || 0
  };
}

async function getReplySystemData(supabase: any) {
  const now = new Date();
  const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const next5min = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  
  // Get reply queue
  const { data: queue } = await supabase
    .from('content_metadata')
    .select('scheduled_at, quality_score, content, created_at')
    .eq('status', 'queued')
    .eq('decision_type', 'reply')
    .order('scheduled_at', { ascending: true });
  
  const readyToPost = queue?.filter((q: any) => q.scheduled_at <= next5min).length || 0;
  
  // Get recent replies
  const { data: recentReplies } = await supabase
    .from('content_metadata')
    .select('content, posted_at, actual_impressions, actual_likes, generator_name, reply_to_username')
    .eq('status', 'posted')
    .eq('decision_type', 'reply')
    .gte('posted_at', last24h)
    .order('posted_at', { ascending: false })
    .limit(5);
  
  const { count: last24hCount } = await supabase
    .from('content_metadata')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'posted')
    .eq('decision_type', 'reply')
    .gte('posted_at', last24h);
  
  return {
    status: queue?.length >= 8 ? 'healthy' : 'warning',
    queueCount: queue?.length || 0,
    readyToPost,
    recentReplies: recentReplies || [],
    last24h: last24hCount || 0
  };
}

async function getHarvestingSystemData(supabase: any) {
  const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  
  // Get available opportunities
  const { data: opportunities } = await supabase
    .from('reply_opportunities')
    .select('tier, target_username, like_count, created_at, target_tweet_url')
    .eq('replied_to', false)
    .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(10);
  
  // Count by tier
  const byTier = {
    platinum: opportunities?.filter((o: any) => o.tier === 'Platinum' || o.tier === 'golden').length || 0,
    diamond: opportunities?.filter((o: any) => o.tier === 'Diamond').length || 0,
    golden: opportunities?.filter((o: any) => o.tier === 'Golden' || o.tier === 'acceptable').length || 0
  };
  
  // Count harvested last 24h
  const { count: last24hCount } = await supabase
    .from('reply_opportunities')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', last24h);
  
  return {
    status: opportunities?.length >= 20 ? 'healthy' : 'warning',
    opportunitiesAvailable: opportunities?.length || 0,
    byTier,
    recentOpportunities: opportunities || [],
    last24h: last24hCount || 0
  };
}

async function getScrapingSystemData(supabase: any) {
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
  
  // Get scraping status
  const { data: lastScrape } = await supabase
    .from('outcomes')
    .select('collected_at, tweet_id')
    .eq('data_source', 'orchestrator_v2')
    .order('collected_at', { ascending: false })
    .limit(1)
    .single();
  
  const lastScrapeTime = lastScrape?.collected_at ? new Date(String(lastScrape.collected_at)) : null;
  const minutesSinceLastScrape = lastScrapeTime 
    ? Math.round((Date.now() - lastScrapeTime.getTime()) / (1000 * 60))
    : 999;
  
  // Get posts needing scraping
  const { data: allPosts } = await supabase
    .from('content_metadata')
    .select('tweet_id, posted_at, actual_impressions, content, decision_type')
    .eq('status', 'posted')
    .not('tweet_id', 'is', null)
    .gte('created_at', threeDaysAgo);
  
  const needsScraping = allPosts?.filter((p: any) => !p.actual_impressions) || [];
  const scraped = allPosts?.filter((p: any) => p.actual_impressions) || [];
  
  const coverage = allPosts?.length > 0 
    ? Math.round((scraped.length / allPosts.length) * 100) 
    : 0;
  
  return {
    status: minutesSinceLastScrape < 30 ? 'healthy' : 'warning',
    coverage,
    needsScraping: needsScraping.length,
    recentScrapes: scraped.slice(0, 5),
    lastRunMinutes: minutesSinceLastScrape
  };
}

function getBrowserSystemData() {
  try {
    const pool = UnifiedBrowserPool.getInstance();
    const metrics = pool.getMetrics();
    
    const successRate = metrics.totalOperations > 0 
      ? Math.round((metrics.successfulOperations / metrics.totalOperations) * 100)
      : 100;
    
    return {
      healthy: successRate > 80,
      successRate,
      activeContexts: metrics.activeContexts
    };
  } catch {
    return {
      healthy: false,
      successRate: 0,
      activeContexts: 0
    };
  }
}

// ============================================================
// HTML GENERATOR
// ============================================================

function generateUnifiedHTML(data: SystemDashboardData): string {
  const timestamp = new Date(data.timestamp).toLocaleString();
  
  return `<!DOCTYPE html>
<html>
<head>
    <title>xBOT Unified Dashboard</title>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        ${getUnifiedStyles()}
    </style>
</head>
<body>
    <div class="dashboard-container">
        <!-- HEADER -->
        <div class="dashboard-header">
            <h1>🎯 xBOT System Dashboard</h1>
            <p>All systems on one page - Last updated: <span id="timestamp">${timestamp}</span></p>
            <div class="auto-refresh">
                <span class="pulse"></span>
                Auto-refresh: <span id="countdown">5</span>s
            </div>
        </div>

        <!-- SYSTEM GRID -->
        <div class="systems-grid">
            
            <!-- POSTING SYSTEM -->
            <div class="system-card ${data.postingSystem.status}">
                <div class="system-header">
                    <div class="system-title">
                        <span class="system-icon">📤</span>
                        <h2>Posting System</h2>
                    </div>
                    <div class="system-status ${data.postingSystem.status}">
                        ${data.postingSystem.status === 'healthy' ? '✅ Healthy' : '⚠️ Warning'}
                    </div>
                </div>
                
                <div class="system-metrics">
                    <div class="metric-box">
                        <div class="metric-value">${data.postingSystem.queueCount}</div>
                        <div class="metric-label">Queued</div>
                    </div>
                    <div class="metric-box highlight">
                        <div class="metric-value">${data.postingSystem.readyToPost}</div>
                        <div class="metric-label">Ready Now</div>
                    </div>
                    <div class="metric-box">
                        <div class="metric-value">${data.postingSystem.last24h}</div>
                        <div class="metric-label">Last 24h</div>
                    </div>
                </div>
                
                <div class="system-actions">
                    <button onclick="forcePost()" class="action-btn primary">📤 Post Now</button>
                    <button onclick="runContentJob()" class="action-btn">✍️ Generate Content</button>
                </div>
                
                <div class="system-data">
                    <div class="data-header">Recent Posts:</div>
                    ${data.postingSystem.recentPosts.length > 0 ? data.postingSystem.recentPosts.map((post: any) => {
                        const age = Math.round((Date.now() - new Date(post.posted_at).getTime()) / (1000 * 60));
                        return `
                        <div class="data-item">
                            <div class="data-content">${(post.content || '').substring(0, 80)}...</div>
                            <div class="data-meta">
                                <span class="badge ${post.decision_type}">${post.decision_type}</span>
                                <span>${post.actual_impressions || 0} views</span>
                                <span>${post.actual_likes || 0} likes</span>
                                <span>${age}m ago</span>
                            </div>
                        </div>
                    `}).join('') : '<div class="no-data">No recent posts</div>'}
                </div>
            </div>

            <!-- REPLY SYSTEM -->
            <div class="system-card ${data.replySystem.status}">
                <div class="system-header">
                    <div class="system-title">
                        <span class="system-icon">💬</span>
                        <h2>Reply System</h2>
                    </div>
                    <div class="system-status ${data.replySystem.status}">
                        ${data.replySystem.status === 'healthy' ? '✅ Healthy' : '⚠️ Warning'}
                    </div>
                </div>
                
                <div class="system-metrics">
                    <div class="metric-box">
                        <div class="metric-value">${data.replySystem.queueCount}</div>
                        <div class="metric-label">Queued</div>
                    </div>
                    <div class="metric-box highlight">
                        <div class="metric-value">${data.replySystem.readyToPost}</div>
                        <div class="metric-label">Ready Now</div>
                    </div>
                    <div class="metric-box">
                        <div class="metric-value">${data.replySystem.last24h}</div>
                        <div class="metric-label">Last 24h</div>
                    </div>
                </div>
                
                <div class="system-actions">
                    <button onclick="forcePost()" class="action-btn primary">💬 Post Reply</button>
                    <button onclick="runReplyJob()" class="action-btn">✍️ Generate Replies</button>
                </div>
                
                <div class="system-data">
                    <div class="data-header">Recent Replies:</div>
                    ${data.replySystem.recentReplies.length > 0 ? data.replySystem.recentReplies.map((reply: any) => {
                        const age = Math.round((Date.now() - new Date(reply.posted_at).getTime()) / (1000 * 60));
                        return `
                        <div class="data-item">
                            <div class="data-content">${(reply.content || '').substring(0, 80)}...</div>
                            <div class="data-meta">
                                <span class="badge reply">@${reply.reply_to_username || 'unknown'}</span>
                                <span>${reply.actual_impressions || 0} views</span>
                                <span>${reply.actual_likes || 0} likes</span>
                                <span>${age}m ago</span>
                            </div>
                        </div>
                    `}).join('') : '<div class="no-data">No recent replies</div>'}
                </div>
            </div>

            <!-- HARVESTING SYSTEM -->
            <div class="system-card ${data.harvestingSystem.status}">
                <div class="system-header">
                    <div class="system-title">
                        <span class="system-icon">🌾</span>
                        <h2>Harvesting System</h2>
                    </div>
                    <div class="system-status ${data.harvestingSystem.status}">
                        ${data.harvestingSystem.status === 'healthy' ? '✅ Healthy' : '⚠️ Warning'}
                    </div>
                </div>
                
                <div class="system-metrics">
                    <div class="metric-box">
                        <div class="metric-value">${data.harvestingSystem.opportunitiesAvailable}</div>
                        <div class="metric-label">Available</div>
                    </div>
                    <div class="metric-box highlight">
                        <div class="metric-value">${data.harvestingSystem.byTier.platinum}</div>
                        <div class="metric-label">Platinum</div>
                    </div>
                    <div class="metric-box">
                        <div class="metric-value">${data.harvestingSystem.last24h}</div>
                        <div class="metric-label">Found 24h</div>
                    </div>
                </div>
                
                <div class="tier-breakdown">
                    <div class="tier-item platinum">
                        <span class="tier-count">${data.harvestingSystem.byTier.platinum}</span>
                        <span class="tier-label">Platinum</span>
                    </div>
                    <div class="tier-item diamond">
                        <span class="tier-count">${data.harvestingSystem.byTier.diamond}</span>
                        <span class="tier-label">Diamond</span>
                    </div>
                    <div class="tier-item golden">
                        <span class="tier-count">${data.harvestingSystem.byTier.golden}</span>
                        <span class="tier-label">Golden</span>
                    </div>
                </div>
                
                <div class="system-actions">
                    <button onclick="runHarvester()" class="action-btn primary">🌾 Run Harvester</button>
                </div>
                
                <div class="system-data">
                    <div class="data-header">Recent Opportunities:</div>
                    ${data.harvestingSystem.recentOpportunities.length > 0 ? data.harvestingSystem.recentOpportunities.map((opp: any) => {
                        const age = Math.round((Date.now() - new Date(opp.created_at).getTime()) / (1000 * 60));
                        return `
                        <div class="data-item">
                            <div class="data-content">@${opp.target_username}</div>
                            <div class="data-meta">
                                <span class="badge ${opp.tier?.toLowerCase()}">${opp.tier}</span>
                                <span>${(opp.like_count || 0).toLocaleString()} likes</span>
                                <span>${age}m ago</span>
                            </div>
                        </div>
                    `}).join('') : '<div class="no-data">No opportunities</div>'}
                </div>
            </div>

            <!-- SCRAPING SYSTEM -->
            <div class="system-card ${data.scrapingSystem.status}">
                <div class="system-header">
                    <div class="system-title">
                        <span class="system-icon">📊</span>
                        <h2>Scraping System</h2>
                    </div>
                    <div class="system-status ${data.scrapingSystem.status}">
                        ${data.scrapingSystem.status === 'healthy' ? '✅ Healthy' : '⚠️ Warning'}
                    </div>
                </div>
                
                <div class="system-metrics">
                    <div class="metric-box">
                        <div class="metric-value">${data.scrapingSystem.coverage}%</div>
                        <div class="metric-label">Coverage</div>
                    </div>
                    <div class="metric-box highlight">
                        <div class="metric-value">${data.scrapingSystem.needsScraping}</div>
                        <div class="metric-label">Needs Scrape</div>
                    </div>
                    <div class="metric-box">
                        <div class="metric-value">${data.scrapingSystem.lastRunMinutes < 999 ? data.scrapingSystem.lastRunMinutes + 'm' : 'Never'}</div>
                        <div class="metric-label">Last Run</div>
                    </div>
                </div>
                
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${data.scrapingSystem.coverage}%"></div>
                    <div class="progress-label">${data.scrapingSystem.coverage}% scraped</div>
                </div>
                
                <div class="system-actions">
                    <button onclick="runScraper()" class="action-btn primary">📊 Run Scraper</button>
                </div>
                
                <div class="system-data">
                    <div class="data-header">Recently Scraped:</div>
                    ${data.scrapingSystem.recentScrapes.length > 0 ? data.scrapingSystem.recentScrapes.map((post: any) => {
                        const age = Math.round((Date.now() - new Date(post.posted_at).getTime()) / (1000 * 60));
                        return `
                        <div class="data-item">
                            <div class="data-content">${(post.content || '').substring(0, 60)}...</div>
                            <div class="data-meta">
                                <span class="badge ${post.decision_type}">${post.decision_type}</span>
                                <span>${post.actual_impressions || 0} views</span>
                                <span>${post.actual_likes || 0} likes</span>
                            </div>
                        </div>
                    `}).join('') : '<div class="no-data">No recent scrapes</div>'}
                </div>
            </div>

        </div>

        <!-- BROWSER STATUS BAR -->
        <div class="browser-status ${data.browserStatus.healthy ? 'healthy' : 'warning'}">
            <div class="browser-info">
                <span class="browser-icon">🌐</span>
                <span>Browser Pool: ${data.browserStatus.successRate}% success rate</span>
                <span class="separator">•</span>
                <span>${data.browserStatus.activeContexts}/8 contexts active</span>
            </div>
            <button onclick="restartBrowser()" class="browser-action">🔄 Restart Browser</button>
        </div>

        <!-- FOOTER -->
        <div class="dashboard-footer">
            <p>🔄 Auto-refreshes every 5 seconds | All systems monitored on this page</p>
            <div class="footer-links">
                <a href="/dashboard/recent?token=xbot-admin-2025">📅 Detailed Recent Activity</a>
                <a href="/dashboard/posts?token=xbot-admin-2025">📊 Posts Analytics</a>
                <a href="/dashboard/replies?token=xbot-admin-2025">💬 Replies Analytics</a>
            </div>
        </div>
    </div>
    
    <!-- TOAST -->
    <div id="toast" class="toast"></div>
    
    <script>
        ${getUnifiedScripts()}
    </script>
</body>
</html>`;
}

function getUnifiedStyles(): string {
  return `
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        
        .dashboard-container {
            max-width: 1800px;
            margin: 0 auto;
        }
        
        .dashboard-header {
            background: white;
            padding: 30px;
            border-radius: 15px;
            margin-bottom: 30px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
            text-align: center;
        }
        
        .dashboard-header h1 {
            color: #2d3748;
            margin-bottom: 10px;
        }
        
        .auto-refresh {
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
        
        .pulse {
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
        
        .systems-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(450px, 1fr));
            gap: 25px;
            margin-bottom: 25px;
        }
        
        .system-card {
            background: white;
            border-radius: 15px;
            padding: 25px;
            box-shadow: 0 8px 20px rgba(0,0,0,0.15);
            border-left: 5px solid #cbd5e0;
        }
        
        .system-card.healthy {
            border-left-color: #48bb78;
        }
        
        .system-card.warning {
            border-left-color: #ed8936;
        }
        
        .system-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 2px solid #e2e8f0;
        }
        
        .system-title {
            display: flex;
            align-items: center;
            gap: 12px;
        }
        
        .system-icon {
            font-size: 32px;
        }
        
        .system-title h2 {
            color: #2d3748;
            font-size: 20px;
        }
        
        .system-status {
            padding: 6px 14px;
            border-radius: 20px;
            font-size: 13px;
            font-weight: 600;
        }
        
        .system-status.healthy {
            background: #f0fff4;
            color: #22543d;
        }
        
        .system-status.warning {
            background: #fffaf0;
            color: #7c2d12;
        }
        
        .system-metrics {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 15px;
            margin-bottom: 20px;
        }
        
        .metric-box {
            background: #f7fafc;
            padding: 15px;
            border-radius: 10px;
            text-align: center;
        }
        
        .metric-box.highlight {
            background: linear-gradient(135deg, #667eea15 0%, #764ba215 100%);
            border: 2px solid #667eea;
        }
        
        .metric-value {
            font-size: 28px;
            font-weight: bold;
            color: #2d3748;
            margin-bottom: 5px;
        }
        
        .metric-label {
            font-size: 12px;
            color: #718096;
            text-transform: uppercase;
            font-weight: 600;
        }
        
        .tier-breakdown {
            display: flex;
            gap: 10px;
            margin-bottom: 20px;
        }
        
        .tier-item {
            flex: 1;
            padding: 12px;
            border-radius: 8px;
            text-align: center;
        }
        
        .tier-item.platinum { background: #e6fffa; border: 2px solid #047857; }
        .tier-item.diamond { background: #fef3c7; border: 2px solid #92400e; }
        .tier-item.golden { background: #fed7aa; border: 2px solid #c2410c; }
        
        .tier-count {
            display: block;
            font-size: 24px;
            font-weight: bold;
            color: #2d3748;
        }
        
        .tier-label {
            font-size: 11px;
            text-transform: uppercase;
            font-weight: 600;
            color: #4a5568;
        }
        
        .progress-bar {
            position: relative;
            height: 30px;
            background: #e2e8f0;
            border-radius: 15px;
            overflow: hidden;
            margin-bottom: 20px;
        }
        
        .progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
            transition: width 0.3s;
        }
        
        .progress-label {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            font-size: 13px;
            font-weight: 600;
            color: white;
            text-shadow: 0 1px 2px rgba(0,0,0,0.3);
        }
        
        .system-actions {
            display: flex;
            gap: 10px;
            margin-bottom: 20px;
        }
        
        .action-btn {
            flex: 1;
            padding: 12px;
            border: none;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s;
            background: #f7fafc;
            color: #2d3748;
        }
        
        .action-btn.primary {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
        }
        
        .action-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        }
        
        .system-data {
            background: #f7fafc;
            padding: 15px;
            border-radius: 10px;
        }
        
        .data-header {
            font-size: 13px;
            font-weight: 600;
            color: #4a5568;
            margin-bottom: 12px;
            text-transform: uppercase;
        }
        
        .data-item {
            background: white;
            padding: 12px;
            border-radius: 8px;
            margin-bottom: 8px;
        }
        
        .data-item:last-child {
            margin-bottom: 0;
        }
        
        .data-content {
            font-size: 13px;
            color: #2d3748;
            margin-bottom: 8px;
        }
        
        .data-meta {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
            font-size: 12px;
            color: #718096;
        }
        
        .badge {
            padding: 3px 8px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
        }
        
        .badge.single { background: #dbeafe; color: #1e40af; }
        .badge.thread { background: #fce7f3; color: #9f1239; }
        .badge.reply { background: #d1fae5; color: #065f46; }
        .badge.platinum { background: #e6fffa; color: #047857; }
        .badge.diamond { background: #fef3c7; color: #92400e; }
        .badge.golden { background: #fed7aa; color: #c2410c; }
        
        .no-data {
            text-align: center;
            padding: 20px;
            color: #a0aec0;
            font-style: italic;
            font-size: 13px;
        }
        
        .browser-status {
            background: white;
            padding: 20px;
            border-radius: 15px;
            margin-bottom: 25px;
            box-shadow: 0 8px 20px rgba(0,0,0,0.15);
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-left: 5px solid #cbd5e0;
        }
        
        .browser-status.healthy {
            border-left-color: #48bb78;
        }
        
        .browser-status.warning {
            border-left-color: #ed8936;
        }
        
        .browser-info {
            display: flex;
            align-items: center;
            gap: 15px;
            font-size: 14px;
            color: #4a5568;
        }
        
        .browser-icon {
            font-size: 24px;
        }
        
        .separator {
            color: #cbd5e0;
        }
        
        .browser-action {
            padding: 10px 20px;
            border: none;
            border-radius: 8px;
            background: linear-gradient(135deg, #f6ad55 0%, #ed8936 100%);
            color: white;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s;
        }
        
        .browser-action:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        }
        
        .dashboard-footer {
            background: white;
            padding: 20px;
            border-radius: 15px;
            box-shadow: 0 8px 20px rgba(0,0,0,0.15);
            text-align: center;
        }
        
        .dashboard-footer p {
            color: #4a5568;
            margin-bottom: 15px;
        }
        
        .footer-links {
            display: flex;
            gap: 15px;
            justify-content: center;
            flex-wrap: wrap;
        }
        
        .footer-links a {
            padding: 8px 16px;
            background: #f7fafc;
            border-radius: 6px;
            text-decoration: none;
            color: #4a5568;
            font-size: 13px;
            transition: all 0.2s;
        }
        
        .footer-links a:hover {
            background: #edf2f7;
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
        
        .toast.success { background: #48bb78; }
        .toast.error { background: #f56565; }
        .toast.warning { background: #ed8936; }
  `;
}

function getUnifiedScripts(): string {
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
        
        // Toast notification
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
            showToast('Triggering post...', 'warning');
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
                    showToast('✅ Post triggered!', 'success');
                    setTimeout(() => location.reload(), 2000);
                } else {
                    showToast('❌ Failed: ' + (data.error || 'Unknown error'), 'error');
                }
            } catch (error) {
                showToast('❌ Error: ' + error.message, 'error');
            }
        }
        
        async function runScraper() {
            showToast('Running scraper...', 'warning');
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
                    showToast('✅ Scraper started!', 'success');
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
                    showToast('✅ Harvester started!', 'success');
                    setTimeout(() => location.reload(), 3000);
                } else {
                    showToast('❌ Failed: ' + (data.error || 'Unknown error'), 'error');
                }
            } catch (error) {
                showToast('❌ Error: ' + error.message, 'error');
            }
        }
        
        async function restartBrowser() {
            if (!confirm('Restart browser? This will interrupt operations briefly.')) {
                return;
            }
            showToast('Restarting browser...', 'warning');
            try {
                const response = await fetch('/api/admin/restart-browser', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + (new URLSearchParams(window.location.search).get('token') || 'xbot-admin-2025')
                    }
                });
                const data = await response.json();
                if (response.ok) {
                    showToast('✅ Browser restarted!', 'success');
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
        <p>Failed to generate unified dashboard.</p>
        <pre style="background: #fff5f5; padding: 20px; border-radius: 8px; overflow-x: auto;">${error}</pre>
        <a href="/dashboard/health?token=xbot-admin-2025" style="display: inline-block; margin-top: 20px; padding: 12px 24px; background: #667eea; color: white; text-decoration: none; border-radius: 8px;">Retry</a>
    </div>
</body>
</html>`;
}

