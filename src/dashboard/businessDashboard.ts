/**
 * 💼 BUSINESS-FOCUSED DASHBOARD
 * Executive view showing if the system is working, with real-time activity indicators
 */

import { DiagnosticEngine } from '../diagnostics/diagnosticEngine';
import { getSupabaseClient } from '../db';
import { getHeartbeat } from '../jobs/jobHeartbeat';
import { JobManager } from '../jobs/jobManager';
import { 
  generateNavigation, 
  getSharedStyles, 
  generateErrorHTML, 
  formatTimeAgo,
  getTodayStats,
  getQueueStatus,
  getScraperCoverage,
  getContentTypeBadge,
  getContentTypeClass,
  TOKEN_PARAM
} from './shared/dashboardUtils';

export async function generateBusinessDashboard(): Promise<string> {
  try {
    const supabase = getSupabaseClient();
    const engine = DiagnosticEngine.getInstance();
    const diagnostics = await engine.runDiagnostics();
    const jobManager = JobManager.getInstance();
    const stats = jobManager.getStats();

    // Check metrics scraper heartbeat
    const metricsHeartbeat = await getHeartbeat('metrics_scraper') || await getHeartbeat('analytics');
    
    // Check if scraper is actively running RIGHT NOW
    const isScrapingNow = metricsHeartbeat?.last_run_status === 'running';
    const lastScrapeTime = metricsHeartbeat?.last_success ? new Date(metricsHeartbeat.last_success) : null;
    const minutesSinceLastScrape = lastScrapeTime 
      ? Math.floor((Date.now() - lastScrapeTime.getTime()) / (1000 * 60))
      : null;

    // Get recent metrics collection activity
    const { data: recentMetrics } = await supabase
      .from('tweet_metrics')
      .select('collected_at')
      .order('collected_at', { ascending: false })
      .limit(10);

    const lastMetricCollected = recentMetrics && recentMetrics.length > 0
      ? new Date(recentMetrics[0].collected_at)
      : null;

    // Get posting activity
    const { data: recentPosts } = await supabase
      .from('content_metadata')
      .select('decision_id, posted_at, status, decision_type, tweet_id')
      .order('created_at', { ascending: false })
      .limit(20);

    const lastPostTime = recentPosts?.find(p => p.status === 'posted' && p.posted_at) 
      ? new Date(recentPosts.find(p => p.status === 'posted' && p.posted_at)!.posted_at)
      : null;

    // Get queued content
    const queuedCount = await getQueueStatus();

    // Get posts without metrics (need scraping)
    const { count: postsNeedingMetrics } = await supabase
      .from('content_metadata')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'posted')
      .not('tweet_id', 'is', null)
      .is('actual_impressions', null);

    // Get today's stats
    const { postedToday, repliedToday, queuedToday } = await getTodayStats();
    
    // Get breakdown by type (today's activity)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const { data: typeBreakdown } = await supabase
      .from('content_metadata')
      .select('decision_type, status')
      .gte('created_at', todayStart.toISOString());
    
    const singlesToday = typeBreakdown?.filter((p: any) => p.decision_type === 'single' && p.status === 'posted').length || 0;
    const threadsToday = typeBreakdown?.filter((p: any) => p.decision_type === 'thread' && p.status === 'posted').length || 0;
    const repliesTodayCount = typeBreakdown?.filter((p: any) => p.decision_type === 'reply' && p.status === 'posted').length || 0;
    
    const queuedSingles = typeBreakdown?.filter((p: any) => p.decision_type === 'single' && p.status === 'queued').length || 0;
    const queuedThreads = typeBreakdown?.filter((p: any) => p.decision_type === 'thread' && p.status === 'queued').length || 0;
    const queuedReplies = typeBreakdown?.filter((p: any) => p.decision_type === 'reply' && p.status === 'queued').length || 0;

    // Get scraper coverage
    const { coverage: scraperCoverage, postsWithMetrics, totalPosted } = await getScraperCoverage();

    // Identify specific problems from diagnostics
    const problems: Array<{component: string, issue: string, severity: 'high' | 'medium' | 'low'}> = [];
    
    Object.entries(diagnostics.stages).forEach(([key, stage]: [string, any]) => {
      if (stage.status === 'error' || stage.status === 'warning') {
        const componentName = key === 'contentGeneration' ? 'Content Generation' :
                             key === 'posting' ? 'Posting' :
                             key === 'metrics' ? 'Metrics Scraper' :
                             key === 'learning' ? 'Learning' : key;
        
        stage.issues.forEach((issue: any) => {
          if (issue.type === 'error' || issue.type === 'warning') {
            problems.push({
              component: componentName,
              issue: issue.message,
              severity: issue.severity || (issue.type === 'error' ? 'high' : 'medium')
            });
          }
        });
      }
    });

    return generateBusinessDashboardHTML({
      diagnostics,
      isScrapingNow,
      lastScrapeTime,
      minutesSinceLastScrape,
      lastMetricCollected,
      lastPostTime,
      queuedCount: queuedCount || 0,
      postsNeedingMetrics: postsNeedingMetrics || 0,
      postedToday,
      repliedToday,
      queuedToday,
      singlesToday,
      threadsToday,
      repliesTodayCount,
      queuedSingles,
      queuedThreads,
      queuedReplies,
      scraperCoverage,
      totalPosted: totalPosted || 0,
      postsWithMetrics: postsWithMetrics || 0,
      recentPosts: recentPosts || [],
      problems
    });
  } catch (error: any) {
    console.error('[BUSINESS_DASHBOARD] Error:', error.message);
    return generateErrorHTML(error.message);
  }
}

