/**
 * 📊 COMPREHENSIVE DASHBOARD - Multi-Page Analytics
 * Page 1: Posts breakdown (topic, tone, angle, generator, structure)
 * Page 2: Replies breakdown (tier, account, conversion)
 */

import { getSupabaseClient } from '../db/index';

export async function generateRecentDashboard(): Promise<string> {
  const supabase = getSupabaseClient();
  
  try {
    // Get recent posts sorted by date (not performance)
    const [
      recentPosts,
      last24hStats,
      generatorDistribution,
      topicDistribution
    ] = await Promise.all([
      getRecentPostsChronological(supabase),
      getLast24HourStats(supabase),
      getRecentGeneratorDistribution(supabase),
      getRecentTopicDistribution(supabase)
    ]);

    return generateRecentHTML({
      recentPosts,
      last24hStats,
      generatorDistribution,
      topicDistribution
    });

  } catch (error: any) {
    console.error('[RECENT_DASHBOARD] Error:', error.message);
    return generateErrorHTML(error.message);
  }
}

export async function generatePostsDashboard(): Promise<string> {
  const supabase = getSupabaseClient();
  
  try {
    // Get comprehensive post data
    const [
      topPosts,
      generatorBreakdown,
      topicBreakdown,
      toneBreakdown,
      angleBreakdown,
      last24h
    ] = await Promise.all([
      getTopPerformingPosts(supabase),
      getGeneratorBreakdown(supabase),
      getTopicBreakdown(supabase),
      getToneBreakdown(supabase),
      getAngleBreakdown(supabase),
      getLast24HourStats(supabase)
    ]);

    return generatePostsHTML({
      topPosts,
      generatorBreakdown,
      topicBreakdown,
      toneBreakdown,
      angleBreakdown,
      last24h
    });

  } catch (error: any) {
    console.error('[POSTS_DASHBOARD] Error:', error.message);
    return generateErrorHTML(error.message);
  }
}

export async function generateRepliesDashboard(): Promise<string> {
  const supabase = getSupabaseClient();
  
  try {
    // Get comprehensive reply data
    const [
      topReplies,
      tierBreakdown,
      accountBreakdown,
      generatorBreakdown,
      conversionStats
    ] = await Promise.all([
      getTopPerformingReplies(supabase),
      getReplyTierBreakdown(supabase),
      getAccountBreakdown(supabase),
      getReplyGeneratorBreakdown(supabase),
      getConversionStats(supabase)
    ]);

    return generateRepliesHTML({
      topReplies,
      tierBreakdown,
      accountBreakdown,
      generatorBreakdown,
      conversionStats
    });

  } catch (error: any) {
    console.error('[REPLIES_DASHBOARD] Error:', error.message);
    return generateErrorHTML(error.message);
  }
}

// ============================================================
// POSTS DATA FETCHERS
// ============================================================

async function getTopPerformingPosts(supabase: any) {
  const { data } = await supabase
    .from('content_metadata')
    .select('content, actual_likes, actual_retweets, actual_impressions, actual_engagement_rate, generator_name, raw_topic, topic_cluster, angle, tone, posted_at')
    .eq('status', 'posted')
    .eq('decision_type', 'single')
    .not('actual_likes', 'is', null)
    .order('actual_impressions', { ascending: false })
    .limit(500); // Show ALL posts with metrics (up to 500)

  return data || [];
}

async function getGeneratorBreakdown(supabase: any) {
  const { data } = await supabase
    .from('content_metadata')
    .select('generator_name, actual_likes, actual_impressions, actual_engagement_rate')
    .eq('status', 'posted')
    .eq('decision_type', 'single')
    .not('actual_likes', 'is', null);

  if (!data || data.length === 0) return [];

  const byGenerator = data.reduce((acc: any, post: any) => {
    const gen = post.generator_name || 'unknown';
    if (!acc[gen]) {
      acc[gen] = { posts: 0, totalLikes: 0, totalViews: 0, totalER: 0 };
    }
    acc[gen].posts++;
    acc[gen].totalLikes += post.actual_likes || 0;
    acc[gen].totalViews += post.actual_impressions || 0;
    acc[gen].totalER += post.actual_engagement_rate || 0;
    return acc;
  }, {});

  return Object.entries(byGenerator)
    .map(([name, stats]: [string, any]) => ({
      name,
      posts: stats.posts,
      avgLikes: Math.round(stats.totalLikes / stats.posts),
      avgViews: Math.round(stats.totalViews / stats.posts),
      avgER: ((stats.totalER / stats.posts) * 100).toFixed(2)
    }))
    .sort((a, b) => parseFloat(b.avgER) - parseFloat(a.avgER));
}

