/**
 * 🔍 VISUAL INTELLIGENCE DASHBOARD
 * 
 * Shows comprehensive data about scraped tweets from other accounts:
 * - Collection stats
 * - Top performing tweets
 * - Breakdown by tier, topic, angle, tone
 * - Pattern intelligence
 * - Collection rate and trends
 */

import { getSupabaseClient } from '../db/index';

export async function generateVIDashboard(): Promise<string> {
  const supabase = getSupabaseClient();
  
  try {
    const [
      collectionStats,
      topTweets,
      tierBreakdown,
      topicBreakdown,
      recentActivity,
      patternStats,
      accountStats
    ] = await Promise.all([
      getCollectionStats(supabase),
      getTopPerformingTweets(supabase),
      getTierBreakdown(supabase),
      getTopicBreakdown(supabase),
      getRecentActivity(supabase),
      getPatternStats(supabase),
      getAccountStats(supabase)
    ]);

    return generateVIHTML({
      collectionStats,
      topTweets,
      tierBreakdown,
      topicBreakdown,
      recentActivity,
      patternStats,
      accountStats
    });

  } catch (error: any) {
    console.error('[VI_DASHBOARD] Error:', error.message);
    return generateErrorHTML(error.message);
  }
}

// ============================================================
// DATA FETCHERS
// ============================================================

async function getCollectionStats(supabase: any) {
  const { count: total, error: totalError } = await supabase
    .from('vi_collected_tweets')
    .select('*', { count: 'exact', head: true });

  const { count: withViews, error: viewsError } = await supabase
    .from('vi_collected_tweets')
    .select('*', { count: 'exact', head: true })
    .gt('views', 0);

  const { count: classified, error: classError } = await supabase
    .from('vi_collected_tweets')
    .select('*', { count: 'exact', head: true })
    .eq('classified', true);

  const { count: analyzed, error: analyzedError } = await supabase
    .from('vi_collected_tweets')
    .select('*', { count: 'exact', head: true })
    .eq('analyzed', true);

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { count: recent, error: recentError } = await supabase
    .from('vi_collected_tweets')
    .select('*', { count: 'exact', head: true })
    .gte('scraped_at', sevenDaysAgo);

  const { data: accounts, error: accountsError } = await supabase
    .from('vi_scrape_targets')
    .select('username, is_active')
    .eq('is_active', true);

  return {
    total: total || 0,
    withViews: withViews || 0,
    classified: classified || 0,
    analyzed: analyzed || 0,
    recent7d: recent || 0,
    activeAccounts: (accounts || []).length,
    viewsPercent: total ? Math.round((withViews / total) * 100) : 0,
    classifiedPercent: total ? Math.round((classified / total) * 100) : 0,
    analyzedPercent: total ? Math.round((analyzed / total) * 100) : 0
  };
}

async function getTopPerformingTweets(supabase: any) {
  const { data, error } = await supabase
    .from('vi_collected_tweets')
    .select('tweet_id, content, author_username, views, likes, retweets, replies, engagement_rate, viral_multiplier, tier, posted_at')
    .gt('views', 0)
    .order('engagement_rate', { ascending: false })
    .limit(20);

  if (error) throw error;
  return (data || []).map((t: any) => ({
    ...t,
    content: (t.content || '').substring(0, 150)
  }));
}

async function getTierBreakdown(supabase: any) {
  const { data, error } = await supabase
    .from('vi_collected_tweets')
    .select('tier, views, likes, engagement_rate')
    .gt('views', 0);

  if (error) throw error;

  const byTier: Record<string, { count: number; avgViews: number; avgLikes: number; avgER: number }> = {};
  
  (data || []).forEach((t: any) => {
    const tier = t.tier || 'unknown';
    if (!byTier[tier]) {
      byTier[tier] = { count: 0, avgViews: 0, avgLikes: 0, avgER: 0 };
    }
    byTier[tier].count++;
    byTier[tier].avgViews += t.views || 0;
    byTier[tier].avgLikes += t.likes || 0;
    byTier[tier].avgER += t.engagement_rate || 0;
  });

  return Object.entries(byTier).map(([tier, stats]) => ({
    tier,
    count: stats.count,
    avgViews: Math.round(stats.avgViews / stats.count),
    avgLikes: Math.round(stats.avgLikes / stats.count),
    avgER: (stats.avgER / stats.count) * 100
  })).sort((a, b) => b.count - a.count);
}

