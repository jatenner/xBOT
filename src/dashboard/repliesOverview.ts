import { getSupabaseClient } from '../db/index';

interface ReplyRow {
  tweet_id: string | null;
  content: string | null;
  raw_topic: string | null;
  topic_cluster: string | null;
  tone: string | null;
  angle: string | null;
  generator_name: string | null;
  target_username: string | null;
  target_tweet_id: string | null;
  predicted_er: number | null;
  actual_impressions: number | null;
  actual_likes: number | null;
  actual_retweets: number | null;
  actual_replies: number | null;
  actual_engagement_rate: number | null;
  posted_at: string | null;
  features: Record<string, any> | null;
}

interface MetricsRow {
  tweet_id: string;
  impressions_count: number | null;
  likes_count: number | null;
  retweets_count: number | null;
  replies_count: number | null;
  updated_at: string | null;
}

const STYLES = `
  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background: #f8fafc;
    color: #0f172a;
    margin: 0;
    padding: 40px;
  }

  .container {
    max-width: 1280px;
    margin: 0 auto;
  }

  h1 {
    margin: 0;
    font-size: 32px;
    color: #1f2937;
  }

  .header p {
    margin-top: 8px;
    color: #475569;
  }

  .nav-tabs {
    display: flex;
    gap: 12px;
    margin: 24px 0;
    flex-wrap: wrap;
  }

  .nav-tab {
    text-decoration: none;
    padding: 12px 24px;
    border-radius: 12px;
    background: white;
    color: #1f2937;
    font-weight: 600;
    box-shadow: 0 6px 16px rgba(15, 23, 42, 0.08);
    transition: all 0.2s ease;
  }

  .nav-tab:hover {
    transform: translateY(-2px);
    box-shadow: 0 10px 22px rgba(15, 23, 42, 0.12);
  }

  .nav-tab.active {
    background: #7c3aed;
    color: white;
  }

  .stats-grid {
    display: grid;
    gap: 16px;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    margin-bottom: 24px;
  }

  .stat-card {
    background: white;
    border-radius: 14px;
    padding: 18px;
    box-shadow: 0 8px 20px rgba(15, 23, 42, 0.08);
  }

  .stat-label {
    font-size: 14px;
    color: #475569;
    margin-bottom: 6px;
  }

  .stat-value {
    font-size: 24px;
    font-weight: 700;
    color: #1f2937;
  }

  .stat-detail {
    font-size: 13px;
    color: #64748b;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    background: white;
    border-radius: 14px;
    overflow: hidden;
    box-shadow: 0 12px 28px rgba(15, 23, 42, 0.1);
  }

  th, td {
    padding: 12px 14px;
    text-align: left;
    font-size: 13px;
    color: #1f2937;
    vertical-align: top;
  }

  th {
    background: #f1f5f9;
    font-weight: 600;
  }

  tr:nth-child(even) td {
    background: #f8fafc;
  }

  .badge {
    display: inline-flex;
    align-items: center;
    padding: 3px 8px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 600;
  }

  .badge.tier { background: rgba(14, 116, 144, 0.12); color: #0f172a; }
  .badge.stale { background: rgba(245, 158, 11, 0.12); color: #b45309; }
  .badge.ok { background: rgba(16, 185, 129, 0.12); color: #047857; }

  .content-preview {
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
    font-size: 13px;
    color: #334155;
  }

  .metrics {
    font-family: 'Roboto Mono', SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
    font-size: 12px;
    color: #0f172a;
    line-height: 1.4;
  }

  .metrics strong {
    color: #7c3aed;
  }

  .empty {
    text-align: center;
    padding: 32px;
    color: #64748b;
  }
`;

function minutesAgo(timestamp: string | null | undefined): number | null {
  if (!timestamp) return null;
  const time = new Date(timestamp).getTime();
  if (Number.isNaN(time)) return null;
  return Math.round((Date.now() - time) / 60000);
}

