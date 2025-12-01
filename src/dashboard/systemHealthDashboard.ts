/**
 * 🏥 COMPREHENSIVE SYSTEM HEALTH DASHBOARD
 * Real-time view showing:
 * - All jobs and their status (running/failed/success)
 * - Target tracking with explanations (why targets are missed)
 * - Active failures and alerts
 * - Historical failure trends
 */

import { getSupabaseClient } from '../db';
import { getHeartbeat } from '../jobs/jobHeartbeat';
import { JobManager } from '../jobs/jobManager';
import { DiagnosticEngine } from '../diagnostics/diagnosticEngine';
import { 
  generateNavigation, 
  getSharedStyles, 
  generateErrorHTML, 
  formatTimeAgo,
  TOKEN_PARAM
} from './shared/dashboardUtils';

interface JobStatus {
  name: string;
  displayName: string;
  status: 'running' | 'success' | 'failure' | 'stale' | 'unknown';
  lastRun: Date | null;
  lastSuccess: Date | null;
  lastFailure: Date | null;
  consecutiveFailures: number;
  lastError: string | null;
  expectedIntervalMinutes: number;
  isStale: boolean;
  nextRunEstimate: Date | null;
}

interface TargetMiss {
  type: 'post' | 'reply';
  expected: number;
  actual: number;
  reason: string;
  timestamp: Date;
}

