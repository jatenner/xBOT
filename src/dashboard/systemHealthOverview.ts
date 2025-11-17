import { getSupabaseClient } from '../db/index';
import { getMetricsHealthReport } from './metricsHealthTracker';

interface HealthCard {
  name: string;
  status: 'healthy' | 'warning' | 'critical';
  headline: string;
  details: string[];
}

const SHARED_STYLES = `
  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background: #f7fafc;
    color: #1a202c;
    margin: 0;
    padding: 40px;
  }

  .container {
    max-width: 1200px;
    margin: 0 auto;
  }

  .header h1 {
    margin: 0;
    font-size: 32px;
    color: #2d3748;
  }

  .header p {
    margin: 8px 0 0;
    color: #4a5568;
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
    border-radius: 10px;
    background: white;
    color: #2d3748;
    font-weight: 600;
    box-shadow: 0 4px 12px rgba(15, 23, 42, 0.08);
    transition: all 0.2s ease;
  }

  .nav-tab:hover {
    transform: translateY(-1px);
    box-shadow: 0 6px 14px rgba(15, 23, 42, 0.12);
  }

  .nav-tab.active {
    background: #4f46e5;
    color: white;
  }

  .grid {
    display: grid;
    gap: 18px;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  }

  .card {
    background: white;
    border-radius: 14px;
    padding: 20px;
    box-shadow: 0 8px 18px rgba(15, 23, 42, 0.08);
    border-left: 6px solid transparent;
    transition: transform 0.2s ease;
  }

  .card:hover {
    transform: translateY(-2px);
  }

  .card.healthy { border-left-color: #10b981; }
  .card.warning { border-left-color: #f59e0b; }
  .card.critical { border-left-color: #ef4444; }

  .card h3 {
    margin: 0 0 8px;
    font-size: 18px;
    color: #1f2937;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .card ul {
    padding-left: 18px;
    margin: 12px 0 0;
    color: #4b5563;
    font-size: 14px;
    line-height: 1.5;
  }

  .card .status-indicator {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 14px;
    font-weight: 600;
  }

  .status-indicator.healthy { color: #059669; }
  .status-indicator.warning { color: #d97706; }
  .status-indicator.critical { color: #dc2626; }

  .section {
    margin-top: 36px;
  }

  .section h2 {
    margin-bottom: 16px;
    color: #1f2937;
    font-size: 24px;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    background: white;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 8px 18px rgba(15, 23, 42, 0.08);
  }

  th, td {
    padding: 12px 16px;
    text-align: left;
    font-size: 14px;
    color: #374151;
  }

  th {
    background: #f9fafb;
    color: #1f2937;
    font-weight: 600;
  }

  tr:nth-child(even) td {
    background: #fafbff;
  }

  .badge {
    display: inline-flex;
    align-items: center;
    padding: 4px 8px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 600;
  }

  .badge.success { background: rgba(16, 185, 129, 0.15); color: #047857; }
  .badge.warning { background: rgba(245, 158, 11, 0.15); color: #b45309; }
  .badge.error { background: rgba(239, 68, 68, 0.15); color: #b91c1c; }

  .timestamp {
    color: #6b7280;
    font-size: 13px;
  }
`;

function minutesAgo(date: string | null | undefined): number | null {
  if (!date) return null;
  const time = new Date(date).getTime();
  if (Number.isNaN(time)) return null;
  return Math.round((Date.now() - time) / 60000);
}

function formatMinutes(minutes: number | null): string {
  if (minutes === null) return 'Never';
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  return `${hours}h ago`;
}

function statusIndicator(status: 'healthy' | 'warning' | 'critical'): string {
  const emoji = status === 'healthy' ? '🟢' : status === 'warning' ? '🟡' : '🔴';
  const label = status === 'healthy' ? 'Healthy' : status === 'warning' ? 'Needs attention' : 'Action required';
  return `<span class="status-indicator ${status}">${emoji} ${label}</span>`;
}

