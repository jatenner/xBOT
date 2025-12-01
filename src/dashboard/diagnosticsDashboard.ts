/**
 * 🤖 INTELLIGENT DIAGNOSTICS DASHBOARD
 * Chatbot-style dashboard that explains system health in plain English
 */

import { DiagnosticEngine } from '../diagnostics/diagnosticEngine';
import { getSupabaseClient } from '../db';
import { JobManager } from '../jobs/jobManager';

export async function generateDiagnosticsDashboard(): Promise<string> {
  try {
    const engine = DiagnosticEngine.getInstance();
    const diagnostics = await engine.runDiagnostics();
    const supabase = getSupabaseClient();
    const jobManager = JobManager.getInstance();
    const stats = jobManager.getStats();

    // Get recent activity
    const { data: recentPosts } = await supabase
      .from('content_metadata')
      .select('content, posted_at, status, decision_type')
      .order('created_at', { ascending: false })
      .limit(10);

    // Get today's stats
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const { data: todayPosts } = await supabase
      .from('content_metadata')
      .select('decision_id, decision_type, actual_impressions, actual_likes')
      .eq('status', 'posted')
      .gte('posted_at', todayStart.toISOString());

    const postedToday = todayPosts?.filter(p => p.decision_type === 'single').length || 0;
    const repliedToday = todayPosts?.filter(p => p.decision_type === 'reply').length || 0;
    const totalViews = todayPosts?.reduce((sum, p) => sum + (p.actual_impressions || 0), 0) || 0;
    const totalLikes = todayPosts?.reduce((sum, p) => sum + (p.actual_likes || 0), 0) || 0;

    return generateDiagnosticsHTML({
      diagnostics,
      recentPosts: recentPosts || [],
      stats: {
        postedToday,
        repliedToday,
        totalViews,
        totalLikes
      }
    });
  } catch (error: any) {
    console.error('[DIAGNOSTICS_DASHBOARD] Error:', error.message);
    return generateErrorHTML(error.message);
  }
}

