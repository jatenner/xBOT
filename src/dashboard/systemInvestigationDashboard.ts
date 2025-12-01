/**
 * 🔍 SYSTEM INVESTIGATION DASHBOARD
 * Deep dive report showing actual system state vs dashboard claims
 */

import { 
  generateNavigation, 
  getSharedStyles, 
  generateErrorHTML, 
  formatTimeAgo,
  TOKEN_PARAM
} from './shared/dashboardUtils';

export async function generateSystemInvestigationDashboard(): Promise<string> {
  try {
    // Fetch investigation data from API
    const baseUrl = process.env.RAILWAY_PUBLIC_DOMAIN 
      ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
      : 'http://localhost:3000';
    
    const response = await fetch(`${baseUrl}/api/system-investigation`);
    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }
    const investigation = await response.json();
    
    return generateInvestigationHTML(investigation);
  } catch (error: any) {
    console.error('[SYSTEM_INVESTIGATION_DASHBOARD] Error:', error.message);
    // Fallback: try direct database access
    try {
      const { getSupabaseClient } = await import('../db');
      const { getHeartbeat } = await import('../jobs/jobHeartbeat');
      const { getCircuitBreakerStatus } = await import('../jobs/postingQueue');
      
      const supabase = getSupabaseClient();
      const postingHeartbeat = await getHeartbeat('posting');
      const metricsHeartbeat = await getHeartbeat('metrics_scraper') || await getHeartbeat('analytics');
      const circuitBreaker = getCircuitBreakerStatus();
      
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: attempts } = await supabase
        .from('posting_attempts')
        .select('status, error_message, created_at')
        .gte('created_at', oneDayAgo)
        .order('created_at', { ascending: false });
      
      const { count: totalPosted } = await supabase
        .from('content_metadata')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'posted')
        .not('tweet_id', 'is', null);
      
      const { count: withMetrics } = await supabase
        .from('content_metadata')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'posted')
        .not('tweet_id', 'is', null)
        .not('actual_impressions', 'is', null);
      
      const investigation = {
        posting: {
          status: postingHeartbeat?.last_run_status || 'unknown',
          lastSuccess: postingHeartbeat?.last_success || null,
          consecutiveFailures: postingHeartbeat?.consecutive_failures || 0,
          lastError: postingHeartbeat?.last_error || null,
          minutesSinceSuccess: postingHeartbeat?.last_success 
            ? Math.floor((Date.now() - new Date(postingHeartbeat.last_success).getTime()) / (1000 * 60))
            : null,
          attempts: attempts && attempts.length > 0 ? {
            total: attempts.length,
            success: attempts.filter(a => a.status === 'success').length,
            failed: attempts.filter(a => a.status === 'failed').length,
            successRate: ((attempts.filter(a => a.status === 'success').length / attempts.length) * 100).toFixed(1)
          } : { total: 0 }
        },
        metrics: {
          status: metricsHeartbeat?.last_run_status || 'unknown',
          lastSuccess: metricsHeartbeat?.last_success || null,
          minutesSinceSuccess: metricsHeartbeat?.last_success
            ? Math.floor((Date.now() - new Date(metricsHeartbeat.last_success).getTime()) / (1000 * 60))
            : null
        },
        coverage: {
          totalPosted: totalPosted || 0,
          withMetrics: withMetrics || 0,
          coverage: totalPosted && totalPosted > 0
            ? Math.round((withMetrics || 0) / totalPosted * 100)
            : 100
        },
        circuitBreaker: {
          state: circuitBreaker.state,
          failures: circuitBreaker.failures,
          isOpen: circuitBreaker.state === 'open'
        },
        summary: {
          postingJobWorking: postingHeartbeat?.last_success && 
            (Date.now() - new Date(postingHeartbeat.last_success).getTime()) < 30 * 60 * 1000,
          metricsScraperWorking: metricsHeartbeat?.last_success &&
            (Date.now() - new Date(metricsHeartbeat.last_success).getTime()) < 30 * 60 * 1000
        }
      };
      
      return generateInvestigationHTML(investigation);
    } catch (fallbackError: any) {
      return generateErrorHTML(`Investigation failed: ${fallbackError.message}`, '/dashboard/overview');
    }
  }
}

