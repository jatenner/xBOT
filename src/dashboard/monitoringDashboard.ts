/**
 * 📊 SYSTEM MONITORING DASHBOARD
 * 
 * Real-time monitoring focused on:
 * - What's happening right now
 * - Live error stream
 * - Rate tracking (2 posts/hour, 4 replies/hour expected)
 * - System health status
 * - Activity feed
 */

import { getSupabaseClient } from '../db/index';

interface MonitoringData {
  postingRate: {
    lastHour: number;
    expected: number;
    status: string;
    recentPosts: any[];
  };
  replyRate: {
    lastHour: number;
    expected: number;
    status: string;
    recentReplies: any[];
  };
  harvestingActivity: {
    lastHour: number;
    available: number;
    recentFinds: any[];
  };
  scrapingActivity: {
    lastHour: number;
    coverage: number;
    lastRun: string;
  };
  liveErrors: any[];
  systemStatus: {
    posting: boolean;
    replies: boolean;
    harvesting: boolean;
    scraping: boolean;
  };
  timestamp: Date;
}

export async function generateMonitoringDashboard(): Promise<string> {
  try {
    const supabase = getSupabaseClient();
    const now = new Date();
    
    const data = await fetchMonitoringData(supabase);
    
    return generateMonitoringHTML(data);
    
  } catch (error: any) {
    console.error('[MONITORING_DASHBOARD] Error:', error.message);
    return generateErrorHTML(error.message);
  }
}

async function fetchMonitoringData(supabase: any): Promise<MonitoringData> {
  const now = new Date();
  const lastHour = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  
  // POSTING RATE - Expected: 2 per hour
  const { data: postsLastHour } = await supabase
    .from('content_metadata')
    .select('content, posted_at, actual_impressions, actual_likes, decision_type, generator_name')
    .eq('status', 'posted')
    .in('decision_type', ['single', 'thread'])
    .gte('posted_at', lastHour)
    .order('posted_at', { ascending: false });
  
  // REPLY RATE - Expected: 4 per hour
  const { data: repliesLastHour } = await supabase
    .from('content_metadata')
    .select('content, posted_at, actual_impressions, actual_likes, reply_to_username')
    .eq('status', 'posted')
    .eq('decision_type', 'reply')
    .gte('posted_at', lastHour)
    .order('posted_at', { ascending: false });
  
  // HARVESTING ACTIVITY
  const { data: harvestedLastHour } = await supabase
    .from('reply_opportunities')
    .select('target_username, tier, like_count, created_at')
    .gte('created_at', lastHour)
    .order('created_at', { ascending: false });
  
  const { data: availableOpportunities } = await supabase
    .from('reply_opportunities')
    .select('*', { count: 'exact', head: true })
    .eq('replied_to', false)
    .or('expires_at.is.null,expires_at.gt.' + now.toISOString());
  
  // SCRAPING ACTIVITY
  const { data: lastScrape } = await supabase
    .from('outcomes')
    .select('collected_at')
    .eq('data_source', 'orchestrator_v2')
    .order('collected_at', { ascending: false })
    .limit(1)
    .single();
  
  const { data: scrapedLastHour } = await supabase
    .from('outcomes')
    .select('*', { count: 'exact', head: true })
    .eq('data_source', 'orchestrator_v2')
    .gte('collected_at', lastHour);
  
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
  const { data: allPosts } = await supabase
    .from('content_metadata')
    .select('actual_impressions')
    .eq('status', 'posted')
    .not('tweet_id', 'is', null)
    .gte('created_at', threeDaysAgo);
  
  const scraped = allPosts?.filter((p: any) => p.actual_impressions) || [];
  const coverage = allPosts?.length > 0 ? Math.round((scraped.length / allPosts.length) * 100) : 0;
  
  // LIVE ERRORS - Last hour
  const { data: errors } = await supabase
    .from('content_metadata')
    .select('decision_type, error_message, updated_at, content')
    .eq('status', 'failed')
    .gte('updated_at', lastHour)
    .order('updated_at', { ascending: false })
    .limit(20);
  
  const lastScrapeTime = lastScrape?.collected_at ? new Date(String(lastScrape.collected_at)) : null;
  const minutesSinceLastScrape = lastScrapeTime 
    ? Math.round((Date.now() - lastScrapeTime.getTime()) / (1000 * 60))
    : 999;
  
  return {
    postingRate: {
      lastHour: postsLastHour?.length || 0,
      expected: 2,
      status: (postsLastHour?.length || 0) >= 2 ? 'healthy' : 'warning',
      recentPosts: postsLastHour || []
    },
    replyRate: {
      lastHour: repliesLastHour?.length || 0,
      expected: 4,
      status: (repliesLastHour?.length || 0) >= 4 ? 'healthy' : 'warning',
      recentReplies: repliesLastHour || []
    },
    harvestingActivity: {
      lastHour: harvestedLastHour?.length || 0,
      available: availableOpportunities?.length || 0,
      recentFinds: harvestedLastHour || []
    },
    scrapingActivity: {
      lastHour: scrapedLastHour || 0,
      coverage,
      lastRun: minutesSinceLastScrape < 999 ? `${minutesSinceLastScrape}m ago` : 'Never'
    },
    liveErrors: errors || [],
    systemStatus: {
      posting: (postsLastHour?.length || 0) >= 1,
      replies: (repliesLastHour?.length || 0) >= 1,
      harvesting: (harvestedLastHour?.length || 0) >= 1,
      scraping: minutesSinceLastScrape < 30
    },
    timestamp: now
  };
}

