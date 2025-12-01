/**
 * 📊 COMPREHENSIVE DASHBOARD
 * Complete view of content generation, posting, performance, learning, and system health
 */

import { getSupabaseClient } from '../db';

export async function generateComprehensiveDashboard(): Promise<string> {
  const supabase = getSupabaseClient();
  const now = new Date();
  const todayStart = new Date(now.setHours(0, 0, 0, 0));
  const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
  const last7Days = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);
  
  // Fetch all data in parallel
  const [
    todayPosts,
    yesterdayPosts,
    recentPosts,
    postingAttempts,
    queuedContent,
    topics,
    duplicates,
    systemFailures
  ] = await Promise.all([
    // Today's posts
    supabase.from('content_metadata')
      .select('*')
      .in('decision_type', ['single', 'thread'])
      .gte('posted_at', todayStart.toISOString())
      .order('posted_at', { ascending: false }),
    
    // Yesterday's posts
    supabase.from('content_metadata')
      .select('*')
      .in('decision_type', ['single', 'thread'])
      .gte('posted_at', yesterdayStart.toISOString())
      .lt('posted_at', todayStart.toISOString())
      .order('posted_at', { ascending: false }),
    
    // Recent posts (last 7 days)
    supabase.from('content_metadata')
      .select('*')
      .in('decision_type', ['single', 'thread'])
      .gte('posted_at', last7Days.toISOString())
      .order('posted_at', { ascending: false })
      .limit(100),
    
    // Posting attempts (last 24h)
    supabase.from('posting_attempts')
      .select('status, error_message, decision_type, created_at')
      .gte('created_at', yesterdayStart.toISOString())
      .order('created_at', { ascending: false }),
    
    // Queued content
    supabase.from('content_metadata')
      .select('decision_id, decision_type, raw_topic, created_at, status')
      .eq('status', 'queued')
      .order('created_at', { ascending: false }),
    
    // Topics (last 7 days)
    supabase.from('content_metadata')
      .select('raw_topic')
      .in('decision_type', ['single', 'thread'])
      .gte('created_at', last7Days.toISOString())
      .not('raw_topic', 'is', null),
    
    // Check for duplicates (by content_hash or similar content)
    supabase.from('content_metadata')
      .select('content, content_hash, created_at')
      .in('decision_type', ['single', 'thread'])
      .gte('created_at', last7Days.toISOString())
      .not('content_hash', 'is', null),
    
    // System failures (from posting_attempts)
    supabase.from('posting_attempts')
      .select('status, error_message, created_at')
      .eq('status', 'failed')
      .gte('created_at', yesterdayStart.toISOString())
      .order('created_at', { ascending: false })
      .limit(50)
  ]);
  
  return generateDashboardHTML({
    todayPosts: todayPosts.data || [],
    yesterdayPosts: yesterdayPosts.data || [],
    recentPosts: recentPosts.data || [],
    postingAttempts: postingAttempts.data || [],
    queuedContent: queuedContent.data || [],
    topics: topics.data || [],
    duplicates: duplicates.data || [],
    systemFailures: systemFailures.data || []
  });
}