export async function generateSystemHealthOverview(): Promise<string> {
  const supabase = getSupabaseClient();
  const now = new Date();
  const oneHourAgoIso = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
  const threeHoursAgoIso = new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString();
  const twentyFourHoursAgoIso = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

  const [
    contentGenerated,
    contentPosted,
    replyGenerated,
    replyPosted,
    queuedContentCount,
    queuedRepliesCount,
    failedPosts24h,
    failedReplies24h,
    recentFailures,
    opportunitySnapshot,
    latestMetrics,
    postsWithMissingMetrics,
    repliesWithMissingMetrics,
    totalPosts24h,
    totalReplies24h,
    scrapedPosts24h,
    scrapedReplies24h,
    lastScrapeTime,
    scrapeFrequency
  ] = await Promise.all([
    supabase
      .from('content_metadata')
      .select('created_at')
      .in('decision_type', ['single', 'thread'])
      .order('created_at', { ascending: false })
      .limit(1),
    supabase
      .from('content_metadata')
      .select('posted_at')
      .in('decision_type', ['single', 'thread'])
      .eq('status', 'posted')
      .order('posted_at', { ascending: false })
      .limit(1),
    supabase
      .from('content_metadata')
      .select('created_at')
      .eq('decision_type', 'reply')
      .order('created_at', { ascending: false })
      .limit(1),
    supabase
      .from('content_metadata')
      .select('posted_at')
      .eq('decision_type', 'reply')
      .eq('status', 'posted')
      .order('posted_at', { ascending: false })
      .limit(1),
    supabase
      .from('content_metadata')
      .select('*', { count: 'exact', head: true })
      .in('decision_type', ['single', 'thread'])
      .eq('status', 'queued'),
    supabase
      .from('content_metadata')
      .select('*', { count: 'exact', head: true })
      .eq('decision_type', 'reply')
      .eq('status', 'queued'),
    supabase
      .from('content_metadata')
      .select('*', { count: 'exact', head: true })
      .in('decision_type', ['single', 'thread'])
      .eq('status', 'failed')
      .gte('created_at', twentyFourHoursAgoIso),
    supabase
      .from('content_metadata')
      .select('*', { count: 'exact', head: true })
      .eq('decision_type', 'reply')
      .eq('status', 'failed')
      .gte('created_at', twentyFourHoursAgoIso),
    supabase
      .from('content_metadata')
      .select('decision_type, content, error_message, updated_at, tweet_id')
      .eq('status', 'failed')
      .order('updated_at', { ascending: false })
      .limit(6),
    supabase
      .from('reply_opportunities')
      .select('created_at, tier')
      .eq('replied_to', false)
      .gte('created_at', twentyFourHoursAgoIso),
    supabase
      .from('tweet_metrics')
      .select('updated_at')
      .order('updated_at', { ascending: false })
      .limit(1),
    supabase
      .from('content_metadata')
      .select('*', { count: 'exact', head: true })
      .in('decision_type', ['single', 'thread'])
      .eq('status', 'posted')
      .gte('posted_at', twentyFourHoursAgoIso)
      .or('actual_impressions.is.null,actual_impressions.eq.0'),
    supabase
      .from('content_metadata')
      .select('*', { count: 'exact', head: true })
      .eq('decision_type', 'reply')
      .eq('status', 'posted')
      .gte('posted_at', twentyFourHoursAgoIso)
      .or('actual_impressions.is.null,actual_impressions.eq.0'),
    // Total posts (24h)
    supabase
      .from('content_metadata')
      .select('*', { count: 'exact', head: true })
      .in('decision_type', ['single', 'thread'])
      .eq('status', 'posted')
      .gte('posted_at', twentyFourHoursAgoIso),
    // Total replies (24h)
    supabase
      .from('content_metadata')
      .select('*', { count: 'exact', head: true })
      .eq('decision_type', 'reply')
      .eq('status', 'posted')
      .gte('posted_at', twentyFourHoursAgoIso),
    // Scraped posts (24h) - have metrics
    supabase
      .from('content_metadata')
      .select('*', { count: 'exact', head: true })
      .in('decision_type', ['single', 'thread'])
      .eq('status', 'posted')
      .gte('posted_at', twentyFourHoursAgoIso)
      .not('actual_impressions', 'is', null)
      .gt('actual_impressions', 0),
    // Scraped replies (24h) - have metrics
    supabase
      .from('content_metadata')
      .select('*', { count: 'exact', head: true })
      .eq('decision_type', 'reply')
      .eq('status', 'posted')
      .gte('posted_at', twentyFourHoursAgoIso)
      .not('actual_impressions', 'is', null)
      .gt('actual_impressions', 0),
    // Last scrape time from outcomes table
    supabase
      .from('outcomes')
      .select('collected_at')
      .order('collected_at', { ascending: false })
      .limit(1),
    // Scrape frequency - count scrapes in last 24h
    supabase
      .from('outcomes')
      .select('collected_at', { count: 'exact', head: true })
      .gte('collected_at', twentyFourHoursAgoIso)
  ]);

  const contentGeneratedAt = contentGenerated.data?.[0]?.created_at ?? null;
  const contentPostedAt = contentPosted.data?.[0]?.posted_at ?? null;
  const replyGeneratedAt = replyGenerated.data?.[0]?.created_at ?? null;
  const replyPostedAt = replyPosted.data?.[0]?.posted_at ?? null;
  const latestMetricsAt = latestMetrics.data?.[0]?.updated_at ?? null;

  const cards: HealthCard[] = [];

  // Content pipeline
  const contentGenMinutes = minutesAgo(contentGeneratedAt);
  const contentPostMinutes = minutesAgo(contentPostedAt);
  const contentQueued = queuedContentCount.count || 0;

  let contentStatus: HealthCard['status'] = 'healthy';
  if (contentGenMinutes === null || contentGenMinutes > 180 || contentQueued === 0) {
    contentStatus = 'critical';
  } else if (contentGenMinutes > 120 || contentPostMinutes === null || contentPostMinutes > 120) {
    contentStatus = 'warning';
  }

  cards.push({
    name: 'Content Generation',
    status: contentStatus,
    headline: `Last generated ${formatMinutes(contentGenMinutes)}`,
    details: [
      `Last posted ${formatMinutes(contentPostMinutes)}`,
      `Queued singles & threads: ${contentQueued}`,
      failedPosts24h.count ? `Failures (24h): ${failedPosts24h.count}` : 'No failures in past 24h'
    ]
  });

  // Reply pipeline
  const replyGenMinutes = minutesAgo(replyGeneratedAt);
  const replyPostMinutes = minutesAgo(replyPostedAt);
  const repliesQueued = queuedRepliesCount.count || 0;

  let replyStatus: HealthCard['status'] = 'healthy';
  if (replyGenMinutes === null || replyGenMinutes > 90 || repliesQueued < 3) {
    replyStatus = 'critical';
  } else if (replyGenMinutes > 45 || replyPostMinutes === null || replyPostMinutes > 60) {
    replyStatus = 'warning';
  }

  cards.push({
    name: 'Reply Generation',
    status: replyStatus,
    headline: `Last generated ${formatMinutes(replyGenMinutes)}`,
    details: [
      `Last reply posted ${formatMinutes(replyPostMinutes)}`,
      `Replies queued: ${repliesQueued}`,
      failedReplies24h.count ? `Failures (24h): ${failedReplies24h.count}` : 'No failures in past 24h'
    ]
  });

  // Harvest pipeline
  const opportunityCount = opportunitySnapshot.data?.length || 0;
  const lastOpportunityCreated = opportunitySnapshot.data?.[0]?.created_at ?? null;
  const harvestMinutes = minutesAgo(lastOpportunityCreated);
  const goldenCount = opportunitySnapshot.data?.filter(o => o.tier === 'golden').length || 0;

  let harvestStatus: HealthCard['status'] = 'healthy';
  if (opportunityCount < 10 || harvestMinutes === null || harvestMinutes > 240) {
    harvestStatus = 'critical';
  } else if (opportunityCount < 25 || harvestMinutes > 120) {
    harvestStatus = 'warning';
  }

  cards.push({
    name: 'Harvest Pipeline',
    status: harvestStatus,
    headline: `Pool size: ${opportunityCount} opportunities`,
    details: [
      `Golden opportunities: ${goldenCount}`,
      `Last harvest ${formatMinutes(harvestMinutes)}`,
      opportunityCount < 10 ? '⚠️ Opportunity pool is dangerously low' : 'Pool healthy'
    ]
  });

  // Posting queue
  let postingStatus: HealthCard['status'] = 'healthy';
  if (contentPostMinutes === null || contentPostMinutes > 90 || replyPostMinutes === null || replyPostMinutes > 90) {
    postingStatus = 'warning';
  }
  if ((queuedContentCount.count || 0) === 0 && (queuedRepliesCount.count || 0) === 0) {
    postingStatus = 'critical';
  }

  cards.push({
    name: 'Posting Queue',
    status: postingStatus,
    headline: `Content posted ${formatMinutes(contentPostMinutes)}`,
    details: [
      `Replies posted ${formatMinutes(replyPostMinutes)}`,
      `Queued totals — Posts: ${contentQueued}, Replies: ${repliesQueued}`,
      `Failures (24h): posts ${failedPosts24h.count || 0}, replies ${failedReplies24h.count || 0}`
    ]
  });

  // Scraping pipeline - comprehensive tracking
  const metricsMinutes = minutesAgo(latestMetricsAt);
  const postsMissingMetrics = postsWithMissingMetrics.count || 0;
  const repliesMissingMetrics = repliesWithMissingMetrics.count || 0;
  
  // New comprehensive metrics
  const totalPosts = totalPosts24h.count || 0;
  const totalReplies = totalReplies24h.count || 0;
  const scrapedPosts = scrapedPosts24h.count || 0;
  const scrapedReplies = scrapedReplies24h.count || 0;
  const postsScrapeRate = totalPosts > 0 ? Math.round((scrapedPosts / totalPosts) * 100) : 0;
  const repliesScrapeRate = totalReplies > 0 ? Math.round((scrapedReplies / totalReplies) * 100) : 0;
  
  // Last scrape time from outcomes
  const lastScrapeAt = lastScrapeTime.data?.[0]?.collected_at ?? null;
  const lastScrapeMinutes = minutesAgo(lastScrapeAt);
  
  // Scrape frequency (how many scrapes in last 24h)
  const scrapes24h = scrapeFrequency.count || 0;
  const scrapeFrequencyText = scrapes24h > 0 
    ? `${scrapes24h} scrapes in last 24h`
    : 'No scrapes in last 24h';

  let scrapingStatus: HealthCard['status'] = 'healthy';
  if (metricsMinutes === null || metricsMinutes > 90) {
    scrapingStatus = 'critical';
  } else if (metricsMinutes > 45) {
    scrapingStatus = 'warning';
  }
  if (postsMissingMetrics > 5 || repliesMissingMetrics > 5) {
    scrapingStatus = 'warning';
  }
  if (postsScrapeRate < 80 && totalPosts > 0) {
    scrapingStatus = 'warning'; // Less than 80% scraped
  }
  if (repliesScrapeRate < 80 && totalReplies > 0) {
    scrapingStatus = 'warning';
  }

  // Get comprehensive health report for multiple time windows
  let healthReport;
  try {
    healthReport = await getMetricsHealthReport([12, 14, 24, 48]);
  } catch (error: any) {
    console.warn('[HEALTH_DASHBOARD] Failed to get health report:', error.message);
    healthReport = null;
  }

  // Build detailed metrics card
  const metricsDetails = [
    `📊 Posts: ${scrapedPosts}/${totalPosts} scraped (${postsScrapeRate}%)`,
    `💬 Replies: ${scrapedReplies}/${totalReplies} scraped (${repliesScrapeRate}%)`,
    scrapeFrequencyText
  ];

  // Add time window breakdown if available
  if (healthReport) {
    const window24h = healthReport.breakdown.posts.find(w => w.windowHours === 24);
    const window12h = healthReport.breakdown.posts.find(w => w.windowHours === 12);
    
    if (window24h) {
      metricsDetails.push(`📈 24h: ${window24h.scraped}/${window24h.total} scraped, ${window24h.updated} fresh, ${window24h.stale} stale, ${window24h.missing} missing`);
    }
    if (window12h) {
      metricsDetails.push(`⏱️ 12h: ${window12h.scraped}/${window12h.total} scraped (${window12h.scrapeRate}%), ${window12h.updated} fresh`);
    }
  } else {
    // Fallback to simple metrics
    metricsDetails.push(
      postsMissingMetrics > 0 
        ? `⚠️ ${postsMissingMetrics} posts missing metrics`
        : '✅ All posts have metrics',
      repliesMissingMetrics > 0
        ? `⚠️ ${repliesMissingMetrics} replies missing metrics`
        : '✅ All replies have metrics'
    );
  }

  cards.push({
    name: 'Metrics Scraper',
    status: scrapingStatus,
    headline: `Last scrape ${formatMinutes(lastScrapeMinutes ?? metricsMinutes)}`,
    details: metricsDetails
  });

  const failures = (recentFailures.data || []).map(failure => ({
    type: failure.decision_type,
    error: failure.error_message || 'No error message recorded',
    updatedAt: failure.updated_at,
    tweetId: failure.tweet_id
  }));

  const timestamp = new Date().toLocaleString();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>xBOT System Health Overview</title>
  <style>${SHARED_STYLES}</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🩺 xBOT System Health</h1>
      <p>The command center for live system status. Last updated ${timestamp}</p>
    </div>

    <div class="nav-tabs">
      <a href="/dashboard/health?token=xbot-admin-2025" class="nav-tab active">🩺 System Health</a>
      <a href="/dashboard/posts?token=xbot-admin-2025" class="nav-tab">📝 Posts</a>
      <a href="/dashboard/replies?token=xbot-admin-2025" class="nav-tab">💬 Replies</a>
    </div>

    <div class="grid">
      ${cards
        .map(
          card => `
        <div class="card ${card.status}">
          <h3>${card.name}</h3>
          ${statusIndicator(card.status)}
          <p style="margin: 12px 0; font-size: 15px; color: #1f2937;">${card.headline}</p>
          <ul>
            ${card.details.map(detail => `<li>${detail}</li>`).join('')}
          </ul>
        </div>
      `
        )
        .join('')}
    </div>

    <div class="section">
      <h2>🚨 Recent pipeline failures</h2>
      ${
        failures.length === 0
          ? `<p style="color:#047857;">All clear — no failures reported.</p>`
          : `<table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Type</th>
              <th>Error</th>
              <th>Tweet</th>
            </tr>
          </thead>
          <tbody>
            ${failures
              .map(
                failure => `
              <tr>
                <td>${new Date(failure.updatedAt).toLocaleString()}</td>
                <td><span class="badge warning">${failure.type}</span></td>
                <td>${failure.error}</td>
                <td>${
                  failure.tweetId
                    ? `<a href="https://x.com/Signal_Synapse/status/${failure.tweetId}" target="_blank">View</a>`
                    : '—'
                }</td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>`
      }
      <p style="margin-top:12px; color:#4b5563; font-size:13px;">
        Tip: Failures are pulled directly from <code>content_metadata</code>. Investigate anything that stays here for more than a few minutes.
      </p>
    </div>
  </div>
</body>
</html>`;
}

