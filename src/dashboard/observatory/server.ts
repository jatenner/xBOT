/**
 * Growth Observatory Dashboard Server
 *
 * A real-time visual dashboard showing:
 * Tab 1: LIVE — What the system is doing right now
 * Tab 2: DATABASE — Raw data counts, tables, growth curves
 * Tab 3: ANALYSIS — Patterns, playbooks, retrospectives, experiments
 *
 * Usage: npx tsx src/dashboard/observatory/server.ts
 * Opens at: http://localhost:3333
 */

import 'dotenv/config';
import { createServer } from 'http';
import { getSupabaseClient } from '../../db';

const PORT = parseInt(process.env.OBSERVATORY_DASHBOARD_PORT || '3333');

// =============================================================================
// API Endpoints
// =============================================================================

export async function getLiveData() {
  const s = getSupabaseClient();
  const now = Date.now();
  const oneHourAgo = new Date(now - 60 * 60 * 1000).toISOString();
  const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString();

  // Recent system events (last hour)
  const { data: recentEvents } = await s.from('system_events')
    .select('event_type, message, created_at')
    .gte('created_at', oneHourAgo)
    .order('created_at', { ascending: false })
    .limit(30);

  // Recent brain tweets ingested (last hour)
  const { count: tweetsLastHour } = await s.from('brain_tweets')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', oneHourAgo);

  // Recent census snapshots (last hour)
  const { count: censusLastHour } = await s.from('brain_account_snapshots')
    .select('id', { count: 'exact', head: true })
    .gte('checked_at', oneHourAgo);

  // Recent classifications
  const { count: classifiedLastHour } = await s.from('brain_classifications')
    .select('id', { count: 'exact', head: true })
    .gte('classified_at', oneHourAgo);

  // Growth events today
  const { data: growthEventsToday } = await s.from('brain_growth_events')
    .select('username, growth_rate_after, followers_at_detection, detected_at')
    .gte('detected_at', oneDayAgo)
    .order('detected_at', { ascending: false })
    .limit(10);

  // Active growth accounts
  const { data: hotAccounts } = await s.from('brain_accounts')
    .select('username, followers_count, growth_rate_7d, growth_status')
    .in('growth_status', ['hot', 'explosive'])
    .order('growth_rate_7d', { ascending: false })
    .limit(10);

  return {
    timestamp: new Date().toISOString(),
    last_hour: {
      tweets_ingested: tweetsLastHour ?? 0,
      accounts_censused: censusLastHour ?? 0,
      tweets_classified: classifiedLastHour ?? 0,
    },
    growth_events_today: growthEventsToday ?? [],
    hot_accounts: hotAccounts ?? [],
    recent_events: (recentEvents ?? []).slice(0, 15),
  };
}

export async function getDatabaseData() {
  const s = getSupabaseClient();

  // Table counts
  const tables = [
    'brain_tweets', 'brain_accounts', 'brain_keywords', 'brain_classifications',
    'brain_account_snapshots', 'brain_growth_events', 'brain_account_profiles',
    'brain_retrospective_analyses', 'brain_strategy_library', 'brain_strategy_memory',
    'brain_daily_context', 'self_model_state', 'feedback_events',
  ];

  const counts: Record<string, number> = {};
  for (const table of tables) {
    const { count } = await s.from(table).select('id', { count: 'exact', head: true });
    counts[table] = count ?? 0;
  }

  // Account distribution by growth status
  const { data: statusDist } = await s.from('brain_accounts')
    .select('growth_status')
    .eq('is_active', true);

  const growthDist: Record<string, number> = {};
  for (const a of statusDist ?? []) {
    growthDist[a.growth_status ?? 'unknown'] = (growthDist[a.growth_status ?? 'unknown'] ?? 0) + 1;
  }

  // Account distribution by tier
  const { data: tierDist } = await s.from('brain_accounts')
    .select('tier')
    .eq('is_active', true);

  const tiers: Record<string, number> = {};
  for (const a of tierDist ?? []) {
    tiers[a.tier ?? 'C'] = (tiers[a.tier ?? 'C'] ?? 0) + 1;
  }

  // Follower range distribution — what sizes of accounts are we watching?
  const { data: rangeData } = await s.from('brain_accounts')
    .select('follower_range')
    .eq('is_active', true)
    .not('follower_range', 'is', null);

  const rangeDist: Record<string, number> = {};
  const rangeLabels: Record<string, string> = {
    'nano': '0-500',
    'micro': '500-2K',
    'small': '2K-10K',
    'mid': '10K-50K',
    'large': '50K-200K',
    'mega': '200K-1M',
    'celebrity': '1M+',
  };
  for (const a of rangeData ?? []) {
    const label = rangeLabels[a.follower_range] || a.follower_range;
    rangeDist[label] = (rangeDist[label] ?? 0) + 1;
  }

  // Classification domains
  const { data: domains } = await s.from('brain_classifications')
    .select('domain');

  const domainDist: Record<string, number> = {};
  for (const c of domains ?? []) {
    domainDist[c.domain ?? 'unknown'] = (domainDist[c.domain ?? 'unknown'] ?? 0) + 1;
  }

  // Top 20 accounts — exclude AI-classified celebrities, keep everyone else
  // The accountProfiler classifies accounts as: content_creator, celebrity, brand, follow_farmer, bot, dormant, viewer
  // We skip 'celebrity' (fame-based growth, not strategy) and 'bot'/'follow_farmer' (fake growth)
  // Accounts not yet profiled (account_type_cached IS NULL) are included — most are real creators
  const { data: topAccounts } = await s.from('brain_accounts')
    .select('username, followers_count, growth_rate_7d, growth_status, niche_cached, account_type_cached')
    .eq('is_active', true)
    .gte('followers_count', 100)
    .not('account_type_cached', 'in', '("celebrity","bot","follow_farmer")')
    .order('followers_count', { ascending: false, nullsFirst: false })
    .limit(20);

  // Fastest growing by % — only accounts where we have REAL before/after data
  // prev_followers_count must differ from followers_count (actual observed gain)
  const { data: rawFastestPct } = await s.from('brain_accounts')
    .select('username, followers_count, prev_followers_count, growth_rate_7d, growth_status, follower_range')
    .not('growth_rate_7d', 'is', null)
    .gt('growth_rate_7d', 0)
    .not('prev_followers_count', 'is', null)
    .not('account_type_cached', 'in', '("celebrity","bot","follow_farmer")')
    .order('growth_rate_7d', { ascending: false })
    .limit(80);
  // Filter: only show if actual gain > 0
  const fastestGrowingPct = (rawFastestPct ?? []).filter((a: any) =>
    a.prev_followers_count != null &&
    a.followers_count != null &&
    a.followers_count > a.prev_followers_count
  ).slice(0, 20);

  // Fastest growing by VOLUME — who gained the most raw followers this week
  const { data: fastestGrowingVol } = await s.from('brain_accounts')
    .select('username, followers_count, prev_followers_count, growth_rate_7d, growth_status, follower_range')
    .not('growth_rate_7d', 'is', null)
    .gt('growth_rate_7d', 0)
    .gte('followers_count', 50)
    .not('account_type_cached', 'in', '("celebrity","bot","follow_farmer")')
    .order('followers_count', { ascending: false }) // Bigger accounts with any growth = more volume
    .limit(100);

  return {
    table_counts: counts,
    growth_status_distribution: growthDist,
    tier_distribution: tiers,
    follower_range_distribution: rangeDist,
    domain_distribution: domainDist,
    top_accounts_by_followers: topAccounts ?? [],
    fastest_growing_pct: fastestGrowingPct ?? [],
    fastest_growing_vol: (fastestGrowingVol ?? [])
      .filter((a: any) => a.growth_rate_7d > 0 && a.prev_followers_count)
      .sort((a: any, b: any) => {
        const aGain = (a.followers_count ?? 0) - (a.prev_followers_count ?? a.followers_count ?? 0);
        const bGain = (b.followers_count ?? 0) - (b.prev_followers_count ?? b.followers_count ?? 0);
        return bGain - aGain;
      })
      .slice(0, 20),
  };
}

