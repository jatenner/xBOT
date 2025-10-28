/**
 * 📊 IMPROVED PERFORMANCE DASHBOARD
 * Shows generator performance, reply conversion, and actual metrics
 */

import { getSupabaseClient } from '../db/index';

export async function generateImprovedDashboard(): Promise<string> {
  const supabase = getSupabaseClient();
  
  try {
    // Get all metrics in parallel
    const [
      postStats,
      replyStats,
      generatorStats,
      recentPosts,
      replyConversions
    ] = await Promise.all([
      getPostStats(supabase),
      getReplyStats(supabase),
      getGeneratorPerformance(supabase),
      getRecentPosts(supabase),
      getReplyConversions(supabase)
    ]);

    return generateHTML({
      postStats,
      replyStats,
      generatorStats,
      recentPosts,
      replyConversions
    });

  } catch (error: any) {
    console.error('[DASHBOARD] Error:', error.message);
    return generateErrorHTML(error.message);
  }
}

async function getPostStats(supabase: any) {
  const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const last7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [total, last24, last7, withMetrics] = await Promise.all([
    supabase.from('content_metadata').select('id', { count: 'exact', head: true }).eq('decision_type', 'single'),
    supabase.from('content_metadata').select('id', { count: 'exact', head: true }).eq('decision_type', 'single').gte('posted_at', last24h),
    supabase.from('content_metadata').select('id', { count: 'exact', head: true }).eq('decision_type', 'single').gte('posted_at', last7d),
    supabase.from('content_metadata').select('actual_likes, actual_retweets, actual_engagement_rate').eq('decision_type', 'single').not('actual_likes', 'is', null)
  ]);

  const avgLikes = withMetrics.data?.length > 0 
    ? withMetrics.data.reduce((sum: number, p: any) => sum + (p.actual_likes || 0), 0) / withMetrics.data.length 
    : 0;

  const avgER = withMetrics.data?.length > 0
    ? withMetrics.data.reduce((sum: number, p: any) => sum + (p.actual_engagement_rate || 0), 0) / withMetrics.data.length
    : 0;

  return {
    total: total.count || 0,
    last24h: last24.count || 0,
    last7d: last7.count || 0,
    avgLikes: Math.round(avgLikes),
    avgER: (avgER * 100).toFixed(2)
  };
}

async function getReplyStats(supabase: any) {
  const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  
  const [total, last24, opportunities, conversions] = await Promise.all([
    supabase.from('content_metadata').select('id', { count: 'exact', head: true }).eq('decision_type', 'reply'),
    supabase.from('content_metadata').select('id', { count: 'exact', head: true }).eq('decision_type', 'reply').gte('posted_at', last24h),
    supabase.from('reply_opportunities').select('id, tier', { count: 'exact' }).eq('status', 'pending'),
    supabase.from('reply_conversions').select('followers_gained')
  ]);

  const totalFollowers = conversions.data?.reduce((sum: number, c: any) => sum + (c.followers_gained || 0), 0) || 0;

  // Count opportunities by tier
  const tierCounts = opportunities.data?.reduce((acc: any, opp: any) => {
    acc[opp.tier || 'unknown'] = (acc[opp.tier || 'unknown'] || 0) + 1;
    return acc;
  }, {}) || {};

  return {
    total: total.count || 0,
    last24h: last24.count || 0,
    opportunities: opportunities.count || 0,
    totalFollowersGained: totalFollowers,
    tierCounts
  };
}

