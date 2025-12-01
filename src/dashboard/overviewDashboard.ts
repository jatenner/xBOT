/**
 * 📊 OVERVIEW DASHBOARD
 * Main landing page - clean overview of system status and key metrics
 */

import { DiagnosticEngine } from '../diagnostics/diagnosticEngine';
import { getSupabaseClient } from '../db';
import { getHeartbeat } from '../jobs/jobHeartbeat';
import { 
  generateNavigation, 
  getSharedStyles, 
  generateErrorHTML, 
  formatTimeAgo,
  getTodayStats,
  getQueueStatus,
  getScraperCoverage,
  TOKEN_PARAM
} from './shared/dashboardUtils';

export async function generateOverviewDashboard(): Promise<string> {
  try {
    const supabase = getSupabaseClient();
    const engine = DiagnosticEngine.getInstance();
    const diagnostics = await engine.runDiagnostics();
    
    // Get key metrics
    const { postedToday, repliedToday, totalViews, totalLikes } = await getTodayStats();
    const queuedCount = await getQueueStatus();
    const { coverage: scraperCoverage } = await getScraperCoverage();
    
    // Get recent activity
    const { data: recentPosts } = await supabase
      .from('content_metadata')
      .select('decision_id, posted_at, status, decision_type, content')
      .order('created_at', { ascending: false })
      .limit(10);
    
    // Check critical jobs
    const planHeartbeat = await getHeartbeat('plan');
    const postingHeartbeat = await getHeartbeat('posting');
    const metricsHeartbeat = await getHeartbeat('metrics_scraper') || await getHeartbeat('analytics');
    
    // Determine overall status
    const criticalIssues = diagnostics.messages.filter((m: any) => m.severity === 'high');
    const overallStatus = diagnostics.overallStatus;
    
    return generateOverviewHTML({
      overallStatus,
      criticalIssues: criticalIssues.length,
      postedToday,
      repliedToday,
      totalViews,
      totalLikes,
      queuedCount,
      scraperCoverage,
      recentPosts: recentPosts || [],
      planLastRun: planHeartbeat?.last_success,
      postingLastRun: postingHeartbeat?.last_success,
      metricsLastRun: metricsHeartbeat?.last_success
    });
  } catch (error: any) {
    console.error('[OVERVIEW_DASHBOARD] Error:', error.message);
    return generateErrorHTML(error.message, '/dashboard/overview');
  }
}

