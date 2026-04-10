/**
 * DATA QUALITY DASHBOARD
 *
 * Shows the truth about the data pipeline:
 * - Scraping success/failure rates
 * - Outcomes integrity (real vs simulated vs null)
 * - Learning system status (real_data vs fallback_defaults)
 * - Follower tracking health
 */

import { getSupabaseClient } from '../db';

export async function generateDataQualityHTML(): Promise<string> {
  const supabase = getSupabaseClient();

  // 1. OUTCOMES INTEGRITY
  const { count: totalOutcomes } = await supabase
    .from('outcomes')
    .select('*', { count: 'exact', head: true });

  const { count: simulatedCount } = await supabase
    .from('outcomes')
    .select('*', { count: 'exact', head: true })
    .eq('simulated', true);

  const { count: realWithViews } = await supabase
    .from('outcomes')
    .select('*', { count: 'exact', head: true })
    .eq('simulated', false)
    .not('views', 'is', null)
    .gt('views', 0);

  const { count: realNullViews } = await supabase
    .from('outcomes')
    .select('*', { count: 'exact', head: true })
    .eq('simulated', false)
    .is('views', null);

  const { count: realZeroViews } = await supabase
    .from('outcomes')
    .select('*', { count: 'exact', head: true })
    .eq('simulated', false)
    .not('views', 'is', null)
    .eq('views', 0);

  const { count: withProvenance } = await supabase
    .from('outcomes')
    .select('*', { count: 'exact', head: true })
    .eq('data_source', 'playwright_scraper');

  const { count: nullEngagementRate } = await supabase
    .from('outcomes')
    .select('*', { count: 'exact', head: true })
    .eq('simulated', false)
    .is('engagement_rate', null);

  // 2. SCRAPE AUDIT LOG (may not exist yet if migration hasn't run)
  let scrapeStats = { total: 0, success: 0, failed: 0, mismatch: 0, lastSuccess: 'N/A' };
  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { count: scrapeTotal } = await supabase
      .from('scrape_audit_log')
      .select('*', { count: 'exact', head: true })
      .gte('attempted_at', oneDayAgo);

    const { count: scrapeSuccess } = await supabase
      .from('scrape_audit_log')
      .select('*', { count: 'exact', head: true })
      .gte('attempted_at', oneDayAgo)
      .eq('collection_status', 'success');

    const { count: scrapeFailed } = await supabase
      .from('scrape_audit_log')
      .select('*', { count: 'exact', head: true })
      .gte('attempted_at', oneDayAgo)
      .in('collection_status', ['failed', 'timeout', 'auth_failed', 'consent_blocked']);

    const { count: scrapeMismatch } = await supabase
      .from('scrape_audit_log')
      .select('*', { count: 'exact', head: true })
      .gte('attempted_at', oneDayAgo)
      .eq('collection_status', 'content_mismatch');

    const { data: lastSuccessRow } = await supabase
      .from('scrape_audit_log')
      .select('attempted_at')
      .eq('collection_status', 'success')
      .order('attempted_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    scrapeStats = {
      total: scrapeTotal || 0,
      success: scrapeSuccess || 0,
      failed: scrapeFailed || 0,
      mismatch: scrapeMismatch || 0,
      lastSuccess: lastSuccessRow?.attempted_at
        ? new Date(lastSuccessRow.attempted_at).toLocaleString()
        : 'Never',
    };
  } catch {
    // Table may not exist yet
  }

  // 3. LEARNING SYSTEM STATE (may not exist yet)
  let learningStates: Array<{ system_name: string; mode: string; sample_count: number; min_required: number; run_at: string }> = [];
  try {
    const systems = ['learn_job', 'growth_intelligence', 'archetype_learning', 'central_controller'];
    for (const sys of systems) {
      const { data } = await supabase
        .from('learning_system_state')
        .select('system_name, mode, sample_count, min_required, run_at')
        .eq('system_name', sys)
        .order('run_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) learningStates.push(data);
    }
  } catch {
    // Table may not exist yet
  }

  // 4. FOLLOWER TRACKING
  const { count: followerTrackingRows } = await supabase
    .from('post_follower_tracking')
    .select('*', { count: 'exact', head: true });

  const { count: followerSnapshotRows } = await supabase
    .from('follower_snapshots')
    .select('*', { count: 'exact', head: true });

  const { count: postsWithBaseline } = await supabase
    .from('post_follower_tracking')
    .select('*', { count: 'exact', head: true })
    .eq('hours_after_post', 0);

  const { count: postsWithFollowup } = await supabase
    .from('post_follower_tracking')
    .select('*', { count: 'exact', head: true })
    .eq('hours_after_post', 24);

  // Build HTML
  const total = totalOutcomes || 0;
  const simPct = total > 0 ? ((simulatedCount || 0) / total * 100).toFixed(1) : '0';
  const realViewsPct = total > 0 ? ((realWithViews || 0) / total * 100).toFixed(1) : '0';
  const realNonSim = total - (simulatedCount || 0);
  const nullERPct = realNonSim > 0 ? ((nullEngagementRate || 0) / realNonSim * 100).toFixed(1) : '0';

  const modeColor = (mode: string) => {
    if (mode === 'real_data') return '#22c55e';
    if (mode === 'fallback_defaults') return '#ef4444';
    return '#f59e0b';
  };

  return `<!DOCTYPE html>
<html><head><title>xBOT Data Quality</title>
<style>
  body { font-family: -apple-system, sans-serif; background: #0f172a; color: #e2e8f0; padding: 20px; max-width: 900px; margin: 0 auto; }
  h1 { color: #38bdf8; } h2 { color: #94a3b8; border-bottom: 1px solid #334155; padding-bottom: 8px; margin-top: 32px; }
  .card { background: #1e293b; border-radius: 8px; padding: 16px; margin: 12px 0; }
  .metric { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #334155; }
  .metric:last-child { border-bottom: none; }
  .label { color: #94a3b8; } .value { font-weight: bold; }
  .good { color: #22c55e; } .bad { color: #ef4444; } .warn { color: #f59e0b; } .neutral { color: #e2e8f0; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; }
  .truth-box { background: #1e1e2e; border: 2px solid #ef4444; border-radius: 8px; padding: 20px; margin: 20px 0; }
  .truth-box h3 { color: #ef4444; margin-top: 0; }
</style></head><body>
<h1>Data Quality Dashboard</h1>
<p style="color:#64748b">Generated: ${new Date().toLocaleString()}</p>

<div class="truth-box">
  <h3>THE TRUTH</h3>
  <p>Your system is learning from <strong class="${(realWithViews || 0) > 0 ? 'good' : 'bad'}">${realWithViews || 0}</strong> real outcomes with views.</p>
  <p>Learning systems status: ${learningStates.length === 0 ? '<span class="warn">No data yet (run migration + jobs first)</span>' :
    learningStates.map(s => `<span style="color:${modeColor(s.mode)}">${s.system_name}: ${s.mode}</span>`).join(' | ')}</p>
  <p>Follower tracking: <strong class="${(followerTrackingRows || 0) > 0 ? 'good' : 'bad'}">${(followerTrackingRows || 0) > 0 ? 'Active' : 'BROKEN'}</strong> (${followerTrackingRows || 0} rows in post_follower_tracking)</p>
</div>

<h2>1. Outcomes Integrity</h2>
<div class="card">
  <div class="metric"><span class="label">Total outcomes rows</span><span class="value neutral">${total}</span></div>
  <div class="metric"><span class="label">Simulated (contaminated)</span><span class="value ${(simulatedCount || 0) > 0 ? 'bad' : 'good'}">${simulatedCount || 0} (${simPct}%)</span></div>
  <div class="metric"><span class="label">Real with views > 0</span><span class="value ${(realWithViews || 0) > 0 ? 'good' : 'bad'}">${realWithViews || 0} (${realViewsPct}%)</span></div>
  <div class="metric"><span class="label">Real with NULL views (never scraped)</span><span class="value warn">${realNullViews || 0}</span></div>
  <div class="metric"><span class="label">Real with 0 views (scraped, truly zero)</span><span class="value neutral">${realZeroViews || 0}</span></div>
  <div class="metric"><span class="label">With provenance (data_source=playwright_scraper)</span><span class="value ${(withProvenance || 0) > 0 ? 'good' : 'warn'}">${withProvenance || 0}</span></div>
  <div class="metric"><span class="label">Missing engagement_rate (real only)</span><span class="value ${(nullEngagementRate || 0) > 0 ? 'warn' : 'good'}">${nullEngagementRate || 0} (${nullERPct}%)</span></div>
</div>

<h2>2. Scraping Health (Last 24h)</h2>
<div class="card">
  <div class="metric"><span class="label">Total scrape attempts</span><span class="value neutral">${scrapeStats.total}</span></div>
  <div class="metric"><span class="label">Successful</span><span class="value good">${scrapeStats.success}</span></div>
  <div class="metric"><span class="label">Failed</span><span class="value ${scrapeStats.failed > 0 ? 'bad' : 'good'}">${scrapeStats.failed}</span></div>
  <div class="metric"><span class="label">Content mismatch</span><span class="value ${scrapeStats.mismatch > 0 ? 'warn' : 'good'}">${scrapeStats.mismatch}</span></div>
  <div class="metric"><span class="label">Success rate</span><span class="value ${scrapeStats.total > 0 && scrapeStats.success / scrapeStats.total > 0.8 ? 'good' : 'bad'}">${scrapeStats.total > 0 ? (scrapeStats.success / scrapeStats.total * 100).toFixed(0) : 0}%</span></div>
  <div class="metric"><span class="label">Last successful scrape</span><span class="value neutral">${scrapeStats.lastSuccess}</span></div>
</div>

<h2>3. Learning System Status</h2>
<div class="card">
  ${learningStates.length === 0
    ? '<div class="metric"><span class="label">No learning state data</span><span class="value warn">Run migration + jobs first</span></div>'
    : learningStates.map(s => `
      <div class="metric">
        <span class="label">${s.system_name}</span>
        <span class="value"><span class="badge" style="background:${modeColor(s.mode)}20;color:${modeColor(s.mode)}">${s.mode}</span> (${s.sample_count}/${s.min_required} samples, ${new Date(s.run_at).toLocaleString()})</span>
      </div>
    `).join('')}
</div>

<h2>4. Follower Tracking</h2>
<div class="card">
  <div class="metric"><span class="label">post_follower_tracking rows</span><span class="value ${(followerTrackingRows || 0) > 0 ? 'good' : 'bad'}">${followerTrackingRows || 0}</span></div>
  <div class="metric"><span class="label">follower_snapshots rows</span><span class="value neutral">${followerSnapshotRows || 0}</span></div>
  <div class="metric"><span class="label">Posts with baseline (0h)</span><span class="value neutral">${postsWithBaseline || 0}</span></div>
  <div class="metric"><span class="label">Posts with 24h followup</span><span class="value ${(postsWithFollowup || 0) > 0 ? 'good' : 'warn'}">${postsWithFollowup || 0}</span></div>
  <div class="metric"><span class="label">Attribution gap (baseline - 24h)</span><span class="value warn">${(postsWithBaseline || 0) - (postsWithFollowup || 0)}</span></div>
</div>

</body></html>`;
}