async function getTopicBreakdown(supabase: any) {
  const { data, error } = await supabase
    .from('vi_content_classification')
    .select(`
      topic,
      vi_collected_tweets!inner(views, likes, engagement_rate)
    `)
    .gte('topic_confidence', 0.6)
    .gt('vi_collected_tweets.views', 0)
    .limit(1000);

  if (error) throw error;

  const byTopic: Record<string, { count: number; avgViews: number; avgLikes: number; avgER: number }> = {};
  
  (data || []).forEach((c: any) => {
    const tweet = c.vi_collected_tweets;
    if (!tweet) return;
    
    const topic = c.topic || 'unknown';
    if (!byTopic[topic]) {
      byTopic[topic] = { count: 0, avgViews: 0, avgLikes: 0, avgER: 0 };
    }
    byTopic[topic].count++;
    byTopic[topic].avgViews += tweet.views || 0;
    byTopic[topic].avgLikes += tweet.likes || 0;
    byTopic[topic].avgER += tweet.engagement_rate || 0;
  });

  return Object.entries(byTopic).map(([topic, stats]) => ({
    topic,
    count: stats.count,
    avgViews: Math.round(stats.avgViews / stats.count),
    avgLikes: Math.round(stats.avgLikes / stats.count),
    avgER: (stats.avgER / stats.count) * 100
  })).sort((a, b) => b.count - a.count).slice(0, 15);
}

async function getRecentActivity(supabase: any) {
  const { data, error } = await supabase
    .from('vi_collected_tweets')
    .select('scraped_at, author_username')
    .order('scraped_at', { ascending: false })
    .limit(100);

  if (error) throw error;

  // Group by day
  const byDay = new Map<string, number>();
  (data || []).forEach((t: any) => {
    const day = new Date(t.scraped_at).toISOString().split('T')[0];
    byDay.set(day, (byDay.get(day) || 0) + 1);
  });

  return Array.from(byDay.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 7)
    .map(([day, count]) => ({ day, count }));
}

async function getPatternStats(supabase: any) {
  const { count, error } = await supabase
    .from('vi_format_intelligence')
    .select('*', { count: 'exact', head: true });

  if (error) throw error;

  const { data: patterns, error: patternsError } = await supabase
    .from('vi_format_intelligence')
    .select('confidence_level, based_on_count')
    .limit(100);

  if (patternsError) throw error;

  const highConf = (patterns || []).filter((p: any) => p.confidence_level === 'high').length;
  const mediumConf = (patterns || []).filter((p: any) => p.confidence_level === 'medium').length;
  const avgSamples = patterns && patterns.length > 0
    ? Math.round((patterns as any[]).reduce((sum, p) => sum + (p.based_on_count || 0), 0) / patterns.length)
    : 0;

  return {
    total: count || 0,
    highConfidence: highConf,
    mediumConfidence: mediumConf,
    avgSamplesPerPattern: avgSamples
  };
}

async function getAccountStats(supabase: any) {
  const { data: targets, error } = await supabase
    .from('vi_scrape_targets')
    .select('username, is_active, tier, last_scraped_at, scrape_success_count')
    .eq('is_active', true);

  if (error) throw error;

  const byTier: Record<string, number> = {};
  (targets || []).forEach((t: any) => {
    const tier = t.tier || 'unknown';
    byTier[tier] = (byTier[tier] || 0) + 1;
  });

  const recentlyScraped = (targets || []).filter((t: any) => {
    if (!t.last_scraped_at) return false;
    const hoursAgo = (Date.now() - new Date(t.last_scraped_at).getTime()) / (1000 * 60 * 60);
    return hoursAgo < 12;
  }).length;

  return {
    total: (targets || []).length,
    byTier: Object.entries(byTier).map(([tier, count]) => ({ tier, count })),
    recentlyScraped,
    scrapeSuccessRate: targets && targets.length > 0
      ? Math.round((recentlyScraped / targets.length) * 100)
      : 0
  };
}

// ============================================================
// HTML GENERATOR
// ============================================================