function generateOverviewHTML(data: any): string {
  const {
    overallStatus,
    criticalIssues,
    postedToday,
    repliedToday,
    totalViews,
    totalLikes,
    queuedCount,
    scraperCoverage,
    recentPosts,
    planLastRun,
    postingLastRun,
    metricsLastRun
  } = data;
  
  const now = new Date().toLocaleString();
  const statusColor = overallStatus === 'healthy' ? '#10b981' :
                     overallStatus === 'warning' ? '#f59e0b' : '#ef4444';
  const statusEmoji = overallStatus === 'healthy' ? '🟢' :
                      overallStatus === 'warning' ? '🟡' : '🔴';
  
  return `<!DOCTYPE html>
<html>
<head>
    <title>📊 xBOT Overview</title>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="refresh" content="30">
    <style>
        ${getSharedStyles()}
        .status-banner {
            background: linear-gradient(135deg, ${statusColor}15, ${statusColor}05);
            border: 2px solid ${statusColor};
            border-radius: 12px;
            padding: 25px;
            margin-bottom: 30px;
            text-align: center;
        }
        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .metric-card {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            text-align: center;
        }
        .metric-value {
            font-size: 32px;
            font-weight: bold;
            color: #333;
            margin-bottom: 5px;
        }
        .metric-label {
            font-size: 14px;
            color: #666;
        }
        .activity-feed {
            background: white;
            border-radius: 8px;
            padding: 20px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .activity-item {
            padding: 12px;
            border-bottom: 1px solid #e5e7eb;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .activity-item:last-child {
            border-bottom: none;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📊 xBOT Overview</h1>
            <p>System status and key metrics at a glance</p>
        </div>

        ${generateNavigation('/dashboard/overview')}

        <!-- Investigation Link -->
        <div style="margin-bottom: 20px; text-align: center;">
            <a href="/dashboard/system-investigation${TOKEN_PARAM}" style="display: inline-block; padding: 12px 24px; background: #667eea; color: white; border-radius: 8px; text-decoration: none; font-weight: 600;">
                🔍 Investigate System Status
            </a>
        </div>

        <!-- Status Banner -->
        <div class="status-banner">
            <div style="font-size: 48px; margin-bottom: 10px;">${statusEmoji}</div>
            <div style="font-size: 24px; font-weight: 600; margin-bottom: 5px;">
                System is ${overallStatus === 'healthy' ? 'WORKING' : overallStatus === 'warning' ? 'NEEDS ATTENTION' : 'CRITICAL'}
            </div>
            <div style="color: #666; font-size: 16px;">
                ${criticalIssues > 0 
                  ? `${criticalIssues} critical issue(s) detected - <a href="/dashboard/system-health${TOKEN_PARAM}" style="color: ${statusColor}; font-weight: 600;">View Details</a>`
                  : 'All systems operational'}
            </div>
        </div>

        <!-- Key Metrics -->
        <div class="metrics-grid">
            <div class="metric-card">
                <div class="metric-value" style="color: #3b82f6;">${postedToday}</div>
                <div class="metric-label">Posts Today</div>
            </div>
            <div class="metric-card">
                <div class="metric-value" style="color: #10b981;">${repliedToday}</div>
                <div class="metric-label">Replies Today</div>
            </div>
            <div class="metric-card">
                <div class="metric-value" style="color: #f59e0b;">${queuedCount}</div>
                <div class="metric-label">Queued Content</div>
            </div>
            <div class="metric-card">
                <div class="metric-value" style="color: #8b5cf6;">${scraperCoverage}%</div>
                <div class="metric-label">Metrics Coverage</div>
            </div>
            <div class="metric-card">
                <div class="metric-value" style="color: #06b6d4;">${totalViews.toLocaleString()}</div>
                <div class="metric-label">Total Views</div>
            </div>
            <div class="metric-card">
                <div class="metric-value" style="color: #ec4899;">${totalLikes.toLocaleString()}</div>
                <div class="metric-label">Total Likes</div>
            </div>
        </div>

        <!-- Quick Status -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px; margin-bottom: 30px;">
            <div style="background: white; padding: 15px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                <div style="font-weight: 600; margin-bottom: 8px;">📝 Content Generation</div>
                <div style="font-size: 13px; color: #666;">
                    ${planLastRun ? `Last run: ${formatTimeAgo(planLastRun)}` : 'Never run'}
                </div>
            </div>
            <div style="background: white; padding: 15px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                <div style="font-weight: 600; margin-bottom: 8px;">📮 Posting</div>
                <div style="font-size: 13px; color: #666;">
                    ${postingLastRun ? `Last run: ${formatTimeAgo(postingLastRun)}` : 'Never run'}
                </div>
            </div>
            <div style="background: white; padding: 15px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                <div style="font-weight: 600; margin-bottom: 8px;">📊 Metrics</div>
                <div style="font-size: 13px; color: #666;">
                    ${metricsLastRun ? `Last run: ${formatTimeAgo(metricsLastRun)}` : 'Never run'}
                </div>
            </div>
        </div>

        <!-- Recent Activity -->
        <div class="activity-feed">
            <h2 style="margin: 0 0 20px 0;">📋 Recent Activity</h2>
            ${recentPosts.length > 0 ? recentPosts.map((post: any) => {
              const timeAgo = post.posted_at 
                ? formatTimeAgo(post.posted_at)
                : 'Just now';
              const typeEmoji = post.decision_type === 'single' ? '📝' :
                               post.decision_type === 'thread' ? '🧵' :
                               post.decision_type === 'reply' ? '💬' : '📄';
              return `
                <div class="activity-item">
                    <div>
                        <div style="font-weight: 600; margin-bottom: 4px;">
                            ${typeEmoji} ${post.decision_type === 'single' ? 'Single Post' :
                                         post.decision_type === 'thread' ? 'Thread' :
                                         post.decision_type === 'reply' ? 'Reply' : 'Content'}
                        </div>
                        <div style="font-size: 13px; color: #666;">
                            ${post.content?.substring(0, 80) || 'No content'}...
                        </div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-size: 12px; color: #666;">${timeAgo}</div>
                        <div style="font-size: 11px; color: ${post.status === 'posted' ? '#10b981' : '#f59e0b'}; margin-top: 4px;">
                            ${post.status === 'posted' ? '✅ Posted' : '⏳ Queued'}
                        </div>
                    </div>
                </div>
              `;
            }).join('') : '<div style="text-align: center; color: #666; padding: 40px;">No recent activity</div>'}
            <div style="margin-top: 20px; text-align: center;">
                <a href="/dashboard/content${TOKEN_PARAM}" style="color: #667eea; font-weight: 600; text-decoration: underline;">
                    View All Content →
                </a>
            </div>
        </div>

        <div style="text-align: center; color: #666; font-size: 14px; margin-top: 30px; padding: 20px;">
            ⚡ Auto-refresh every 30 seconds • Last updated: ${now}
        </div>
    </div>
</body>
</html>`;
}