function generateMonitoringHTML(data: MonitoringData): string {
  const timestamp = new Date(data.timestamp).toLocaleString();
  
  return `<!DOCTYPE html>
<html>
<head>
    <title>xBOT System Monitor</title>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        ${getMonitoringStyles()}
    </style>
</head>
<body>
    <div class="monitor-container">
        
        <!-- HEADER -->
        <div class="monitor-header">
            <h1>📊 xBOT System Monitor</h1>
            <p>Real-time activity tracking - Last updated: <span id="timestamp">${timestamp}</span></p>
            <div class="auto-refresh">
                <span class="pulse"></span>
                Refreshes in <span id="countdown">5</span>s
            </div>
        </div>

        <!-- RATE TRACKING -->
        <div class="section">
            <h2>📈 Hourly Rate Tracking</h2>
            <div class="rates-grid">
                
                <!-- POSTING RATE -->
                <div class="rate-card ${data.postingRate.status}">
                    <div class="rate-header">
                        <span class="rate-icon">📤</span>
                        <div class="rate-title">
                            <h3>Posting Rate</h3>
                            <p>Expected: 2 posts/hour</p>
                        </div>
                    </div>
                    <div class="rate-display">
                        <div class="rate-value">${data.postingRate.lastHour}</div>
                        <div class="rate-label">posts last hour</div>
                    </div>
                    <div class="rate-status ${data.postingRate.status}">
                        ${data.postingRate.lastHour >= data.postingRate.expected ? '✅ On Track' : '⚠️ Below Target'}
                    </div>
                    <div class="rate-bar">
                        <div class="rate-fill" style="width: ${Math.min((data.postingRate.lastHour / data.postingRate.expected) * 100, 100)}%"></div>
                    </div>
                </div>

                <!-- REPLY RATE -->
                <div class="rate-card ${data.replyRate.status}">
                    <div class="rate-header">
                        <span class="rate-icon">💬</span>
                        <div class="rate-title">
                            <h3>Reply Rate</h3>
                            <p>Expected: 4 replies/hour</p>
                        </div>
                    </div>
                    <div class="rate-display">
                        <div class="rate-value">${data.replyRate.lastHour}</div>
                        <div class="rate-label">replies last hour</div>
                    </div>
                    <div class="rate-status ${data.replyRate.status}">
                        ${data.replyRate.lastHour >= data.replyRate.expected ? '✅ On Track' : '⚠️ Below Target'}
                    </div>
                    <div class="rate-bar">
                        <div class="rate-fill" style="width: ${Math.min((data.replyRate.lastHour / data.replyRate.expected) * 100, 100)}%"></div>
                    </div>
                </div>

                <!-- HARVESTING ACTIVITY -->
                <div class="rate-card ${data.harvestingActivity.lastHour > 0 ? 'healthy' : 'neutral'}">
                    <div class="rate-header">
                        <span class="rate-icon">🌾</span>
                        <div class="rate-title">
                            <h3>Harvesting Activity</h3>
                            <p>Finding reply opportunities</p>
                        </div>
                    </div>
                    <div class="rate-display">
                        <div class="rate-value">${data.harvestingActivity.lastHour}</div>
                        <div class="rate-label">found last hour</div>
                    </div>
                    <div class="rate-status ${data.harvestingActivity.lastHour > 0 ? 'healthy' : 'neutral'}">
                        ${data.harvestingActivity.available} available
                    </div>
                </div>

                <!-- SCRAPING ACTIVITY -->
                <div class="rate-card ${data.scrapingActivity.lastRun.includes('m ago') && parseInt(data.scrapingActivity.lastRun) < 30 ? 'healthy' : 'warning'}">
                    <div class="rate-header">
                        <span class="rate-icon">📊</span>
                        <div class="rate-title">
                            <h3>Scraping Activity</h3>
                            <p>Metrics collection</p>
                        </div>
                    </div>
                    <div class="rate-display">
                        <div class="rate-value">${data.scrapingActivity.coverage}%</div>
                        <div class="rate-label">coverage</div>
                    </div>
                    <div class="rate-status">
                        Last run: ${data.scrapingActivity.lastRun}
                    </div>
                </div>

            </div>
        </div>

        <!-- SYSTEM STATUS -->
        <div class="section">
            <h2>🎯 System Status</h2>
            <div class="status-grid">
                <div class="status-item ${data.systemStatus.posting ? 'active' : 'inactive'}">
                    <span class="status-dot"></span>
                    <span>Posting System</span>
                    <span class="status-label">${data.systemStatus.posting ? 'Active' : 'Inactive'}</span>
                </div>
                <div class="status-item ${data.systemStatus.replies ? 'active' : 'inactive'}">
                    <span class="status-dot"></span>
                    <span>Reply System</span>
                    <span class="status-label">${data.systemStatus.replies ? 'Active' : 'Inactive'}</span>
                </div>
                <div class="status-item ${data.systemStatus.harvesting ? 'active' : 'inactive'}">
                    <span class="status-dot"></span>
                    <span>Harvesting</span>
                    <span class="status-label">${data.systemStatus.harvesting ? 'Active' : 'Inactive'}</span>
                </div>
                <div class="status-item ${data.systemStatus.scraping ? 'active' : 'inactive'}">
                    <span class="status-dot"></span>
                    <span>Scraping</span>
                    <span class="status-label">${data.systemStatus.scraping ? 'Active' : 'Inactive'}</span>
                </div>
            </div>
        </div>

        <!-- LIVE ERRORS -->
        ${data.liveErrors.length > 0 ? `
        <div class="section error-section">
            <h2>🚨 Live Errors (Last Hour)</h2>
            <div class="error-count">
                <span class="error-badge">${data.liveErrors.length}</span>
                <span>errors detected</span>
            </div>
            <div class="error-stream">
                ${data.liveErrors.map((error: any) => {
                    const age = Math.round((Date.now() - new Date(error.updated_at).getTime()) / (1000 * 60));
                    return `
                    <div class="error-item">
                        <div class="error-time">${age}m ago</div>
                        <div class="error-type">${error.decision_type}</div>
                        <div class="error-message">${error.error_message || 'Unknown error'}</div>
                        <div class="error-content">${(error.content || '').substring(0, 100)}...</div>
                    </div>
                `}).join('')}
            </div>
        </div>
        ` : ''}

        <!-- RECENT ACTIVITY -->
        <div class="section">
            <h2>🔄 Recent Activity</h2>
            
            <div class="activity-columns">
                
                <!-- RECENT POSTS -->
                <div class="activity-column">
                    <h3>📤 Recent Posts (Last Hour)</h3>
                    ${data.postingRate.recentPosts.length > 0 ? `
                        <div class="activity-stream">
                            ${data.postingRate.recentPosts.map((post: any) => {
                                const age = Math.round((Date.now() - new Date(post.posted_at).getTime()) / (1000 * 60));
                                return `
                                <div class="activity-item">
                                    <div class="activity-time">${age}m ago</div>
                                    <div class="activity-content">${(post.content || '').substring(0, 80)}...</div>
                                    <div class="activity-stats">
                                        <span>${post.actual_impressions || 0} views</span>
                                        <span>${post.actual_likes || 0} likes</span>
                                        <span class="activity-badge">${post.decision_type}</span>
                                    </div>
                                </div>
                            `}).join('')}
                        </div>
                    ` : '<div class="no-activity">No posts in last hour</div>'}
                </div>

                <!-- RECENT REPLIES -->
                <div class="activity-column">
                    <h3>💬 Recent Replies (Last Hour)</h3>
                    ${data.replyRate.recentReplies.length > 0 ? `
                        <div class="activity-stream">
                            ${data.replyRate.recentReplies.map((reply: any) => {
                                const age = Math.round((Date.now() - new Date(reply.posted_at).getTime()) / (1000 * 60));
                                return `
                                <div class="activity-item">
                                    <div class="activity-time">${age}m ago</div>
                                    <div class="activity-content">${(reply.content || '').substring(0, 80)}...</div>
                                    <div class="activity-stats">
                                        <span>@${reply.reply_to_username || 'unknown'}</span>
                                        <span>${reply.actual_impressions || 0} views</span>
                                        <span>${reply.actual_likes || 0} likes</span>
                                    </div>
                                </div>
                            `}).join('')}
                        </div>
                    ` : '<div class="no-activity">No replies in last hour</div>'}
                </div>

                <!-- RECENT HARVESTS -->
                <div class="activity-column">
                    <h3>🌾 Recent Harvests (Last Hour)</h3>
                    ${data.harvestingActivity.recentFinds.length > 0 ? `
                        <div class="activity-stream">
                            ${data.harvestingActivity.recentFinds.map((find: any) => {
                                const age = Math.round((Date.now() - new Date(find.created_at).getTime()) / (1000 * 60));
                                return `
                                <div class="activity-item">
                                    <div class="activity-time">${age}m ago</div>
                                    <div class="activity-content">@${find.target_username}</div>
                                    <div class="activity-stats">
                                        <span class="tier-badge ${find.tier?.toLowerCase()}">${find.tier}</span>
                                        <span>${(find.like_count || 0).toLocaleString()} likes</span>
                                    </div>
                                </div>
                            `}).join('')}
                        </div>
                    ` : '<div class="no-activity">No harvests in last hour</div>'}
                </div>

            </div>
        </div>

        <!-- FOOTER -->
        <div class="monitor-footer">
            <p>📊 Monitoring all system activity in real-time</p>
            <p style="font-size: 12px; color: #718096; margin-top: 5px;">
                Auto-refreshes every 5 seconds • Tracking: 2 posts/hour, 4 replies/hour
            </p>
        </div>

    </div>
    
    <script>
        ${getMonitoringScripts()}
    </script>
</body>
</html>`;
}