function generateVIHTML(data: any): string {
  const { collectionStats, topTweets, tierBreakdown, topicBreakdown, recentActivity, patternStats, accountStats } = data;
  
  return `<!DOCTYPE html>
<html>
<head>
    <title>xBOT Visual Intelligence Dashboard</title>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 20px;
            color: #333;
        }
        .container {
            max-width: 1400px;
            margin: 0 auto;
            background: white;
            border-radius: 12px;
            padding: 30px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }
        .header {
            margin-bottom: 30px;
            border-bottom: 3px solid #667eea;
            padding-bottom: 20px;
        }
        .header h1 {
            color: #667eea;
            font-size: 2.5em;
            margin-bottom: 10px;
        }
        .nav-tabs {
            display: flex;
            gap: 10px;
            margin-bottom: 30px;
            flex-wrap: wrap;
        }
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
        .nav-tab.active {
            background: #667eea;
            color: white;
        }
        .nav-tab:hover {
            background: #5568d3;
            color: white;
        }
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .stat-card {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            border-radius: 10px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.2);
        }
        .stat-label {
            font-size: 0.9em;
            opacity: 0.9;
            margin-bottom: 8px;
        }
        .stat-value {
            font-size: 2em;
            font-weight: bold;
        }
        .section {
            margin-bottom: 40px;
        }
        .section-title {
            font-size: 1.5em;
            color: #667eea;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 2px solid #eee;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            background: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        th {
            background: #667eea;
            color: white;
            padding: 15px;
            text-align: left;
            font-weight: 600;
        }
        td {
            padding: 12px 15px;
            border-bottom: 1px solid #eee;
        }
        tr:hover {
            background: #f5f7fa;
        }
        .tweet-preview {
            max-width: 400px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .badge {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 0.85em;
            font-weight: 600;
        }
        .badge-high { background: #10b981; color: white; }
        .badge-medium { background: #f59e0b; color: white; }
        .badge-low { background: #ef4444; color: white; }
        .badge-established { background: #6366f1; color: white; }
        .badge-growth { background: #8b5cf6; color: white; }
        .badge-micro { background: #ec4899; color: white; }
        .progress-bar {
            width: 100%;
            height: 20px;
            background: #e5e7eb;
            border-radius: 10px;
            overflow: hidden;
            margin-top: 5px;
        }
        .progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #667eea, #764ba2);
            transition: width 0.3s;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔍 Visual Intelligence Dashboard</h1>
            <p>Comprehensive analytics for scraped tweets from health/longevity accounts</p>
        </div>

        <div class="nav-tabs">
            <a href="/dashboard/recent?token=xbot-admin-2025" class="nav-tab">📅 Recent</a>
            <a href="/dashboard/posts?token=xbot-admin-2025" class="nav-tab">📊 Metrics</a>
            <a href="/dashboard/replies?token=xbot-admin-2025" class="nav-tab">💬 Replies</a>
            <a href="/dashboard/vi?token=xbot-admin-2025" class="nav-tab active">🔍 VI Collection</a>
            <a href="/dashboard/health?token=xbot-admin-2025" class="nav-tab">🔧 Health</a>
        </div>

        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-label">Total Tweets Collected</div>
                <div class="stat-value">${collectionStats.total.toLocaleString()}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">With Real Views</div>
                <div class="stat-value">${collectionStats.withViews.toLocaleString()}</div>
                <div style="margin-top: 5px; font-size: 0.9em;">${collectionStats.viewsPercent}% complete</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">AI Classified</div>
                <div class="stat-value">${collectionStats.classified.toLocaleString()}</div>
                <div style="margin-top: 5px; font-size: 0.9em;">${collectionStats.classifiedPercent}% complete</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Pattern Analyzed</div>
                <div class="stat-value">${collectionStats.analyzed.toLocaleString()}</div>
                <div style="margin-top: 5px; font-size: 0.9em;">${collectionStats.analyzedPercent}% complete</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Last 7 Days</div>
                <div class="stat-value">${collectionStats.recent7d.toLocaleString()}</div>
                <div style="margin-top: 5px; font-size: 0.9em;">~${Math.round(collectionStats.recent7d / 7)}/day</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Active Accounts</div>
                <div class="stat-value">${collectionStats.activeAccounts}</div>
            </div>
        </div>

        <div class="section">
            <h2 class="section-title">📊 Account Statistics</h2>
            <div class="stats-grid" style="grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));">
                ${accountStats.byTier.map((t: any) => `
                    <div class="stat-card">
                        <div class="stat-label">${t.tier} Accounts</div>
                        <div class="stat-value">${t.count}</div>
                    </div>
                `).join('')}
                <div class="stat-card">
                    <div class="stat-label">Recently Scraped</div>
                    <div class="stat-value">${accountStats.recentlyScraped}</div>
                    <div style="margin-top: 5px; font-size: 0.9em;">${accountStats.scrapeSuccessRate}% success</div>
                </div>
            </div>
        </div>

        <div class="section">
            <h2 class="section-title">🔥 Top Performing Tweets (by Engagement Rate)</h2>
            <table>
                <thead>
                    <tr>
                        <th>Author</th>
                        <th>Content Preview</th>
                        <th>Views</th>
                        <th>Likes</th>
                        <th>RTs</th>
                        <th>ER</th>
                        <th>Tier</th>
                    </tr>
                </thead>
                <tbody>
                    ${topTweets.slice(0, 15).map((t: any) => `
                        <tr>
                            <td><strong>@${t.author_username}</strong></td>
                            <td class="tweet-preview">${escapeHtml(t.content)}</td>
                            <td>${(t.views || 0).toLocaleString()}</td>
                            <td>${(t.likes || 0).toLocaleString()}</td>
                            <td>${(t.retweets || 0).toLocaleString()}</td>
                            <td><strong>${((t.engagement_rate || 0) * 100).toFixed(2)}%</strong></td>
                            <td><span class="badge badge-${t.tier || 'unknown'}">${t.tier || 'unknown'}</span></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>

        <div class="section">
            <h2 class="section-title">📈 Breakdown by Tier</h2>
            <table>
                <thead>
                    <tr>
                        <th>Tier</th>
                        <th>Tweets</th>
                        <th>Avg Views</th>
                        <th>Avg Likes</th>
                        <th>Avg ER</th>
                    </tr>
                </thead>
                <tbody>
                    ${tierBreakdown.map((t: any) => `
                        <tr>
                            <td><span class="badge badge-${t.tier}">${t.tier}</span></td>
                            <td>${t.count.toLocaleString()}</td>
                            <td>${t.avgViews.toLocaleString()}</td>
                            <td>${t.avgLikes.toLocaleString()}</td>
                            <td><strong>${t.avgER.toFixed(2)}%</strong></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>

        <div class="section">
            <h2 class="section-title">🎯 Breakdown by Topic</h2>
            <table>
                <thead>
                    <tr>
                        <th>Topic</th>
                        <th>Tweets</th>
                        <th>Avg Views</th>
                        <th>Avg Likes</th>
                        <th>Avg ER</th>
                    </tr>
                </thead>
                <tbody>
                    ${topicBreakdown.map((t: any) => `
                        <tr>
                            <td><strong>${t.topic}</strong></td>
                            <td>${t.count.toLocaleString()}</td>
                            <td>${t.avgViews.toLocaleString()}</td>
                            <td>${t.avgLikes.toLocaleString()}</td>
                            <td><strong>${t.avgER.toFixed(2)}%</strong></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>

        <div class="section">
            <h2 class="section-title">🧠 Pattern Intelligence</h2>
            <div class="stats-grid" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));">
                <div class="stat-card">
                    <div class="stat-label">Total Patterns</div>
                    <div class="stat-value">${patternStats.total}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">High Confidence</div>
                    <div class="stat-value">${patternStats.highConfidence}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Medium Confidence</div>
                    <div class="stat-value">${patternStats.mediumConfidence}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Avg Samples/Pattern</div>
                    <div class="stat-value">${patternStats.avgSamplesPerPattern}</div>
                </div>
            </div>
        </div>

        <div class="section">
            <h2 class="section-title">📅 Recent Collection Activity</h2>
            <table>
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Tweets Collected</th>
                        <th>Progress</th>
                    </tr>
                </thead>
                <tbody>
                    ${recentActivity.map((a: any) => {
                        const maxCount = Math.max(...recentActivity.map((r: any) => r.count));
                        const percent = maxCount > 0 ? (a.count / maxCount) * 100 : 0;
                        return `
                            <tr>
                                <td><strong>${a.day}</strong></td>
                                <td>${a.count.toLocaleString()}</td>
                                <td>
                                    <div class="progress-bar">
                                        <div class="progress-fill" style="width: ${percent}%"></div>
                                    </div>
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    </div>
</body>
</html>`;
}

function generateErrorHTML(message: string): string {
  return `<!DOCTYPE html>
<html>
<head>
    <title>Error - VI Dashboard</title>
    <meta charset="UTF-8">
</head>
<body>
    <div style="padding: 40px; text-align: center;">
        <h1 style="color: #ef4444;">❌ Error Loading Dashboard</h1>
        <p>${escapeHtml(message)}</p>
    </div>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