export async function getAnalysisData() {
  const s = getSupabaseClient();

  // Strategy library
  const { data: strategies } = await s.from('brain_strategy_library')
    .select('*')
    .order('win_rate', { ascending: false, nullsFirst: false });

  // Recent retrospectives
  const { data: retrospectives } = await s.from('brain_retrospective_analyses')
    .select('username, key_changes, analysis_summary, analyzed_at')
    .order('analyzed_at', { ascending: false })
    .limit(10);

  // Account profiles by type
  const { data: profiles } = await s.from('brain_account_profiles')
    .select('account_type, niche');

  const typeDist: Record<string, number> = {};
  const nicheDist: Record<string, number> = {};
  for (const p of profiles ?? []) {
    typeDist[p.account_type ?? 'unknown'] = (typeDist[p.account_type ?? 'unknown'] ?? 0) + 1;
    nicheDist[p.niche ?? 'unknown'] = (nicheDist[p.niche ?? 'unknown'] ?? 0) + 1;
  }

  // Our experiments
  const { data: experiments } = await s.from('brain_strategy_memory')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);

  // Growth events summary
  const { data: growthEvents } = await s.from('brain_growth_events')
    .select('username, growth_rate_before, growth_rate_after, followers_at_detection, retrospective_status, detected_at')
    .order('detected_at', { ascending: false })
    .limit(20);

  // Self model
  const { data: selfModel } = await s.from('self_model_state')
    .select('*')
    .eq('id', 1)
    .single();

  // Top tweets by likes
  const { data: topTweets } = await s.from('brain_tweets')
    .select('tweet_id, author_username, likes, retweets, content, discovery_source')
    .order('likes', { ascending: false })
    .limit(10);

  return {
    strategy_library: strategies ?? [],
    retrospectives: retrospectives ?? [],
    account_type_distribution: typeDist,
    niche_distribution: nicheDist,
    experiments: experiments ?? [],
    growth_events: growthEvents ?? [],
    self_model: selfModel,
    top_tweets: topTweets ?? [],
  };
}

// =============================================================================
// HTML Dashboard
// =============================================================================