function getMonitoringStyles(): string {
  return `
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #1a202c 0%, #2d3748 100%);
            min-height: 100vh;
            padding: 20px;
            color: #e2e8f0;
        }
        
        .monitor-container {
            max-width: 1600px;
            margin: 0 auto;
        }
        
        .monitor-header {
            background: #2d3748;
            padding: 30px;
            border-radius: 15px;
            margin-bottom: 30px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.5);
            text-align: center;
            border: 1px solid #4a5568;
        }
        
        .monitor-header h1 {
            color: #e2e8f0;
            margin-bottom: 10px;
        }
        
        .monitor-header p {
            color: #a0aec0;
        }
        
        .auto-refresh {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            background: #48bb7820;
            padding: 8px 16px;
            border-radius: 20px;
            margin-top: 10px;
            font-size: 14px;
            color: #48bb78;
            border: 1px solid #48bb7840;
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
        
        .section {
            background: #2d3748;
            padding: 25px;
            border-radius: 15px;
            margin-bottom: 25px;
            box-shadow: 0 8px 20px rgba(0,0,0,0.3);
            border: 1px solid #4a5568;
        }
        
        .section h2 {
            color: #e2e8f0;
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 2px solid #4a5568;
        }
        
        .rates-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
        }
        
        .rate-card {
            background: #1a202c;
            padding: 20px;
            border-radius: 12px;
            border: 2px solid #4a5568;
        }
        
        .rate-card.healthy {
            border-color: #48bb78;
            background: #48bb7810;
        }
        
        .rate-card.warning {
            border-color: #ed8936;
            background: #ed893610;
        }
        
        .rate-card.neutral {
            border-color: #4299e1;
            background: #4299e110;
        }
        
        .rate-header {
            display: flex;
            align-items: center;
            gap: 15px;
            margin-bottom: 20px;
        }
        
        .rate-icon {
            font-size: 40px;
        }
        
        .rate-title h3 {
            color: #e2e8f0;
            margin-bottom: 5px;
            font-size: 18px;
        }
        
        .rate-title p {
            color: #a0aec0;
            font-size: 13px;
        }
        
        .rate-display {
            text-align: center;
            margin-bottom: 15px;
        }
        
        .rate-value {
            font-size: 48px;
            font-weight: bold;
            color: #e2e8f0;
        }
        
        .rate-label {
            font-size: 13px;
            color: #a0aec0;
            text-transform: uppercase;
        }
        
        .rate-status {
            text-align: center;
            padding: 8px;
            border-radius: 6px;
            font-size: 14px;
            font-weight: 600;
            margin-bottom: 15px;
        }
        
        .rate-status.healthy {
            background: #48bb7820;
            color: #48bb78;
        }
        
        .rate-status.warning {
            background: #ed893620;
            color: #ed8936;
        }
        
        .rate-bar {
            height: 8px;
            background: #1a202c;
            border-radius: 4px;
            overflow: hidden;
        }
        
        .rate-fill {
            height: 100%;
            background: linear-gradient(90deg, #48bb78 0%, #38a169 100%);
            transition: width 0.3s;
        }
        
        .status-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 15px;
        }
        
        .status-item {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 15px;
            background: #1a202c;
            border-radius: 10px;
            border: 2px solid #4a5568;
        }
        
        .status-item.active {
            border-color: #48bb78;
            background: #48bb7810;
        }
        
        .status-item.inactive {
            border-color: #718096;
            background: #71809610;
        }
        
        .status-dot {
            width: 12px;
            height: 12px;
            border-radius: 50%;
            background: #718096;
        }
        
        .status-item.active .status-dot {
            background: #48bb78;
            animation: pulse 2s infinite;
        }
        
        .status-label {
            margin-left: auto;
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
            color: #a0aec0;
        }
        
        .status-item.active .status-label {
            color: #48bb78;
        }
        
        .error-section {
            border: 2px solid #f56565;
            background: #f5656510;
        }
        
        .error-count {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 20px;
            padding: 15px;
            background: #f5656520;
            border-radius: 8px;
        }
        
        .error-badge {
            background: #f56565;
            color: white;
            padding: 5px 15px;
            border-radius: 20px;
            font-size: 20px;
            font-weight: bold;
        }
        
        .error-stream {
            display: flex;
            flex-direction: column;
            gap: 12px;
        }
        
        .error-item {
            background: #1a202c;
            padding: 15px;
            border-radius: 8px;
            border-left: 4px solid #f56565;
        }
        
        .error-time {
            font-size: 12px;
            color: #f56565;
            margin-bottom: 8px;
            font-weight: 600;
        }
        
        .error-type {
            display: inline-block;
            padding: 4px 10px;
            background: #f5656520;
            color: #f56565;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
            margin-bottom: 8px;
        }
        
        .error-message {
            font-size: 13px;
            color: #fc8181;
            margin-bottom: 8px;
            font-family: monospace;
        }
        
        .error-content {
            font-size: 12px;
            color: #a0aec0;
        }
        
        .activity-columns {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
            gap: 20px;
        }
        
        .activity-column h3 {
            color: #e2e8f0;
            margin-bottom: 15px;
            font-size: 16px;
        }
        
        .activity-stream {
            display: flex;
            flex-direction: column;
            gap: 10px;
        }
        
        .activity-item {
            background: #1a202c;
            padding: 12px;
            border-radius: 8px;
            border-left: 3px solid #4a5568;
        }
        
        .activity-time {
            font-size: 11px;
            color: #48bb78;
            margin-bottom: 6px;
            font-weight: 600;
        }
        
        .activity-content {
            font-size: 13px;
            color: #e2e8f0;
            margin-bottom: 8px;
        }
        
        .activity-stats {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
            font-size: 12px;
            color: #a0aec0;
        }
        
        .activity-badge {
            padding: 2px 8px;
            background: #4a5568;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
        }
        
        .tier-badge {
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
        }
        
        .tier-badge.platinum { background: #047857; color: white; }
        .tier-badge.diamond { background: #92400e; color: white; }
        .tier-badge.golden { background: #c2410c; color: white; }
        
        .no-activity {
            text-align: center;
            padding: 30px;
            color: #718096;
            font-style: italic;
        }
        
        .monitor-footer {
            text-align: center;
            padding: 20px;
            color: #a0aec0;
        }
  `;
}

function getMonitoringScripts(): string {
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
  `;
}

function generateErrorHTML(error: string): string {
  return `<!DOCTYPE html>
<html>
<head>
    <title>Monitor Error</title>
    <meta charset="UTF-8">
</head>
<body style="font-family: sans-serif; padding: 40px; background: #1a202c; color: #e2e8f0;">
    <div style="max-width: 800px; margin: 0 auto; background: #2d3748; padding: 40px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.5);">
        <h1 style="color: #f56565;">❌ Monitor Error</h1>
        <p>Failed to generate monitoring dashboard.</p>
        <pre style="background: #1a202c; padding: 20px; border-radius: 8px; overflow-x: auto; color: #e2e8f0;">${error}</pre>
        <a href="/dashboard/health?token=xbot-admin-2025" style="display: inline-block; margin-top: 20px; padding: 12px 24px; background: #667eea; color: white; text-decoration: none; border-radius: 8px;">Retry</a>
    </div>
</body>
</html>`;
}