async function getTopicBreakdown(supabase: any) {
  const { data } = await supabase
    .from('content_metadata')
    .select('raw_topic, topic_cluster, actual_likes, actual_impressions, actual_engagement_rate')
    .eq('status', 'posted')
    .eq('decision_type', 'single')
    .not('actual_likes', 'is', null);

  if (!data || data.length === 0) return [];

  const byTopic = data.reduce((acc: any, post: any) => {
    // Use raw_topic if available, otherwise fall back to topic_cluster
    let topic = post.raw_topic || post.topic_cluster || 'Uncategorized';
    
    // Simplify super long topics (keep first 60 chars)
    if (topic.length > 60) {
      topic = topic.substring(0, 60) + '...';
    }
    
    if (!acc[topic]) {
      acc[topic] = { posts: 0, totalLikes: 0, totalViews: 0, totalER: 0 };
    }
    acc[topic].posts++;
    acc[topic].totalLikes += post.actual_likes || 0;
    acc[topic].totalViews += post.actual_impressions || 0;
    acc[topic].totalER += post.actual_engagement_rate || 0;
    return acc;
  }, {});

  return Object.entries(byTopic)
    .map(([name, stats]: [string, any]) => ({
      name,
      posts: stats.posts,
      avgLikes: Math.round(stats.totalLikes / stats.posts),
      avgViews: Math.round(stats.totalViews / stats.posts),
      avgER: ((stats.totalER / stats.posts) * 100).toFixed(2)
    }))
    .sort((a, b) => parseFloat(b.avgER) - parseFloat(a.avgER));
}

async function getToneBreakdown(supabase: any) {
  const { data } = await supabase
    .from('content_metadata')
    .select('tone, actual_likes, actual_impressions, actual_engagement_rate')
    .eq('status', 'posted')
    .eq('decision_type', 'single')
    .not('actual_likes', 'is', null)
    .not('tone', 'is', null);

  if (!data || data.length === 0) return [];

  const byTone = data.reduce((acc: any, post: any) => {
    const tone = post.tone || 'unknown';
    if (!acc[tone]) {
      acc[tone] = { posts: 0, totalLikes: 0, totalViews: 0, totalER: 0 };
    }
    acc[tone].posts++;
    acc[tone].totalLikes += post.actual_likes || 0;
    acc[tone].totalViews += post.actual_impressions || 0;
    acc[tone].totalER += post.actual_engagement_rate || 0;
    return acc;
  }, {});

  return Object.entries(byTone)
    .map(([name, stats]: [string, any]) => ({
      name,
      posts: stats.posts,
      avgLikes: Math.round(stats.totalLikes / stats.posts),
      avgViews: Math.round(stats.totalViews / stats.posts),
      avgER: ((stats.totalER / stats.posts) * 100).toFixed(2)
    }))
    .sort((a, b) => parseFloat(b.avgER) - parseFloat(a.avgER));
}

async function getAngleBreakdown(supabase: any) {
  const { data } = await supabase
    .from('content_metadata')
    .select('angle, actual_likes, actual_impressions, actual_engagement_rate')
    .eq('status', 'posted')
    .eq('decision_type', 'single')
    .not('actual_likes', 'is', null)
    .not('angle', 'is', null);

  if (!data || data.length === 0) return [];

  const byAngle = data.reduce((acc: any, post: any) => {
    const angle = post.angle || 'unknown';
    if (!acc[angle]) {
      acc[angle] = { posts: 0, totalLikes: 0, totalViews: 0, totalER: 0 };
    }
    acc[angle].posts++;
    acc[angle].totalLikes += post.actual_likes || 0;
    acc[angle].totalViews += post.actual_impressions || 0;
    acc[angle].totalER += post.actual_engagement_rate || 0;
    return acc;
  }, {});

  return Object.entries(byAngle)
    .map(([name, stats]: [string, any]) => ({
      name,
      posts: stats.posts,
      avgLikes: Math.round(stats.totalLikes / stats.posts),
      avgViews: Math.round(stats.totalViews / stats.posts),
      avgER: ((stats.totalER / stats.posts) * 100).toFixed(2)
    }))
    .sort((a, b) => parseFloat(b.avgER) - parseFloat(a.avgER));
}

async function getLast24HourStats(supabase: any) {
  const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  
  const { data } = await supabase
    .from('content_metadata')
    .select('actual_likes, actual_retweets, actual_impressions')
    .eq('status', 'posted')
    .eq('decision_type', 'single')
    .gte('posted_at', last24h);

  const totalLikes = data?.reduce((sum: number, p: any) => sum + (p.actual_likes || 0), 0) || 0;
  const totalViews = data?.reduce((sum: number, p: any) => sum + (p.actual_impressions || 0), 0) || 0;

  return {
    posts: data?.length || 0,
    likes: totalLikes,
    views: totalViews
  };
}

// ============================================================
// REPLIES DATA FETCHERS
// ============================================================