export function getHTML(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>xBOT Growth Observatory</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0a0a0f; color: #e0e0e0; }

  .header { background: linear-gradient(135deg, #1a1a2e, #16213e); padding: 20px 30px; border-bottom: 1px solid #2a2a4a; display: flex; justify-content: space-between; align-items: center; }
  .header h1 { font-size: 24px; color: #fff; }
  .header h1 span { color: #4fc3f7; }
  .header .refresh { color: #888; font-size: 13px; }

  .tabs { display: flex; gap: 0; background: #111; border-bottom: 2px solid #222; }
  .tab { padding: 14px 28px; cursor: pointer; color: #888; font-weight: 600; font-size: 14px; border-bottom: 2px solid transparent; transition: all 0.2s; }
  .tab:hover { color: #ccc; background: #1a1a2e; }
  .tab.active { color: #4fc3f7; border-bottom-color: #4fc3f7; background: #0d1b2a; }

  .content { padding: 24px; max-width: 1400px; margin: 0 auto; }
  .panel { display: none; }
  .panel.active { display: block; }

  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; margin-bottom: 24px; }
  .card { background: #111827; border: 1px solid #1f2937; border-radius: 12px; padding: 20px; }
  .card h3 { color: #9ca3af; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }
  .card .value { font-size: 32px; font-weight: 700; color: #fff; }
  .card .value.green { color: #10b981; }
  .card .value.blue { color: #4fc3f7; }
  .card .value.orange { color: #f59e0b; }
  .card .value.red { color: #ef4444; }
  .card .sub { color: #6b7280; font-size: 13px; margin-top: 4px; }

  .table-card { background: #111827; border: 1px solid #1f2937; border-radius: 12px; padding: 20px; margin-bottom: 24px; }
  .table-card h2 { color: #fff; font-size: 16px; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; color: #9ca3af; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; padding: 8px 12px; border-bottom: 1px solid #1f2937; }
  td { padding: 10px 12px; border-bottom: 1px solid #111; font-size: 14px; }
  tr:hover { background: #1a1a2e; }

  .badge { display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 11px; font-weight: 600; }
  .badge.explosive { background: #7c3aed22; color: #a78bfa; border: 1px solid #7c3aed44; }
  .badge.hot { background: #ef444422; color: #f87171; border: 1px solid #ef444444; }
  .badge.interesting { background: #f59e0b22; color: #fbbf24; border: 1px solid #f59e0b44; }
  .badge.boring { background: #6b728022; color: #9ca3af; border: 1px solid #6b728044; }
  .badge.unknown { background: #37415122; color: #9ca3af; border: 1px solid #37415144; }

  .bar-chart { display: flex; flex-direction: column; gap: 6px; }
  .bar-row { display: flex; align-items: center; gap: 10px; }
  .bar-label { width: 120px; font-size: 13px; color: #9ca3af; text-align: right; }
  .bar-track { flex: 1; height: 20px; background: #1f2937; border-radius: 4px; overflow: hidden; }
  .bar-fill { height: 100%; border-radius: 4px; min-width: 2px; transition: width 0.5s; }
  .bar-fill.blue { background: linear-gradient(90deg, #3b82f6, #60a5fa); }
  .bar-fill.green { background: linear-gradient(90deg, #10b981, #34d399); }
  .bar-fill.orange { background: linear-gradient(90deg, #f59e0b, #fbbf24); }
  .bar-fill.purple { background: linear-gradient(90deg, #8b5cf6, #a78bfa); }
  .bar-value { width: 50px; font-size: 13px; color: #6b7280; }

  .event-log { max-height: 400px; overflow-y: auto; }
  .event { padding: 8px 12px; border-bottom: 1px solid #111; font-size: 13px; font-family: monospace; }
  .event .time { color: #6b7280; margin-right: 8px; }
  .event .type { color: #4fc3f7; margin-right: 8px; }

  .insight-card { background: #0d1b2a; border: 1px solid #1e3a5f; border-radius: 8px; padding: 16px; margin-bottom: 12px; }
  .insight-card .author { color: #4fc3f7; font-weight: 600; }
  .insight-card .summary { color: #d1d5db; margin-top: 6px; font-size: 14px; line-height: 1.5; }
  .insight-card .meta { color: #6b7280; font-size: 12px; margin-top: 8px; }

  .pulse { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #10b981; margin-right: 6px; animation: pulse 2s infinite; }
  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
</style>
</head>
<body>

<div class="header">
  <h1>🔭 <span>Growth Observatory</span> Dashboard</h1>
  <div class="refresh">Auto-refreshes every 30s | <span id="lastUpdate">Loading...</span></div>
</div>

<div class="tabs">
  <div class="tab active" onclick="switchTab('live')"><span class="pulse"></span> Live Activity</div>
  <div class="tab" onclick="switchTab('database')">Database</div>
  <div class="tab" onclick="switchTab('analysis')">Analysis</div>
  <div class="tab" onclick="switchTab('intelligence')">Intelligence</div>
</div>

<div class="content">
  <!-- TAB 1: LIVE -->
  <div id="live" class="panel active">
    <div class="grid" id="liveStats"></div>
    <div class="grid">
      <div class="table-card">
        <h2>🔥 Growing Accounts Right Now</h2>
        <table><thead><tr><th>Account</th><th>Followers</th><th>Growth/Week</th><th>Status</th></tr></thead>
        <tbody id="hotAccountsTable"></tbody></table>
      </div>
      <div class="table-card">
        <h2>⚡ Growth Events Today</h2>
        <table><thead><tr><th>Account</th><th>Followers</th><th>Growth Rate</th><th>Time</th></tr></thead>
        <tbody id="growthEventsTable"></tbody></table>
      </div>
    </div>
    <div class="table-card">
      <h2>📋 Recent System Events</h2>
      <div class="event-log" id="eventLog"></div>
    </div>
  </div>

  <!-- TAB 2: DATABASE -->
  <div id="database" class="panel">
    <div class="grid" id="dbStats"></div>
    <div class="grid">
      <div class="table-card">
        <h2>How Are Tracked Accounts Growing?</h2>
        <div id="growthStatusChart" class="bar-chart"></div>
      </div>
      <div class="table-card">
        <h2>Account Quality Tiers (by engagement)</h2>
        <div id="tierChart" class="bar-chart"></div>
      </div>
    </div>
    <div class="grid">
      <div class="table-card">
        <h2>Accounts by Follower Size (who are we watching?)</h2>
        <div id="sourceChart" class="bar-chart"></div>
      </div>
      <div class="table-card">
        <h2>What Niches Are These Accounts In?</h2>
        <div id="domainChart" class="bar-chart"></div>
      </div>
    </div>
    <div class="grid">
      <div class="table-card">
        <h2>Top Accounts (celebrities, bots, follow-farmers filtered out)</h2>
        <table><thead><tr><th>Account</th><th>Followers</th><th>Growth/Week</th><th>Status</th><th>Niche</th></tr></thead>
        <tbody id="topAccountsTable"></tbody></table>
      </div>
      <div class="table-card">
        <h2>Fastest Growth Rate (%) — all sizes, repeating doublers = signal</h2>
        <table><thead><tr><th>Account</th><th>Now</th><th>Was</th><th>+Gained</th><th>%/Week</th><th>Range</th></tr></thead>
        <tbody id="fastestGrowingPctTable"></tbody></table>
      </div>
    </div>
    <div class="table-card">
      <h2>Most Followers Gained This Week (raw volume)</h2>
      <table><thead><tr><th>Account</th><th>Now</th><th>Was</th><th>+Gained</th><th>%/Week</th><th>Range</th></tr></thead>
      <tbody id="fastestGrowingVolTable"></tbody></table>
      </div>
    </div>
  </div>

  <!-- TAB 3: ANALYSIS -->
  <div id="analysis" class="panel">
    <div class="grid" id="analysisStats"></div>
    <div class="grid">
      <div class="table-card">
        <h2>📚 Strategy Playbooks</h2>
        <div id="strategyLibrary"></div>
      </div>
      <div class="table-card">
        <h2>🧪 Our Experiments</h2>
        <div id="experiments"></div>
      </div>
    </div>
    <div class="table-card">
      <h2>🔍 Retrospective Insights — What Growing Accounts Changed</h2>
      <div id="retrospectives"></div>
    </div>
    <div class="grid">
      <div class="table-card">
        <h2>⚡ Recent Growth Events</h2>
        <table><thead><tr><th>Account</th><th>Followers</th><th>Growth Before</th><th>Growth After</th><th>Status</th></tr></thead>
        <tbody id="growthEventsAnalysis"></tbody></table>
      </div>
      <div class="table-card">
        <h2>Top Tweets in Brain</h2>
        <table><thead><tr><th>Author</th><th>Likes</th><th>Source</th><th>Content</th></tr></thead>
        <tbody id="topTweetsTable"></tbody></table>
      </div>
    </div>
  </div>

  <!-- INTELLIGENCE TAB -->
  <div id="intelligence" class="panel">
    <div class="grid" id="intelStats"></div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
      <div class="table-card">
        <h2>Discovery Funnel</h2>
        <div id="discoveryFunnel" class="bar-chart"></div>
      </div>
      <div class="table-card">
        <h2>New Data Streams</h2>
        <div id="newTableCounts" class="bar-chart"></div>
      </div>
    </div>

    <div class="table-card">
      <h2>Top Hashtags by Engagement</h2>
      <table><thead><tr><th>Hashtag</th><th>Uses</th><th>Avg Likes</th><th>Ranges</th></tr></thead>
      <tbody id="hashtagsTable"></tbody></table>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
      <div class="table-card">
        <h2>Recent Bio Changes</h2>
        <table><thead><tr><th>Account</th><th>Type</th><th>Followers</th><th>When</th></tr></thead>
        <tbody id="bioChangesTable"></tbody></table>
      </div>
      <div class="table-card">
        <h2>Content Strategy Shifts (Growth-Correlated)</h2>
        <table><thead><tr><th>Account</th><th>Dimension</th><th>From</th><th>To</th><th>Growth</th></tr></thead>
        <tbody id="evolutionTable"></tbody></table>
      </div>
    </div>

    <div class="table-card">
      <h2>Accounts Accelerating Posting Frequency</h2>
      <table><thead><tr><th>Account</th><th>Posts/Day (7d)</th><th>Change</th><th>Reply Ratio</th><th>Followers</th><th>Range</th></tr></thead>
      <tbody id="frequencyTable"></tbody></table>
    </div>

    <div class="table-card">
      <h2>Growth Leaderboard by Follower Range</h2>
      <div id="rangeLeaderboard"></div>
    </div>

    <div class="table-card">
      <h2>Live Ingest Feed</h2>
      <div id="liveFeed" style="max-height:400px;overflow-y:auto;font-size:13px;font-family:monospace"></div>
    </div>
  </div>
</div>

<script>
function switchTab(name) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.getElementById(name).classList.add('active');
  event.target.closest('.tab').classList.add('active');
}

function fmt(n) {
  if (n >= 1e6) return (n/1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n/1e3).toFixed(1) + 'K';
  return String(n);
}

function badge(status) {
  return '<span class="badge ' + (status||'unknown') + '">' + (status||'unknown') + '</span>';
}

function barChart(container, data, color) {
  const max = Math.max(...Object.values(data), 1);
  container.innerHTML = Object.entries(data)
    .sort((a,b) => b[1] - a[1])
    .map(([k,v]) =>
      '<div class="bar-row"><div class="bar-label">' + k + '</div>' +
      '<div class="bar-track"><div class="bar-fill ' + color + '" style="width:' + (v/max*100) + '%"></div></div>' +
      '<div class="bar-value">' + fmt(v) + '</div></div>'
    ).join('');
}

async function loadLive() {
  try {
    const res = await fetch((window.__obsBase||'') + '/api/live');
    const d = await res.json();

    document.getElementById('liveStats').innerHTML =
      '<div class="card"><h3>Tweets Scraped This Hour</h3><div class="value blue">' + d.last_hour.tweets_ingested + '</div><div class="sub">New tweets pulled from account timelines right now</div></div>' +
      '<div class="card"><h3>Follower Checks This Hour</h3><div class="value green">' + d.last_hour.accounts_censused + '</div><div class="sub">Accounts visited to check if follower count changed</div></div>' +
      '<div class="card"><h3>Tweets AI-Analyzed This Hour</h3><div class="value orange">' + d.last_hour.tweets_classified + '</div><div class="sub">Tweets scored by AI for hook type, tone, format, domain</div></div>' +
      '<div class="card"><h3>Growth Spikes Today</h3><div class="value">' + d.growth_events_today.length + '</div><div class="sub">Accounts whose follower growth suddenly accelerated</div></div>';

    document.getElementById('hotAccountsTable').innerHTML = d.hot_accounts.map(a =>
      '<tr><td>@' + a.username + '</td><td>' + fmt(a.followers_count||0) + '</td><td>' +
      (a.growth_rate_7d ? a.growth_rate_7d.toFixed(1) + '%' : '—') + '</td><td>' + badge(a.growth_status) + '</td></tr>'
    ).join('') || '<tr><td colspan="4" style="color:#666">No hot/explosive accounts detected yet</td></tr>';

    document.getElementById('growthEventsTable').innerHTML = d.growth_events_today.map(e =>
      '<tr><td>@' + e.username + '</td><td>' + fmt(e.followers_at_detection||0) + '</td><td>' +
      (e.growth_rate_after ? e.growth_rate_after.toFixed(1) + '%/week' : '—') + '</td><td>' +
      new Date(e.detected_at).toLocaleTimeString() + '</td></tr>'
    ).join('') || '<tr><td colspan="4" style="color:#666">No growth events today — observatory needs 2+ snapshots per account</td></tr>';

    document.getElementById('eventLog').innerHTML = d.recent_events.map(e =>
      '<div class="event"><span class="time">' + new Date(e.created_at).toLocaleTimeString() + '</span>' +
      '<span class="type">' + e.event_type + '</span>' + (e.message||'').substring(0, 100) + '</div>'
    ).join('') || '<div class="event" style="color:#666">No events in last hour</div>';

    document.getElementById('lastUpdate').textContent = new Date().toLocaleTimeString();
  } catch(e) { console.error('Live load error:', e); }
}

async function loadDatabase() {
  try {
    const res = await fetch((window.__obsBase||'') + '/api/database');
    const d = await res.json();

    var tweets = d.table_counts['brain_tweets'] || 0;
    var accounts = d.table_counts['brain_accounts'] || 0;
    var snapshots = d.table_counts['brain_account_snapshots'] || 0;
    var classifications = d.table_counts['brain_classifications'] || 0;
    var growthEvents = d.table_counts['brain_growth_events'] || 0;
    var retros = d.table_counts['brain_retrospective_analyses'] || 0;
    var classRate = tweets > 0 ? Math.round(classifications / tweets * 100) : 0;
    var gd = d.growth_status_distribution || {};
    var growing = (gd['interesting']||0) + (gd['hot']||0) + (gd['explosive']||0);

    document.getElementById('dbStats').innerHTML =
      '<div class="card"><h3>Twitter Accounts We Watch</h3><div class="value blue">' + fmt(accounts) + '</div><div class="sub">Public profiles scraped for tweets, bios, follower counts</div></div>' +
      '<div class="card"><h3>Tweets Scraped</h3><div class="value green">' + fmt(tweets) + '</div><div class="sub">Every tweet from watched accounts — content, likes, views, replies, timing</div></div>' +
      '<div class="card"><h3>Follower Snapshots</h3><div class="value orange">' + fmt(snapshots) + '</div><div class="sub">Follower count checks over time — how we detect who is growing</div></div>' +
      '<div class="card"><h3>Accounts Growing Right Now</h3><div class="value green">' + fmt(growing) + '</div><div class="sub">' + (gd['explosive']||0) + ' explosive, ' + (gd['hot']||0) + ' hot, ' + (gd['interesting']||0) + ' interesting</div></div>' +
      '<div class="card"><h3>Tweets AI-Classified</h3><div class="value">' + fmt(classifications) + '</div><div class="sub">' + classRate + '% coverage — each tweet scored on hook type, tone, format, domain</div></div>' +
      '<div class="card"><h3>Growth Events Detected</h3><div class="value">' + fmt(growthEvents) + '</div><div class="sub">Times an account\\'s follower growth suddenly accelerated</div></div>' +
      '<div class="card"><h3>Growth Analyzed</h3><div class="value">' + fmt(retros) + '</div><div class="sub">Deep analyses of WHAT changed when an account started growing</div></div>' +
      '<div class="card"><h3>Accounts Not Yet Checked</h3><div class="value red">' + fmt(gd['unknown']||0) + '</div><div class="sub">Discovered but no follower snapshot yet — census will reach them</div></div>';

    barChart(document.getElementById('growthStatusChart'), d.growth_status_distribution, 'green');
    barChart(document.getElementById('tierChart'), d.tier_distribution, 'blue');
    barChart(document.getElementById('sourceChart'), d.follower_range_distribution, 'purple');
    barChart(document.getElementById('domainChart'), d.domain_distribution, 'orange');

    document.getElementById('topAccountsTable').innerHTML = (d.top_accounts_by_followers||[]).map(a =>
      '<tr><td>@' + a.username + '</td><td>' + fmt(a.followers_count||0) + '</td><td>' +
      (a.growth_rate_7d ? a.growth_rate_7d.toFixed(1) + '%' : '—') + '</td><td>' + badge(a.growth_status) +
      '</td><td>' + (a.niche_cached || '—') + '</td></tr>'
    ).join('');

    function growthRow(a) {
      var now = a.followers_count || 0;
      var was = a.prev_followers_count || now;
      var gained = now - was;
      return '<tr><td>@' + a.username + '</td><td>' + fmt(now) + '</td><td style="color:#888">' + fmt(was) + '</td>' +
        '<td style="color:#10b981;font-weight:700">+' + fmt(gained > 0 ? gained : 0) + '</td>' +
        '<td>' + (a.growth_rate_7d ? '+' + a.growth_rate_7d.toFixed(1) + '%' : '—') + '</td>' +
        '<td>' + badge(a.follower_range || 'unknown') + '</td></tr>';
    }

    document.getElementById('fastestGrowingPctTable').innerHTML = (d.fastest_growing_pct||[]).map(growthRow).join('')
      || '<tr><td colspan="6" style="color:#666">No growth data yet — census needs time</td></tr>';

    document.getElementById('fastestGrowingVolTable').innerHTML = (d.fastest_growing_vol||[]).map(growthRow).join('')
      || '<tr><td colspan="6" style="color:#666">No volume growth data yet</td></tr>';
  } catch(e) { console.error('DB load error:', e); }
}

async function loadAnalysis() {
  try {
    const res = await fetch((window.__obsBase||'') + '/api/analysis');
    const d = await res.json();

    const sm = d.self_model;
    document.getElementById('analysisStats').innerHTML =
      '<div class="card"><h3>Our Phase</h3><div class="value blue">' + (sm?.growth_phase||'unknown') + '</div><div class="sub">' + (sm?.follower_count||0) + ' followers</div></div>' +
      '<div class="card"><h3>Our Avg Views (7d)</h3><div class="value">' + Math.round(sm?.avg_views_7d||0) + '</div></div>' +
      '<div class="card"><h3>Growth Events Detected</h3><div class="value green">' + (d.growth_events||[]).length + '</div></div>' +
      '<div class="card"><h3>Retrospectives Done</h3><div class="value orange">' + (d.retrospectives||[]).length + '</div></div>';

    // Strategy library
    const libHTML = (d.strategy_library||[]).map(s =>
      '<div class="insight-card"><div class="author">' + s.stage + ' → ' + s.strategy_name +
      (s.win_rate ? ' (' + (s.win_rate*100).toFixed(0) + '% win rate)' : '') + '</div>' +
      '<div class="summary">' + JSON.stringify(s.winning_patterns||{}).substring(0,200) + '</div>' +
      '<div class="meta">Sample: ' + (s.sample_size||0) + ' accounts | Confidence: ' + (s.confidence||'low') + '</div></div>'
    ).join('');
    document.getElementById('strategyLibrary').innerHTML = libHTML || '<div style="color:#666;padding:12px">No playbooks yet — observatory needs retrospective data first</div>';

    // Experiments
    const expHTML = (d.experiments||[]).map(e =>
      '<div class="insight-card"><div class="author">' + e.strategy_name + ' (test #' + e.test_number + ')</div>' +
      '<div class="summary">Verdict: ' + (e.verdict||'in_progress') + (e.diagnosis ? ' — ' + e.diagnosis : '') + '</div>' +
      '<div class="meta">Shelf: ' + (e.shelf_status||'active') + (e.revisit_at ? ' | Revisit: ' + new Date(e.revisit_at).toLocaleDateString() : '') + '</div></div>'
    ).join('');
    document.getElementById('experiments').innerHTML = expHTML || '<div style="color:#666;padding:12px">No experiments running yet</div>';

    // Retrospectives
    const retroHTML = (d.retrospectives||[]).map(r =>
      '<div class="insight-card"><div class="author">@' + r.username + '</div>' +
      '<div class="summary">' + (r.analysis_summary || 'No AI summary') + '</div>' +
      '<div class="meta">Changes: ' + ((r.key_changes||[]).length) + ' detected | ' + new Date(r.analyzed_at).toLocaleDateString() + '</div></div>'
    ).join('');
    document.getElementById('retrospectives').innerHTML = retroHTML || '<div style="color:#666;padding:12px">No retrospectives yet — waiting for growth events</div>';

    // Growth events
    document.getElementById('growthEventsAnalysis').innerHTML = (d.growth_events||[]).map(e =>
      '<tr><td>@' + e.username + '</td><td>' + fmt(e.followers_at_detection||0) + '</td><td>' +
      (e.growth_rate_before ? e.growth_rate_before.toFixed(1) + '%' : '—') + '</td><td style="color:#10b981">' +
      (e.growth_rate_after ? e.growth_rate_after.toFixed(1) + '%' : '—') + '</td><td>' + (e.retrospective_status||'pending') + '</td></tr>'
    ).join('') || '<tr><td colspan="5" style="color:#666">No growth events yet</td></tr>';

    // Top tweets
    document.getElementById('topTweetsTable').innerHTML = (d.top_tweets||[]).map(t =>
      '<tr><td>@' + t.author_username + '</td><td>' + fmt(t.likes||0) + '</td><td>' + t.discovery_source +
      '</td><td style="max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + (t.content||'').substring(0,80) + '</td></tr>'
    ).join('');
  } catch(e) { console.error('Analysis load error:', e); }
}

// Intelligence tab loader
async function loadIntelligence() {
  try {
    const res = await fetch((window.__obsBase||'') + '/api/intelligence');
    const d = await res.json();

    // Stats cards
    var funnel = d.discovery_funnel || {};
    document.getElementById('intelStats').innerHTML =
      '<div class="card"><h3>Discovery Funnel</h3><div class="value blue">' + fmt(funnel.total_discovered) + '</div><div class="sub">Total accounts discovered</div></div>' +
      '<div class="card"><h3>Censused</h3><div class="value green">' + fmt(funnel.censused) + '</div><div class="sub">' + (funnel.total_discovered ? Math.round(funnel.censused/funnel.total_discovered*100) : 0) + '% of discovered</div></div>' +
      '<div class="card"><h3>Classified</h3><div class="value orange">' + fmt(funnel.classified) + '</div><div class="sub">' + (funnel.total_discovered ? Math.round(funnel.classified/funnel.total_discovered*100) : 0) + '% profiled</div></div>' +
      '<div class="card"><h3>Growing</h3><div class="value green">' + fmt(funnel.growing) + '</div><div class="sub">interesting + hot + explosive</div></div>';

    // Discovery funnel bar chart
    var funnelEl = document.getElementById('discoveryFunnel');
    barChart(funnelEl, { 'Discovered': funnel.total_discovered, 'Censused': funnel.censused, 'Classified': funnel.classified, 'Growing': funnel.growing }, 'blue');

    // New table counts
    var ntc = d.new_table_counts || {};
    var ntcEl = document.getElementById('newTableCounts');
    barChart(ntcEl, {
      'Hashtags': ntc['brain_tweet_hashtags'] ?? 0,
      'Bio Changes': ntc['brain_bio_changes'] ?? 0,
      'Frequency': ntc['brain_posting_frequency'] ?? 0,
      'Evolution': ntc['brain_content_evolution'] ?? 0
    }, 'green');

    // Hashtags
    document.getElementById('hashtagsTable').innerHTML = (d.top_hashtags||[]).map(function(h) {
      var rangeStr = Object.entries(h.ranges||{}).map(function(e){return e[0]+':'+e[1]}).join(', ');
      return '<tr><td>#' + h.hashtag + '</td><td>' + h.count + '</td><td>' + fmt(h.avg_likes) + '</td><td style="font-size:11px;color:#888">' + rangeStr + '</td></tr>';
    }).join('');

    // Bio changes
    document.getElementById('bioChangesTable').innerHTML = (d.bio_changes||[]).map(function(b) {
      return '<tr><td>@' + b.username + '</td><td>' + badge(b.change_type) + '</td><td>' + fmt(b.followers_at_change||0) + '</td><td style="color:#888">' + new Date(b.changed_at).toLocaleDateString() + '</td></tr>';
    }).join('');

    // Content evolution
    document.getElementById('evolutionTable').innerHTML = (d.content_evolutions||[]).map(function(e) {
      return '<tr><td>@' + e.username + '</td><td>' + e.dimension + '</td><td>' + (e.old_primary||'?') + '</td><td>' + (e.new_primary||'?') + '</td><td style="color:#10b981">+' + ((e.growth_rate_after||0)*100).toFixed(1) + '%</td></tr>';
    }).join('');

    // Frequency trends
    document.getElementById('frequencyTable').innerHTML = (d.frequency_trends||[]).map(function(f) {
      return '<tr><td>@' + f.username + '</td><td>' + (f.posts_per_day_7d||0).toFixed(1) + '</td><td style="color:#10b981">+' + (f.frequency_delta_7d||0).toFixed(1) + '/day</td><td>' + ((f.reply_ratio_7d||0)*100).toFixed(0) + '%</td><td>' + fmt(f.followers_at_measurement||0) + '</td><td>' + badge(f.follower_range) + '</td></tr>';
    }).join('');

    // Growth leaderboard by range
    var lb = d.growth_leaderboard || {};
    var lbHtml = '';
    var ranges = ['nano','micro','small','mid','large','mega','celebrity'];
    for (var ri = 0; ri < ranges.length; ri++) {
      var r = ranges[ri];
      var accounts = lb[r] || [];
      if (accounts.length === 0) continue;
      lbHtml += '<h3 style="color:#4fc3f7;margin:12px 0 6px;font-size:13px;text-transform:uppercase">' + r + '</h3>';
      lbHtml += '<table><thead><tr><th>Account</th><th>Followers</th><th>7d Growth</th><th>Status</th></tr></thead><tbody>';
      for (var ai = 0; ai < accounts.length; ai++) {
        var a = accounts[ai];
        lbHtml += '<tr><td>@' + a.username + '</td><td>' + fmt(a.followers_count||0) + '</td><td style="color:#10b981">+' + ((a.growth_rate_7d||0)).toFixed(1) + '%</td><td>' + badge(a.growth_status) + '</td></tr>';
      }
      lbHtml += '</tbody></table>';
    }
    document.getElementById('rangeLeaderboard').innerHTML = lbHtml;

  } catch(e) { console.error('Intelligence load error:', e); }
}

// SSE live feed connection
function connectLiveFeed() {
  try {
    var es = new EventSource((window.__obsBase||'') + '/api/stream');
    var feedEl = document.getElementById('liveFeed');
    es.onmessage = function(e) {
      try {
        var msg = JSON.parse(e.data);
        if (msg.type === 'tweets' && msg.data) {
          for (var i = 0; i < msg.data.length; i++) {
            var t = msg.data[i];
            var div = document.createElement('div');
            div.style.cssText = 'padding:6px 8px;border-bottom:1px solid #1f2937;';
            div.innerHTML = '<span style="color:#4fc3f7">@' + t.author_username + '</span> ' +
              '<span style="color:#666">[' + (t.discovery_source||'?') + ']</span> ' +
              '<span style="color:#10b981">' + fmt(t.likes||0) + 'L ' + fmt(t.views||0) + 'V</span> ' +
              '<span>' + (t.content||'').substring(0,100) + '</span>';
            feedEl.insertBefore(div, feedEl.firstChild);
            if (feedEl.children.length > 50) feedEl.removeChild(feedEl.lastChild);
          }
        }
      } catch(ee) {}
    };
    es.onerror = function() { setTimeout(connectLiveFeed, 5000); es.close(); };
  } catch(e) {}
}

// Initial load
loadLive(); loadDatabase(); loadAnalysis(); loadIntelligence();
connectLiveFeed();

// Auto-refresh
setInterval(loadLive, 30000);
setInterval(loadDatabase, 60000);
setInterval(loadAnalysis, 120000);
setInterval(loadIntelligence, 60000);
</script>
</body>
</html>`;
}

// =============================================================================
// INTELLIGENCE API — New data streams (hashtags, bio changes, frequency, evolution)
// =============================================================================

export async function getIntelligenceData() {
  const s = getSupabaseClient();
  const d7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const d30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // Top hashtags by engagement (last 30 days)
  let topHashtags: any[] = [];
  try {
    const { data } = await s.from('brain_tweet_hashtags')
      .select('hashtag, likes, views, follower_range')
      .order('likes', { ascending: false })
      .limit(200);
    // Aggregate by hashtag
    const agg: Record<string, { count: number; total_likes: number; total_views: number; ranges: Record<string, number> }> = {};
    for (const row of data ?? []) {
      if (!agg[row.hashtag]) agg[row.hashtag] = { count: 0, total_likes: 0, total_views: 0, ranges: {} };
      agg[row.hashtag].count++;
      agg[row.hashtag].total_likes += row.likes ?? 0;
      agg[row.hashtag].total_views += row.views ?? 0;
      if (row.follower_range) agg[row.hashtag].ranges[row.follower_range] = (agg[row.hashtag].ranges[row.follower_range] ?? 0) + 1;
    }
    topHashtags = Object.entries(agg)
      .map(([tag, d]) => ({ hashtag: tag, count: d.count, avg_likes: Math.round(d.total_likes / d.count), total_views: d.total_views, ranges: d.ranges }))
      .sort((a, b) => b.avg_likes - a.avg_likes)
      .slice(0, 30);
  } catch { /* table may not exist */ }

  // Recent bio changes
  let bioChanges: any[] = [];
  try {
    const { data } = await s.from('brain_bio_changes')
      .select('username, change_type, old_bio, new_bio, followers_at_change, follower_range, changed_at')
      .order('changed_at', { ascending: false })
      .limit(20);
    bioChanges = data ?? [];
  } catch {}

  // Posting frequency trends — accounts accelerating
  let frequencyTrends: any[] = [];
  try {
    const { data } = await s.from('brain_posting_frequency')
      .select('username, posts_per_day_7d, frequency_delta_7d, frequency_trend, reply_ratio_7d, followers_at_measurement, follower_range, measured_at')
      .eq('frequency_trend', 'accelerating')
      .order('frequency_delta_7d', { ascending: false })
      .limit(20);
    frequencyTrends = data ?? [];
  } catch {}

  // Content evolution events (growth-correlated only)
  let contentEvolutions: any[] = [];
  try {
    const { data } = await s.from('brain_content_evolution')
      .select('username, dimension, old_primary, new_primary, growth_rate_after, growth_correlated, follower_range, detected_at')
      .eq('growth_correlated', true)
      .order('detected_at', { ascending: false })
      .limit(20);
    contentEvolutions = data ?? [];
  } catch {}

  // Discovery funnel — how accounts flow through the pipeline
  const { count: totalAccounts } = await s.from('brain_accounts').select('*', { count: 'exact', head: true });
  const { count: withSnapshots } = await s.from('brain_accounts').select('*', { count: 'exact', head: true }).gte('snapshot_count', 1);
  const { count: withClassifications } = await s.from('brain_account_profiles').select('*', { count: 'exact', head: true });
  const { count: growing } = await s.from('brain_accounts').select('*', { count: 'exact', head: true }).in('growth_status', ['interesting', 'hot', 'explosive']);

  // Follower range × growth status matrix
  const { data: rangeGrowthData } = await s.from('brain_accounts')
    .select('follower_range, growth_status')
    .eq('is_active', true)
    .not('follower_range', 'is', null);
  const rangeGrowthMatrix: Record<string, Record<string, number>> = {};
  for (const row of rangeGrowthData ?? []) {
    const range = row.follower_range ?? 'unknown';
    const status = row.growth_status ?? 'unknown';
    if (!rangeGrowthMatrix[range]) rangeGrowthMatrix[range] = {};
    rangeGrowthMatrix[range][status] = (rangeGrowthMatrix[range][status] ?? 0) + 1;
  }

  // Growth leaderboard by follower range
  const ranges = ['nano', 'micro', 'small', 'mid', 'large', 'mega', 'celebrity'];
  const growthLeaderboard: Record<string, any[]> = {};
  for (const range of ranges) {
    const { data } = await s.from('brain_accounts')
      .select('username, followers_count, growth_rate_7d, growth_status')
      .eq('follower_range', range)
      .not('growth_rate_7d', 'is', null)
      .gt('growth_rate_7d', 0)
      .order('growth_rate_7d', { ascending: false })
      .limit(5);
    growthLeaderboard[range] = data ?? [];
  }

  // New table counts
  const newTableCounts: Record<string, number> = {};
  for (const table of ['brain_tweet_hashtags', 'brain_bio_changes', 'brain_posting_frequency', 'brain_content_evolution']) {
    try {
      const { count } = await s.from(table).select('*', { count: 'exact', head: true });
      newTableCounts[table] = count ?? 0;
    } catch {
      newTableCounts[table] = -1; // Not yet created
    }
  }

  return {
    top_hashtags: topHashtags,
    bio_changes: bioChanges,
    frequency_trends: frequencyTrends,
    content_evolutions: contentEvolutions,
    discovery_funnel: {
      total_discovered: totalAccounts ?? 0,
      censused: withSnapshots ?? 0,
      classified: withClassifications ?? 0,
      growing: growing ?? 0,
    },
    range_growth_matrix: rangeGrowthMatrix,
    growth_leaderboard: growthLeaderboard,
    new_table_counts: newTableCounts,
  };
}

// =============================================================================
// Server
// =============================================================================

// Only start standalone server if run directly (not imported as module)
const isStandalone = require.main === module || process.argv[1]?.includes('observatory/server');
if (!isStandalone) {
  // Imported as module — don't start standalone server
} else {

const server = createServer(async (req, res) => {
  const url = req.url || '/';

  try {
    if (url === '/api/live') {
      const data = await getLiveData();
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify(data));
    } else if (url === '/api/database') {
      const data = await getDatabaseData();
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify(data));
    } else if (url === '/api/analysis') {
      const data = await getAnalysisData();
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify(data));
    } else if (url === '/api/intelligence') {
      const data = await getIntelligenceData();
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify(data));
    } else if (url === '/api/stream') {
      // SSE endpoint for real-time tweet ingest
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      });
      res.write('data: {"type":"connected"}\n\n');

      const interval = setInterval(async () => {
        try {
          const s = getSupabaseClient();
          const since = new Date(Date.now() - 30 * 1000).toISOString(); // Last 30 seconds
          const { data: recentTweets } = await s.from('brain_tweets')
            .select('tweet_id, author_username, content, likes, views, retweets, discovery_source, author_followers, posted_at')
            .gte('created_at', since)
            .order('created_at', { ascending: false })
            .limit(10);

          if (recentTweets && recentTweets.length > 0) {
            res.write(`data: ${JSON.stringify({ type: 'tweets', data: recentTweets })}\n\n`);
          }
        } catch {}
      }, 10000); // Poll every 10s

      req.on('close', () => clearInterval(interval));
      return; // Don't end response — SSE stays open
    } else {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(getHTML());
    }
  } catch (err: any) {
    console.error('Dashboard error:', err.message);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  }
});

server.listen(PORT, () => {
  console.log(`\n Growth Observatory Dashboard running at http://localhost:${PORT}\n`);
});

} // end isStandalone