function generateDashboardHTML(data: any): string {
  const {
    todayPosts,
    yesterdayPosts,
    recentPosts,
    postingAttempts,
    queuedContent,
    topics,
    duplicates,
    systemFailures
  } = data;
  
  // Calculate metrics
  const finalAttempts = postingAttempts.filter((a: any) => a.status !== 'attempting');
  const successCount = finalAttempts.filter((a: any) => a.status === 'success').length;
  const failedCount = finalAttempts.filter((a: any) => a.status === 'failed').length;
  const successRate = finalAttempts.length > 0 ? (successCount / finalAttempts.length) * 100 : 0;
  
  // Today vs Yesterday metrics
  const todayViews = todayPosts.reduce((sum: number, p: any) => sum + (p.actual_impressions || 0), 0);
  const yesterdayViews = yesterdayPosts.reduce((sum: number, p: any) => sum + (p.actual_impressions || 0), 0);
  const todayLikes = todayPosts.reduce((sum: number, p: any) => sum + (p.actual_likes || 0), 0);
  const yesterdayLikes = yesterdayPosts.reduce((sum: number, p: any) => sum + (p.actual_likes || 0), 0);
  const todayPostsCount = todayPosts.length;
  const yesterdayPostsCount = yesterdayPosts.length;
  
  const viewsChange = yesterdayViews > 0 ? ((todayViews - yesterdayViews) / yesterdayViews * 100) : 0;
  const likesChange = yesterdayLikes > 0 ? ((todayLikes - yesterdayLikes) / yesterdayLikes * 100) : 0;
  
  // Topic analysis
  const topicCounts: Record<string, number> = {};
  topics.forEach((t: any) => {
    const topic = t.raw_topic || 'Unknown';
    topicCounts[topic] = (topicCounts[topic] || 0) + 1;
  });
  const topTopics = Object.entries(topicCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  
  // Duplicate detection
  const contentHashes: Record<string, number> = {};
  duplicates.forEach((d: any) => {
    const hash = d.content_hash || 'no-hash';
    contentHashes[hash] = (contentHashes[hash] || 0) + 1;
  });
  const duplicateCount = Object.values(contentHashes).filter(count => count > 1).length;
  
  // Failure analysis
  const failureTypes: Record<string, number> = {};
  systemFailures.forEach((f: any) => {
    const error = f.error_message || 'Unknown error';
    let category = 'Other';
    if (/timeout|exceeded/i.test(error)) category = 'Timeout';
    else if (/session|auth/i.test(error)) category = 'Authentication';
    else if (/rate.*limit/i.test(error)) category = 'Rate Limit';
    else if (/network/i.test(error)) category = 'Network';
    else if (/content|validation/i.test(error)) category = 'Content Validation';
    failureTypes[category] = (failureTypes[category] || 0) + 1;
  });
  
  // Content generation stats
  const queuedByType: Record<string, number> = {};
  queuedContent.forEach((q: any) => {
    const type = q.decision_type || 'unknown';
    queuedByType[type] = (queuedByType[type] || 0) + 1;
  });
  
  return `<!DOCTYPE html>
<html>
<head>
    <title>xBOT Comprehensive Dashboard</title>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="refresh" content="60">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: #f5f5f5;
            color: #333;
            line-height: 1.6;
        }
        
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px 20px;
            text-align: center;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        
        .header h1 {
            font-size: 2.5em;
            margin-bottom: 10px;
        }
        
        .tabs {
            display: flex;
            justify-content: center;
            background: white;
            border-bottom: 2px solid #e5e7eb;
            padding: 0 20px;
            flex-wrap: wrap;
        }
        
        .tab {
            background: none;
            border: none;
            padding: 15px 25px;
            font-size: 1em;
            cursor: pointer;
            color: #666;
            transition: all 0.3s;
            border-bottom: 3px solid transparent;
        }
        
        .tab:hover {
            color: #667eea;
        }
        
        .tab.active {
            color: #667eea;
            border-bottom-color: #667eea;
            font-weight: 600;
        }
        
        .tab-content {
            display: none;
            padding: 30px 20px;
            max-width: 1400px;
            margin: 0 auto;
        }
        
        .tab-content.active {
            display: block;
        }
        
        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        
        .metric-card {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.05);
        }
        
        .metric-card h3 {
            font-size: 0.9em;
            color: #666;
            margin-bottom: 10px;
            text-transform: uppercase;
        }
        
        .metric-value {
            font-size: 2em;
            font-weight: 600;
            color: #333;
        }
        
        .metric-change {
            font-size: 0.9em;
            margin-top: 5px;
        }
        
        .metric-change.positive {
            color: #10b981;
        }
        
        .metric-change.negative {
            color: #ef4444;
        }
        
        .section {
            background: white;
            padding: 25px;
            border-radius: 8px;
            margin-bottom: 20px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.05);
        }
        
        .section h2 {
            font-size: 1.5em;
            margin-bottom: 20px;
            color: #333;
            border-bottom: 2px solid #e5e7eb;
            padding-bottom: 10px;
        }
        
        .status-badge {
            display: inline-block;
            padding: 5px 12px;
            border-radius: 20px;
            font-size: 0.85em;
            font-weight: 600;
        }
        
        .status-badge.success {
            background: #d1fae5;
            color: #065f46;
        }
        
        .status-badge.warning {
            background: #fef3c7;
            color: #92400e;
        }
        
        .status-badge.error {
            background: #fee2e2;
            color: #991b1b;
        }
        
        .topic-list {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
        }
        
        .topic-tag {
            background: #f3f4f6;
            padding: 8px 15px;
            border-radius: 20px;
            font-size: 0.9em;
        }
        
        .topic-tag .count {
            background: #667eea;
            color: white;
            padding: 2px 8px;
            border-radius: 10px;
            margin-left: 8px;
            font-weight: 600;
        }
        
        .failure-item {
            padding: 10px;
            margin-bottom: 10px;
            background: #fef2f2;
            border-left: 4px solid #ef4444;
            border-radius: 4px;
        }
        
        .failure-item .error-type {
            font-weight: 600;
            color: #991b1b;
            margin-bottom: 5px;
        }
        
        .failure-item .error-message {
            font-size: 0.9em;
            color: #666;
        }
        
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 15px;
        }
        
        th, td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #e5e7eb;
        }
        
        th {
            background: #f9fafb;
            font-weight: 600;
            color: #666;
        }
        
        .progress-bar {
            width: 100%;
            height: 20px;
            background: #e5e7eb;
            border-radius: 10px;
            overflow: hidden;
            margin-top: 10px;
        }
        
        .progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #667eea, #764ba2);
            transition: width 0.3s;
        }
        
        .progress-fill.success {
            background: linear-gradient(90deg, #10b981, #059669);
        }
        
        .progress-fill.warning {
            background: linear-gradient(90deg, #f59e0b, #d97706);
        }
        
        .progress-fill.error {
            background: linear-gradient(90deg, #ef4444, #dc2626);
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>📊 xBOT Comprehensive Dashboard</h1>
        <p>Complete system overview: Content → Posting → Performance → Learning</p>
    </div>
    
    <div class="tabs">
        <button class="tab active" onclick="showTab('overview')">Overview</button>
        <button class="tab" onclick="showTab('content')">Content Generation</button>
        <button class="tab" onclick="showTab('posting')">Posting System</button>
        <button class="tab" onclick="showTab('performance')">Performance</button>
        <button class="tab" onclick="showTab('learning')">Learning</button>
        <button class="tab" onclick="showTab('health')">System Health</button>
    </div>
    
    <!-- Overview Tab -->
    <div id="overview" class="tab-content active">
        <div class="metrics-grid">
            <div class="metric-card">
                <h3>Today's Posts</h3>
                <div class="metric-value">${todayPostsCount}</div>
                <div class="metric-change ${todayPostsCount >= yesterdayPostsCount ? 'positive' : 'negative'}">
                    ${todayPostsCount >= yesterdayPostsCount ? '↑' : '↓'} ${Math.abs(todayPostsCount - yesterdayPostsCount)} vs yesterday
                </div>
            </div>
            
            <div class="metric-card">
                <h3>Today's Views</h3>
                <div class="metric-value">${formatNumber(todayViews)}</div>
                <div class="metric-change ${viewsChange >= 0 ? 'positive' : 'negative'}">
                    ${viewsChange >= 0 ? '↑' : '↓'} ${Math.abs(viewsChange).toFixed(1)}% vs yesterday
                </div>
            </div>
            
            <div class="metric-card">
                <h3>Today's Likes</h3>
                <div class="metric-value">${formatNumber(todayLikes)}</div>
                <div class="metric-change ${likesChange >= 0 ? 'positive' : 'negative'}">
                    ${likesChange >= 0 ? '↑' : '↓'} ${Math.abs(likesChange).toFixed(1)}% vs yesterday
                </div>
            </div>
            
            <div class="metric-card">
                <h3>Posting Success Rate</h3>
                <div class="metric-value">${successRate.toFixed(1)}%</div>
                <div class="progress-bar">
                    <div class="progress-fill ${successRate >= 70 ? 'success' : successRate >= 50 ? 'warning' : 'error'}" 
                         style="width: ${successRate}%"></div>
                </div>
            </div>
            
            <div class="metric-card">
                <h3>Content Queue</h3>
                <div class="metric-value">${queuedContent.length}</div>
                <div style="font-size: 0.9em; color: #666; margin-top: 5px;">
                    ${Object.entries(queuedByType).map(([type, count]) => `${count} ${type}s`).join(', ')}
                </div>
            </div>
            
            <div class="metric-card">
                <h3>Unique Topics</h3>
                <div class="metric-value">${topTopics.length}</div>
                <div style="font-size: 0.9em; color: #666; margin-top: 5px;">
                    Last 7 days
                </div>
            </div>
        </div>
        
        <div class="section">
            <h2>🚨 System Status</h2>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
                <div>
                    <span class="status-badge ${successRate >= 70 ? 'success' : successRate >= 50 ? 'warning' : 'error'}">
                        Posting: ${successRate >= 70 ? 'Healthy' : successRate >= 50 ? 'Warning' : 'Critical'}
                    </span>
                </div>
                <div>
                    <span class="status-badge ${queuedContent.length > 10 ? 'success' : queuedContent.length > 5 ? 'warning' : 'error'}">
                        Queue: ${queuedContent.length > 10 ? 'Good' : queuedContent.length > 5 ? 'Low' : 'Empty'}
                    </span>
                </div>
                <div>
                    <span class="status-badge ${duplicateCount === 0 ? 'success' : 'warning'}">
                        Duplicates: ${duplicateCount === 0 ? 'None' : duplicateCount}
                    </span>
                </div>
            </div>
        </div>
    </div>
    
    <!-- Content Generation Tab -->
    <div id="content" class="tab-content">
        <div class="section">
            <h2>📝 Content Generation</h2>
            <div class="metrics-grid">
                <div class="metric-card">
                    <h3>Queued Content</h3>
                    <div class="metric-value">${queuedContent.length}</div>
                </div>
                <div class="metric-card">
                    <h3>Generated Today</h3>
                    <div class="metric-value">${todayPostsCount}</div>
                </div>
                <div class="metric-card">
                    <h3>Duplicates Detected</h3>
                    <div class="metric-value">${duplicateCount}</div>
                </div>
            </div>
        </div>
        
        <div class="section">
            <h2>🎯 Topics (Last 7 Days)</h2>
            <div class="topic-list">
                ${topTopics.map(([topic, count]: [string, number]) => `
                    <div class="topic-tag">
                        ${topic}
                        <span class="count">${count}</span>
                    </div>
                `).join('')}
            </div>
        </div>
        
        <div class="section">
            <h2>📋 Queued Content</h2>
            <table>
                <thead>
                    <tr>
                        <th>Type</th>
                        <th>Topic</th>
                        <th>Created</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${queuedContent.slice(0, 20).map((q: any) => `
                        <tr>
                            <td>${q.decision_type}</td>
                            <td>${q.raw_topic || 'N/A'}</td>
                            <td>${formatTimeAgo(q.created_at)}</td>
                            <td><span class="status-badge warning">${q.status}</span></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    </div>
    
    <!-- Posting Tab -->
    <div id="posting" class="tab-content">
        <div class="section">
            <h2>📮 Posting System</h2>
            <div class="metrics-grid">
                <div class="metric-card">
                    <h3>Success Rate</h3>
                    <div class="metric-value">${successRate.toFixed(1)}%</div>
                    <div class="progress-bar">
                        <div class="progress-fill ${successRate >= 70 ? 'success' : successRate >= 50 ? 'warning' : 'error'}" 
                             style="width: ${successRate}%"></div>
                    </div>
                </div>
                <div class="metric-card">
                    <h3>Successful</h3>
                    <div class="metric-value">${successCount}</div>
                </div>
                <div class="metric-card">
                    <h3>Failed</h3>
                    <div class="metric-value">${failedCount}</div>
                </div>
            </div>
        </div>
        
        <div class="section">
            <h2>❌ Failure Types (Last 24h)</h2>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
                ${Object.entries(failureTypes).map(([type, count]: [string, number]) => `
                    <div class="metric-card">
                        <h3>${type}</h3>
                        <div class="metric-value">${count}</div>
                    </div>
                `).join('')}
            </div>
        </div>
        
        <div class="section">
            <h2>🔍 Recent Failures</h2>
            ${systemFailures.slice(0, 10).map((f: any) => `
                <div class="failure-item">
                    <div class="error-type">${categorizeError(f.error_message || 'Unknown')}</div>
                    <div class="error-message">${(f.error_message || 'No error message').substring(0, 200)}</div>
                    <div style="font-size: 0.8em; color: #999; margin-top: 5px;">
                        ${formatTimeAgo(f.created_at)}
                    </div>
                </div>
            `).join('')}
        </div>
    </div>
    
    <!-- Performance Tab -->
    <div id="performance" class="tab-content">
        <div class="section">
            <h2>📊 Performance Metrics</h2>
            <div class="metrics-grid">
                <div class="metric-card">
                    <h3>Today vs Yesterday</h3>
                    <div style="margin-top: 15px;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                            <span>Views:</span>
                            <span><strong>${formatNumber(todayViews)}</strong> vs ${formatNumber(yesterdayViews)}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                            <span>Likes:</span>
                            <span><strong>${formatNumber(todayLikes)}</strong> vs ${formatNumber(yesterdayLikes)}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between;">
                            <span>Posts:</span>
                            <span><strong>${todayPostsCount}</strong> vs ${yesterdayPostsCount}</span>
                        </div>
                    </div>
                </div>
                <div class="metric-card">
                    <h3>Avg Views/Post</h3>
                    <div class="metric-value">${todayPostsCount > 0 ? formatNumber(Math.round(todayViews / todayPostsCount)) : 0}</div>
                </div>
                <div class="metric-card">
                    <h3>Avg Likes/Post</h3>
                    <div class="metric-value">${todayPostsCount > 0 ? formatNumber(Math.round(todayLikes / todayPostsCount)) : 0}</div>
                </div>
            </div>
        </div>
        
        <div class="section">
            <h2>📈 Recent Posts Performance</h2>
            <table>
                <thead>
                    <tr>
                        <th>Posted</th>
                        <th>Type</th>
                        <th>Views</th>
                        <th>Likes</th>
                        <th>Retweets</th>
                        <th>ER</th>
                        <th>Topic</th>
                    </tr>
                </thead>
                <tbody>
                    ${recentPosts.slice(0, 20).map((p: any) => `
                        <tr>
                            <td>${formatTimeAgo(p.posted_at)}</td>
                            <td>${p.decision_type}</td>
                            <td>${formatNumber(p.actual_impressions || 0)}</td>
                            <td>${formatNumber(p.actual_likes || 0)}</td>
                            <td>${formatNumber(p.actual_retweets || 0)}</td>
                            <td>${p.actual_engagement_rate ? (p.actual_engagement_rate * 100).toFixed(2) + '%' : 'N/A'}</td>
                            <td>${p.raw_topic || 'N/A'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    </div>
    
    <!-- Learning Tab -->
    <div id="learning" class="tab-content">
        <div class="section">
            <h2>🧠 Learning System</h2>
            <p style="color: #666; margin-bottom: 20px;">
                The learning system analyzes performance patterns to optimize content generation.
            </p>
            <div class="metrics-grid">
                <div class="metric-card">
                    <h3>Posts Analyzed</h3>
                    <div class="metric-value">${recentPosts.length}</div>
                </div>
                <div class="metric-card">
                    <h3>Topics Tracked</h3>
                    <div class="metric-value">${topTopics.length}</div>
                </div>
            </div>
        </div>
        
        <div class="section">
            <h2>🎯 Top Performing Topics</h2>
            <table>
                <thead>
                    <tr>
                        <th>Topic</th>
                        <th>Posts</th>
                        <th>Avg Views</th>
                        <th>Avg Likes</th>
                    </tr>
                </thead>
                <tbody>
                    ${topTopics.slice(0, 10).map(([topic, count]: [string, number]) => {
                        const topicPosts = recentPosts.filter((p: any) => p.raw_topic === topic);
                        const avgViews = topicPosts.length > 0 
                            ? Math.round(topicPosts.reduce((sum: number, p: any) => sum + (p.actual_impressions || 0), 0) / topicPosts.length)
                            : 0;
                        const avgLikes = topicPosts.length > 0
                            ? Math.round(topicPosts.reduce((sum: number, p: any) => sum + (p.actual_likes || 0), 0) / topicPosts.length)
                            : 0;
                        return `
                            <tr>
                                <td>${topic}</td>
                                <td>${count}</td>
                                <td>${formatNumber(avgViews)}</td>
                                <td>${formatNumber(avgLikes)}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    </div>
    
    <!-- System Health Tab -->
    <div id="health" class="tab-content">
        <div class="section">
            <h2>🏥 System Health</h2>
            <div class="metrics-grid">
                <div class="metric-card">
                    <h3>Posting Health</h3>
                    <div class="metric-value">
                        <span class="status-badge ${successRate >= 70 ? 'success' : successRate >= 50 ? 'warning' : 'error'}">
                            ${successRate >= 70 ? 'Healthy' : successRate >= 50 ? 'Warning' : 'Critical'}
                        </span>
                    </div>
                </div>
                <div class="metric-card">
                    <h3>Content Queue</h3>
                    <div class="metric-value">
                        <span class="status-badge ${queuedContent.length > 10 ? 'success' : queuedContent.length > 5 ? 'warning' : 'error'}">
                            ${queuedContent.length > 10 ? 'Good' : queuedContent.length > 5 ? 'Low' : 'Empty'}
                        </span>
                    </div>
                </div>
                <div class="metric-card">
                    <h3>Duplicate Detection</h3>
                    <div class="metric-value">
                        <span class="status-badge ${duplicateCount === 0 ? 'success' : 'warning'}">
                            ${duplicateCount === 0 ? 'Clean' : duplicateCount + ' found'}
                        </span>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="section">
            <h2>⚠️ Recent System Failures</h2>
            ${systemFailures.length > 0 ? systemFailures.slice(0, 20).map((f: any) => `
                <div class="failure-item">
                    <div class="error-type">${categorizeError(f.error_message || 'Unknown')}</div>
                    <div class="error-message">${(f.error_message || 'No error message').substring(0, 300)}</div>
                    <div style="font-size: 0.8em; color: #999; margin-top: 5px;">
                        ${formatTimeAgo(f.created_at)}
                    </div>
                </div>
            `).join('') : '<p style="color: #666;">No recent failures! System is healthy.</p>'}
        </div>
    </div>
    
    <script>
        function showTab(tabName) {
            const tabs = document.querySelectorAll('.tab');
            const contents = document.querySelectorAll('.tab-content');
            
            tabs.forEach(tab => tab.classList.remove('active'));
            contents.forEach(content => content.classList.remove('active'));
            
            event.currentTarget.classList.add('active');
            document.getElementById(tabName).classList.add('active');
        }
    </script>
</body>
</html>`;
}

function formatNumber(num: number): string {
  if (!num) return '0';
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

function formatTimeAgo(isoDate: string | null | undefined): string {
  if (!isoDate) return 'N/A';
  const date = new Date(isoDate);
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function categorizeError(error: string): string {
  if (/timeout|exceeded/i.test(error)) return 'Timeout';
  if (/session|auth/i.test(error)) return 'Authentication';
  if (/rate.*limit/i.test(error)) return 'Rate Limit';
  if (/network/i.test(error)) return 'Network';
  if (/content|validation/i.test(error)) return 'Content Validation';
  return 'Other';
}