function formatTimestamp(timestamp: string | null | undefined): string {
  if (!timestamp) return '—';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '—';
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

function extractTier(features: Record<string, any> | null | undefined): string | null {
  if (!features) return null;
  const tier = features.tier || features.opportunity_tier || features.target_tier;
  return typeof tier === 'string' ? tier : null;
}

export async function generateRepliesOverview(): Promise<string> {
  const supabase = getSupabaseClient();

  const [recentRepliesResult, queuedRepliesResult, recentOpportunityResult] = await Promise.all([
    supabase
      .from('content_metadata')
      .select(
        'tweet_id, content, raw_topic, topic_cluster, tone, angle, generator_name, target_username, target_tweet_id, predicted_er, actual_impressions, actual_likes, actual_retweets, actual_replies, actual_engagement_rate, posted_at, features'
      )
      .eq('decision_type', 'reply')
      .eq('status', 'posted')
      .order('posted_at', { ascending: false })
      .limit(50),
    supabase
      .from('content_metadata')
      .select('*', { count: 'exact', head: true })
      .eq('decision_type', 'reply')
      .eq('status', 'queued'),
    supabase
      .from('reply_opportunities')
      .select('tier')
      .eq('replied_to', false)
  ]);

  const replies: ReplyRow[] = recentRepliesResult.data ?? [];
  const queuedReplies = queuedRepliesResult.count || 0;
  const poolAvailable = recentOpportunityResult.data?.length || 0;

  const tweetIds = replies
    .map(reply => reply.tweet_id)
    .filter((id): id is string => Boolean(id));

  let metricsMap: Record<string, MetricsRow> = {};
  if (tweetIds.length) {
    const { data: metricsRows } = await supabase
      .from('tweet_metrics')
      .select('tweet_id, impressions_count, likes_count, retweets_count, replies_count, updated_at')
      .in('tweet_id', tweetIds);

    if (metricsRows) {
      metricsMap = metricsRows.reduce<Record<string, MetricsRow>>((acc, row) => {
        acc[row.tweet_id] = row;
        return acc;
      }, {});
    }
  }

  const timestamp = new Date().toLocaleString();
  const replies24h = replies.filter(reply => {
    if (!reply.posted_at) return false;
    const postedTime = new Date(reply.posted_at).getTime();
    return postedTime >= Date.now() - 24 * 60 * 60 * 1000;
  });
  const views24h = replies24h.reduce((sum, reply) => sum + (reply.actual_impressions || 0), 0);
  const likes24h = replies24h.reduce((sum, reply) => sum + (reply.actual_likes || 0), 0);

  const tableRows = replies
    .map(reply => {
      const metrics = reply.tweet_id ? metricsMap[reply.tweet_id] : undefined;
      const metricsMinutes = metrics ? minutesAgo(metrics.updated_at) : null;
      const stale = metricsMinutes !== null && metricsMinutes > 60;
      const predicted = reply.predicted_er !== null && reply.predicted_er !== undefined
        ? `${(reply.predicted_er * 100).toFixed(1)}%`
        : '—';

      const topic = reply.raw_topic || reply.topic_cluster || '—';
      const tone = reply.tone || '—';
      const angle = reply.angle || '—';
      const generator = reply.generator_name || 'unknown';
      const target = reply.target_username ? `@${reply.target_username}` : '—';
      const tier = extractTier(reply.features);
      const tierBadge = tier ? `<span class="badge tier">${tier.toUpperCase()}</span>` : '';

      const impressions = reply.actual_impressions ?? metrics?.impressions_count ?? 0;
      const likes = reply.actual_likes ?? metrics?.likes_count ?? 0;
      const retweets = reply.actual_retweets ?? metrics?.retweets_count ?? 0;
      const repliesCount = reply.actual_replies ?? metrics?.replies_count ?? 0;
      const er =
        reply.actual_engagement_rate !== null && reply.actual_engagement_rate !== undefined
          ? `${(reply.actual_engagement_rate * 100).toFixed(2)}%`
          : '—';

      const metricsBadge = metricsMinutes === null
        ? '<span class="badge stale">No metrics yet</span>'
        : stale
        ? `<span class="badge stale">Stale · ${metricsMinutes}m</span>`
        : `<span class="badge ok">Updated ${metricsMinutes}m ago</span>`;

      const tweetLink = reply.tweet_id
        ? `<a href="https://x.com/Signal_Synapse/status/${reply.tweet_id}" target="_blank">${reply.tweet_id}</a>`
        : '—';

      const targetLink = reply.target_tweet_id
        ? `<a href="https://x.com/${reply.target_username}/status/${reply.target_tweet_id}" target="_blank">Target tweet</a>`
        : '—';

      return `
        <tr>
          <td>
            <div>${formatTimestamp(reply.posted_at)}</div>
            ${tierBadge}
          </td>
          <td>
            <div class="content-preview">${reply.content || '—'}</div>
            <div style="margin-top:6px;">${tweetLink}</div>
          </td>
          <td>
            <strong>${target}</strong><br/>
            ${targetLink}
          </td>
          <td>
            <strong>${topic}</strong><br/>
            <span style="color:#64748b;">Tone: ${tone}</span><br/>
            <span style="color:#94a3b8;">Angle: ${angle}</span>
          </td>
          <td>
            ${generator}<br/>
            <span style="color:#475569;">Predicted ER: ${predicted}</span>
          </td>
          <td>
            <div class="metrics"><strong>${impressions.toLocaleString()}</strong> views<br/>${likes.toLocaleString()} likes<br/>${retweets.toLocaleString()} retweets<br/>${repliesCount.toLocaleString()} replies<br/>ER: ${er}</div>
          </td>
          <td>${metricsBadge}</td>
        </tr>
      `;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>xBOT Replies Overview</title>
  <style>${STYLES}</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>💬 Replies Overview</h1>
      <p>Recent replies with tone, angle, tier and live metrics. Last updated ${timestamp}</p>
    </div>

    <div class="nav-tabs">
      <a href="/dashboard/health?token=xbot-admin-2025" class="nav-tab">🩺 System Health</a>
      <a href="/dashboard/posts?token=xbot-admin-2025" class="nav-tab">📝 Posts</a>
      <a href="/dashboard/replies?token=xbot-admin-2025" class="nav-tab active">💬 Replies</a>
      <a href="/dashboard/vi?token=xbot-admin-2025" class="nav-tab">🔍 VI Collection</a>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">Replies displayed</div>
        <div class="stat-value">${replies.length}</div>
        <div class="stat-detail">Most recent ${replies.length} replies in dataset</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Replies in last 24h</div>
        <div class="stat-value">${replies24h.length}</div>
        <div class="stat-detail">👁️ ${views24h.toLocaleString()} views • ❤️ ${likes24h.toLocaleString()} likes</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Replies queued</div>
        <div class="stat-value">${queuedReplies}</div>
        <div class="stat-detail">${queuedReplies < 4 ? '⚠️ Queue low' : 'Queue ready'}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Opportunity pool</div>
        <div class="stat-value">${poolAvailable}</div>
        <div class="stat-detail">${poolAvailable < 15 ? '⚠️ Harvest needed' : 'Harvest healthy'}</div>
      </div>
    </div>

    ${
      replies.length === 0
        ? `<div class="empty">No recent replies found.</div>`
        : `<table>
        <thead>
          <tr>
            <th style="width: 110px;">Posted</th>
            <th style="width: 26%;">Reply Content</th>
            <th style="width: 20%;">Target</th>
            <th style="width: 20%;">Topic / Tone / Angle</th>
            <th style="width: 16%;">Generator</th>
            <th style="width: 18%;">Metrics</th>
            <th style="width: 120px;">Scraper</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>`
    }
  </div>
</body>
</html>`;
}

