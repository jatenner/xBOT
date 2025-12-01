/**
 * 📈 ANALYTICS DASHBOARD
 * Performance metrics, target tracking, and data validation
 */

import { getSupabaseClient } from '../db';
import { DiagnosticEngine } from '../diagnostics/diagnosticEngine';
import { 
  generateNavigation, 
  getSharedStyles, 
  generateErrorHTML, 
  formatTimeAgo,
  TOKEN_PARAM
} from './shared/dashboardUtils';

export async function generateAnalyticsDashboard(): Promise<string> {
  try {
    const supabase = getSupabaseClient();
    const engine = DiagnosticEngine.getInstance();
    
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const hoursElapsed = now.getHours() + (now.getMinutes() / 60);
    
    const postsPerHourGoal = parseInt(process.env.MAX_POSTS_PER_HOUR || '2');
    const repliesPerHourGoal = parseInt(process.env.REPLIES_PER_HOUR || '4');
    const expectedPosts = Math.floor(hoursElapsed * postsPerHourGoal);
    const expectedReplies = Math.floor(hoursElapsed * repliesPerHourGoal);
    
    // Get today's posts
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
    
    // Get posting attempts
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: attempts } = await supabase
      .from('posting_attempts')
      .select('status')
      .gte('created_at', oneDayAgo);
    
    const successRate = attempts && attempts.length > 0
      ? (attempts.filter((a: any) => a.status === 'success').length / attempts.length) * 100
      : 100;
    
    // Get metrics coverage
    const { count: postsWithMetrics } = await supabase
      .from('content_metadata')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'posted')
      .not('tweet_id', 'is', null)
      .not('actual_impressions', 'is', null);
    
    const { count: totalPosted } = await supabase
      .from('content_metadata')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'posted')
      .not('tweet_id', 'is', null);
    
    const metricsCoverage = totalPosted && totalPosted > 0
      ? Math.round((postsWithMetrics || 0) / totalPosted * 100)
      : 100;
    
    return generateAnalyticsHTML({
      expectedPosts,
      actualPosts,
      expectedReplies,
      actualReplies,
      hoursElapsed: hoursElapsed.toFixed(1),
      successRate: successRate.toFixed(1),
      metricsCoverage,
      totalAttempts: attempts?.length || 0
    });
  } catch (error: any) {
    console.error('[ANALYTICS_DASHBOARD] Error:', error.message);
    return generateErrorHTML(error.message, '/dashboard/overview');
  }
}

function generateAnalyticsHTML(data: any): string {
  const { expectedPosts, actualPosts, expectedReplies, actualReplies, hoursElapsed, successRate, metricsCoverage, totalAttempts } = data;
  const now = new Date().toLocaleString();
  
  const postsOnTrack = actualPosts >= expectedPosts;
  const repliesOnTrack = actualReplies >= expectedReplies;
  
  return `<!DOCTYPE html>
<html>
<head>
    <title>📈 xBOT Analytics</title>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="refresh" content="60">
    <style>
        ${getSharedStyles()}
        .metric-card {
            background: white;
            padding: 25px;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            margin-bottom: 20px;
        }
        .metric-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
        }
        .progress-bar {
            height: 30px;
            background: #e5e7eb;
            border-radius: 15px;
            overflow: hidden;
            position: relative;
            margin-top: 15px;
        }
        .progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #10b981, #34d399);
            transition: width 0.3s;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: 600;
        }
        .progress-fill.warning {
            background: linear-gradient(90deg, #f59e0b, #fbbf24);
        }
        .progress-fill.danger {
            background: linear-gradient(90deg, #ef4444, #f87171);
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📈 xBOT Analytics</h1>
            <p>Performance metrics, targets, and validation</p>
        </div>

        ${generateNavigation('/dashboard/analytics')}

        <!-- Target Tracking -->
        <div class="metric-card">
            <div class="metric-header">
                <h2 style="margin: 0;">🎯 Hourly Targets</h2>
                <span style="color: #666; font-size: 14px;">${hoursElapsed} hours elapsed today</span>
            </div>
            
            <!-- Posts Target -->
            <div style="margin-bottom: 25px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span style="font-weight: 600;">Posts Target</span>
                    <span style="color: ${postsOnTrack ? '#10b981' : '#ef4444'}; font-weight: 600;">
                        ${actualPosts} / ${expectedPosts}
                    </span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill ${postsOnTrack ? '' : actualPosts >= expectedPosts * 0.7 ? 'warning' : 'danger'}" 
                         style="width: ${Math.min(100, (actualPosts / expectedPosts) * 100)}%">
                        ${Math.round((actualPosts / expectedPosts) * 100)}%
                    </div>
                </div>
                ${!postsOnTrack ? `
                    <div style="margin-top: 10px; padding: 10px; background: #fef3c7; border-radius: 6px; font-size: 13px; color: #92400e;">
                        ⚠️ Behind target by ${expectedPosts - actualPosts} posts
                    </div>
                ` : ''}
            </div>

            <!-- Replies Target -->
            <div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span style="font-weight: 600;">Replies Target</span>
                    <span style="color: ${repliesOnTrack ? '#10b981' : '#ef4444'}; font-weight: 600;">
                        ${actualReplies} / ${expectedReplies}
                    </span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill ${repliesOnTrack ? '' : actualReplies >= expectedReplies * 0.7 ? 'warning' : 'danger'}" 
                         style="width: ${Math.min(100, (actualReplies / expectedReplies) * 100)}%">
                        ${Math.round((actualReplies / expectedReplies) * 100)}%
                    </div>
                </div>
                ${!repliesOnTrack ? `
                    <div style="margin-top: 10px; padding: 10px; background: #fef3c7; border-radius: 6px; font-size: 13px; color: #92400e;">
                        ⚠️ Behind target by ${expectedReplies - actualReplies} replies
                    </div>
                ` : ''}
            </div>
        </div>

        <!-- Performance Metrics -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 20px;">
            <div class="metric-card">
                <div style="font-size: 32px; font-weight: bold; color: ${parseFloat(successRate) >= 90 ? '#10b981' : parseFloat(successRate) >= 70 ? '#f59e0b' : '#ef4444'};">
                    ${successRate}%
                </div>
                <div style="font-size: 14px; color: #666; margin-top: 5px;">Posting Success Rate</div>
                <div style="font-size: 12px; color: #999; margin-top: 5px;">${totalAttempts} attempts (24h)</div>
            </div>
            
            <div class="metric-card">
                <div style="font-size: 32px; font-weight: bold; color: ${metricsCoverage >= 80 ? '#10b981' : metricsCoverage >= 60 ? '#f59e0b' : '#ef4444'};">
                    ${metricsCoverage}%
                </div>
                <div style="font-size: 14px; color: #666; margin-top: 5px;">Metrics Coverage</div>
                <div style="font-size: 12px; color: #999; margin-top: 5px;">Posts with metrics</div>
            </div>
        </div>

        <div style="text-align: center; color: #666; font-size: 14px; margin-top: 30px; padding: 20px;">
            ⚡ Auto-refresh every 60 seconds • Last updated: ${now}
        </div>
    </div>
</body>
</html>`;
}