async function getGeneratorPerformance(supabase: any) {
  const { data } = await supabase
    .from('content_metadata')
    .select('generator_name, actual_likes, actual_engagement_rate')
    .eq('decision_type', 'single')
    .not('actual_likes', 'is', null);

  if (!data || data.length === 0) {
    return [];
  }

  // Group by generator
  const byGenerator = data.reduce((acc: any, post: any) => {
    const gen = post.generator_name || 'unknown';
    if (!acc[gen]) {
      acc[gen] = { posts: 0, totalLikes: 0, totalER: 0 };
    }
    acc[gen].posts++;
    acc[gen].totalLikes += post.actual_likes || 0;
    acc[gen].totalER += post.actual_engagement_rate || 0;
    return acc;
  }, {});

  return Object.entries(byGenerator)
    .map(([name, stats]: [string, any]) => ({
      name,
      posts: stats.posts,
      avgLikes: Math.round(stats.totalLikes / stats.posts),
      avgER: ((stats.totalER / stats.posts) * 100).toFixed(2)
    }))
    .sort((a, b) => parseFloat(b.avgER) - parseFloat(a.avgER));
}

async function getRecentPosts(supabase: any) {
  const { data } = await supabase
    .from('content_metadata')
    .select('content, generator_name, actual_likes, actual_retweets, posted_at')
    .eq('decision_type', 'single')
    .not('posted_at', 'is', null)
    .order('posted_at', { ascending: false })
    .limit(10);

  return data || [];
}

async function getReplyConversions(supabase: any) {
  const { data } = await supabase
    .from('reply_conversions')
    .select('target_account, opportunity_tier, followers_gained, replied_at')
    .order('replied_at', { ascending: false })
    .limit(10);

  return data || [];
}

