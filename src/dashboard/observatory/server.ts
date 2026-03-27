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

async function getLiveData() {
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

async function getDatabaseData() {
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

  // Tweet sources
  const { data: sources } = await s.from('brain_tweets')
    .select('discovery_source')
    .limit(10000);

  const sourceDist: Record<string, number> = {};
  for (const t of sources ?? []) {
    sourceDist[t.discovery_source] = (sourceDist[t.discovery_source] ?? 0) + 1;
  }

  // Classification domains
  const { data: domains } = await s.from('brain_classifications')
    .select('domain');

  const domainDist: Record<string, number> = {};
  for (const c of domains ?? []) {
    domainDist[c.domain ?? 'unknown'] = (domainDist[c.domain ?? 'unknown'] ?? 0) + 1;
  }

  // Top 20 accounts by followers
  const { data: topAccounts } = await s.from('brain_accounts')
    .select('username, followers_count, growth_rate_7d, growth_status, niche_cached, account_type_cached')
    .eq('is_active', true)
    .order('followers_count', { ascending: false, nullsFirst: false })
    .limit(20);

  // Top 20 fastest growing
  const { data: fastestGrowing } = await s.from('brain_accounts')
    .select('username, followers_count, growth_rate_7d, growth_status')
    .not('growth_rate_7d', 'is', null)
    .gt('growth_rate_7d', 0)
    .order('growth_rate_7d', { ascending: false })
    .limit(20);

  return {
    table_counts: counts,
    growth_status_distribution: growthDist,
    tier_distribution: tiers,
    tweet_source_distribution: sourceDist,
    domain_distribution: domainDist,
    top_accounts_by_followers: topAccounts ?? [],
    fastest_growing: fastestGrowing ?? [],
  };
}

async function getAnalysisData() {
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

function getHTML(): string {
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
  <div class="tab" onclick="switchTab('database')">📊 Database</div>
  <div class="tab" onclick="switchTab('analysis')">🧠 Analysis</div>
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
        <h2>📊 Growth Status Distribution</h2>
        <div id="growthStatusChart" class="bar-chart"></div>
      </div>
      <div class="table-card">
        <h2>🏷️ Tier Distribution</h2>
        <div id="tierChart" class="bar-chart"></div>
      </div>
    </div>
    <div class="grid">
      <div class="table-card">
        <h2>📡 Tweet Sources</h2>
        <div id="sourceChart" class="bar-chart"></div>
      </div>
      <div class="table-card">
        <h2>🌐 Domains Classified</h2>
        <div id="domainChart" class="bar-chart"></div>
      </div>
    </div>
    <div class="grid">
      <div class="table-card">
        <h2>🏆 Top Accounts by Followers</h2>
        <table><thead><tr><th>Account</th><th>Followers</th><th>Growth/Week</th><th>Status</th><th>Niche</th></tr></thead>
        <tbody id="topAccountsTable"></tbody></table>
      </div>
      <div class="table-card">
        <h2>🚀 Fastest Growing</h2>
        <table><thead><tr><th>Account</th><th>Followers</th><th>Growth/Week</th><th>Status</th></tr></thead>
        <tbody id="fastestGrowingTable"></tbody></table>
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
        <h2>🏆 Top Tweets in Brain</h2>
        <table><thead><tr><th>Author</th><th>Likes</th><th>Source</th><th>Content</th></tr></thead>
        <tbody id="topTweetsTable"></tbody></table>
      </div>
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
    const res = await fetch('/api/live');
    const d = await res.json();

    document.getElementById('liveStats').innerHTML =
      '<div class="card"><h3>Tweets Ingested (1h)</h3><div class="value blue">' + d.last_hour.tweets_ingested + '</div></div>' +
      '<div class="card"><h3>Accounts Censused (1h)</h3><div class="value green">' + d.last_hour.accounts_censused + '</div></div>' +
      '<div class="card"><h3>Tweets Classified (1h)</h3><div class="value orange">' + d.last_hour.tweets_classified + '</div></div>' +
      '<div class="card"><h3>Growth Events Today</h3><div class="value">' + d.growth_events_today.length + '</div></div>';

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
    const res = await fetch('/api/database');
    const d = await res.json();

    const total = Object.values(d.table_counts).reduce((s,v) => s + v, 0);
    const accounts = d.table_counts['brain_accounts'] || 0;
    const snapshots = d.table_counts['brain_account_snapshots'] || 0;

    document.getElementById('dbStats').innerHTML =
      '<div class="card"><h3>Total Rows</h3><div class="value">' + fmt(total) + '</div></div>' +
      '<div class="card"><h3>Accounts Tracked</h3><div class="value blue">' + fmt(accounts) + '</div></div>' +
      '<div class="card"><h3>Tweets Collected</h3><div class="value green">' + fmt(d.table_counts['brain_tweets']||0) + '</div></div>' +
      '<div class="card"><h3>Follower Snapshots</h3><div class="value orange">' + fmt(snapshots) + '</div></div>' +
      '<div class="card"><h3>Classifications</h3><div class="value">' + fmt(d.table_counts['brain_classifications']||0) + '</div></div>' +
      '<div class="card"><h3>Growth Events</h3><div class="value">' + fmt(d.table_counts['brain_growth_events']||0) + '</div></div>' +
      '<div class="card"><h3>Retrospectives</h3><div class="value">' + fmt(d.table_counts['brain_retrospective_analyses']||0) + '</div></div>' +
      '<div class="card"><h3>Strategy Playbooks</h3><div class="value">' + fmt(d.table_counts['brain_strategy_library']||0) + '</div></div>';

    barChart(document.getElementById('growthStatusChart'), d.growth_status_distribution, 'green');
    barChart(document.getElementById('tierChart'), d.tier_distribution, 'blue');
    barChart(document.getElementById('sourceChart'), d.tweet_source_distribution, 'purple');
    barChart(document.getElementById('domainChart'), d.domain_distribution, 'orange');

    document.getElementById('topAccountsTable').innerHTML = (d.top_accounts_by_followers||[]).map(a =>
      '<tr><td>@' + a.username + '</td><td>' + fmt(a.followers_count||0) + '</td><td>' +
      (a.growth_rate_7d ? a.growth_rate_7d.toFixed(1) + '%' : '—') + '</td><td>' + badge(a.growth_status) +
      '</td><td>' + (a.niche_cached || '—') + '</td></tr>'
    ).join('');

    document.getElementById('fastestGrowingTable').innerHTML = (d.fastest_growing||[]).map(a =>
      '<tr><td>@' + a.username + '</td><td>' + fmt(a.followers_count||0) + '</td><td style="color:#10b981;font-weight:700">' +
      (a.growth_rate_7d ? '+' + a.growth_rate_7d.toFixed(1) + '%' : '—') + '</td><td>' + badge(a.growth_status) + '</td></tr>'
    ).join('') || '<tr><td colspan="4" style="color:#666">No growth data yet — census needs time</td></tr>';
  } catch(e) { console.error('DB load error:', e); }
}

async function loadAnalysis() {
  try {
    const res = await fetch('/api/analysis');
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

// Initial load
loadLive(); loadDatabase(); loadAnalysis();

// Auto-refresh
setInterval(loadLive, 30000);
setInterval(loadDatabase, 60000);
setInterval(loadAnalysis, 120000);
</script>
</body>
</html>`;
}

// =============================================================================
// Server
// =============================================================================

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
  console.log(`\n🔭 Growth Observatory Dashboard running at http://localhost:${PORT}\n`);
});
