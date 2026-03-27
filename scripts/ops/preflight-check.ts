/**
 * Pre-Flight Checklist
 *
 * Tests EVERY requirement for safe live posting before enabling the system.
 * Must pass ALL checks before going live.
 *
 * Usage: npx tsx scripts/ops/preflight-check.ts
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';

if (!process.env.TWITTER_SESSION_B64) {
  const p = path.join(process.cwd(), 'twitter_session.b64');
  if (fs.existsSync(p)) process.env.TWITTER_SESSION_B64 = fs.readFileSync(p, 'utf-8').trim();
}

let passed = 0;
let failed = 0;
let warnings = 0;

function pass(name: string, detail?: string) {
  console.log(`  ✅ ${name}${detail ? ` — ${detail}` : ''}`);
  passed++;
}
function fail(name: string, detail: string) {
  console.log(`  ❌ ${name} — ${detail}`);
  failed++;
}
function warn(name: string, detail: string) {
  console.log(`  ⚠️  ${name} — ${detail}`);
  warnings++;
}

async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('🛫 PRE-FLIGHT CHECKLIST FOR LIVE POSTING');
  console.log('='.repeat(60));

  // =========================================================================
  // 1. ENVIRONMENT
  // =========================================================================
  console.log('\n--- 1. ENVIRONMENT ---');

  if (process.env.SHADOW_MODE === 'false') pass('SHADOW_MODE=false');
  else fail('SHADOW_MODE', `Set to "${process.env.SHADOW_MODE}" — must be "false" for live posting`);

  if (process.env.X_ACTIONS_ENABLED === 'true') pass('X_ACTIONS_ENABLED=true');
  else fail('X_ACTIONS_ENABLED', `Set to "${process.env.X_ACTIONS_ENABLED}" — must be "true"`);

  if (process.env.LIVE_POSTS === 'true') pass('LIVE_POSTS=true');
  else fail('LIVE_POSTS', `Set to "${process.env.LIVE_POSTS}" — must be "true"`);

  const maxDay = parseInt(process.env.X_MAX_ACTIONS_PER_DAY || '3');
  if (maxDay <= 6) pass(`X_MAX_ACTIONS_PER_DAY=${maxDay}`, 'Conservative daily cap');
  else warn(`X_MAX_ACTIONS_PER_DAY=${maxDay}`, 'Higher than 6 for initial launch');

  const maxHour = parseInt(process.env.X_MAX_ACTIONS_PER_HOUR || '1');
  if (maxHour <= 2) pass(`X_MAX_ACTIONS_PER_HOUR=${maxHour}`, 'Conservative hourly cap');
  else warn(`X_MAX_ACTIONS_PER_HOUR=${maxHour}`, 'Higher than 2 for initial launch');

  if (process.env.RAMP_START_DATE) pass(`RAMP_START_DATE=${process.env.RAMP_START_DATE}`);
  else warn('RAMP_START_DATE', 'Not set — gradual ramp defaults to day 1 (6 actions). Set explicitly.');

  if (process.env.MODE === 'live') pass('MODE=live');
  else fail('MODE', `Set to "${process.env.MODE}" — must be "live"`);

  // =========================================================================
  // 2. TWITTER SESSION
  // =========================================================================
  console.log('\n--- 2. TWITTER SESSION ---');

  const sessionB64 = process.env.TWITTER_SESSION_B64;
  if (sessionB64 && sessionB64.length > 100) {
    pass(`TWITTER_SESSION_B64 loaded`, `${sessionB64.length} chars`);

    // Check session age
    const sessionPath = path.join(process.cwd(), 'twitter_session.b64');
    if (fs.existsSync(sessionPath)) {
      const stat = fs.statSync(sessionPath);
      const ageHours = (Date.now() - stat.mtimeMs) / (60 * 60 * 1000);
      if (ageHours < 24) pass('Session freshness', `${ageHours.toFixed(1)} hours old`);
      else if (ageHours < 72) warn('Session freshness', `${ageHours.toFixed(1)} hours old — consider re-exporting`);
      else fail('Session freshness', `${ageHours.toFixed(1)} hours old — STALE. Re-export from Chrome.`);
    }

    // Validate session structure
    try {
      const decoded = Buffer.from(sessionB64, 'base64').toString('utf-8');
      const parsed = JSON.parse(decoded);
      const cookieCount = parsed.cookies?.length ?? 0;
      if (cookieCount >= 20) pass('Session cookies', `${cookieCount} cookies`);
      else fail('Session cookies', `Only ${cookieCount} cookies — may be incomplete`);

      // Check for critical cookies
      const cookieNames = new Set((parsed.cookies ?? []).map((c: any) => c.name));
      const required = ['auth_token', 'ct0'];
      for (const name of required) {
        if (cookieNames.has(name)) pass(`Cookie: ${name}`, 'Present');
        else fail(`Cookie: ${name}`, 'MISSING — session may be invalid');
      }

      // Check cookie expiry
      const authToken = (parsed.cookies ?? []).find((c: any) => c.name === 'auth_token');
      if (authToken?.expires) {
        const expiresAt = new Date(authToken.expires * 1000);
        const daysUntilExpiry = (expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000);
        if (daysUntilExpiry > 7) pass('auth_token expiry', `${Math.round(daysUntilExpiry)} days remaining`);
        else if (daysUntilExpiry > 1) warn('auth_token expiry', `Only ${daysUntilExpiry.toFixed(1)} days remaining`);
        else fail('auth_token expiry', `EXPIRED or expiring in ${daysUntilExpiry.toFixed(1)} days`);
      }
    } catch (e: any) {
      fail('Session parse', `Cannot parse session: ${e.message}`);
    }
  } else {
    fail('TWITTER_SESSION_B64', 'Not set or too short');
  }

  // =========================================================================
  // 3. BROWSER & AUTH LIVE TEST
  // =========================================================================
  console.log('\n--- 3. BROWSER & AUTH LIVE TEST ---');

  try {
    const { chromium } = await import('playwright');
    const browser = await chromium.launch({ headless: true });

    // Load session
    let storageState: any = undefined;
    if (sessionB64) {
      const decoded = Buffer.from(sessionB64, 'base64').toString('utf-8');
      storageState = JSON.parse(decoded);
    }

    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      ...(storageState ? { storageState } : {}),
    });
    const page = await context.newPage();

    // Test 1: Can we load Twitter home?
    try {
      await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForTimeout(3000);

      if (page.url().includes('/i/flow/login')) {
        fail('Twitter auth', 'Redirected to login — session is INVALID');
      } else {
        // Check if we see the compose button (means we're logged in)
        const composeBtn = await page.$('[data-testid="tweetTextarea_0"]');
        const sideNav = await page.$('[data-testid="SideNav_NewTweet_Button"]');

        if (composeBtn || sideNav) {
          pass('Twitter auth', 'Logged in — compose button visible');
        } else {
          // Check for tweet articles (timeline loaded)
          const articles = await page.$$('article[data-testid="tweet"]');
          if (articles.length > 0) {
            pass('Twitter auth', `Logged in — ${articles.length} timeline tweets visible`);
          } else {
            warn('Twitter auth', 'Page loaded but no compose button or tweets found');
          }
        }

        // Check for any suspension/restriction banners
        const pageText = await page.evaluate(() => document.body?.innerText?.substring(0, 2000) || '');
        if (pageText.includes('suspended') || pageText.includes('locked') || pageText.includes('restricted')) {
          fail('Account status', 'SUSPENSION/RESTRICTION DETECTED on page');
        } else {
          pass('Account status', 'No suspension or restriction banners');
        }
      }
    } catch (e: any) {
      fail('Twitter home load', e.message);
    }

    // Test 2: Can we load our profile?
    try {
      // Get our username from session
      const decoded = Buffer.from(sessionB64!, 'base64').toString('utf-8');
      const session = JSON.parse(decoded);
      const screenName = session.cookies?.find((c: any) => c.name === 'twid')?.value?.replace('u%3D', '') || null;

      if (screenName) {
        pass('Account ID', `twid=${screenName}`);
      }
    } catch { /* non-critical */ }

    // Test 3: Can we navigate to compose (don't actually post)
    try {
      await page.goto('https://x.com/compose/post', { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(2000);

      const textarea = await page.$('[data-testid="tweetTextarea_0"]');
      if (textarea) {
        pass('Compose page', 'Text area accessible — posting will work');
      } else {
        warn('Compose page', 'Text area not found — may need different selector');
      }
    } catch (e: any) {
      warn('Compose page', `Navigation issue: ${e.message}`);
    }

    await browser.close();
  } catch (e: any) {
    fail('Browser launch', e.message);
  }

  // =========================================================================
  // 4. DATABASE
  // =========================================================================
  console.log('\n--- 4. DATABASE ---');

  try {
    const { getSupabaseClient } = await import('../../src/db');
    const s = getSupabaseClient();

    // Test connection
    const { error: connErr } = await s.from('system_events').select('id').limit(1);
    if (!connErr) pass('Database connection', 'Supabase reachable');
    else fail('Database connection', connErr.message);

    // Check strategy_state exists
    const { data: strategy } = await s.from('strategy_state').select('id, generation').eq('id', 1).single();
    if (strategy) pass('strategy_state', `Generation ${strategy.generation}`);
    else fail('strategy_state', 'Singleton missing');

    // Check self_model_state exists
    const { data: selfModel } = await s.from('self_model_state').select('id, growth_phase').eq('id', 1).single();
    if (selfModel) pass('self_model_state', `Phase: ${selfModel.growth_phase}`);
    else warn('self_model_state', 'Not initialized — brain self-model will create it');

    // Check brain tables exist
    const brainTables = ['brain_tweets', 'brain_accounts', 'brain_keywords', 'brain_classifications', 'feedback_events'];
    for (const table of brainTables) {
      const { error } = await s.from(table).select('id').limit(1);
      if (!error) pass(`Table: ${table}`, 'Exists');
      else fail(`Table: ${table}`, error.message);
    }

    // Check brain data volume
    const { count: tweetCount } = await s.from('brain_tweets').select('id', { count: 'exact', head: true });
    if ((tweetCount ?? 0) > 100) pass('Brain tweet data', `${tweetCount} tweets`);
    else if ((tweetCount ?? 0) > 0) warn('Brain tweet data', `Only ${tweetCount} tweets — brain is still learning`);
    else warn('Brain tweet data', '0 tweets — brain has no data yet');

  } catch (e: any) {
    fail('Database', e.message);
  }

  // =========================================================================
  // 5. OPENAI
  // =========================================================================
  console.log('\n--- 5. OPENAI ---');

  if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.startsWith('sk-')) {
    pass('OPENAI_API_KEY', 'Set and starts with sk-');

    // Test API call
    try {
      const { createBudgetedChatCompletion } = await import('../../src/services/openaiBudgetedClient');
      const response = await createBudgetedChatCompletion({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'Reply with exactly: OK' }],
        max_tokens: 5,
      }, { purpose: 'preflight_check' });

      const reply = response.choices[0]?.message?.content?.trim();
      if (reply) pass('OpenAI API call', `Response: "${reply}"`);
      else fail('OpenAI API call', 'Empty response');
    } catch (e: any) {
      fail('OpenAI API call', e.message);
    }
  } else {
    fail('OPENAI_API_KEY', 'Not set or invalid format');
  }

  // =========================================================================
  // 6. SAFETY GATES
  // =========================================================================
  console.log('\n--- 6. SAFETY GATES ---');

  // Crash-loop check
  const restartPath = path.join(process.cwd(), '.xbot-restarts.json');
  if (fs.existsSync(restartPath)) {
    try {
      const restarts = JSON.parse(fs.readFileSync(restartPath, 'utf-8'));
      const recentRestarts = (restarts.timestamps || []).filter((t: number) => Date.now() - t < 15 * 60 * 1000);
      if (recentRestarts.length >= 3) {
        fail('Crash-loop', `${recentRestarts.length} restarts in 15 min — 6h cooldown active`);
      } else {
        pass('Crash-loop', `${recentRestarts.length} recent restarts (< 3 threshold)`);
      }
    } catch {
      pass('Crash-loop', 'No restart tracking file');
    }
  } else {
    pass('Crash-loop', 'No restart tracking file');
  }

  // 226 cooldown check
  try {
    const { getSupabaseClient } = await import('../../src/db');
    const s = getSupabaseClient();
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
    const { count: recent226 } = await s
      .from('system_events')
      .select('id', { count: 'exact', head: true })
      .eq('event_type', 'CREATE_TWEET_226_BLOCKED')
      .gte('created_at', sixHoursAgo);

    if ((recent226 ?? 0) === 0) pass('226 cooldown', 'No 226 blocks in last 6 hours');
    else fail('226 cooldown', `${recent226} 226 blocks in last 6 hours — cooldown may be active`);
  } catch {
    warn('226 cooldown', 'Could not check');
  }

  // Gradual ramp
  const rampDate = process.env.RAMP_START_DATE;
  if (rampDate) {
    const daysSince = (Date.now() - new Date(rampDate).getTime()) / (24 * 60 * 60 * 1000);
    const rampDay = Math.min(Math.floor(daysSince) + 1, 5);
    const limits = [6, 10, 15, 20, 999];
    const todayLimit = limits[Math.min(rampDay - 1, 4)];
    pass('Gradual ramp', `Day ${rampDay}, max ${todayLimit} actions/day`);
  }

  // =========================================================================
  // SUMMARY
  // =========================================================================
  console.log('\n' + '='.repeat(60));
  console.log(`🛫 PRE-FLIGHT RESULTS: ${passed} passed, ${failed} failed, ${warnings} warnings`);

  if (failed === 0) {
    console.log('\n✅ ALL CHECKS PASSED — System is ready for live posting.');
    console.log('   Start with: npx tsx scripts/ops/test2-fetch-and-tick.ts');
  } else {
    console.log(`\n❌ ${failed} CHECKS FAILED — DO NOT go live until these are fixed.`);
  }

  if (warnings > 0) {
    console.log(`\n⚠️  ${warnings} warnings — review before proceeding.`);
  }

  console.log('='.repeat(60) + '\n');

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => {
  console.error('PREFLIGHT FATAL:', e);
  process.exit(1);
});