function generateInvestigationHTML(investigation: any): string {
  const now = new Date().toLocaleString();
  
  return `<!DOCTYPE html>
<html>
<head>
    <title>🔍 xBOT System Investigation</title>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="refresh" content="60">
    <style>
        ${getSharedStyles()}
        .investigation-section {
            background: white;
            border-radius: 8px;
            padding: 25px;
            margin-bottom: 20px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .finding {
            padding: 15px;
            border-radius: 6px;
            margin-bottom: 15px;
            border-left: 4px solid #e5e7eb;
        }
        .finding.working {
            background: #d1fae5;
            border-left-color: #10b981;
        }
        .finding.not-working {
            background: #fee2e2;
            border-left-color: #ef4444;
        }
        .finding.warning {
            background: #fef3c7;
            border-left-color: #f59e0b;
        }
        .stat-row {
            display: flex;
            justify-content: space-between;
            padding: 10px 0;
            border-bottom: 1px solid #e5e7eb;
        }
        .stat-row:last-child {
            border-bottom: none;
        }
        .stat-label {
            font-weight: 600;
            color: #333;
        }
        .stat-value {
            color: #666;
        }
        .summary-box {
            background: linear-gradient(135deg, #667eea15, #764ba215);
            border: 2px solid #667eea;
            border-radius: 12px;
            padding: 25px;
            margin-bottom: 30px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔍 xBOT System Investigation</h1>
            <p>Deep dive into actual system state vs dashboard claims</p>
        </div>

        ${generateNavigation('/dashboard/system-investigation')}

        <!-- Summary -->
        <div class="summary-box">
            <h2 style="margin: 0 0 15px 0;">📋 Investigation Summary</h2>
            <div style="font-size: 18px; font-weight: 600; color: #333; margin-bottom: 10px;">
                ${investigation.summary?.overallAssessment || 'Investigating...'}
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-top: 20px;">
                <div>
                    <div style="font-size: 14px; color: #666;">Posting Job</div>
                    <div style="font-size: 20px; font-weight: 600; color: ${investigation.summary?.postingJobWorking ? '#10b981' : '#ef4444'};">
                        ${investigation.summary?.postingJobWorking ? '✅ Working' : '❌ Not Working'}
                    </div>
                </div>
                <div>
                    <div style="font-size: 14px; color: #666;">Metrics Scraper</div>
                    <div style="font-size: 20px; font-weight: 600; color: ${investigation.summary?.metricsScraperWorking ? '#10b981' : '#ef4444'};">
                        ${investigation.summary?.metricsScraperWorking ? '✅ Working' : '❌ Not Working'}
                    </div>
                </div>
                <div>
                    <div style="font-size: 14px; color: #666;">Posting Success Rate</div>
                    <div style="font-size: 20px; font-weight: 600; color: ${investigation.posting?.attempts?.successRate && parseFloat(investigation.posting.attempts.successRate) >= 70 ? '#10b981' : '#ef4444'};">
                        ${investigation.posting?.attempts?.successRate ? `${investigation.posting.attempts.successRate}%` : 'N/A'}
                    </div>
                </div>
                <div>
                    <div style="font-size: 14px; color: #666;">Circuit Breaker</div>
                    <div style="font-size: 20px; font-weight: 600; color: ${investigation.circuitBreaker?.isOpen ? '#ef4444' : '#10b981'};">
                        ${investigation.circuitBreaker?.isOpen ? '❌ OPEN' : '✅ Closed'}
                    </div>
                </div>
            </div>
        </div>

        <!-- Posting Job Analysis -->
        <div class="investigation-section">
            <h2 style="margin: 0 0 20px 0;">📮 Posting Job Analysis</h2>
            
            <div class="finding ${investigation.posting?.minutesSinceSuccess !== null && investigation.posting.minutesSinceSuccess < 30 ? 'working' : 'not-working'}">
                <div style="font-weight: 600; margin-bottom: 10px; font-size: 16px;">
                    ${investigation.posting?.minutesSinceSuccess !== null && investigation.posting.minutesSinceSuccess < 30 ? '✅' : '❌'} 
                    Job Status: ${investigation.posting?.status || 'Unknown'}
                </div>
                <div class="stat-row">
                    <span class="stat-label">Last Success:</span>
                    <span class="stat-value">${investigation.posting?.lastSuccess ? formatTimeAgo(investigation.posting.lastSuccess) : 'Never'}</span>
                </div>
                ${investigation.posting?.minutesSinceSuccess !== null ? `
                <div class="stat-row">
                    <span class="stat-label">Minutes Since Success:</span>
                    <span class="stat-value">${investigation.posting.minutesSinceSuccess} minutes</span>
                </div>
                ` : ''}
                <div class="stat-row">
                    <span class="stat-label">Consecutive Failures:</span>
                    <span class="stat-value">${investigation.posting?.consecutiveFailures || 0}</span>
                </div>
                ${investigation.posting?.lastError ? `
                <div class="stat-row">
                    <span class="stat-label">Last Error:</span>
                    <span class="stat-value" style="color: #991b1b; font-size: 12px;">${investigation.posting.lastError.substring(0, 300)}</span>
                </div>
                ` : ''}
            </div>

            ${investigation.posting?.attempts && investigation.posting.attempts.total > 0 ? `
            <div class="finding ${investigation.posting.attempts.successRate && parseFloat(investigation.posting.attempts.successRate) >= 70 ? 'working' : 'not-working'}">
                <div style="font-weight: 600; margin-bottom: 10px; font-size: 16px;">
                    📊 Posting Attempts (Last 24h)
                </div>
                <div class="stat-row">
                    <span class="stat-label">Total Attempts:</span>
                    <span class="stat-value">${investigation.posting.attempts.total}</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">Successful:</span>
                    <span class="stat-value" style="color: #10b981;">${investigation.posting.attempts.success || 0}</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">Failed:</span>
                    <span class="stat-value" style="color: #ef4444;">${investigation.posting.attempts.failed || 0}</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">Success Rate:</span>
                    <span class="stat-value" style="font-weight: 600; font-size: 18px; color: ${investigation.posting.attempts.successRate && parseFloat(investigation.posting.attempts.successRate) >= 70 ? '#10b981' : '#ef4444'};">
                        ${investigation.posting.attempts.successRate}%
                    </span>
                </div>
                
                ${investigation.posting.attempts.recentFailures && investigation.posting.attempts.recentFailures.length > 0 ? `
                <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #e5e7eb;">
                    <div style="font-weight: 600; margin-bottom: 10px;">Recent Failures:</div>
                    ${investigation.posting.attempts.recentFailures.map((failure: any) => `
                        <div style="padding: 8px; background: #fee2e2; border-radius: 4px; margin-bottom: 5px; font-size: 12px;">
                            <div style="font-weight: 600; color: #991b1b;">${new Date(failure.time).toLocaleString()}</div>
                            <div style="color: #666; margin-top: 4px;">${failure.error}</div>
                        </div>
                    `).join('')}
                </div>
                ` : ''}
            </div>
            ` : `
            <div class="finding warning">
                <div style="font-weight: 600;">⚠️ No posting attempts found in last 24 hours</div>
                <div style="margin-top: 10px; color: #666;">This could mean:</div>
                <ul style="margin-top: 5px; color: #666;">
                    <li>Posting job is not running</li>
                    <li>No content in queue to post</li>
                    <li>Rate limits are blocking posts</li>
                </ul>
            </div>
            `}
        </div>

        <!-- Metrics Scraper Analysis -->
        <div class="investigation-section">
            <h2 style="margin: 0 0 20px 0;">📊 Metrics Scraper Analysis</h2>
            
            <div class="finding ${investigation.metrics?.minutesSinceSuccess !== null && investigation.metrics.minutesSinceSuccess < 30 ? 'working' : 'not-working'}">
                <div style="font-weight: 600; margin-bottom: 10px; font-size: 16px;">
                    ${investigation.metrics?.minutesSinceSuccess !== null && investigation.metrics.minutesSinceSuccess < 30 ? '✅' : '❌'} 
                    Scraper Status: ${investigation.metrics?.status || 'Unknown'}
                </div>
                <div class="stat-row">
                    <span class="stat-label">Last Success:</span>
                    <span class="stat-value">${investigation.metrics?.lastSuccess ? formatTimeAgo(investigation.metrics.lastSuccess) : 'Never'}</span>
                </div>
                ${investigation.metrics?.minutesSinceSuccess !== null ? `
                <div class="stat-row">
                    <span class="stat-label">Minutes Since Success:</span>
                    <span class="stat-value">${investigation.metrics.minutesSinceSuccess} minutes</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">Is Stale (>20 min):</span>
                    <span class="stat-value" style="color: ${investigation.metrics.isStale ? '#ef4444' : '#10b981'};">
                        ${investigation.metrics.isStale ? 'YES ⚠️' : 'NO ✅'}
                    </span>
                </div>
                ` : ''}
                ${investigation.metrics?.lastError ? `
                <div class="stat-row">
                    <span class="stat-label">Last Error:</span>
                    <span class="stat-value" style="color: #991b1b; font-size: 12px;">${investigation.metrics.lastError.substring(0, 300)}</span>
                </div>
                ` : ''}
            </div>

            <div class="finding ${investigation.coverage?.coverage >= 80 ? 'working' : 'warning'}">
                <div style="font-weight: 600; margin-bottom: 10px; font-size: 16px;">
                    📈 Metrics Coverage
                </div>
                <div class="stat-row">
                    <span class="stat-label">Total Posted:</span>
                    <span class="stat-value">${investigation.coverage?.totalPosted || 0}</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">With Metrics:</span>
                    <span class="stat-value">${investigation.coverage?.withMetrics || 0}</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">Coverage:</span>
                    <span class="stat-value" style="font-weight: 600; font-size: 18px; color: ${investigation.coverage?.coverage >= 80 ? '#10b981' : '#f59e0b'};">
                        ${investigation.coverage?.coverage || 0}%
                    </span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">Missing Metrics:</span>
                    <span class="stat-value" style="color: ${investigation.coverage?.missingMetrics > 0 ? '#f59e0b' : '#10b981'};">
                        ${investigation.coverage?.missingMetrics || 0} posts
                    </span>
                </div>
            </div>
        </div>

        <!-- Circuit Breaker -->
        ${investigation.circuitBreaker?.isOpen ? `
        <div class="investigation-section">
            <h2 style="margin: 0 0 20px 0;">🔌 Circuit Breaker Status</h2>
            <div class="finding not-working">
                <div style="font-weight: 600; margin-bottom: 10px; font-size: 18px; color: #991b1b;">
                    ⚠️ CIRCUIT BREAKER IS OPEN
                </div>
                <div class="stat-row">
                    <span class="stat-label">State:</span>
                    <span class="stat-value" style="color: #ef4444; font-weight: 600;">${investigation.circuitBreaker.state.toUpperCase()}</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">Failures:</span>
                    <span class="stat-value">${investigation.circuitBreaker.failures} / ${investigation.circuitBreaker.threshold}</span>
                </div>
                ${investigation.circuitBreaker.timeUntilReset ? `
                <div class="stat-row">
                    <span class="stat-label">Will Reset In:</span>
                    <span class="stat-value">${Math.ceil(investigation.circuitBreaker.timeUntilReset / 1000)} seconds</span>
                </div>
                ` : ''}
                <div style="margin-top: 15px; padding: 12px; background: #fee2e2; border-radius: 6px; color: #991b1b;">
                    <strong>Impact:</strong> All posting operations are blocked until circuit breaker resets or is manually reset.
                </div>
            </div>
        </div>
        ` : ''}

        <!-- Recent Activity -->
        ${investigation.recentActivity?.lastPostTime ? `
        <div class="investigation-section">
            <h2 style="margin: 0 0 20px 0;">📝 Recent Activity</h2>
            <div class="finding ${investigation.recentActivity.isInactive ? 'warning' : 'working'}">
                <div style="font-weight: 600; margin-bottom: 10px; font-size: 16px;">
                    ${investigation.recentActivity.isInactive ? '⚠️' : '✅'} 
                    Last Post Activity
                </div>
                <div class="stat-row">
                    <span class="stat-label">Last Post:</span>
                    <span class="stat-value">${new Date(investigation.recentActivity.lastPostTime).toLocaleString()}</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">Minutes Since Last Post:</span>
                    <span class="stat-value">${investigation.recentActivity.minutesSinceLastPost} minutes</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">Is Inactive (>30 min):</span>
                    <span class="stat-value" style="color: ${investigation.recentActivity.isInactive ? '#ef4444' : '#10b981'};">
                        ${investigation.recentActivity.isInactive ? 'YES ⚠️' : 'NO ✅'}
                    </span>
                </div>
            </div>
        </div>
        ` : ''}

        <!-- Queued Content -->
        ${investigation.queuedContent ? `
        <div class="investigation-section">
            <h2 style="margin: 0 0 20px 0;">📦 Queued Content</h2>
            <div class="finding ${investigation.queuedContent.total > 0 ? 'working' : 'warning'}">
                <div style="font-weight: 600; margin-bottom: 10px; font-size: 16px;">
                    ${investigation.queuedContent.total > 0 ? '✅' : '⚠️'} 
                    Queue Status
                </div>
                <div class="stat-row">
                    <span class="stat-label">Total Queued:</span>
                    <span class="stat-value">${investigation.queuedContent.total}</span>
                </div>
                ${investigation.queuedContent.total > 0 ? `
                <div class="stat-row">
                    <span class="stat-label">Singles:</span>
                    <span class="stat-value">${investigation.queuedContent.singles || 0}</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">Threads:</span>
                    <span class="stat-value">${investigation.queuedContent.threads || 0}</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">Replies:</span>
                    <span class="stat-value">${investigation.queuedContent.replies || 0}</span>
                </div>
                ${investigation.queuedContent.oldestQueuedHours ? `
                <div class="stat-row">
                    <span class="stat-label">Oldest Queued:</span>
                    <span class="stat-value">${investigation.queuedContent.oldestQueuedHours.toFixed(1)} hours ago</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">Is Stale (>2 hours):</span>
                    <span class="stat-value" style="color: ${investigation.queuedContent.isStale ? '#ef4444' : '#10b981'};">
                        ${investigation.queuedContent.isStale ? 'YES ⚠️' : 'NO ✅'}
                    </span>
                </div>
                ` : ''}
                ` : ''}
            </div>
        </div>
        ` : ''}

        <div style="text-align: center; color: #666; font-size: 14px; margin-top: 30px; padding: 20px;">
            ⚡ Auto-refresh every 60 seconds • Last updated: ${now}
        </div>
    </div>
</body>
</html>`;
}

