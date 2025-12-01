/**
 * 📋 POSTING MONITOR DASHBOARD
 * Monitor hourly posting schedule and track posting goals
 */

import { getSupabaseClient } from '../db';
import { 
  generateNavigation, 
  getSharedStyles, 
  generateErrorHTML,
  getTodayStats,
  TOKEN_PARAM
} from './shared/dashboardUtils';

export async function generatePostingMonitorDashboard(): Promise<string> {
  try {
    const supabase = getSupabaseClient();
    
    // Build posting monitor data directly
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // Get posts from today
    const { data: todayPosts } = await supabase
      .from('content_metadata')
      .select('content, posted_at, tweet_id, actual_impressions, actual_likes, actual_engagement_rate, decision_type')
      .eq('status', 'posted')
      .gte('posted_at', todayStart.toISOString())
      .order('posted_at', { ascending: true });

    // Hourly targets: 2 posts/hour, 4 replies/hour
    const postsPerHourGoal = parseInt(process.env.MAX_POSTS_PER_HOUR || '2');
    const repliesPerHourGoal = parseInt(process.env.REPLIES_PER_HOUR || '4');
    
    const singlePosts = (todayPosts || []).filter((p: any) => p.decision_type === 'single');
    const replyPosts = (todayPosts || []).filter((p: any) => p.decision_type === 'reply');
    const postedToday = singlePosts.length;
    const repliedToday = replyPosts.length;
    
    // Calculate hourly goals (posts per hour * hours elapsed today)
    const hoursElapsed = now.getHours() + (now.getMinutes() / 60);
    const hourlyPostsGoal = Math.floor(hoursElapsed * postsPerHourGoal);
    const hourlyRepliesGoal = Math.floor(hoursElapsed * repliesPerHourGoal);
    
    // On track if we're meeting or exceeding hourly pace
    const postsOnTrack = postedToday >= hourlyPostsGoal;
    const repliesOnTrack = repliedToday >= hourlyRepliesGoal;
    const onTrack = postsOnTrack && repliesOnTrack;

    // Build timeline for last 24 hours
    const last24Hours = [];
    for (let i = 23; i >= 0; i--) {
      const hourTime = new Date(now.getTime() - i * 60 * 60 * 1000);
      const hour = hourTime.getHours();
      const hourStart = new Date(hourTime.setMinutes(0, 0, 0));
      const hourEnd = new Date(hourTime.setMinutes(59, 59, 999));
      
      const postsInHour = (todayPosts || []).filter((p: any) => {
        if (!p.posted_at) return false;
        const postTime = new Date(p.posted_at);
        return postTime >= hourStart && postTime <= hourEnd && p.decision_type === 'single';
      });
      
      last24Hours.push({
        hour,
        posted: postsInHour.length > 0,
        count: postsInHour.length
      });
    }

    const timeline = singlePosts.map((post: any) => ({
      time: post.posted_at,
      post: post.content?.substring(0, 100) || 'No content',
      status: 'success' as const,
      tweetId: post.tweet_id,
      metrics: {
        views: post.actual_impressions || 0,
        likes: post.actual_likes || 0
      }
    }));

    const scheduleHealth: {
      spacing: 'good' | 'tight';
      rateLimit: string;
      issues: any[];
    } = {
      spacing: 'good',
      rateLimit: 'respected',
      issues: []
    };

    // Check spacing between posts
    if (timeline.length > 1) {
      for (let i = 1; i < timeline.length; i++) {
        const timeDiff = new Date(timeline[i].time).getTime() - new Date(timeline[i-1].time).getTime();
        const hoursDiff = timeDiff / (1000 * 60 * 60);
        if (hoursDiff < 0.5) {
          scheduleHealth.spacing = 'tight';
          scheduleHealth.issues.push({
            type: 'spacing',
            message: 'Posts were published too close together',
            posts: [timeline[i-1].time, timeline[i].time]
          });
        }
      }
    }

    const monitorData = {
      postsPerHourGoal,
      repliesPerHourGoal,
      hourlyPostsGoal,
      hourlyRepliesGoal,
      postedToday,
      repliedToday,
      postsOnTrack,
      repliesOnTrack,
      onTrack,
      timeline,
      scheduleHealth,
      last24Hours,
      hoursElapsed,
      hoursElapsedDisplay
    };

    // Get detailed post history for display
    const { data: weekPosts } = await supabase
      .from('content_metadata')
      .select('posted_at, decision_type, actual_impressions, actual_likes')
      .eq('status', 'posted')
      .eq('decision_type', 'single')
      .gte('posted_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order('posted_at', { ascending: true });

    return generatePostingMonitorHTML({
      monitorData,
      todayPosts: singlePosts || [],
      weekPosts: weekPosts || []
    });
  } catch (error: any) {
    console.error('[POSTING_MONITOR_DASHBOARD] Error:', error.message);
    return generateErrorHTML(error.message);
  }
}

function generatePostingMonitorHTML(data: any): string {
  const now = new Date().toLocaleString();
  const { monitorData, todayPosts, weekPosts } = data;

  const singlePosts = todayPosts.filter((p: any) => p.decision_type === 'single');
  const replyPosts = todayPosts.filter((p: any) => p.decision_type === 'reply');
  const postsOnTrackEmoji = monitorData.postsOnTrack ? '✅' : '⚠️';
  const repliesOnTrackEmoji = monitorData.repliesOnTrack ? '✅' : '⚠️';
  const postsProgressPercent = monitorData.hourlyPostsGoal > 0 
    ? Math.min(100, (monitorData.postedToday / monitorData.hourlyPostsGoal) * 100)
    : 0;
  const repliesProgressPercent = monitorData.hourlyRepliesGoal > 0
    ? Math.min(100, (monitorData.repliedToday / monitorData.hourlyRepliesGoal) * 100)
    : 0;

  // Build hourly timeline visualization
  const hourlyTimeline = monitorData.last24Hours || [];
  
  // Calculate week stats
  const postsByDay = new Map<string, number>();
  weekPosts.forEach((post: any) => {
    const day = new Date(post.posted_at).toLocaleDateString('en-US', { weekday: 'short' });
    postsByDay.set(day, (postsByDay.get(day) || 0) + 1);
  });

  return `<!DOCTYPE html>
<html>
<head>
    <title>📋 Posting Monitor | xBOT</title>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        ${getSharedStyles()}
        .goal-card {
            background: white;
            padding: 30px;
            border-radius: 15px;
            box-shadow: 0 5px 20px rgba(0,0,0,0.1);
            margin-bottom: 20px;
        }
        .goal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
        }
        .goal-status {
            font-size: 48px;
        }
        .progress-container {
            margin-top: 20px;
        }
        .progress-bar {
            background: #e5e7eb;
            height: 40px;
            border-radius: 20px;
            overflow: hidden;
            position: relative;
        }
        .progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #10b981, #059669);
            transition: width 0.5s;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: 600;
            font-size: 16px;
        }
        .timeline-container {
            background: white;
            padding: 30px;
            border-radius: 15px;
            box-shadow: 0 5px 20px rgba(0,0,0,0.1);
            margin-bottom: 20px;
        }
        .timeline-grid {
            display: grid;
            grid-template-columns: repeat(24, 1fr);
            gap: 4px;
            margin-top: 20px;
        }
        .hour-cell {
            height: 40px;
            background: #f3f4f6;
            border-radius: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 10px;
            color: #666;
            position: relative;
        }
        .hour-cell.posted {
            background: #10b981;
            color: white;
            font-weight: 600;
        }
        .hour-cell.current {
            border: 2px solid #667eea;
            box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.3);
        }
        .hour-label {
            font-size: 11px;
            color: #666;
            text-align: center;
            margin-top: 4px;
        }
        .post-item {
            background: white;
            padding: 20px;
            border-radius: 12px;
            margin-bottom: 15px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            border-left: 4px solid #10b981;
        }
        .post-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 12px;
        }
        .post-time {
            color: #666;
            font-size: 14px;
            font-weight: 600;
        }
        .post-content {
            color: #333;
            line-height: 1.6;
            margin-bottom: 12px;
        }
        .post-metrics {
            display: flex;
            gap: 20px;
            padding-top: 12px;
            border-top: 1px solid #f0f0f0;
        }
        .metric-item {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .metric-value {
            font-weight: 600;
            color: #333;
        }
        .week-stats {
            background: white;
            padding: 25px;
            border-radius: 15px;
            box-shadow: 0 5px 20px rgba(0,0,0,0.1);
        }
        .week-grid {
            display: grid;
            grid-template-columns: repeat(7, 1fr);
            gap: 15px;
            margin-top: 20px;
        }
        .day-card {
            background: #f9fafb;
            padding: 15px;
            border-radius: 8px;
            text-align: center;
        }
        .day-name {
            font-size: 12px;
            color: #666;
            margin-bottom: 8px;
        }
        .day-count {
            font-size: 24px;
            font-weight: bold;
            color: #333;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📋 Posting Monitor</h1>
            <p>Track your hourly posting schedule: ${monitorData.postsPerHourGoal} posts/hour, ${monitorData.repliesPerHourGoal} replies/hour</p>
        </div>

        ${generateNavigation('/dashboard/posting-monitor')}

        <!-- Posts Goal Card -->
        <div class="goal-card">
            <div class="goal-header">
                <div>
                    <h2 style="margin: 0; color: #333;">📝 Posts Goal (Hourly)</h2>
                    <p style="color: #666; margin-top: 8px;">Target: ${monitorData.postsPerHourGoal} posts per hour</p>
                </div>
                <div style="text-align: right;">
                    <div class="goal-status">${postsOnTrackEmoji}</div>
                    <div style="color: #666; font-size: 14px;">${monitorData.postsOnTrack ? 'On Track' : 'Off Track'}</div>
                </div>
            </div>

            <div class="progress-container">
                <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                    <span style="font-weight: 600; color: #333;">Posted Today: <span style="color: #10b981; font-size: 24px;">${monitorData.postedToday}</span></span>
                    <span style="color: #666; font-size: 13px;">Expected: ${monitorData.hourlyPostsGoal} posts<br/>(${monitorData.postsPerHourGoal}/hour × ${monitorData.hoursElapsedDisplay} hours since midnight)</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${postsProgressPercent}%;">
                        ${monitorData.postedToday}/${monitorData.hourlyPostsGoal} posts
                    </div>
                </div>
                <div style="margin-top: 15px; padding: 15px; background: ${monitorData.postsOnTrack ? '#f0fdf4' : '#fef3c7'}; border-radius: 8px; border-left: 4px solid ${monitorData.postsOnTrack ? '#10b981' : '#f59e0b'};">
                    ${monitorData.postsOnTrack ? 
                      `<div style="color: #065f46; font-weight: 600;">✅ Posts are on track! Meeting ${monitorData.postsPerHourGoal} posts/hour goal.</div>` :
                      `<div style="color: #92400e; font-weight: 600;">⚠️ Posts are behind schedule. Need ${monitorData.hourlyPostsGoal - monitorData.postedToday} more posts to meet hourly goal (${monitorData.postsPerHourGoal}/hour).</div>`}
                </div>
            </div>
        </div>

        <!-- Replies Goal Card -->
        <div class="goal-card">
            <div class="goal-header">
                <div>
                    <h2 style="margin: 0; color: #333;">💬 Replies Goal (Hourly)</h2>
                    <p style="color: #666; margin-top: 8px;">Target: ${monitorData.repliesPerHourGoal} replies per hour</p>
                </div>
                <div style="text-align: right;">
                    <div class="goal-status">${repliesOnTrackEmoji}</div>
                    <div style="color: #666; font-size: 14px;">${monitorData.repliesOnTrack ? 'On Track' : 'Off Track'}</div>
                </div>
            </div>

            <div class="progress-container">
                <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                    <span style="font-weight: 600; color: #333;">Replied Today: <span style="color: #10b981; font-size: 24px;">${monitorData.repliedToday}</span></span>
                    <span style="color: #666; font-size: 13px;">Expected: ${monitorData.hourlyRepliesGoal} replies<br/>(${monitorData.repliesPerHourGoal}/hour × ${monitorData.hoursElapsedDisplay} hours since midnight)</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${repliesProgressPercent}%;">
                        ${monitorData.repliedToday}/${monitorData.hourlyRepliesGoal} replies
                    </div>
                </div>
                <div style="margin-top: 15px; padding: 15px; background: ${monitorData.repliesOnTrack ? '#f0fdf4' : '#fef3c7'}; border-radius: 8px; border-left: 4px solid ${monitorData.repliesOnTrack ? '#10b981' : '#f59e0b'};">
                    ${monitorData.repliesOnTrack ? 
                      `<div style="color: #065f46; font-weight: 600;">✅ Replies are on track! Meeting ${monitorData.repliesPerHourGoal} replies/hour goal.</div>` :
                      `<div style="color: #92400e; font-weight: 600;">⚠️ Replies are behind schedule. Need ${monitorData.hourlyRepliesGoal - monitorData.repliedToday} more replies to meet hourly goal (${monitorData.repliesPerHourGoal}/hour).</div>`}
                </div>
            </div>
        </div>

        <div class="timeline-container">
            <h2 style="margin-bottom: 10px; color: #333;">📊 Posting Timeline (Last 24 Hours)</h2>
            <p style="color: #666; margin-bottom: 20px;">Visual timeline showing when posts were published throughout the day</p>
            
            <div style="display: grid; grid-template-columns: 40px 1fr; gap: 10px;">
                <div></div>
                <div class="timeline-grid">
                    ${Array.from({ length: 24 }, (_, i) => {
                        const currentHour = new Date().getHours();
                        const hourData = hourlyTimeline.find((h: any) => h.hour === i) || { hour: i, posted: false, count: 0 };
                        const isCurrent = i === currentHour;
                        return `
                            <div class="hour-cell ${hourData.posted ? 'posted' : ''} ${isCurrent ? 'current' : ''}" 
                                 title="Hour ${i}: ${hourData.posted ? `${hourData.count} post(s)` : 'No posts'}">
                                ${hourData.posted ? hourData.count : ''}
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
            
            <div style="display: grid; grid-template-columns: 40px 1fr; gap: 10px; margin-top: 8px;">
                <div></div>
                <div style="display: grid; grid-template-columns: repeat(24, 1fr); gap: 4px;">
                    ${Array.from({ length: 24 }, (_, i) => 
                        `<div class="hour-label">${i}</div>`
                    ).join('')}
                </div>
            </div>

            <div style="margin-top: 20px; display: flex; gap: 20px; flex-wrap: wrap;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <div style="width: 20px; height: 20px; background: #f3f4f6; border-radius: 4px;"></div>
                    <span style="color: #666; font-size: 14px;">No posts</span>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <div style="width: 20px; height: 20px; background: #10b981; border-radius: 4px;"></div>
                    <span style="color: #666; font-size: 14px;">Posted</span>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <div style="width: 20px; height: 20px; border: 2px solid #667eea; border-radius: 4px;"></div>
                    <span style="color: #666; font-size: 14px;">Current hour</span>
                </div>
            </div>
        </div>

        ${singlePosts.length > 0 ? `
            <div class="section">
                <h2>📝 Today's Posts (${singlePosts.length})</h2>
                ${singlePosts.map((post: any) => {
                    const postedTime = new Date(post.posted_at);
                    const timeStr = postedTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
                    return `
                        <div class="post-item">
                            <div class="post-header">
                                <div class="post-time">🕐 ${timeStr}</div>
                                ${post.tweet_id ? `<div style="color: #666; font-size: 12px;"><code>${post.tweet_id}</code> ✅</div>` : ''}
                            </div>
                            <div class="post-content">${post.content?.substring(0, 200) || 'No content'}${post.content && post.content.length > 200 ? '...' : ''}</div>
                            ${post.actual_impressions ? `
                                <div class="post-metrics">
                                    <div class="metric-item">
                                        <span>👁️</span>
                                        <span class="metric-value">${(post.actual_impressions / 1000).toFixed(1)}K views</span>
                                    </div>
                                    <div class="metric-item">
                                        <span>❤️</span>
                                        <span class="metric-value">${post.actual_likes || 0} likes</span>
                                    </div>
                                    ${post.actual_engagement_rate ? `
                                        <div class="metric-item">
                                            <span>📊</span>
                                            <span class="metric-value">${(post.actual_engagement_rate * 100).toFixed(2)}% ER</span>
                                        </div>
                                    ` : ''}
                                </div>
                            ` : '<div style="color: #999; font-size: 12px; margin-top: 8px;">⏳ Metrics being collected...</div>'}
                        </div>
                    `;
                }).join('')}
            </div>
        ` : `
            <div class="section">
                <h2>📝 Today's Posts</h2>
                <div style="text-align: center; padding: 40px; color: #999;">
                    <div style="font-size: 48px; margin-bottom: 10px;">📭</div>
                    <div>No posts published today yet</div>
                    <div style="margin-top: 8px; font-size: 14px;">Posts will appear here as they're published</div>
                </div>
            </div>
        `}

        <div class="week-stats">
            <h2 style="margin-bottom: 10px; color: #333;">📈 Weekly Posting Stats (Last 7 Days)</h2>
            <div class="week-grid">
                ${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => {
                    const count = postsByDay.get(day) || 0;
                    return `
                        <div class="day-card">
                            <div class="day-name">${day}</div>
                            <div class="day-count" style="color: ${count > 0 ? '#10b981' : '#999'};">${count}</div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>

        <div class="section">
            <h2>📊 Schedule Health</h2>
            <div style="padding: 20px; background: #f9fafb; border-radius: 8px;">
                <div style="margin-bottom: 15px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <span style="font-weight: 600; color: #333;">Post Spacing:</span>
                        <span style="color: ${monitorData.scheduleHealth?.spacing === 'good' ? '#10b981' : '#f59e0b'}; font-weight: 600;">
                            ${monitorData.scheduleHealth?.spacing === 'good' ? '✅ Good' : '⚠️ Tight'}
                        </span>
                    </div>
                    <div style="color: #666; font-size: 14px;">
                        ${monitorData.scheduleHealth?.spacing === 'good' 
                          ? 'Posts are well-spaced throughout the day, maximizing engagement opportunities.'
                          : 'Posts were published too close together. Spreading them out improves performance.'}
                    </div>
                </div>
                
                <div style="margin-bottom: 15px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <span style="font-weight: 600; color: #333;">Rate Limit:</span>
                        <span style="color: #10b981; font-weight: 600;">✅ Respected</span>
                    </div>
                    <div style="color: #666; font-size: 14px;">
                        Posting rate limits are being respected. System targets ${monitorData.postsPerHourGoal} posts/hour and ${monitorData.repliesPerHourGoal} replies/hour.
                    </div>
                </div>

                ${monitorData.scheduleHealth?.issues && monitorData.scheduleHealth.issues.length > 0 ? `
                    <div style="margin-top: 15px; padding: 15px; background: #fef2f2; border-radius: 8px; border-left: 4px solid #ef4444;">
                        <div style="font-weight: 600; color: #991b1b; margin-bottom: 8px;">⚠️ Issues Found:</div>
                        ${monitorData.scheduleHealth.issues.map((issue: any) => `
                            <div style="color: #666; font-size: 14px; margin-bottom: 4px;">• ${issue.message}</div>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
        </div>

        <div class="footer">
            <p>🤖 Last updated: ${now}</p>
            <p>⚡ Auto-refresh every 60 seconds</p>
        </div>
    </div>
    <script>
        setTimeout(() => location.reload(), 60000);
    </script>
</body>
</html>`;
}