function generateBusinessDashboardHTML(data: any): string {
  const now = new Date().toLocaleString();
  const {
    diagnostics,
    isScrapingNow,
    lastScrapeTime,
    minutesSinceLastScrape,
    lastMetricCollected,
    lastPostTime,
    queuedCount,
    postsNeedingMetrics,
    postedToday,
    repliedToday,
    queuedToday,
    singlesToday = 0,
    threadsToday = 0,
    repliesTodayCount = 0,
    queuedSingles = 0,
    queuedThreads = 0,
    queuedReplies = 0,
    scraperCoverage,
    totalPosted,
    postsWithMetrics,
    recentPosts
  } = data;

  // Overall system status
  const systemWorking = diagnostics.overallStatus === 'healthy';
  const statusColor = systemWorking ? '#10b981' : diagnostics.overallStatus === 'warning' ? '#f59e0b' : '#ef4444';
  const statusEmoji = systemWorking ? '✅' : '⚠️';

  // Identify specific problems
  const problems: Array<{component: string, issue: string, severity: 'high' | 'medium' | 'low'}> = [];
  
  Object.entries(diagnostics.stages).forEach(([key, stage]: [string, any]) => {
    if (stage.status === 'error' || stage.status === 'warning') {
      const componentName = key === 'contentGeneration' ? 'Content Generation' :
                           key === 'posting' ? 'Posting' :
                           key === 'metrics' ? 'Metrics Scraper' :
                           key === 'learning' ? 'Learning' : key;
      
      stage.issues.forEach((issue: any) => {
        if (issue.type === 'error' || issue.type === 'warning') {
          problems.push({
            component: componentName,
            issue: issue.message,
            severity: issue.severity || (issue.type === 'error' ? 'high' : 'medium')
          });
        }
      });
    }
  });

  // Determine if system is actually broken or just needs attention
  const criticalProblems = problems.filter(p => p.severity === 'high');
  const hasCriticalIssues = criticalProblems.length > 0;

  // Scraper status
  const scraperWorking = isScrapingNow || (minutesSinceLastScrape !== null && minutesSinceLastScrape < 30);
  const scraperStatusColor = isScrapingNow ? '#10b981' : scraperWorking ? '#f59e0b' : '#ef4444';
  const scraperStatusText = isScrapingNow ? 'ACTIVELY SCRAPING NOW' : scraperWorking 
    ? `Last scraped ${minutesSinceLastScrape}m ago` 
    : 'NOT SCRAPING';

  // Posting status
  const postingWorking = lastPostTime && (Date.now() - lastPostTime.getTime()) < 30 * 60 * 1000;
  const postingStatusColor = postingWorking ? '#10b981' : '#f59e0b';
  const postingStatusText = lastPostTime
    ? `Last posted ${Math.floor((Date.now() - lastPostTime.getTime()) / (1000 * 60))}m ago`
    : 'Never posted';

  return `<!DOCTYPE html>
<html>
<head>
    <title>💼 xBOT Business Dashboard</title>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
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
        .status-banner.working {
            background: linear-gradient(135deg, #10b98115, #10b98105);
            border-color: #10b981;
        }
        .status-banner.warning {
            background: linear-gradient(135deg, #f59e0b15, #f59e0b05);
            border-color: #f59e0b;
        }
        .status-banner.error {
            background: linear-gradient(135deg, #ef444415, #ef444405);
            border-color: #ef4444;
        }
        .status-title {
            font-size: 32px;
            font-weight: bold;
            color: #333;
            margin-bottom: 10px;
        }
        .status-subtitle {
            font-size: 18px;
            color: #666;
        }
        .activity-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .activity-card {
            background: white;
            border-radius: 12px;
            padding: 25px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            border-left: 5px solid #667eea;
            transition: transform 0.2s;
        }
        .activity-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(0,0,0,0.15);
        }
        .activity-card.scraping {
            border-left-color: #10b981;
            background: linear-gradient(135deg, #10b98108, white);
        }
        .activity-card.scraping::before {
            content: '🔄';
            position: absolute;
            top: 20px;
            right: 20px;
            font-size: 24px;
            animation: spin 2s linear infinite;
        }
        @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }
        .activity-card.posting {
            border-left-color: #3b82f6;
        }
        .activity-card.queue {
            border-left-color: #f59e0b;
        }
        .activity-card.metrics {
            border-left-color: #8b5cf6;
        }
        .activity-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
        }
        .activity-title {
            font-size: 18px;
            font-weight: 600;
            color: #333;
        }
        .activity-status {
            padding: 6px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
            background: #f3f4f6;
            color: #666;
        }
        .activity-status.active {
            background: #10b981;
            color: white;
            animation: pulse 2s infinite;
        }
        .activity-status.warning {
            background: #f59e0b;
            color: white;
        }
        .activity-status.error {
            background: #ef4444;
            color: white;
        }
        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.7; }
        }
        .activity-metrics {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
            margin-top: 15px;
        }
        .metric-item {
            text-align: center;
        }
        .metric-value {
            font-size: 28px;
            font-weight: bold;
            color: #333;
            margin-bottom: 4px;
        }
        .metric-label {
            font-size: 12px;
            color: #666;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .coverage-bar {
            background: #e5e7eb;
            height: 12px;
            border-radius: 6px;
            overflow: hidden;
            margin-top: 10px;
        }
        .coverage-fill {
            height: 100%;
            background: linear-gradient(90deg, #10b981, #059669);
            transition: width 0.3s;
        }
        .recent-activity {
            background: white;
            border-radius: 12px;
            padding: 25px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        .activity-item {
            display: flex;
            align-items: center;
            gap: 15px;
            padding: 15px;
            border-bottom: 1px solid #f0f0f0;
        }
        .activity-item:last-child {
            border-bottom: none;
        }
        .activity-icon {
            font-size: 24px;
            width: 40px;
            height: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 8px;
            background: #f3f4f6;
        }
        .activity-icon.single {
            background: #dbeafe;
        }
        .activity-icon.thread {
            background: #ede9fe;
        }
        .activity-icon.reply {
            background: #d1fae5;
        }
        .activity-icon.post {
            background: #dbeafe;
        }
        .activity-icon.scrape {
            background: #dcfce7;
        }
        .activity-content {
            flex: 1;
        }
        .activity-text {
            font-weight: 600;
            color: #333;
            margin-bottom: 4px;
        }
        .activity-time {
            font-size: 12px;
            color: #666;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>💼 xBOT Business Dashboard</h1>
            <p>Real-time system activity and performance metrics</p>
        </div>

        ${generateNavigation('/dashboard/business')}

        <div class="status-banner ${systemWorking ? 'working' : diagnostics.overallStatus === 'warning' ? 'warning' : 'error'}">
            <div class="status-title">
                ${statusEmoji} System is ${systemWorking ? 'WORKING' : diagnostics.overallStatus === 'warning' ? 'NEEDS ATTENTION' : 'NOT WORKING'}
            </div>
            <div class="status-subtitle">
                ${systemWorking 
                  ? 'All critical systems are operational and processing content'
                  : problems.length > 0
                  ? `${problems.length} issue(s) detected: ${problems.slice(0, 2).map((p: any) => p.component).join(', ')}${problems.length > 2 ? '...' : ''}`
                  : diagnostics.overallStatus === 'warning'
                  ? 'Some systems need attention - see details below'
                  : 'Critical systems are down - immediate action required'}
            </div>
            ${problems.length > 0 ? `
                <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid rgba(0,0,0,0.1);">
                    <div style="font-weight: 600; margin-bottom: 10px; color: #333;">🔍 Specific Issues:</div>
                    <div style="display: grid; gap: 8px;">
                        ${problems.slice(0, 5).map((p: any) => `
                            <div style="padding: 10px; background: ${p.severity === 'high' ? '#fee2e2' : '#fef3c7'}; border-radius: 6px; border-left: 3px solid ${p.severity === 'high' ? '#ef4444' : '#f59e0b'};">
                                <div style="font-weight: 600; color: ${p.severity === 'high' ? '#991b1b' : '#92400e'}; margin-bottom: 4px;">
                                    ${p.severity === 'high' ? '🔴' : '🟡'} ${p.component}
                                </div>
                                <div style="font-size: 13px; color: #666;">${p.issue}</div>
                            </div>
                        `).join('')}
                        ${problems.length > 5 ? `<div style="color: #666; font-size: 13px; margin-top: 5px;">...and ${problems.length - 5} more issue(s). See System Health dashboard for details.</div>` : ''}
                    </div>
                </div>
            ` : ''}
        </div>

        <div class="activity-grid">
            <!-- Metrics Scraper Card -->
            <div class="activity-card metrics ${isScrapingNow ? 'scraping' : ''}" style="position: relative;">
                <div class="activity-header">
                    <div class="activity-title">📊 Metrics Scraper</div>
                    <span class="activity-status ${isScrapingNow ? 'active' : scraperWorking ? 'warning' : 'error'}">
                        ${scraperStatusText}
                    </span>
                </div>
                <div style="margin-top: 15px;">
                    <div style="color: #666; font-size: 14px; margin-bottom: 8px;">
                        ${isScrapingNow 
                          ? '🔄 Currently collecting metrics from Twitter...'
                          : lastScrapeTime
                          ? `Last scraped: ${lastScrapeTime.toLocaleString()}`
                          : 'No scraping activity detected'}
                    </div>
                    <div class="activity-metrics">
                        <div class="metric-item">
                            <div class="metric-value" style="color: #8b5cf6;">${scraperCoverage}%</div>
                            <div class="metric-label">Coverage</div>
                        </div>
                        <div class="metric-item">
                            <div class="metric-value" style="color: #8b5cf6;">${postsWithMetrics}/${totalPosted}</div>
                            <div class="metric-label">Posts Scraped</div>
                        </div>
                    </div>
                    ${postsNeedingMetrics > 0 ? `
                        <div style="margin-top: 15px; padding: 12px; background: #fef3c7; border-radius: 8px;">
                            <div style="font-weight: 600; color: #92400e; margin-bottom: 4px;">⚠️ ${postsNeedingMetrics} posts need metrics</div>
                            <div style="color: #666; font-size: 13px;">These posts are waiting to be scraped</div>
                        </div>
                    ` : ''}
                </div>
            </div>

            <!-- Posting Activity Card -->
            <div class="activity-card posting">
                <div class="activity-header">
                    <div class="activity-title">📝 Posting Activity</div>
                    <span class="activity-status ${postingWorking ? 'active' : 'warning'}">
                        ${postingWorking ? 'ACTIVE' : 'INACTIVE'}
                    </span>
                </div>
                <div style="margin-top: 15px;">
                    <div style="color: #666; font-size: 14px; margin-bottom: 8px;">
                        ${postingStatusText}
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 12px;">
                        <div style="text-align: center; padding: 10px; background: rgba(59, 130, 246, 0.1); border-radius: 8px; border: 2px solid #3b82f6;">
                            <div style="font-size: 20px; font-weight: bold; color: #3b82f6;">${singlesToday}</div>
                            <div style="font-size: 11px; color: #666; margin-top: 4px;">📝 Singles</div>
                        </div>
                        <div style="text-align: center; padding: 10px; background: rgba(139, 92, 246, 0.1); border-radius: 8px; border: 2px solid #8b5cf6;">
                            <div style="font-size: 20px; font-weight: bold; color: #8b5cf6;">${threadsToday}</div>
                            <div style="font-size: 11px; color: #666; margin-top: 4px;">🧵 Threads</div>
                        </div>
                        <div style="text-align: center; padding: 10px; background: rgba(16, 185, 129, 0.1); border-radius: 8px; border: 2px solid #10b981;">
                            <div style="font-size: 20px; font-weight: bold; color: #10b981;">${repliesTodayCount}</div>
                            <div style="font-size: 11px; color: #666; margin-top: 4px;">💬 Replies</div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Content Queue Card -->
            <div class="activity-card queue">
                <div class="activity-header">
                    <div class="activity-title">📦 Content Queue</div>
                    <span class="activity-status ${queuedCount > 0 ? 'active' : 'warning'}">
                        ${queuedCount > 0 ? `${queuedCount} QUEUED` : 'EMPTY'}
                    </span>
                </div>
                <div style="margin-top: 15px;">
                    <div style="color: #666; font-size: 14px; margin-bottom: 12px;">
                        ${queuedCount > 0 
                          ? `${queuedCount} pieces of content ready to post`
                          : 'No content in queue - generation may be needed'}
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px;">
                        <div style="text-align: center; padding: 8px; background: rgba(59, 130, 246, 0.1); border-radius: 6px; border-left: 3px solid #3b82f6;">
                            <div style="font-size: 18px; font-weight: bold; color: #3b82f6;">${queuedSingles || 0}</div>
                            <div style="font-size: 10px; color: #666;">📝 Singles</div>
                        </div>
                        <div style="text-align: center; padding: 8px; background: rgba(139, 92, 246, 0.1); border-radius: 6px; border-left: 3px solid #8b5cf6;">
                            <div style="font-size: 18px; font-weight: bold; color: #8b5cf6;">${queuedThreads || 0}</div>
                            <div style="font-size: 10px; color: #666;">🧵 Threads</div>
                        </div>
                        <div style="text-align: center; padding: 8px; background: rgba(16, 185, 129, 0.1); border-radius: 6px; border-left: 3px solid #10b981;">
                            <div style="font-size: 18px; font-weight: bold; color: #10b981;">${queuedReplies || 0}</div>
                            <div style="font-size: 10px; color: #666;">💬 Replies</div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- System Health Summary -->
            <div class="activity-card">
                <div class="activity-header">
                    <div class="activity-title">🏥 System Health</div>
                    <span class="activity-status ${systemWorking ? 'active' : diagnostics.overallStatus === 'warning' ? 'warning' : 'error'}">
                        ${diagnostics.overallStatus.toUpperCase()}
                    </span>
                </div>
                <div style="margin-top: 15px;">
                    <div style="color: #666; font-size: 14px; margin-bottom: 15px;">
                        Component health scores (click <a href="/dashboard/system-health${TOKEN_PARAM}" style="color: #667eea; text-decoration: underline;">System Health</a> for details)
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                        ${Object.entries(diagnostics.stages).map(([key, stage]: [string, any]) => {
                          const componentName = key === 'contentGeneration' ? 'Generation' :
                                               key === 'posting' ? 'Posting' :
                                               key === 'metrics' ? 'Metrics' : 'Learning';
                          const hasIssues = stage.issues && stage.issues.filter((i: any) => i.type === 'error' || i.type === 'warning').length > 0;
                          const healthColor = stage.healthScore >= 80 ? '#10b981' : stage.healthScore >= 50 ? '#f59e0b' : '#ef4444';
                          return `
                            <div style="text-align: center; padding: 12px; background: ${hasIssues ? '#fee2e2' : '#f9fafb'}; border-radius: 6px; border: 2px solid ${healthColor};">
                                <div style="font-size: 20px; font-weight: bold; color: ${healthColor};">
                                    ${Math.round(stage.healthScore)}%
                                </div>
                                <div style="font-size: 11px; color: #666; margin-top: 4px; font-weight: 600;">
                                    ${componentName}
                                </div>
                                ${hasIssues ? `
                                    <div style="font-size: 10px; color: #991b1b; margin-top: 4px;">
                                        ${stage.issues.filter((i: any) => i.type === 'error' || i.type === 'warning').length} issue(s)
                                    </div>
                                ` : ''}
                            </div>
                          `;
                        }).join('')}
                    </div>
                    ${problems.length > 0 ? `
                        <div style="margin-top: 15px; padding: 12px; background: #fef3c7; border-radius: 6px; border-left: 4px solid #f59e0b;">
                            <div style="font-weight: 600; color: #92400e; margin-bottom: 5px;">
                                ⚠️ ${criticalProblems.length > 0 ? `${criticalProblems.length} critical` : ''} ${problems.length} total issue(s) detected
                            </div>
                            <div style="font-size: 12px; color: #666;">
                                Check the <a href="/dashboard/system-health${TOKEN_PARAM}" style="color: #667eea; font-weight: 600;">System Health</a> dashboard for detailed job status and error messages.
                            </div>
                        </div>
                    ` : ''}
                </div>
            </div>
        </div>

        <div class="recent-activity">
            <h2 style="margin-bottom: 20px; color: #333;">📋 Recent Activity</h2>
            ${recentPosts.length > 0 ? recentPosts.slice(0, 10).map((post: any) => {
                const timeAgo = post.posted_at 
                  ? `${Math.floor((Date.now() - new Date(post.posted_at).getTime()) / (1000 * 60))}m ago`
                  : 'Just now';
                const typeClass = getContentTypeClass(post.decision_type);
                const badge = getContentTypeBadge(post.decision_type);
                const text = post.status === 'posted' 
                  ? `${post.content?.substring(0, 60) || 'No content'}...`
                  : `Queued: ${post.content?.substring(0, 60) || 'No content'}...`;
                
                return `
                    <div class="activity-item content-card ${typeClass}">
                        <div class="activity-icon ${typeClass}">${badge}</div>
                        <div class="activity-content">
                            <div class="activity-text">${text}</div>
                            <div class="activity-time">${timeAgo} • ${post.status.toUpperCase()}</div>
                        </div>
                    </div>
                `;
            }).join('') : '<div style="text-align: center; padding: 40px; color: #999;">No recent activity</div>'}
        </div>

        <div class="footer">
            <p>💼 Last updated: ${now}</p>
            <p>⚡ Auto-refresh every 30 seconds</p>
        </div>
    </div>
    <script>
        setTimeout(() => location.reload(), 30000);
    </script>
</body>
</html>`;
}


