#!/usr/bin/env tsx
/**
 * PRE-LAUNCH VALIDATOR
 *
 * Tests every subsystem WITHOUT posting anything.
 * Run before starting the daemon to catch problems early.
 *
 * Usage: npx tsx scripts/ops/pre-launch-validator.ts
 */

import './load-env';

const results: { name: string; status: 'PASS' | 'FAIL' | 'WARN'; detail: string }[] = [];

function pass(name: string, detail: string) { results.push({ name, status: 'PASS', detail }); }
function fail(name: string, detail: string) { results.push({ name, status: 'FAIL', detail }); }
function warn(name: string, detail: string) { results.push({ name, status: 'WARN', detail }); }

async function main() {
  console.log('\n  ====  PRE-LAUNCH VALIDATOR  ====\n');

  // ── 1. ENV VARS ──────────────────────────────────────────────
  console.log('  [1/10] Checking env vars...');
  const required: Record<string, string | undefined> = {
    DATABASE_URL: process.env.DATABASE_URL,
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    TWITTER_USERNAME: process.env.TWITTER_USERNAME,
    RAMP_START_DATE: process.env.RAMP_START_DATE,
  };
  for (const [key, val] of Object.entries(required)) {
    if (!val) fail(`ENV: ${key}`, 'Missing');
    else pass(`ENV: ${key}`, val.substring(0, 12) + '...');
  }

  // ── 2. SAFETY FLAGS ─────────────────────────────────────────
  console.log('  [2/10] Checking safety flags...');
  const { isShadowMode } = await import('../../src/safety/shadowMode');
  if (isShadowMode()) fail('SHADOW_MODE', 'ON — posting will be blocked');
  else pass('SHADOW_MODE', 'off (live mode)');

  if (process.env.X_ACTIONS_ENABLED !== 'true') fail('X_ACTIONS_ENABLED', `"${process.env.X_ACTIONS_ENABLED}" — must be "true"`);
  else pass('X_ACTIONS_ENABLED', 'true');

  if (process.env.POSTING_ENABLED !== 'true') fail('POSTING_ENABLED', `"${process.env.POSTING_ENABLED}" — must be "true"`);
  else pass('POSTING_ENABLED', 'true');

  if (process.env.ENABLE_REPLIES !== 'true') warn('ENABLE_REPLIES', `"${process.env.ENABLE_REPLIES}" — replies may be disabled`);
  else pass('ENABLE_REPLIES', 'true');

  // ── 3. ACTION GATE ──────────────────────────────────────────
  console.log('  [3/10] Checking action gate...');
  try {
    const { checkActionGate } = await import('../../src/safety/actionGate');
    const gate = checkActionGate('pre_launch_test');
    if (gate.allowed) pass('ACTION_GATE', 'allowed');
    else fail('ACTION_GATE', `blocked: ${gate.reason}`);
  } catch (e: any) {
    fail('ACTION_GATE', e.message);
  }

  // ── 4. GRADUAL RAMP ────────────────────────────────────────
  console.log('  [4/10] Checking gradual ramp...');
  try {
    const { checkGradualRamp } = await import('../../src/safety/gradualRamp');
    const ramp = await checkGradualRamp();
    if (ramp.canAct) pass('GRADUAL_RAMP', `Day ${ramp.dayNumber}, ${ramp.actionsToday}/${ramp.maxActions} used — can act`);
    else warn('GRADUAL_RAMP', `Day ${ramp.dayNumber}, ${ramp.actionsToday}/${ramp.maxActions} — LIMIT REACHED`);
  } catch (e: any) {
    fail('GRADUAL_RAMP', e.message);
  }

  // ── 5. DATABASE CONNECTION ──────────────────────────────────
  console.log('  [5/10] Checking database...');
  try {
    const { getSupabaseClient } = await import('../../src/db/index');
    const supabase = getSupabaseClient();

    // Test read
    const { count: postCount, error: readErr } = await supabase
      .from('content_generation_metadata_comprehensive')
      .select('*', { count: 'exact', head: true });
    if (readErr) throw new Error(`Read failed: ${readErr.message}`);
    pass('DB_READ', `content_metadata: ${postCount} rows`);

    // Test write (system_events)
    const { error: writeErr } = await supabase.from('system_events').insert({
      event_type: 'pre_launch_validator',
      severity: 'info',
      message: `Pre-launch validation for @${process.env.TWITTER_USERNAME}`,
      created_at: new Date().toISOString(),
    });
    if (writeErr) throw new Error(`Write failed: ${writeErr.message}`);
    pass('DB_WRITE', 'system_events insert OK');

    // Check queue is clean
    const { count: queueCount } = await supabase
      .from('content_generation_metadata_comprehensive')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'queued');
    if ((queueCount || 0) > 0) warn('QUEUE', `${queueCount} items queued (stale from old account?)`);
    else pass('QUEUE', 'empty — fresh content will be generated');

    // Check content_features column exists
    const { error: colErr } = await supabase
      .from('content_generation_metadata_comprehensive')
      .select('content_features')
      .limit(1);
    if (colErr && colErr.message.includes('content_features')) fail('DB_SCHEMA', 'content_features column missing');
    else pass('DB_SCHEMA', 'content_features column exists');

    // Check curated accounts
    const { count: curatedCount } = await supabase
      .from('curated_accounts')
      .select('*', { count: 'exact', head: true })
      .eq('enabled', true);
    if ((curatedCount || 0) < 10) warn('CURATED_ACCOUNTS', `only ${curatedCount} enabled`);
    else pass('CURATED_ACCOUNTS', `${curatedCount} enabled`);

    // Check discovered accounts
    const { count: discoveredCount } = await supabase
      .from('discovered_accounts')
      .select('*', { count: 'exact', head: true });
    pass('DISCOVERED_ACCOUNTS', `${discoveredCount} in pool`);

  } catch (e: any) {
    fail('DATABASE', e.message);
  }

  // ── 6. STRATEGY ─────────────────────────────────────────────
  console.log('  [6/10] Checking strategy...');
  try {
    const { getStrategy } = await import('../../src/strategy/adaptiveStrategy');
    const strategy = await getStrategy();
    pass('STRATEGY', `gen=${strategy.generation} replies=${strategy.target_replies_per_day}/day singles=${strategy.target_singles_per_day}/day threads=${strategy.target_threads_per_day}/day`);
    pass('STRATEGY_TIMING', `active_hours=${strategy.active_hours.length}h reply_pacing=${strategy.reply_pacing_minutes}m`);
  } catch (e: any) {
    warn('STRATEGY', `fallback defaults will be used: ${e.message}`);
  }

  // ── 7. CONTENT FEATURE EXTRACTOR ───────────────────────────
  console.log('  [7/10] Testing content feature extractor...');
  try {
    const { extractContentFeatures } = await import('../../src/utils/contentFeatureExtractor');
    const sample = 'The real issue with sleep quality is cortisol. When your HPA axis fires at 2am, melatonin drops 40% and REM cycles shorten. Try 200mg L-theanine 30min before bed.';
    const features = extractContentFeatures(sample);
    if (features.char_count > 0 && features.word_count > 0) {
      pass('FEATURE_EXTRACTOR', `${features.word_count} words, numbers=${features.has_numbers}, stats=${features.has_stats}, type=${features.content_type}, readability=${features.readability}`);
    } else {
      fail('FEATURE_EXTRACTOR', `extraction returned empty: chars=${features.char_count}`);
    }
  } catch (e: any) {
    fail('FEATURE_EXTRACTOR', e.message);
  }

  // ── 8. OPENAI CONNECTIVITY ─────────────────────────────────
  console.log('  [8/10] Testing OpenAI API key...');
  try {
    const key = process.env.OPENAI_API_KEY || '';
    if (!key.startsWith('sk-')) {
      fail('OPENAI_KEY', `Invalid format: "${key.substring(0, 6)}..."`);
    } else {
      // Minimal API call to verify key works
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: { 'Authorization': `Bearer ${key}` },
      });
      if (response.ok) pass('OPENAI_KEY', 'API key valid (models endpoint OK)');
      else if (response.status === 401) fail('OPENAI_KEY', 'API key INVALID (401 Unauthorized)');
      else warn('OPENAI_KEY', `API returned ${response.status} (may still work)`);
    }
  } catch (e: any) {
    warn('OPENAI_KEY', `connectivity test failed: ${e.message}`);
  }

  // ── 9. SESSION FILE ────────────────────────────────────────
  console.log('  [9/10] Checking session files...');
  const fs = await import('fs');
  const sessionPath = '.runner-profile/twitter_session.json';
  if (fs.existsSync(sessionPath)) {
    try {
      const raw = fs.readFileSync(sessionPath, 'utf-8');
      const session = JSON.parse(raw);
      const cookieCount = session.cookies?.length || 0;
      const hasAuth = session.cookies?.some((c: any) => c.name === 'auth_token');
      const hasCt0 = session.cookies?.some((c: any) => c.name === 'ct0');
      if (hasAuth && hasCt0) pass('SESSION', `${cookieCount} cookies, auth_token=YES, ct0=YES`);
      else fail('SESSION', `${cookieCount} cookies, auth_token=${hasAuth ? 'YES' : 'NO'}, ct0=${hasCt0 ? 'YES' : 'NO'}`);
    } catch (e: any) {
      fail('SESSION', `parse error: ${e.message}`);
    }
  } else {
    fail('SESSION', `file not found: ${sessionPath}`);
  }

  // ── 10. STEALTH MODULES ────────────────────────────────────
  console.log('  [10/10] Checking stealth modules...');
  try {
    const { generateSessionFingerprint, getSafeLaunchArgs } = await import('../../src/infra/playwright/stealthConfig');
    const fp = generateSessionFingerprint();
    const args = getSafeLaunchArgs();
    pass('STEALTH_CONFIG', `Chrome/${fp.chromeVersion} viewport=${fp.viewport.width}x${fp.viewport.height} args=${args.length}`);

    const { humanTypeIntoFocused } = await import('../../src/infra/playwright/stealth');
    if (typeof humanTypeIntoFocused === 'function') pass('HUMAN_TYPING', 'humanTypeIntoFocused exported OK');
    else fail('HUMAN_TYPING', 'function not found');
  } catch (e: any) {
    fail('STEALTH', e.message);
  }

  // ── RESULTS ────────────────────────────────────────────────
  console.log('\n  ════════════════════════════════════════════════════════');
  console.log('  RESULTS');
  console.log('  ════════════════════════════════════════════════════════\n');

  const passes = results.filter(r => r.status === 'PASS');
  const warns = results.filter(r => r.status === 'WARN');
  const fails = results.filter(r => r.status === 'FAIL');

  for (const r of results) {
    const icon = r.status === 'PASS' ? '  PASS' : r.status === 'WARN' ? '  WARN' : '  FAIL';
    console.log(`  ${icon}  ${r.name}`);
    console.log(`         ${r.detail}`);
  }

  console.log(`\n  ────────────────────────────────────────────────────────`);
  console.log(`  ${passes.length} passed, ${warns.length} warnings, ${fails.length} failures`);

  if (fails.length === 0) {
    console.log(`\n  READY TO LAUNCH.\n`);
  } else {
    console.log(`\n  NOT READY — fix ${fails.length} failure(s) before starting daemon.\n`);
  }
}

main().catch(err => {
  console.error('Validator crashed:', err);
  process.exit(1);
});