function generateHTML(data: any): string {
  const now = new Date().toLocaleString();
  
  return `<!DOCTYPE html>
<html>
<head>
    <title>xBOT Dashboard</title>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        .container { max-width: 1400px; margin: 0 auto; }
        .header {
            background: white;
            padding: 30px;
            border-radius: 15px;
            margin-bottom: 30px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        }
        .header h1 { color: #333; margin-bottom: 10px; }
        .header p { color: #666; }
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .stat-card {
            background: white;
            padding: 25px;
            border-radius: 15px;
            box-shadow: 0 5px 20px rgba(0,0,0,0.1);
        }
        .stat-label { color: #666; font-size: 14px; margin-bottom: 8px; }
        .stat-value { color: #333; font-size: 36px; font-weight: bold; }
        .stat-change { color: #28a745; font-size: 14px; margin-top: 8px; }
        .section {
            background: white;
            padding: 30px;
            border-radius: 15px;
            box-shadow: 0 5px 20px rgba(0,0,0,0.1);
            margin-bottom: 30px;
        }
        .section h2 { color: #333; margin-bottom: 20px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #eee; }
        th { background: #f8f9fa; font-weight: 600; color: #666; }
        .badge { 
            display: inline-block;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
        }
        .badge-platinum { background: #e3f2fd; color: #1976d2; }
        .badge-diamond { background: #f3e5f5; color: #7b1fa2; }
        .badge-golden { background: #fff3e0; color: #f57c00; }
        .refresh-btn {
            background: #667eea;
            color: white;
            padding: 12px 24px;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-size: 16px;
            font-weight: 600;
        }
        .refresh-btn:hover { background: #5568d3; }
        .footer { text-align: center; color: white; margin-top: 40px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 xBOT Performance Dashboard</h1>
            <p>Real-time analytics for your autonomous Twitter growth system</p>
            <button class="refresh-btn" onclick="location.reload()">🔄 Refresh Data</button>
        </div>

        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-label">Total Posts</div>
                <div class="stat-value">${data.postStats.total}</div>
                <div class="stat-change">📝 ${data.postStats.last24h} in last 24h</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Total Replies</div>
                <div class="stat-value">${data.replyStats.total}</div>
                <div class="stat-change">💬 ${data.replyStats.last24h} in last 24h</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Avg Engagement Rate</div>
                <div class="stat-value">${data.postStats.avgER}%</div>
                <div class="stat-change">❤️ ${data.postStats.avgLikes} avg likes</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Followers from Replies</div>
                <div class="stat-value">${data.replyStats.totalFollowersGained}</div>
                <div class="stat-change">📈 Conversion tracking active</div>
            </div>
        </div>

        <div class="section">
            <h2>🎭 Generator Performance</h2>
            <table>
                <thead>
                    <tr>
                        <th>Generator</th>
                        <th>Posts</th>
                        <th>Avg Likes</th>
                        <th>Avg ER</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.generatorStats.map((gen: any) => `
                        <tr>
                            <td><strong>${gen.name}</strong></td>
                            <td>${gen.posts}</td>
                            <td>${gen.avgLikes}</td>
                            <td><strong>${gen.avgER}%</strong></td>
                        </tr>
                    `).join('')}
                    ${data.generatorStats.length === 0 ? '<tr><td colspan="4" style="text-align: center; color: #999;">No performance data yet - keep posting!</td></tr>' : ''}
                </tbody>
            </table>
        </div>

        <div class="section">
            <h2>💎 Reply Opportunities</h2>
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-label">Platinum (10k+ likes)</div>
                    <div class="stat-value">${data.replyStats.tierCounts.Platinum || data.replyStats.tierCounts.golden || 0}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Diamond (5k+ likes)</div>
                    <div class="stat-value">${data.replyStats.tierCounts.Diamond || 0}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Golden (2k+ likes)</div>
                    <div class="stat-value">${data.replyStats.tierCounts.Golden || 0}</div>
                </div>
            </div>
        </div>

        <div class="section">
            <h2>📝 Recent Posts</h2>
            <table>
                <thead>
                    <tr>
                        <th>Content</th>
                        <th>Generator</th>
                        <th>Likes</th>
                        <th>RTs</th>
                        <th>Posted</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.recentPosts.map((post: any) => `
                        <tr>
                            <td>${post.content.substring(0, 80)}...</td>
                            <td>${post.generator_name || 'unknown'}</td>
                            <td>${post.actual_likes || '-'}</td>
                            <td>${post.actual_retweets || '-'}</td>
                            <td>${post.posted_at ? new Date(post.posted_at).toLocaleTimeString() : '-'}</td>
                        </tr>
                    `).join('')}
                    ${data.recentPosts.length === 0 ? '<tr><td colspan="5" style="text-align: center; color: #999;">No posts yet</td></tr>' : ''}
                </tbody>
            </table>
        </div>

        <div class="section">
            <h2>🎯 Recent Reply Conversions</h2>
            <table>
                <thead>
                    <tr>
                        <th>Target Account</th>
                        <th>Tier</th>
                        <th>Followers Gained</th>
                        <th>Time</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.replyConversions.map((conv: any) => `
                        <tr>
                            <td><strong>@${conv.target_account}</strong></td>
                            <td><span class="badge badge-${conv.opportunity_tier?.toLowerCase() || 'golden'}">${conv.opportunity_tier || 'Unknown'}</span></td>
                            <td>${conv.followers_gained || 0}</td>
                            <td>${new Date(conv.replied_at).toLocaleString()}</td>
                        </tr>
                    `).join('')}
                    ${data.replyConversions.length === 0 ? '<tr><td colspan="4" style="text-align: center; color: #999;">No conversions tracked yet</td></tr>' : ''}
                </tbody>
            </table>
        </div>

        <div class="footer">
            <p>🤖 Last updated: ${now}</p>
            <p>⚡ Real-time data from xBOT autonomous system</p>
        </div>
    </div>

    <script>
        // Auto-refresh every 60 seconds
        setTimeout(() => location.reload(), 60000);
    </script>
</body>
</html>`;
}

function generateErrorHTML(error: string): string {
  return `<!DOCTYPE html>
<html>
<head>
    <title>Dashboard Error</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            text-align: center;
            padding: 50px;
            background: #f5f5f5;
        }
        .error-box {
            background: white;
            padding: 40px;
            border-radius: 10px;
            max-width: 600px;
            margin: 0 auto;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
    </style>
</head>
<body>
    <div class="error-box">
        <h1>🚨 Dashboard Error</h1>
        <p>Unable to load dashboard data</p>
        <p style="color: #dc3545;">${error}</p>
        <p><a href="/dashboard">🔄 Try Again</a></p>
    </div>
</body>
</html>`;
}

export const improvedDashboard = { generateImprovedDashboard };

