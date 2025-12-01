import { getSupabaseClient } from '../db/index';
import { 
  generateNavigation, 
  getSharedStyles, 
  getContentTypeBadge,
  getContentTypeClass,
  TOKEN_PARAM
} from './shared/dashboardUtils';

interface PostRow {
  decision_type: string | null;
  tweet_id: string | null;
  content: string | null;
  raw_topic: string | null;
  topic_cluster: string | null;
  tone: string | null;
  angle: string | null;
  generator_name: string | null;
  predicted_er: number | null;
  actual_impressions: number | null;
  actual_likes: number | null;
  actual_retweets: number | null;
  actual_replies: number | null;
  actual_engagement_rate: number | null;
  posted_at: string | null;
  target_username?: string | null;
  target_tweet_id?: string | null;
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
    color: #6b7280;
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

  .badge.single { background: rgba(59, 130, 246, 0.12); color: #1d4ed8; }
  .badge.thread { background: rgba(236, 72, 153, 0.12); color: #be185d; }
  .badge.reply { background: rgba(139, 92, 246, 0.12); color: #6d28d9; }
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
    color: #2563eb;
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

export async function generatePostsOverview(): Promise<string> {
  const supabase = getSupabaseClient();

  const [recentPostsResult, queueCountResult, last24hResult] = await Promise.all([
    supabase
      .from('content_metadata')
      .select(
        'decision_type, tweet_id, content, raw_topic, topic_cluster, tone, angle, generator_name, predicted_er, actual_impressions, actual_likes, actual_retweets, actual_replies, actual_engagement_rate, posted_at, target_username, target_tweet_id'
      )
      .in('decision_type', ['single', 'thread', 'reply'])
      .eq('status', 'posted')
      .order('posted_at', { ascending: false })
      .limit(50),
    supabase
      .from('content_metadata')
      .select('*', { count: 'exact', head: true })
      .in('decision_type', ['single', 'thread', 'reply'])
      .eq('status', 'queued'),
    supabase
      .from('content_metadata')
      .select('actual_impressions, actual_likes, decision_type')
      .in('decision_type', ['single', 'thread', 'reply'])
      .eq('status', 'posted')
      .gte('posted_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
  ]);

  const posts: PostRow[] = recentPostsResult.data ?? [];

  const tweetIds = posts
    .map(post => post.tweet_id)
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

  const queuedCount = queueCountResult.count || 0;
  const last24h = last24hResult.data || [];
  const last24hViews = last24h.reduce((sum, row) => sum + (row.actual_impressions || 0), 0);
  const last24hLikes = last24h.reduce((sum, row) => sum + (row.actual_likes || 0), 0);

  const timestamp = new Date().toLocaleString();

  const tableRows = posts
    .map(post => {
      const metrics = post.tweet_id ? metricsMap[post.tweet_id] : undefined;
      const metricsMinutes = metrics ? minutesAgo(metrics.updated_at) : null;
      const stale = metricsMinutes !== null && metricsMinutes > 60;
      const typeBadge = getContentTypeBadge(post.decision_type);
      const typeClass = getContentTypeClass(post.decision_type);
      const metricsBadge = metricsMinutes === null
        ? '<span class="badge stale">No metrics yet</span>'
        : stale
        ? `<span class="badge stale">Stale · ${metricsMinutes}m</span>`
        : `<span class="badge ok">Updated ${metricsMinutes}m ago</span>`;

      const topic = post.raw_topic || post.topic_cluster || '—';
      const tone = post.tone || '—';
      const angle = post.angle || '—';
      const generator = post.generator_name || 'unknown';
      const predicted = post.predicted_er !== null && post.predicted_er !== undefined
        ? `${(post.predicted_er * 100).toFixed(1)}%`
        : '—';

      const impressions = post.actual_impressions ?? metrics?.impressions_count ?? 0;
      const likes = post.actual_likes ?? metrics?.likes_count ?? 0;
      const retweets = post.actual_retweets ?? metrics?.retweets_count ?? 0;
      const replies = post.actual_replies ?? metrics?.replies_count ?? 0;
      const er =
        post.actual_engagement_rate !== null && post.actual_engagement_rate !== undefined
          ? `${(post.actual_engagement_rate * 100).toFixed(2)}%`
          : '—';

      const tweetLink = post.tweet_id
        ? `<a href="https://x.com/Signal_Synapse/status/${post.tweet_id}" target="_blank">${post.tweet_id}</a>`
        : '—';

      return `
        <tr class="content-row ${typeClass}">
          <td>${typeBadge}<div class="timestamp">${formatTimestamp(post.posted_at)}</div></td>
          <td>
            <div class="content-preview">${post.content || '—'}</div>
            <div style="margin-top:6px;">${tweetLink}</div>
            ${post.decision_type === 'reply' && post.target_username ? `<div style="margin-top:4px; font-size:11px; color:#64748b;">Replying to @${post.target_username}</div>` : ''}
          </td>
          <td><strong>${topic}</strong><br/><span style="color:#64748b;">Tone: ${tone}</span><br/><span style="color:#94a3b8;">Angle: ${angle}</span></td>
          <td>${generator}<br/><span style="color:#475569;">Predicted ER: ${predicted}</span></td>
          <td>
            <div class="metrics"><strong>${impressions.toLocaleString()}</strong> views<br/>${likes.toLocaleString()} likes<br/>${retweets.toLocaleString()} retweets<br/>${replies.toLocaleString()} replies<br/>ER: ${er}</div>
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
  <title>xBOT Posts Overview</title>
  <style>${getSharedStyles()} ${STYLES}</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📝 Posts Overview</h1>
      <p>Latest posts with metadata and live metrics. Last updated ${timestamp}</p>
    </div>

    ${generateNavigation('/dashboard/posts')}

    <div class="stats-grid">
      <div class="stat-card type-single">
        <div class="stat-label">📝 Singles (24h)</div>
        <div class="stat-value">${last24h.filter((p: any) => p.decision_type === 'single').length}</div>
        <div class="stat-detail">Regular posts to your timeline</div>
      </div>
      <div class="stat-card type-thread">
        <div class="stat-label">🧵 Threads (24h)</div>
        <div class="stat-value">${last24h.filter((p: any) => p.decision_type === 'thread').length}</div>
        <div class="stat-detail">Multi-tweet threads</div>
      </div>
      <div class="stat-card type-reply">
        <div class="stat-label">💬 Replies (24h)</div>
        <div class="stat-value">${last24h.filter((p: any) => p.decision_type === 'reply').length}</div>
        <div class="stat-detail">Replies to other tweets</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Total Views (24h)</div>
        <div class="stat-value">${(last24hViews / 1000).toFixed(1)}K</div>
        <div class="stat-detail">👁️ ${last24hViews.toLocaleString()} views • ❤️ ${last24hLikes.toLocaleString()} likes</div>
      </div>
    </div>

    ${
      posts.length === 0
        ? `<div class="empty">No recent posts found.</div>`
        : `<table>
        <thead>
          <tr>
            <th style="width: 110px;">Type / Time</th>
            <th style="width: 28%;">Content</th>
            <th style="width: 22%;">Topic / Tone / Angle</th>
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