export async function generateSystemHealthDashboard(): Promise<string> {
  try {
    const supabase = getSupabaseClient();
    const engine = DiagnosticEngine.getInstance();
    const diagnostics = await engine.runDiagnostics();
    const jobManager = JobManager.getInstance();

    // Get all job heartbeats
    const jobNames = [
      'plan',
      'posting',
      'analytics',
      'metrics_scraper',
      'learn',
      'reply',
      'reply_posting',
      'account_discovery',
      'self_healing',
      'performance_optimizer'
    ];

    const jobStatuses: JobStatus[] = await Promise.all(
      jobNames.map(async (name) => {
        const heartbeat = await getHeartbeat(name);
        const now = new Date();
        
        // Expected intervals (minutes)
        const intervals: Record<string, number> = {
          plan: parseInt(process.env.JOBS_PLAN_INTERVAL_MIN || '120'),
          posting: 5,
          analytics: 360,
          metrics_scraper: 10,
          learn: parseInt(process.env.JOBS_LEARN_INTERVAL_MIN || '60'),
          reply: parseInt(process.env.JOBS_REPLY_INTERVAL_MIN || '30'),
          reply_posting: parseInt(process.env.JOBS_REPLY_INTERVAL_MIN || '30'),
          account_discovery: 1440,
          self_healing: 15,
          performance_optimizer: 120
        };

        const expectedInterval = intervals[name] || 60;
        const lastSuccess = heartbeat?.last_success ? new Date(heartbeat.last_success) : null;
        const lastFailure = heartbeat?.last_failure ? new Date(heartbeat.last_failure) : null;
        const lastRun = heartbeat?.updated_at ? new Date(heartbeat.updated_at) : null;
        const isRunning = heartbeat?.last_run_status === 'running';
        const isStale = lastSuccess 
          ? (now.getTime() - lastSuccess.getTime()) > (expectedInterval * 2 * 60 * 1000)
          : true;

        let status: JobStatus['status'] = 'unknown';
        if (isRunning) {
          status = 'running';
        } else if (heartbeat?.last_run_status === 'failure') {
          status = 'failure';
        } else if (isStale && lastSuccess) {
          status = 'stale';
        } else if (heartbeat?.last_run_status === 'success') {
          status = 'success';
        }

        const nextRunEstimate = lastSuccess 
          ? new Date(lastSuccess.getTime() + expectedInterval * 60 * 1000)
          : null;

        return {
          name,
          displayName: name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          status,
          lastRun,
          lastSuccess,
          lastFailure,
          consecutiveFailures: heartbeat?.consecutive_failures || 0,
          lastError: heartbeat?.last_error || null,
          expectedIntervalMinutes: expectedInterval,
          isStale,
          nextRunEstimate
        };
      })
    );

    // Get today's posting targets and actuals
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const hoursElapsed = now.getHours() + (now.getMinutes() / 60);
    
    const postsPerHourGoal = parseInt(process.env.MAX_POSTS_PER_HOUR || '2');
    const repliesPerHourGoal = parseInt(process.env.REPLIES_PER_HOUR || '4');
    const expectedPosts = Math.floor(hoursElapsed * postsPerHourGoal);
    const expectedReplies = Math.floor(hoursElapsed * repliesPerHourGoal);

    const { data: todayPosts } = await supabase
      .from('content_metadata')
      .select('decision_type, posted_at, status')
      .gte('created_at', todayStart.toISOString());

    const actualPosts = (todayPosts || []).filter((p: any) => 
      (p.decision_type === 'single' || p.decision_type === 'thread') && p.status === 'posted'
    ).length;
    
    const actualReplies = (todayPosts || []).filter((p: any) => 
      p.decision_type === 'reply' && p.status === 'posted'
    ).length;

    // Analyze why targets might be missed
    const targetMisses: TargetMiss[] = [];
    
    if (actualPosts < expectedPosts) {
      const planJob = jobStatuses.find(j => j.name === 'plan');
      const postingJob = jobStatuses.find(j => j.name === 'posting');
      
      let reason = 'Unknown';
      if (planJob?.status === 'failure' || planJob?.status === 'stale') {
        reason = `Plan job ${planJob.status} - not generating content`;
      } else if (postingJob?.status === 'failure') {
        reason = `Posting job failing - content not being posted`;
      } else if (planJob?.status === 'success' && postingJob?.status === 'success') {
        reason = 'Rate limiting or queue empty';
      }
      
      targetMisses.push({
        type: 'post',
        expected: expectedPosts,
        actual: actualPosts,
        reason,
        timestamp: now
      });
    }

    if (actualReplies < expectedReplies) {
      const replyJob = jobStatuses.find(j => j.name === 'reply' || j.name === 'reply_posting');
      
      let reason = 'Unknown';
      if (replyJob?.status === 'failure' || replyJob?.status === 'stale') {
        reason = `Reply job ${replyJob.status} - not generating/posting replies`;
      } else if (replyJob?.status === 'success') {
        reason = 'Rate limiting or no opportunities';
      }
      
      targetMisses.push({
        type: 'reply',
        expected: expectedReplies,
        actual: actualReplies,
        reason,
        timestamp: now
      });
    }

    // Get active failures
    const activeFailures = jobStatuses.filter(j => 
      j.status === 'failure' || (j.status === 'stale' && j.consecutiveFailures > 0)
    );

    // Get recent errors from system_events if available
    let recentErrors = null;
    try {
      const { data } = await supabase
        .from('system_events')
        .select('event_type, event_data, created_at, severity')
        .eq('severity', 'critical')
        .order('created_at', { ascending: false })
        .limit(10);
      recentErrors = data;
    } catch (error) {
      // Table might not exist, ignore
      recentErrors = [];
    }

    return generateSystemHealthHTML({
      jobStatuses,
      targetMisses,
      activeFailures,
      diagnostics,
      expectedPosts,
      actualPosts,
      expectedReplies,
      actualReplies,
      hoursElapsed: hoursElapsed.toFixed(1),
      recentErrors: recentErrors || []
    });
  } catch (error: any) {
    console.error('[SYSTEM_HEALTH_DASHBOARD] Error:', error.message);
    return generateErrorHTML(error.message, '/dashboard/business');
  }
}