async function getTopPerformingReplies(supabase: any) {
  const { data } = await supabase
    .from('content_metadata')
    .select('content, actual_likes, actual_impressions, actual_engagement_rate, generator_name, target_username, posted_at')
    .eq('status', 'posted')
    .eq('decision_type', 'reply')
    .not('actual_likes', 'is', null)
    .order('actual_likes', { ascending: false })
    .limit(20);

  return data || [];
}

async function getReplyTierBreakdown(supabase: any) {
  const { data: opportunities } = await supabase
    .from('reply_opportunities')
    .select('tier, replied_to')
    .eq('replied_to', true);

  if (!opportunities || opportunities.length === 0) return [];

  const byTier = opportunities.reduce((acc: any, opp: any) => {
    const tier = opp.tier || 'unknown';
    acc[tier] = (acc[tier] || 0) + 1;
    return acc;
  }, {});

  return Object.entries(byTier).map(([tier, count]) => ({ tier, count }));
}

async function getAccountBreakdown(supabase: any) {
  const { data } = await supabase
    .from('reply_conversions')
    .select('target_account, followers_gained, opportunity_tier')
    .order('followers_gained', { ascending: false })
    .limit(20);

  return data || [];
}

async function getReplyGeneratorBreakdown(supabase: any) {
  const { data } = await supabase
    .from('content_metadata')
    .select('generator_name, actual_likes, actual_impressions')
    .eq('status', 'posted')
    .eq('decision_type', 'reply')
    .not('actual_likes', 'is', null);

  if (!data || data.length === 0) return [];

  const byGenerator = data.reduce((acc: any, reply: any) => {
    const gen = reply.generator_name || 'unknown';
    if (!acc[gen]) {
      acc[gen] = { replies: 0, totalLikes: 0, totalViews: 0 };
    }
    acc[gen].replies++;
    acc[gen].totalLikes += reply.actual_likes || 0;
    acc[gen].totalViews += reply.actual_impressions || 0;
    return acc;
  }, {});

  return Object.entries(byGenerator)
    .map(([name, stats]: [string, any]) => ({
      name,
      replies: stats.replies,
      avgLikes: Math.round(stats.totalLikes / stats.replies),
      avgViews: Math.round(stats.totalViews / stats.replies)
    }))
    .sort((a, b) => b.avgLikes - a.avgLikes);
}

async function getConversionStats(supabase: any) {
  const { data } = await supabase
    .from('reply_conversions')
    .select('followers_gained, opportunity_tier');

  if (!data || data.length === 0) {
    return { total: 0, byTier: [] };
  }

  const totalFollowers = data.reduce((sum: number, c: any) => sum + (c.followers_gained || 0), 0);
  
  const byTier = data.reduce((acc: any, c: any) => {
    const tier = c.opportunity_tier || 'unknown';
    if (!acc[tier]) acc[tier] = 0;
    acc[tier] += c.followers_gained || 0;
    return acc;
  }, {});

  return {
    total: totalFollowers,
    byTier: Object.entries(byTier).map(([tier, followers]) => ({ tier, followers }))
  };
}

// ============================================================
// HTML GENERATORS
// ============================================================