function generateDiagnosticsHTML(data: any): string {
  const now = new Date().toLocaleString();
  const { diagnostics, recentPosts, stats } = data;
  
  const statusEmoji = diagnostics.overallStatus === 'healthy' ? '🟢' : 
                     diagnostics.overallStatus === 'warning' ? '🟡' : '🔴';
  const statusColor = diagnostics.overallStatus === 'healthy' ? '#10b981' :
                     diagnostics.overallStatus === 'warning' ? '#f59e0b' : '#ef4444';

  // Sort messages by severity (errors first, then warnings, then success)
  const sortedMessages = [...diagnostics.messages].sort((a, b) => {
    const severityOrder = { high: 0, medium: 1, low: 2 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });

  return `<!DOCTYPE html>
<html>
<head>
    <title>🤖 xBOT System Diagnostics</title>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        ${getSharedStyles()}
        .chat-message {
            background: white;
            padding: 20px;
            border-radius: 12px;
            margin-bottom: 15px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            border-left: 4px solid #667eea;
        }
        .chat-message.system {
            border-left-color: #667eea;
        }
        .chat-message.success {
            border-left-color: #10b981;
            background: #f0fdf4;
        }
        .chat-message.warning {
            border-left-color: #f59e0b;
            background: #fffbeb;
        }
        .chat-message.error {
            border-left-color: #ef4444;
            background: #fef2f2;
        }
        .chat-message.info {
            border-left-color: #3b82f6;
            background: #eff6ff;
        }
        .message-header {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 10px;
        }
        .message-header .icon {
            font-size: 24px;
        }
        .message-header .title {
            font-weight: 600;
            font-size: 16px;
            color: #333;
        }
        .message-content {
            color: #555;
            line-height: 1.6;
            margin-bottom: 8px;
        }
        .message-explanation {
            color: #777;
            font-size: 14px;
            margin-top: 8px;
            padding-top: 8px;
            border-top: 1px solid #e5e7eb;
        }
        .message-action {
            color: #667eea;
            font-weight: 600;
            font-size: 14px;
            margin-top: 8px;
        }
        .status-badge {
            display: inline-block;
            padding: 8px 16px;
            border-radius: 20px;
            font-weight: 600;
            font-size: 14px;
            margin-left: 10px;
        }
        .status-badge.healthy {
            background: #d1fae5;
            color: #065f46;
        }
        .status-badge.warning {
            background: #fef3c7;
            color: #92400e;
        }
        .status-badge.critical {
            background: #fee2e2;
            color: #991b1b;
        }
        .stage-card {
            background: white;
            padding: 20px;
            border-radius: 12px;
            margin-bottom: 15px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .stage-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
        }
        .stage-name {
            font-weight: 600;
            font-size: 18px;
            color: #333;
        }
        .stage-status {
            padding: 6px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
        }
        .stage-status.active {
            background: #d1fae5;
            color: #065f46;
        }
        .stage-status.warning {
            background: #fef3c7;
            color: #92400e;
        }
        .stage-status.error {
            background: #fee2e2;
            color: #991b1b;
        }
        .activity-item {
            padding: 12px;
            background: #f9fafb;
            border-radius: 8px;
            margin-bottom: 8px;
            border-left: 3px solid #667eea;
        }
        .activity-time {
            color: #666;
            font-size: 12px;
            margin-bottom: 4px;
        }
        .activity-text {
            color: #333;
            font-size: 14px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🤖 xBOT System Health</h1>
            <p>Intelligent diagnostics and system monitoring</p>
        </div>

        <div class="nav-tabs">
            <a href="/dashboard/diagnostics?token=xbot-admin-2025" class="nav-tab active">🤖 Diagnostics</a>
            <a href="/dashboard/recent?token=xbot-admin-2025" class="nav-tab">📅 Recent</a>
            <a href="/dashboard/posts?token=xbot-admin-2025" class="nav-tab">📊 Metrics</a>
            <a href="/dashboard/replies?token=xbot-admin-2025" class="nav-tab">💬 Replies</a>
            <a href="/dashboard/system-flow?token=xbot-admin-2025" class="nav-tab">🔍 System Flow</a>
            <a href="/dashboard/data-validation?token=xbot-admin-2025" class="nav-tab">🔬 Data Validation</a>
        </div>

        <div class="section">
            <div style="display: flex; align-items: center; margin-bottom: 20px;">
                <h2 style="margin: 0;">${statusEmoji} System Status</h2>
                <span class="status-badge ${diagnostics.overallStatus}">
                    ${diagnostics.overallStatus.toUpperCase()}
                </span>
            </div>

            ${sortedMessages.map((msg: any) => `
                <div class="chat-message ${msg.type}">
                    <div class="message-header">
                        <span class="icon">${msg.type === 'success' ? '✅' : msg.type === 'warning' ? '⚠️' : msg.type === 'error' ? '❌' : 'ℹ️'}</span>
                        <span class="title">${msg.message}</span>
                    </div>
                    ${msg.explanation ? `<div class="message-content">${msg.explanation}</div>` : ''}
                    ${msg.action ? `<div class="message-action">🔧 ${msg.action}</div>` : ''}
                    ${msg.status === 'investigating' ? `<div style="color: #667eea; font-size: 12px; margin-top: 8px;">🔄 Status: Investigating and fixing automatically...</div>` : ''}
                </div>
            `).join('')}
        </div>

        <div class="section">
            <h2>📊 Today's Activity</h2>
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-label">Posts Published</div>
                    <div class="stat-value">${stats.postedToday}</div>
                    <div class="stat-change">Target: 2 posts/day</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Replies Sent</div>
                    <div class="stat-value">${stats.repliedToday}</div>
                    <div class="stat-change">Target: 3 replies/day</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Total Views</div>
                    <div class="stat-value">${(stats.totalViews / 1000).toFixed(1)}K</div>
                    <div class="stat-change">Today's engagement</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Total Likes</div>
                    <div class="stat-value">${stats.totalLikes}</div>
                    <div class="stat-change">Today's engagement</div>
                </div>
            </div>
        </div>

        <div class="section">
            <h2>⚙️ System Stages</h2>
            
            ${Object.entries(diagnostics.stages).map(([stageKey, stage]: [string, any]) => {
                const stageNames: Record<string, string> = {
                    contentGeneration: 'Content Generation',
                    posting: 'Posting',
                    metrics: 'Metrics Collection',
                    learning: 'Learning & Optimization'
                };
                const stageDescriptions: Record<string, string> = {
                    contentGeneration: 'AI analyzes past performance and generates optimized content',
                    posting: 'Posts content to Twitter and captures tweet IDs',
                    metrics: 'Scrapes Twitter to collect engagement metrics',
                    learning: 'AI learns from performance and optimizes strategies'
                };
                
                return `
                    <div class="stage-card">
                        <div class="stage-header">
                            <div>
                                <div class="stage-name">${stageNames[stageKey]}</div>
                                <div style="color: #666; font-size: 14px; margin-top: 4px;">${stageDescriptions[stageKey]}</div>
                            </div>
                            <span class="stage-status ${stage.status}">${stage.status.toUpperCase()}</span>
                        </div>
                        <div style="margin-top: 15px;">
                            ${stage.lastRun ? `<div style="color: #666; font-size: 14px; margin-bottom: 8px;">✅ Last run: ${formatTimeAgo(stage.lastRun)}</div>` : '<div style="color: #999; font-size: 14px; margin-bottom: 8px;">⏳ Never run</div>'}
                            ${stage.nextRun ? `<div style="color: #666; font-size: 14px; margin-bottom: 8px;">⏰ Next run: ${formatTimeAgo(stage.nextRun)}</div>` : ''}
                            <div style="margin-top: 10px;">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                                    <span style="color: #666; font-size: 12px;">Health Score</span>
                                    <span style="color: #333; font-weight: 600;">${stage.healthScore}%</span>
                                </div>
                                <div style="background: #e5e7eb; height: 8px; border-radius: 4px; overflow: hidden;">
                                    <div style="background: ${getHealthColor(stage.healthScore)}; height: 100%; width: ${stage.healthScore}%; transition: width 0.3s;"></div>
                                </div>
                            </div>
                            ${stage.issues.length > 0 ? `
                                <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #e5e7eb;">
                                    <div style="font-weight: 600; margin-bottom: 8px; color: #333;">Issues:</div>
                                    ${stage.issues.map((issue: any) => `
                                        <div style="padding: 10px; background: #fef2f2; border-radius: 6px; margin-bottom: 8px; border-left: 3px solid #ef4444;">
                                            <div style="font-weight: 600; color: #991b1b; margin-bottom: 4px;">${issue.message}</div>
                                            ${issue.explanation ? `<div style="color: #666; font-size: 14px;">${issue.explanation}</div>` : ''}
                                            ${issue.action ? `<div style="color: #667eea; font-size: 13px; margin-top: 4px;">🔧 ${issue.action}</div>` : ''}
                                        </div>
                                    `).join('')}
                                </div>
                            ` : ''}
                        </div>
                    </div>
                `;
            }).join('')}
        </div>

        <div class="section">
            <h2>📋 Recent Activity</h2>
            ${recentPosts.length > 0 ? recentPosts.map((post: any) => {
                const timeAgo = formatTimeAgo(post.created_at);
                const statusEmoji = post.status === 'posted' ? '✅' : post.status === 'queued' ? '⏳' : '❌';
                return `
                    <div class="activity-item">
                        <div class="activity-time">${timeAgo}</div>
                        <div class="activity-text">
                            ${statusEmoji} ${post.decision_type === 'reply' ? 'Replied to' : 'Posted'}: ${post.content?.substring(0, 100) || 'No content'}...
                        </div>
                    </div>
                `;
            }).join('') : '<div style="color: #999; text-align: center; padding: 20px;">No recent activity</div>'}
        </div>

        <div class="footer">
            <p>🤖 Last updated: ${now}</p>
            <p>⚡ Auto-refresh every 60 seconds</p>
        </div>
    </div>
    <script>
        // Auto-refresh every 60 seconds
        setTimeout(() => location.reload(), 60000);
    </script>
</body>
</html>`;
}

function formatTimeAgo(dateString: string): string {
  if (!dateString) return 'Unknown';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
}

function getHealthColor(score: number): string {
  if (score >= 80) return '#10b981';
  if (score >= 60) return '#f59e0b';
  return '#ef4444';
}

function getSharedStyles(): string {
  return `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        min-height: 100vh;
        padding: 20px;
    }
    .container { max-width: 1800px; margin: 0 auto; }
    .header {
        background: white;
        padding: 30px;
        border-radius: 15px;
        margin-bottom: 20px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.2);
    }
    .header h1 { color: #333; margin-bottom: 10px; font-size: 32px; }
    .header p { color: #666; font-size: 16px; }
    .nav-tabs { display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap; }
    .nav-tab { 
        padding: 12px 24px; 
        background: white; 
        border-radius: 8px; 
        text-decoration: none; 
        color: #333;
        font-weight: 600;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        transition: all 0.2s;
    }
    .nav-tab:hover { background: #667eea; color: white; }
    .nav-tab.active { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }
    .stats-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 20px;
        margin-bottom: 20px;
    }
    .stat-card {
        background: white;
        padding: 25px;
        border-radius: 15px;
        box-shadow: 0 5px 20px rgba(0,0,0,0.1);
        transition: transform 0.2s;
    }
    .stat-card:hover { transform: translateY(-2px); }
    .stat-label { color: #666; font-size: 14px; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px; }
    .stat-value { color: #333; font-size: 36px; font-weight: bold; }
    .stat-change { color: #28a745; font-size: 14px; margin-top: 8px; }
    .section {
        background: white;
        padding: 30px;
        border-radius: 15px;
        box-shadow: 0 5px 20px rgba(0,0,0,0.1);
        margin-bottom: 20px;
    }
    .section h2 { color: #333; margin-bottom: 20px; font-size: 24px; }
    .footer { text-align: center; color: white; margin-top: 40px; opacity: 0.9; }
  `;
}

function generateErrorHTML(error: string): string {
  return `<!DOCTYPE html>
<html>
<head>
    <title>Dashboard Error</title>
    <style>
        body { font-family: Arial; text-align: center; padding: 50px; background: #f5f5f5; }
        .error-box { background: white; padding: 40px; border-radius: 10px; max-width: 600px; margin: 0 auto; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    </style>
</head>
<body>
    <div class="error-box">
        <h1>🚨 Dashboard Error</h1>
        <p style="color: #dc3545;">${error}</p>
        <p><a href="/dashboard/diagnostics?token=xbot-admin-2025">🔄 Try Again</a></p>
    </div>
</body>
</html>`;
}

