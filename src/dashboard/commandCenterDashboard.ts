/**
 * 🎯 COMMAND CENTER DASHBOARD
 * 
 * High-level visual dashboard for system health, diagnostics, and issue detection
 * - Real-time system status
 * - Job health monitoring
 * - Error tracking
 * - Performance trends
 * - Issue alerts
 */

import { getSupabaseClient } from '../db/index';

interface SystemStatus {
  overall: 'healthy' | 'warning' | 'critical';
  score: number;
  issues: number;
}

interface JobStatus {
  name: string;
  status: 'running' | 'idle' | 'error' | 'stuck';
  lastRun: string | null;
  successRate: number;
  errors: number;
}

interface Alert {
  severity: 'critical' | 'warning' | 'info';
  message: string;
  component: string;
  timestamp: string;
}

interface MetricTrend {
  label: string;
  value: number;
  change: number;
  trend: 'up' | 'down' | 'stable';
}

export async function generateCommandCenterDashboard(): Promise<string> {
  const supabase = getSupabaseClient();
  const now = new Date();
  
  // Fetch comprehensive system data
  const [
    jobHeartbeats,
    recentPosts,
    recentReplies,
    missingTweetIds,
    stuckPosts,
    recentErrors,
    systemHealth,
    postingStats,
    metricsStats
  ] = await Promise.all([
    // Job statuses
    supabase
      .from('job_heartbeats')
      .select('job_name, last_success, last_failure, consecutive_failures, last_run_status, last_error, updated_at')
      .order('updated_at', { ascending: false })
      .limit(20),
    
    // Recent posts
    supabase
      .from('content_metadata')
      .select('decision_id, status, posted_at, tweet_id, actual_impressions')
      .eq('decision_type', 'single')
      .order('posted_at', { ascending: false })
      .limit(10),
    
    // Recent replies
    supabase
      .from('content_metadata')
      .select('decision_id, status, posted_at, tweet_id, actual_impressions')
      .eq('decision_type', 'reply')
      .order('posted_at', { ascending: false })
      .limit(10),
    
    // Missing tweet IDs (critical issue)
    supabase
      .from('content_metadata')
      .select('decision_id, posted_at')
      .eq('status', 'posted')
      .is('tweet_id', null)
      .gte('posted_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .limit(20),
    
    // Stuck posts
    supabase
      .from('content_metadata')
      .select('decision_id, status, updated_at')
      .eq('status', 'posting')
      .lt('updated_at', new Date(Date.now() - 30 * 60 * 1000).toISOString())
      .limit(10),
    
    // Recent errors (from logs or error tracking)
    supabase
      .from('content_metadata')
      .select('decision_id, error_message, updated_at')
      .not('error_message', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(10),
    
    // System health metrics
    supabase
      .from('system_health_metrics')
      .select('*')
      .order('measured_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    
    // Posting stats (last 24h)
    supabase
      .from('content_metadata')
      .select('status, posted_at')
      .gte('posted_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
    
    // Metrics stats
    supabase
      .from('content_metadata')
      .select('actual_impressions, actual_likes, posted_at')
      .eq('status', 'posted')
      .not('actual_impressions', 'is', null)
      .gte('posted_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
  ]);
  
  // Calculate system status
  const missingIds = missingTweetIds.data?.length || 0;
  const stuck = stuckPosts.data?.length || 0;
  const errors = recentErrors.data?.length || 0;
  
  const systemStatus: SystemStatus = {
    overall: missingIds > 5 || stuck > 3 || errors > 10 ? 'critical' : 
             missingIds > 0 || stuck > 0 || errors > 5 ? 'warning' : 'healthy',
    score: Math.max(0, 100 - (missingIds * 5) - (stuck * 10) - (errors * 2)),
    issues: missingIds + stuck + errors
  };
  
  // Calculate job statuses
  const jobs: JobStatus[] = (jobHeartbeats.data || []).map(job => {
    const lastSuccess = job.last_success ? new Date(job.last_success).getTime() : 0;
    const lastFailure = job.last_failure ? new Date(job.last_failure).getTime() : 0;
    const lastRun = lastSuccess > lastFailure ? job.last_success : job.last_failure;
    const minutesSinceRun = lastRun ? Math.floor((now.getTime() - new Date(lastRun).getTime()) / 60000) : 999;
    
    let status: 'running' | 'idle' | 'error' | 'stuck' = 'idle';
    if (job.consecutive_failures >= 3) status = 'error';
    else if (minutesSinceRun > 60 && job.last_run_status !== 'running') status = 'stuck';
    else if (job.last_run_status === 'running') status = 'running';
    else if (job.last_run_status === 'success') status = 'idle';
    
    return {
      name: job.job_name,
      status,
      lastRun,
      successRate: Math.max(0, 100 - ((job.consecutive_failures || 0) * 10)),
      errors: job.consecutive_failures || 0
    };
  });
  
  // Generate alerts
  const alerts: Alert[] = [];
  
  if (missingIds > 0) {
    alerts.push({
      severity: 'critical',
      message: `${missingIds} posts missing tweet IDs`,
      component: 'Posting Queue',
      timestamp: new Date().toISOString()
    });
  }
  
  if (stuck > 0) {
    alerts.push({
      severity: 'critical',
      message: `${stuck} posts stuck in 'posting' status`,
      component: 'Posting Queue',
      timestamp: new Date().toISOString()
    });
  }
  
  jobs.filter(j => j.status === 'error' || j.status === 'stuck').forEach(job => {
    alerts.push({
      severity: job.status === 'error' ? 'critical' : 'warning',
      message: `${job.name} ${job.status}`,
      component: 'Job Manager',
      timestamp: job.lastRun || new Date().toISOString()
    });
  });
  
  // Calculate metrics
  const posts24h = postingStats.data?.filter(p => p.status === 'posted').length || 0;
  const totalViews = metricsStats.data?.reduce((sum, m) => sum + (m.actual_impressions || 0), 0) || 0;
  const totalLikes = metricsStats.data?.reduce((sum, m) => sum + (m.actual_likes || 0), 0) || 0;
  const avgER = totalViews > 0 ? (totalLikes / totalViews) * 100 : 0;
  
  const metrics: MetricTrend[] = [
    {
      label: 'Posts (24h)',
      value: posts24h,
      change: 0, // Would calculate from previous period
      trend: 'stable'
    },
    {
      label: 'Total Views',
      value: totalViews,
      change: 0,
      trend: 'up'
    },
    {
      label: 'Avg ER',
      value: avgER,
      change: 0,
      trend: 'stable'
    },
    {
      label: 'System Health',
      value: systemStatus.score,
      change: 0,
      trend: systemStatus.score >= 90 ? 'up' : systemStatus.score >= 70 ? 'stable' : 'down'
    }
  ];
  
  return generateHTML(systemStatus, jobs, alerts, metrics, {
    missingIds,
    stuck,
    errors,
    posts24h,
    totalViews,
    totalLikes
  });
}

function generateHTML(
  systemStatus: SystemStatus,
  jobs: JobStatus[],
  alerts: Alert[],
  metrics: MetricTrend[],
  stats: any
): string {
  const statusColor = systemStatus.overall === 'healthy' ? '#10b981' : 
                      systemStatus.overall === 'warning' ? '#f59e0b' : '#ef4444';
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>🎯 xBOT Command Center</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      color: #e2e8f0;
      padding: 24px;
      min-height: 100vh;
    }
    
    .container {
      max-width: 1600px;
      margin: 0 auto;
    }
    
    .header {
      background: rgba(255, 255, 255, 0.05);
      backdrop-filter: blur(10px);
      border-radius: 16px;
      padding: 24px;
      margin-bottom: 24px;
      border: 1px solid rgba(255, 255, 255, 0.1);
    }
    
    .header h1 {
      font-size: 32px;
      font-weight: 700;
      margin-bottom: 8px;
      background: linear-gradient(135deg, #60a5fa 0%, #a78bfa 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    
    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      border-radius: 8px;
      font-weight: 600;
      font-size: 14px;
      background: ${statusColor}20;
      color: ${statusColor};
      border: 1px solid ${statusColor}40;
    }
    
    .status-badge::before {
      content: '';
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: ${statusColor};
      animation: pulse 2s infinite;
    }
    
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
    
    .grid {
      display: grid;
      gap: 24px;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      margin-bottom: 24px;
    }
    
    .card {
      background: rgba(255, 255, 255, 0.05);
      backdrop-filter: blur(10px);
      border-radius: 16px;
      padding: 24px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      transition: transform 0.2s, box-shadow 0.2s;
    }
    
    .card:hover {
      transform: translateY(-4px);
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
    }
    
    .card h2 {
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 16px;
      color: #cbd5e1;
    }
    
    .metric {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 0;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }
    
    .metric:last-child {
      border-bottom: none;
    }
    
    .metric-label {
      color: #94a3b8;
      font-size: 14px;
    }
    
    .metric-value {
      font-size: 20px;
      font-weight: 700;
      color: #e2e8f0;
    }
    
    .metric-trend {
      font-size: 12px;
      padding: 2px 8px;
      border-radius: 4px;
      margin-left: 8px;
    }
    
    .trend-up { background: #10b98120; color: #10b981; }
    .trend-down { background: #ef444420; color: #ef4444; }
    .trend-stable { background: #64748b20; color: #64748b; }
    
    .job-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px;
      background: rgba(255, 255, 255, 0.03);
      border-radius: 8px;
      margin-bottom: 8px;
      border-left: 4px solid transparent;
    }
    
    .job-item.running { border-left-color: #10b981; }
    .job-item.idle { border-left-color: #64748b; }
    .job-item.error { border-left-color: #ef4444; }
    .job-item.stuck { border-left-color: #f59e0b; }
    
    .job-name {
      font-weight: 600;
      color: #e2e8f0;
    }
    
    .job-status {
      font-size: 12px;
      padding: 4px 8px;
      border-radius: 4px;
      text-transform: uppercase;
      font-weight: 600;
    }
    
    .alert {
      padding: 12px;
      border-radius: 8px;
      margin-bottom: 8px;
      border-left: 4px solid;
      background: rgba(255, 255, 255, 0.03);
    }
    
    .alert.critical {
      border-left-color: #ef4444;
      background: rgba(239, 68, 68, 0.1);
    }
    
    .alert.warning {
      border-left-color: #f59e0b;
      background: rgba(245, 158, 11, 0.1);
    }
    
    .alert.info {
      border-left-color: #3b82f6;
      background: rgba(59, 130, 246, 0.1);
    }
    
    .alert-message {
      font-weight: 600;
      margin-bottom: 4px;
      color: #e2e8f0;
    }
    
    .alert-component {
      font-size: 12px;
      color: #94a3b8;
    }
    
    .chart-container {
      position: relative;
      height: 200px;
      margin-top: 16px;
    }
    
    .nav-tabs {
      display: flex;
      gap: 12px;
      margin-bottom: 24px;
      flex-wrap: wrap;
    }
    
    .nav-tab {
      padding: 12px 24px;
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.05);
      color: #cbd5e1;
      text-decoration: none;
      font-weight: 600;
      transition: all 0.2s;
      border: 1px solid rgba(255, 255, 255, 0.1);
    }
    
    .nav-tab:hover {
      background: rgba(255, 255, 255, 0.1);
      transform: translateY(-2px);
    }
    
    .nav-tab.active {
      background: linear-gradient(135deg, #60a5fa 0%, #a78bfa 100%);
      color: white;
      border: none;
    }
    
    .stat-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }
    
    .stat-card {
      background: rgba(255, 255, 255, 0.05);
      border-radius: 12px;
      padding: 20px;
      text-align: center;
      border: 1px solid rgba(255, 255, 255, 0.1);
    }
    
    .stat-value {
      font-size: 36px;
      font-weight: 700;
      margin-bottom: 8px;
      background: linear-gradient(135deg, #60a5fa 0%, #a78bfa 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    
    .stat-label {
      font-size: 14px;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎯 xBOT Command Center</h1>
      <div style="display: flex; align-items: center; gap: 16px; margin-top: 16px;">
        <div class="status-badge">
          System ${systemStatus.overall.toUpperCase()}
        </div>
        <span style="color: #94a3b8; font-size: 14px;">
          Health Score: ${systemStatus.score}% | ${systemStatus.issues} Active Issues
        </span>
        <span style="color: #64748b; font-size: 12px; margin-left: auto;">
          ${new Date().toLocaleString()}
        </span>
      </div>
    </div>
    
    <div class="nav-tabs">
      <a href="/dashboard/health?token=xbot-admin-2025" class="nav-tab">🩺 System Health</a>
      <a href="/dashboard/posts?token=xbot-admin-2025" class="nav-tab">📝 Posts</a>
      <a href="/dashboard/replies?token=xbot-admin-2025" class="nav-tab">💬 Replies</a>
      <a href="/dashboard/vi?token=xbot-admin-2025" class="nav-tab">🔍 VI Collection</a>
      <a href="/dashboard/command-center?token=xbot-admin-2025" class="nav-tab active">🎯 Command Center</a>
    </div>
    
    <div class="stat-grid">
      <div class="stat-card">
        <div class="stat-value">${stats.posts24h}</div>
        <div class="stat-label">Posts (24h)</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${stats.totalViews.toLocaleString()}</div>
        <div class="stat-label">Total Views</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${stats.missingIds}</div>
        <div class="stat-label">Missing IDs</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${stats.stuck}</div>
        <div class="stat-label">Stuck Posts</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${stats.errors}</div>
        <div class="stat-label">Recent Errors</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${systemStatus.score}%</div>
        <div class="stat-label">Health Score</div>
      </div>
    </div>
    
    <div class="grid">
      <div class="card">
        <h2>🚨 Active Alerts</h2>
        ${alerts.length === 0 
          ? '<div style="color: #94a3b8; text-align: center; padding: 24px;">✅ No active alerts</div>'
          : alerts.map(alert => `
            <div class="alert ${alert.severity}">
              <div class="alert-message">${alert.message}</div>
              <div class="alert-component">${alert.component}</div>
            </div>
          `).join('')
        }
      </div>
      
      <div class="card">
        <h2>⚙️ Job Status</h2>
        ${jobs.slice(0, 10).map(job => `
          <div class="job-item ${job.status}">
            <div>
              <div class="job-name">${job.name}</div>
              <div style="font-size: 11px; color: #94a3b8; margin-top: 4px;">
                ${job.lastRun ? new Date(job.lastRun).toLocaleString() : 'Never'}
              </div>
            </div>
            <div class="job-status" style="
              background: ${job.status === 'running' ? '#10b98120' : 
                           job.status === 'error' ? '#ef444420' : 
                           job.status === 'stuck' ? '#f59e0b20' : '#64748b20'};
              color: ${job.status === 'running' ? '#10b981' : 
                      job.status === 'error' ? '#ef4444' : 
                      job.status === 'stuck' ? '#f59e0b' : '#64748b'};
            ">
              ${job.status}
            </div>
          </div>
        `).join('')}
      </div>
      
      <div class="card">
        <h2>📊 Key Metrics</h2>
        ${metrics.map(metric => `
          <div class="metric">
            <span class="metric-label">${metric.label}</span>
            <div style="display: flex; align-items: center;">
              <span class="metric-value">${typeof metric.value === 'number' && metric.value < 1000 
                ? metric.value.toFixed(1) 
                : metric.value.toLocaleString()}</span>
              <span class="metric-trend trend-${metric.trend}">
                ${metric.trend === 'up' ? '↑' : metric.trend === 'down' ? '↓' : '→'}
              </span>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  </div>
  
  <script>
    // Auto-refresh every 30 seconds
    setTimeout(() => location.reload(), 30000);
  </script>
</body>
</html>`;
}