function generatePostsHTML(data: any): string {
  const now = new Date().toLocaleString();
  
  return `<!DOCTYPE html>
<html>
<head>
    <title>xBOT Posts Dashboard</title>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        ${getSharedStyles()}
        .nav-tabs { display: flex; gap: 10px; margin-bottom: 20px; }
        .nav-tab { 
            padding: 12px 24px; 
            background: white; 
            border-radius: 8px; 
            text-decoration: none; 
            color: #333;
            font-weight: 600;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .nav-tab.active { background: #667eea; color: white; }
        .nav-tab:hover { background: #5568d3; color: white; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📝 xBOT Posts Dashboard</h1>
            <p>Content performance breakdown by topic, tone, angle, and generator</p>
        </div>

        <div class="nav-tabs">
            <a href="/dashboard/recent?token=xbot-admin-2025" class="nav-tab">📅 Recent</a>
            <a href="/dashboard/posts?token=xbot-admin-2025" class="nav-tab active">📊 Metrics</a>
            <a href="/dashboard/replies?token=xbot-admin-2025" class="nav-tab">💬 Replies</a>
        </div>

        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-label">Last 24 Hours</div>
                <div class="stat-value">${data.last24h.posts} posts</div>
                <div class="stat-change">👁️ ${data.last24h.views.toLocaleString()} views • ❤️ ${data.last24h.likes} likes</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Posts with Metrics</div>
                <div class="stat-value">${data.topPosts.length}</div>
                <div class="stat-change">📊 All shown below</div>
            </div>
        </div>

        <div class="section">
            <h2>🏆 All Posts with Performance Data (${data.topPosts.length} posts)</h2>
            <div style="margin-bottom: 15px; display: flex; gap: 10px; flex-wrap: wrap; align-items: center;">
                <button class="sort-btn" onclick="sortTable('likes')">Sort by ❤️ Likes</button>
                <button class="sort-btn active" onclick="sortTable('views')">Sort by 👁️ Views</button>
                <button class="sort-btn" onclick="sortTable('viral')">Sort by 🔥 Viral Score</button>
                <button class="sort-btn" onclick="sortTable('er')">Sort by 📊 ER</button>
                <span style="color: #666; font-size: 14px; margin-left: 10px;">Showing entire database of posts with scraped metrics</span>
            </div>
            <table id="postsTable">
                <thead>
                    <tr>
                        <th style="width: 35%;">Content</th>
                        <th>Generator</th>
                        <th>Topic</th>
                        <th>📅 Posted</th>
                        <th class="number-col">👁️ Views</th>
                        <th class="number-col">❤️ Likes</th>
                        <th class="number-col">🔥 Viral</th>
                        <th class="number-col">📊 ER</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.topPosts.map((post: any) => {
                        const views = post.actual_impressions || 0;
                        const likes = post.actual_likes || 0;
                        const viralScore = views * likes;
                        const er = ((post.actual_engagement_rate || 0) * 100).toFixed(2);
                        
                        return `
                        <tr data-views="${views}" data-likes="${likes}" data-viral="${viralScore}" data-er="${er}">
                            <td class="content-cell">${post.content?.substring(0, 100) || 'No content'}...</td>
                            <td><span class="badge badge-gen">${post.generator_name || 'unknown'}</span></td>
                            <td><span class="topic-tag" title="${post.raw_topic || post.topic_cluster || 'N/A'}">${(post.raw_topic || post.topic_cluster || 'N/A').substring(0, 40)}${(post.raw_topic || post.topic_cluster || '').length > 40 ? '...' : ''}</span></td>
                            <td class="date-cell">${post.posted_at ? new Date(post.posted_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'N/A'}</td>
                            <td class="number-col"><strong>${views.toLocaleString()}</strong></td>
                            <td class="number-col"><strong style="color: #e91e63;">${likes}</strong></td>
                            <td class="number-col"><strong style="color: #ff5722;">${viralScore.toLocaleString()}</strong></td>
                            <td class="number-col"><strong>${er}%</strong></td>
                        </tr>
                    `}).join('')}
                </tbody>
            </table>
        </div>
        
        <script>
        function sortTable(sortBy) {
            const table = document.getElementById('postsTable');
            const tbody = table.querySelector('tbody');
            const rows = Array.from(tbody.querySelectorAll('tr'));
            
            // Update button states
            document.querySelectorAll('.sort-btn').forEach(btn => btn.classList.remove('active'));
            event.target.classList.add('active');
            
            rows.sort((a, b) => {
                const aVal = parseFloat(a.getAttribute('data-' + sortBy)) || 0;
                const bVal = parseFloat(b.getAttribute('data-' + sortBy)) || 0;
                return bVal - aVal; // Descending
            });
            
            rows.forEach(row => tbody.appendChild(row));
        }
        </script>

        <div class="section">
            <h2>🎭 Performance by Generator</h2>
            <p style="color: #666; margin-bottom: 15px; font-size: 14px;">Which AI generators create the best content</p>
            <table>
                <thead>
                    <tr>
                        <th>Generator</th>
                        <th class="number-col">Posts</th>
                        <th class="number-col">Avg Views</th>
                        <th class="number-col">Avg Likes</th>
                        <th class="number-col">Avg ER</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.generatorBreakdown.map((gen: any, index: number) => {
                        const rank = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '';
                        return `
                        <tr>
                            <td><strong>${rank} ${gen.name}</strong></td>
                            <td class="number-col">${gen.posts}</td>
                            <td class="number-col">${gen.avgViews.toLocaleString()}</td>
                            <td class="number-col" style="color: #e91e63;"><strong>${gen.avgLikes}</strong></td>
                            <td class="number-col"><strong>${gen.avgER}%</strong></td>
                        </tr>
                    `}).join('')}
                    ${data.generatorBreakdown.length === 0 ? '<tr><td colspan="5" style="text-align: center; color: #999; padding: 30px;">No data yet - posts need metrics to be scraped</td></tr>' : ''}
                </tbody>
            </table>
        </div>

        <div class="section">
            <h2>🎯 Performance by Topic</h2>
            <p style="color: #666; margin-bottom: 15px; font-size: 14px;">Which topics resonate most with your audience</p>
            <table>
                <thead>
                    <tr>
                        <th>Topic</th>
                        <th class="number-col">Posts</th>
                        <th class="number-col">Avg Views</th>
                        <th class="number-col">Avg Likes</th>
                        <th class="number-col">Avg ER</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.topicBreakdown.map((topic: any, index: number) => {
                        const rank = index === 0 ? '🏆' : index === 1 ? '⭐' : index === 2 ? '✨' : '';
                        return `
                        <tr>
                            <td><strong>${rank} ${topic.name}</strong></td>
                            <td class="number-col">${topic.posts}</td>
                            <td class="number-col">${topic.avgViews.toLocaleString()}</td>
                            <td class="number-col" style="color: #e91e63;"><strong>${topic.avgLikes}</strong></td>
                            <td class="number-col"><strong>${topic.avgER}%</strong></td>
                        </tr>
                    `}).join('')}
                    ${data.topicBreakdown.length === 0 ? '<tr><td colspan="5" style="text-align: center; color: #999; padding: 30px;">No data yet - posts need metrics to be scraped</td></tr>' : ''}
                </tbody>
            </table>
        </div>

        ${data.toneBreakdown.length > 0 ? `
        <div class="section">
            <h2>🎤 Performance by Tone</h2>
            <table>
                <thead>
                    <tr>
                        <th>Tone</th>
                        <th>Posts</th>
                        <th>Avg Views</th>
                        <th>Avg Likes</th>
                        <th>Avg ER</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.toneBreakdown.map((tone: any) => `
                        <tr>
                            <td><strong>${tone.name}</strong></td>
                            <td>${tone.posts}</td>
                            <td>${tone.avgViews.toLocaleString()}</td>
                            <td>${tone.avgLikes}</td>
                            <td><strong>${tone.avgER}%</strong></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        ` : ''}

        ${data.angleBreakdown.length > 0 ? `
        <div class="section">
            <h2>📐 Performance by Angle</h2>
            <table>
                <thead>
                    <tr>
                        <th>Angle</th>
                        <th>Posts</th>
                        <th>Avg Views</th>
                        <th>Avg Likes</th>
                        <th>Avg ER</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.angleBreakdown.map((angle: any) => `
                        <tr>
                            <td><strong>${angle.name}</strong></td>
                            <td>${angle.posts}</td>
                            <td>${angle.avgViews.toLocaleString()}</td>
                            <td>${angle.avgLikes}</td>
                            <td><strong>${angle.avgER}%</strong></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        ` : ''}

        <div class="footer">
            <p>🤖 Last updated: ${now}</p>
            <p>⚡ Real-time data from content_metadata table</p>
        </div>
    </div>
    <script>setTimeout(() => location.reload(), 120000);</script>
</body>
</html>`;
}

function generateRepliesHTML(data: any): string {
  const now = new Date().toLocaleString();
  
  return `<!DOCTYPE html>
<html>
<head>
    <title>xBOT Replies Dashboard</title>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        ${getSharedStyles()}
        .nav-tabs { display: flex; gap: 10px; margin-bottom: 20px; }
        .nav-tab { 
            padding: 12px 24px; 
            background: white; 
            border-radius: 8px; 
            text-decoration: none; 
            color: #333;
            font-weight: 600;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .nav-tab.active { background: #667eea; color: white; }
        .nav-tab:hover { background: #5568d3; color: white; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>💬 xBOT Replies Dashboard</h1>
            <p>Reply performance and follower conversion breakdown</p>
        </div>

        <div class="nav-tabs">
            <a href="/dashboard/recent?token=xbot-admin-2025" class="nav-tab">📅 Recent</a>
            <a href="/dashboard/posts?token=xbot-admin-2025" class="nav-tab">📊 Metrics</a>
            <a href="/dashboard/replies?token=xbot-admin-2025" class="nav-tab active">💬 Replies</a>
        </div>

        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-label">Total Followers from Replies</div>
                <div class="stat-value">${data.conversionStats.total}</div>
                <div class="stat-change">📈 Conversion tracking</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Platinum Tier</div>
                <div class="stat-value">${data.tierBreakdown.find((t: any) => t.tier === 'Platinum' || t.tier === 'golden')?.count || 0}</div>
                <div class="stat-change">💎 10k+ likes</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Diamond Tier</div>
                <div class="stat-value">${data.tierBreakdown.find((t: any) => t.tier === 'Diamond')?.count || 0}</div>
                <div class="stat-change">💎 5k+ likes</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Golden Tier</div>
                <div class="stat-value">${data.tierBreakdown.find((t: any) => t.tier === 'Golden')?.count || 0}</div>
                <div class="stat-change">💎 2k+ likes</div>
            </div>
        </div>

        <div class="section">
            <h2>🏆 Top Performing Replies (by likes)</h2>
            <div style="background: #d1ecf1; border-left: 4px solid #0c5460; padding: 15px; margin-bottom: 20px; border-radius: 8px;">
                <strong>ℹ️ Note:</strong> Reply metrics are scraped after posting. New replies appear here once metrics are collected (10-60 min delay). 
                Old replies with incorrect IDs have been cleaned - only valid data shown.
            </div>
            <table>
                <thead>
                    <tr>
                        <th>Content</th>
                        <th>To @</th>
                        <th>Generator</th>
                        <th>📅 Posted</th>
                        <th>👁️ Views</th>
                        <th>❤️ Likes</th>
                        <th>📊 ER</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.topReplies.slice(0, 10).map((reply: any) => `
                        <tr>
                            <td style="max-width: 300px;">${reply.content?.substring(0, 80) || 'No content'}...</td>
                            <td><strong>@${reply.target_username || 'unknown'}</strong></td>
                            <td><span class="badge">${reply.generator_name || 'unknown'}</span></td>
                            <td>${reply.posted_at ? new Date(reply.posted_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'N/A'}</td>
                            <td><strong>${(reply.actual_impressions || 0).toLocaleString()}</strong></td>
                            <td><strong>${reply.actual_likes || 0}</strong></td>
                            <td><strong>${((reply.actual_engagement_rate || 0) * 100).toFixed(2)}%</strong></td>
                        </tr>
                    `).join('')}
                    ${data.topReplies.length === 0 ? '<tr><td colspan="7" style="text-align: center; color: #999;">No reply metrics yet</td></tr>' : ''}
                </tbody>
            </table>
        </div>

        <div class="section">
            <h2>🎭 Performance by Generator</h2>
            <table>
                <thead>
                    <tr>
                        <th>Generator</th>
                        <th>Replies</th>
                        <th>Avg Views</th>
                        <th>Avg Likes</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.generatorBreakdown.map((gen: any) => `
                        <tr>
                            <td><strong>${gen.name}</strong></td>
                            <td>${gen.replies}</td>
                            <td>${gen.avgViews.toLocaleString()}</td>
                            <td>${gen.avgLikes}</td>
                        </tr>
                    `).join('')}
                    ${data.generatorBreakdown.length === 0 ? '<tr><td colspan="4" style="text-align: center; color: #999;">No data yet</td></tr>' : ''}
                </tbody>
            </table>
        </div>

        <div class="section">
            <h2>🎯 Top Converting Accounts</h2>
            <table>
                <thead>
                    <tr>
                        <th>Account</th>
                        <th>Tier</th>
                        <th>Followers Gained</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.accountBreakdown.slice(0, 15).map((acc: any) => `
                        <tr>
                            <td><strong>@${acc.target_account}</strong></td>
                            <td><span class="badge badge-${acc.opportunity_tier?.toLowerCase() || 'golden'}">${acc.opportunity_tier || 'Unknown'}</span></td>
                            <td><strong>${acc.followers_gained || 0}</strong></td>
                        </tr>
                    `).join('')}
                    ${data.accountBreakdown.length === 0 ? '<tr><td colspan="3" style="text-align: center; color: #999;">No conversions yet</td></tr>' : ''}
                </tbody>
            </table>
        </div>

        <div class="footer">
            <p>🤖 Last updated: ${now}</p>
            <p>⚡ Real-time data from reply_conversions & content_metadata</p>
        </div>
    </div>
    <script>setTimeout(() => location.reload(), 120000);</script>
</body>
</html>`;
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
    .stats-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
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
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 14px 12px; text-align: left; border-bottom: 1px solid #f0f0f0; }
    th { 
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        font-weight: 600;
        color: white;
        font-size: 13px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }
    td { font-size: 14px; }
    tr:hover { background: #f8f9fa; }
    .number-col { text-align: right; font-variant-numeric: tabular-nums; }
    .content-cell { line-height: 1.5; color: #333; }
    .date-cell { color: #666; font-size: 13px; white-space: nowrap; }
    .topic-tag { 
        display: inline-block;
        padding: 4px 10px;
        background: #f0f0f0;
        border-radius: 12px;
        font-size: 12px;
        color: #666;
    }
    .badge { 
        display: inline-block;
        padding: 5px 12px;
        border-radius: 20px;
        font-size: 12px;
        font-weight: 600;
        background: #e3f2fd;
        color: #1976d2;
    }
    .badge-gen { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }
    .badge-platinum { background: #e3f2fd; color: #1976d2; }
    .badge-diamond { background: #f3e5f5; color: #7b1fa2; }
    .badge-golden { background: #fff3e0; color: #f57c00; }
    .sort-btn {
        padding: 10px 20px;
        background: white;
        border: 2px solid #e0e0e0;
        border-radius: 8px;
        cursor: pointer;
        font-weight: 600;
        font-size: 14px;
        color: #666;
        transition: all 0.2s;
    }
    .sort-btn:hover {
        background: #f8f9fa;
        border-color: #667eea;
        color: #667eea;
    }
    .sort-btn.active {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border-color: #667eea;
        color: white;
    }
    .post-card {
        background: white;
        border: 2px solid #e0e0e0;
        border-radius: 16px;
        margin-bottom: 20px;
        padding: 24px;
        cursor: pointer;
        transition: all 0.3s ease;
        box-shadow: 0 2px 8px rgba(0,0,0,0.05);
    }
    .post-card:hover {
        border-color: #667eea;
        box-shadow: 0 8px 30px rgba(102, 126, 234, 0.25);
        transform: translateY(-4px);
    }
    .post-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 20px;
    }
    .post-preview {
        color: #333;
        font-size: 15px;
        line-height: 1.6;
        margin-top: 8px;
    }
    .post-stats {
        display: flex;
        gap: 25px;
        min-width: 150px;
    }
    .post-details {
        display: none;
        margin-top: 20px;
        padding-top: 20px;
        border-top: 2px solid #f0f0f0;
        animation: slideDown 0.3s ease;
    }
    .post-card.expanded .post-details {
        display: block;
    }
    .post-card.expanded {
        border-color: #667eea;
        background: #f8f9ff;
    }
    .metadata-box {
        background: white;
        padding: 12px;
        border-radius: 8px;
        border: 1px solid #e0e0e0;
    }
    .metadata-box strong {
        display: block;
        margin-bottom: 6px;
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }
    .metadata-box div {
        color: #333;
        font-size: 14px;
        line-height: 1.5;
    }
    @keyframes slideDown {
        from { opacity: 0; transform: translateY(-10px); }
        to { opacity: 1; transform: translateY(0); }
    }
    .footer { text-align: center; color: white; margin-top: 40px; opacity: 0.9; }
  `;
}

function getToken(): string {
  return typeof window !== 'undefined' ? (new URLSearchParams(window.location.search).get('token') || '') : '';
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
        <p><a href="/dashboard?token=xbot-admin-2025">🔄 Try Again</a></p>
    </div>
</body>
</html>`;
}

// ============================================================
// RECENT POSTS DATA FETCHERS (chronological, not performance)
// ============================================================

async function getRecentPostsChronological(supabase: any) {
  const { data } = await supabase
    .from('content_metadata')
    .select('content, actual_likes, actual_retweets, actual_impressions, actual_engagement_rate, generator_name, raw_topic, topic_cluster, angle, tone, format_strategy, posted_at, created_at, status')
    .eq('decision_type', 'single')
    .order('created_at', { ascending: false })
    .limit(100); // Last 100 posts (recent activity)

  return data || [];
}

async function getRecentGeneratorDistribution(supabase: any) {
  const last7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  
  const { data } = await supabase
    .from('content_metadata')
    .select('generator_name')
    .eq('decision_type', 'single')
    .gte('created_at', last7d);

  if (!data || data.length === 0) return [];

  const counts = data.reduce((acc: any, post: any) => {
    const gen = post.generator_name || 'unknown';
    acc[gen] = (acc[gen] || 0) + 1;
    return acc;
  }, {});

  return Object.entries(counts)
    .map(([name, count]) => ({ name, count }))
    .sort((a: any, b: any) => b.count - a.count);
}

async function getRecentTopicDistribution(supabase: any) {
  const last7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  
  const { data } = await supabase
    .from('content_metadata')
    .select('raw_topic, topic_cluster')
    .eq('decision_type', 'single')
    .gte('created_at', last7d);

  if (!data || data.length === 0) return [];

  const counts = data.reduce((acc: any, post: any) => {
    let topic = post.raw_topic || post.topic_cluster || 'Uncategorized';
    if (topic.length > 50) topic = topic.substring(0, 50) + '...';
    acc[topic] = (acc[topic] || 0) + 1;
    return acc;
  }, {});

  return Object.entries(counts)
    .map(([name, count]) => ({ name, count }))
    .sort((a: any, b: any) => b.count - a.count)
    .slice(0, 15); // Top 15 topics
}

function generateRecentHTML(data: any): string {
  const now = new Date().toLocaleString();
  
  return `<!DOCTYPE html>
<html>
<head>
    <title>xBOT Recent Posts</title>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        ${getSharedStyles()}
        .nav-tabs { display: flex; gap: 10px; margin-bottom: 20px; }
        .nav-tab { 
            padding: 12px 24px; 
            background: white; 
            border-radius: 8px; 
            text-decoration: none; 
            color: #333;
            font-weight: 600;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .nav-tab.active { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }
        .nav-tab:hover { background: #5568d3; color: white; }
        .status-posted { color: #28a745; font-weight: 600; }
        .status-queued { color: #ffc107; font-weight: 600; }
        .metadata-tag { 
            display: inline-block;
            padding: 3px 8px;
            background: #f0f0f0;
            border-radius: 10px;
            font-size: 11px;
            color: #666;
            margin: 2px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📅 xBOT Recent Activity</h1>
            <p>Latest posts with complete metadata - sorted by date</p>
        </div>

        <div class="nav-tabs">
            <a href="/dashboard/recent?token=xbot-admin-2025" class="nav-tab active">📅 Recent</a>
            <a href="/dashboard/posts?token=xbot-admin-2025" class="nav-tab">📊 Metrics</a>
            <a href="/dashboard/replies?token=xbot-admin-2025" class="nav-tab">💬 Replies</a>
        </div>

        <div class="stats-grid" style="margin-bottom: 30px;">
            <div class="stat-card">
                <div class="stat-label">Last 24 Hours</div>
                <div class="stat-value">${data.last24hStats.posts} posts</div>
                <div class="stat-change">👁️ ${data.last24hStats.views.toLocaleString()} views • ❤️ ${data.last24hStats.likes} likes</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Total Showing</div>
                <div class="stat-value">${data.recentPosts.length}</div>
                <div class="stat-change">📝 Recent posts (click to expand)</div>
            </div>
        </div>

        <div style="background: transparent; padding: 0;">
            <div style="text-align: center; margin-bottom: 30px;">
                <h2 style="color: white; font-size: 28px; margin-bottom: 10px;">📝 Recent Posts</h2>
                <p style="color: rgba(255,255,255,0.9); font-size: 16px;">Click any card to expand and see full content, topic, angle, tone & structure</p>
            </div>
            
            ${data.recentPosts.map((post: any, idx: number) => {
                const views = post.actual_impressions || 0;
                const likes = post.actual_likes || 0;
                const statusStyle = post.status === 'posted' 
                    ? 'background: #28a745; color: white;' 
                    : post.status === 'failed'
                    ? 'background: #dc3545; color: white;'
                    : 'background: #ffc107; color: #333;';
                const structure = post.format_strategy || 'N/A';
                const topic = post.raw_topic || post.topic_cluster || 'N/A';
                
                return `
                <div class="post-card" onclick="document.getElementById('post-${idx}').classList.toggle('expanded')" id="post-${idx}">
                    <div class="post-header">
                        <div style="flex: 1;">
                            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                                <span class="badge badge-gen">${post.generator_name || 'unknown'}</span>
                                <span style="padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; ${statusStyle}">${post.status.toUpperCase()}</span>
                                <span style="color: #999; font-size: 13px;">${post.posted_at ? new Date(post.posted_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : (post.created_at ? new Date(post.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'N/A')}</span>
                            </div>
                            <div class="post-preview">${post.content?.substring(0, 120) || 'No content'}${post.content?.length > 120 ? '...' : ''}</div>
                        </div>
                        <div class="post-stats">
                            <div style="text-align: center;">
                                <div style="font-size: 20px; font-weight: bold; color: #667eea;">${views > 0 ? views.toLocaleString() : '–'}</div>
                                <div style="font-size: 11px; color: #999;">👁️ Views</div>
                            </div>
                            <div style="text-align: center;">
                                <div style="font-size: 20px; font-weight: bold; color: #e91e63;">${likes > 0 ? likes : '–'}</div>
                                <div style="font-size: 11px; color: #999;">❤️ Likes</div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="post-details">
                        <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                            <strong style="color: #667eea; display: block; margin-bottom: 8px;">📄 FULL CONTENT:</strong>
                            <div style="line-height: 1.6; white-space: pre-wrap;">${post.content || 'No content available'}</div>
                        </div>
                        
                        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px;">
                            <div class="metadata-box">
                                <strong style="color: #667eea;">🎯 Topic:</strong>
                                <div>${topic}</div>
                            </div>
                            <div class="metadata-box">
                                <strong style="color: #e91e63;">🎨 Structure:</strong>
                                <div>${structure}</div>
                            </div>
                            <div class="metadata-box">
                                <strong style="color: #28a745;">🎭 Tone:</strong>
                                <div>${post.tone || 'N/A'}</div>
                            </div>
                            <div class="metadata-box">
                                <strong style="color: #ffc107;">📐 Angle:</strong>
                                <div>${post.angle || 'N/A'}</div>
                            </div>
                        </div>
                        
                        ${post.posted_at ? `
                        <div style="margin-top: 15px; padding: 10px; background: #e8f5e9; border-radius: 6px; font-size: 13px;">
                            ✅ <strong>Posted:</strong> ${new Date(post.posted_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                        </div>
                        ` : ''}
                    </div>
                </div>
                `;
            }).join('')}
        </div>

        <div class="footer">
            <p>🤖 Last updated: ${now}</p>
            <p>⚡ Real-time activity feed from content_metadata (all posts)</p>
        </div>
    </div>
    <script>setTimeout(() => location.reload(), 120000);</script>
</body>
</html>`;
}

export const comprehensiveDashboard = { 
  generatePostsDashboard, 
  generateRepliesDashboard,
  generateRecentDashboard
};