function generateSystemHealthHTML(data: any): string {
  const { jobStatuses, targetMisses, activeFailures, diagnostics, expectedPosts, actualPosts, expectedReplies, actualReplies, hoursElapsed, recentErrors } = data;
  const now = new Date().toLocaleString();

  const overallHealth = activeFailures.length === 0 && targetMisses.length === 0 ? 'healthy' :
                        activeFailures.length > 0 ? 'critical' : 'warning';

  return `<!DOCTYPE html>
<html>
<head>
    <title>🏥 xBOT System Health</title>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="refresh" content="30">
    <style>
        ${getSharedStyles()}
        .health-banner {
            padding: 20px;
            border-radius: 12px;
            margin-bottom: 20px;
            display: flex;
            align-items: center;
            gap: 15px;
        }
        .health-banner.healthy {
            background: #d1fae5;
            border-left: 5px solid #10b981;
        }
        .health-banner.warning {
            background: #fef3c7;
            border-left: 5px solid #f59e0b;
        }
        .health-banner.critical {
            background: #fee2e2;
            border-left: 5px solid #ef4444;
        }
        .job-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
            gap: 15px;
            margin-bottom: 30px;
        }
        .job-card {
            background: white;
            padding: 15px;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            border-left: 4px solid #e5e7eb;
        }
        .job-card.running {
            border-left-color: #3b82f6;
        }
        .job-card.success {
            border-left-color: #10b981;
        }
        .job-card.failure {
            border-left-color: #ef4444;
        }
        .job-card.stale {
            border-left-color: #f59e0b;
        }
        .job-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
        }
        .job-name {
            font-weight: 600;
            color: #333;
        }
        .job-status {
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
        }
        .job-status.running {
            background: #dbeafe;
            color: #1e40af;
        }
        .job-status.success {
            background: #d1fae5;
            color: #065f46;
        }
        .job-status.failure {
            background: #fee2e2;
            color: #991b1b;
        }
        .job-status.stale {
            background: #fef3c7;
            color: #92400e;
        }
        .job-details {
            font-size: 13px;
            color: #666;
            line-height: 1.6;
        }
        .target-card {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            margin-bottom: 20px;
        }
        .target-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
        }
        .target-progress {
            display: flex;
            align-items: center;
            gap: 15px;
            margin-bottom: 10px;
        }
        .progress-bar {
            flex: 1;
            height: 24px;
            background: #e5e7eb;
            border-radius: 12px;
            overflow: hidden;
            position: relative;
        }
        .progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #10b981, #34d399);
            transition: width 0.3s;
        }
        .progress-fill.warning {
            background: linear-gradient(90deg, #f59e0b, #fbbf24);
        }
        .progress-fill.danger {
            background: linear-gradient(90deg, #ef4444, #f87171);
        }
        .miss-reason {
            padding: 10px;
            background: #fef3c7;
            border-radius: 6px;
            margin-top: 10px;
            font-size: 13px;
            color: #92400e;
        }
        .alert-section {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            margin-bottom: 20px;
        }
        .alert-item {
            padding: 12px;
            background: #fee2e2;
            border-left: 4px solid #ef4444;
            border-radius: 6px;
            margin-bottom: 10px;
        }
        .alert-item:last-child {
            margin-bottom: 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🏥 xBOT System Health</h1>
            <p>Real-time monitoring of all system components and targets</p>
        </div>

        ${generateNavigation('/dashboard/system-health')}

        <!-- Overall Health Banner -->
        <div class="health-banner ${overallHealth}">
            <div style="font-size: 32px;">
                ${overallHealth === 'healthy' ? '🟢' : overallHealth === 'warning' ? '🟡' : '🔴'}
            </div>
            <div>
                <div style="font-size: 20px; font-weight: 600; margin-bottom: 5px;">
                    System ${overallHealth === 'healthy' ? 'Healthy' : overallHealth === 'warning' ? 'Needs Attention' : 'Critical'}
                </div>
                <div style="color: #666;">
                    ${overallHealth === 'healthy' 
                      ? 'All systems operational and targets on track'
                      : overallHealth === 'warning'
                      ? 'Some targets are behind schedule'
                      : `${activeFailures.length} job(s) failing - immediate action required`}
                </div>
            </div>
        </div>

        <!-- Active Failures Alert -->
        ${activeFailures.length > 0 ? `
        <div class="alert-section">
            <h2 style="margin: 0 0 15px 0; color: #991b1b;">🚨 Active Failures</h2>
            ${activeFailures.map((job: any) => `
                <div class="alert-item">
                    <div style="font-weight: 600; margin-bottom: 5px;">${job.displayName}</div>
                    <div style="font-size: 13px; color: #666;">
                        ${job.lastError ? `Error: ${job.lastError.substring(0, 200)}` : 'No error message available'}
                    </div>
                    <div style="font-size: 12px; color: #999; margin-top: 5px;">
                        ${job.consecutiveFailures > 0 ? `${job.consecutiveFailures} consecutive failures • ` : ''}
                        Last run: ${job.lastRun ? formatTimeAgo(job.lastRun) : 'Never'}
                    </div>
                </div>
            `).join('')}
        </div>
        ` : ''}

        <!-- Target Tracking -->
        <div class="target-card">
            <div class="target-header">
                <h2 style="margin: 0;">🎯 Hourly Targets</h2>
                <span style="color: #666; font-size: 14px;">${hoursElapsed} hours elapsed today</span>
            </div>
            
            <!-- Posts Target -->
            <div style="margin-bottom: 20px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span style="font-weight: 600;">Posts Target</span>
                    <span style="color: ${actualPosts >= expectedPosts ? '#10b981' : '#ef4444'};">
                        ${actualPosts} / ${expectedPosts}
                    </span>
                </div>
                <div class="target-progress">
                    <div class="progress-bar">
                        <div class="progress-fill ${actualPosts >= expectedPosts ? '' : actualPosts >= expectedPosts * 0.7 ? 'warning' : 'danger'}" 
                             style="width: ${Math.min(100, (actualPosts / expectedPosts) * 100)}%"></div>
                    </div>
                </div>
                ${actualPosts < expectedPosts ? `
                    <div class="miss-reason">
                        ⚠️ Behind target by ${expectedPosts - actualPosts} posts. 
                        ${targetMisses.find((m: any) => m.type === 'post')?.reason || 'Reason unknown'}
                    </div>
                ` : ''}
            </div>

            <!-- Replies Target -->
            <div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span style="font-weight: 600;">Replies Target</span>
                    <span style="color: ${actualReplies >= expectedReplies ? '#10b981' : '#ef4444'};">
                        ${actualReplies} / ${expectedReplies}
                    </span>
                </div>
                <div class="target-progress">
                    <div class="progress-bar">
                        <div class="progress-fill ${actualReplies >= expectedReplies ? '' : actualReplies >= expectedReplies * 0.7 ? 'warning' : 'danger'}" 
                             style="width: ${Math.min(100, (actualReplies / expectedReplies) * 100)}%"></div>
                    </div>
                </div>
                ${actualReplies < expectedReplies ? `
                    <div class="miss-reason">
                        ⚠️ Behind target by ${expectedReplies - actualReplies} replies. 
                        ${targetMisses.find((m: any) => m.type === 'reply')?.reason || 'Reason unknown'}
                    </div>
                ` : ''}
            </div>
        </div>

        <!-- Job Status Grid -->
        <h2 style="margin-bottom: 15px;">⚙️ Job Status</h2>
        <div class="job-grid">
            ${jobStatuses.map((job: any) => `
                <div class="job-card ${job.status}">
                    <div class="job-header">
                        <div class="job-name">${job.displayName}</div>
                        <div class="job-status ${job.status}">${job.status}</div>
                    </div>
                    <div class="job-details">
                        ${job.lastSuccess 
                          ? `✅ Last success: ${formatTimeAgo(job.lastSuccess)}<br/>`
                          : '❌ Never succeeded<br/>'}
                        ${job.nextRunEstimate 
                          ? `⏰ Next run: ${formatTimeAgo(job.nextRunEstimate)}<br/>`
                          : ''}
                        ${job.expectedIntervalMinutes 
                          ? `🔄 Interval: ${job.expectedIntervalMinutes} min<br/>`
                          : ''}
                        ${job.consecutiveFailures > 0 
                          ? `<span style="color: #ef4444;">⚠️ ${job.consecutiveFailures} consecutive failures</span><br/>`
                          : ''}
                        ${job.lastError 
                          ? `<span style="color: #991b1b; font-size: 12px;">Error: ${job.lastError.substring(0, 100)}...</span>`
                          : ''}
                    </div>
                </div>
            `).join('')}
        </div>

        <div style="text-align: center; color: #666; font-size: 14px; margin-top: 30px; padding: 20px;">
            ⚡ Auto-refresh every 30 seconds • Last updated: ${now}
        </div>
    </div>
</body>
</html>`;
}
