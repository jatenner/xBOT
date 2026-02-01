#!/usr/bin/env tsx
/**
 * Fix Auth Source-of-Truth and Drive to P1
 * 
 * 1. Identifies exact profile paths
 * 2. Checks auth status
 * 3. Runs interactive login if needed
 * 4. Syncs session
 * 5. Restarts daemons
 * 6. Drives P1 end-to-end
 */

import 'dotenv/config';
import { chromium, BrowserContext, Page } from 'playwright';
import { checkWhoami } from '../../src/utils/whoamiAuth';
import { resolveRunnerProfileDir, RUNNER_PROFILE_PATHS } from '../../src/infra/runnerProfile';
import { execSync } from 'child_process';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { getSupabaseClient } from '../../src/db/index';

const RUNNER_PROFILE_DIR = resolveRunnerProfileDir();
const EXECUTOR_CHROME_PROFILE = RUNNER_PROFILE_PATHS.chromeProfile();

console.log('🔐 Fix Auth Source-of-Truth and Drive to P1');
console.log('═══════════════════════════════════════════════════════════════════════════════\n');

console.log('📁 Profile Paths:');
console.log(`   RUNNER_PROFILE_DIR: ${RUNNER_PROFILE_DIR}`);
console.log(`   EXECUTOR_CHROME_PROFILE: ${EXECUTOR_CHROME_PROFILE}\n`);

// Stop executor/harvester daemons to release profile lock (called from main)
async function stopDaemonsAndReleaseLock(): Promise<void> {
  console.log('🛑 Stopping daemons to release profile lock...\n');
  try {
    execSync('launchctl stop com.xbot.executor', { stdio: 'ignore' });
    execSync('launchctl stop com.xbot.harvester', { stdio: 'ignore' });
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Kill any Chrome processes using the profile
    try {
      execSync('pkill -9 -f "executor-chrome-profile"', { stdio: 'ignore' });
      execSync('pkill -9 -f "Google Chrome.*executor"', { stdio: 'ignore' });
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch {}
    
    // Remove SingletonLock
    const singletonLock = join(EXECUTOR_CHROME_PROFILE, 'SingletonLock');
    if (existsSync(singletonLock)) {
      try {
        execSync(`rm -f "${singletonLock}"`, { stdio: 'ignore' });
        console.log('✅ Removed SingletonLock\n');
      } catch {}
    }
  } catch {}
}

// Step A: Check auth status
async function checkAuthStatus(): Promise<{ logged_in: boolean; handle: string | null; url: string; reason: string; hasAuthCookies: boolean }> {
  console.log('🔍 Step A: Checking auth status in executor profile...\n');
  
  let context: BrowserContext | null = null;
  let page: Page | null = null;
  
  try {
    // Use same profile as executor
    context = await chromium.launchPersistentContext(EXECUTOR_CHROME_PROFILE, {
      headless: true,
      channel: 'chrome',
    });
    
    page = await context.newPage();
    
    // Check cookies
    const cookies = await context.cookies();
    const twitterCookies = cookies.filter(c => 
      c.domain && (c.domain.includes('x.com') || c.domain.includes('twitter.com'))
    );
    const hasAuthToken = twitterCookies.some(c => c.name === 'auth_token');
    const hasCt0 = twitterCookies.some(c => c.name === 'ct0');
    const hasAuthCookies = hasAuthToken && hasCt0;
    
    console.log(`   Cookies: ${cookies.length} total, ${twitterCookies.length} Twitter`);
    console.log(`   auth_token: ${hasAuthToken ? '✅ YES' : '❌ NO'}`);
    console.log(`   ct0: ${hasCt0 ? '✅ YES' : '❌ NO'}\n`);
    
    // Check whoami
    const whoami = await checkWhoami(page);
    
    console.log(`   logged_in: ${whoami.logged_in ? '✅ true' : '❌ false'}`);
    console.log(`   handle: ${whoami.handle || 'unknown'}`);
    console.log(`   url: ${whoami.url}`);
    console.log(`   reason: ${whoami.reason}\n`);
    
    await page.close();
    await context.close();
    
    return {
      logged_in: whoami.logged_in,
      handle: whoami.handle,
      url: whoami.url,
      reason: whoami.reason,
      hasAuthCookies
    };
  } catch (error: any) {
    if (page) await page.close().catch(() => {});
    if (context) await context.close().catch(() => {});
    throw error;
  }
}

// Step B: Interactive login
async function runInteractiveLogin(): Promise<void> {
  console.log('🔐 Step B: Running interactive login...\n');
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('ACTION REQUIRED: Please complete login in the opened browser window.');
  console.log('After you land on https://x.com/home, return here.');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');
  
  let context: BrowserContext | null = null;
  let page: Page | null = null;
  
  try {
    // Launch headed browser with executor profile
    context = await chromium.launchPersistentContext(EXECUTOR_CHROME_PROFILE, {
      headless: false, // Headed for login
      channel: 'chrome',
    });
    
    page = await context.newPage();
    await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded', timeout: 60000 });
    
    // Poll whoami every 5 seconds (max 10 minutes)
    const maxWaitMs = 10 * 60 * 1000;
    const startTime = Date.now();
    let loggedIn = false;
    
    while (!loggedIn && (Date.now() - startTime) < maxWaitMs) {
      await page.waitForTimeout(5000);
      
      const whoami = await checkWhoami(page);
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      
      if (whoami.logged_in) {
        loggedIn = true;
        console.log(`\n✅ Login detected! logged_in=true handle=${whoami.handle || 'unknown'}`);
        break;
      } else {
        process.stdout.write(`\r⏳ Waiting for login... (${elapsed}s) - Please log in to X.com`);
      }
    }
    
    if (!loggedIn) {
      throw new Error('Login timeout - please ensure you are logged in');
    }
    
    // Wait a bit for session to stabilize
    await page.waitForTimeout(3000);
    
    await page.close();
    await context.close();
    
    console.log('✅ Login complete!\n');
  } catch (error: any) {
    if (page) await page.close().catch(() => {});
    if (context) await context.close().catch(() => {});
    throw error;
  }
}

// Step C: Sync session
async function syncSession(): Promise<void> {
  console.log('🔄 Step C: Syncing session from profile...\n');
  
  // Use direct launchPersistentContext (same as executor)
  const context = await chromium.launchPersistentContext(EXECUTOR_CHROME_PROFILE, {
    headless: true,
    channel: 'chrome',
  });
  const page = await context.newPage();
  
  await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);
  
  const whoami = await checkWhoami(page);
  if (!whoami.logged_in) {
    throw new Error('Profile not logged in after sync attempt');
  }
  
  const storageState = await context.storageState();
  const storageStateJson = JSON.stringify(storageState, null, 2);
  
  writeFileSync('twitter_session.json', storageStateJson);
  
  // Validate auth cookies
  const cookies = storageState.cookies || [];
  const authToken = cookies.find((c: any) => c.name === 'auth_token' && c.domain && (c.domain.includes('.x.com') || c.domain.includes('.twitter.com')));
  const ct0 = cookies.find((c: any) => c.name === 'ct0' && c.domain && (c.domain.includes('.x.com') || c.domain.includes('.twitter.com')));
  
  if (!authToken || !ct0) {
    throw new Error('Session missing auth_token or ct0 cookies');
  }
  
  console.log(`✅ Session saved: ${cookies.length} cookies`);
  console.log(`   auth_token: ✅ YES`);
  console.log(`   ct0: ✅ YES\n`);
  
  // Base64 encode
  const sessionBytes = Buffer.from(storageStateJson, 'utf-8');
  const b64 = sessionBytes.toString('base64');
  
  // Update .env
  const envPath = join(process.cwd(), '.env');
  let envContent = readFileSync(envPath, 'utf-8');
  const lines = envContent.split('\n');
  const filteredLines = lines.filter(line => !line.trim().startsWith('TWITTER_SESSION_B64='));
  filteredLines.push(`TWITTER_SESSION_B64=${b64}`);
  writeFileSync(envPath, filteredLines.join('\n') + '\n');
  
  console.log(`✅ Updated .env: TWITTER_SESSION_B64 (${b64.length} chars)\n`);
  
  await page.close();
  await context.close();
}

// Step D: Restart daemons
async function restartDaemons(): Promise<void> {
  console.log('🔄 Step D: Restarting daemons...\n');
  
  // Stop harvester
  try {
    execSync('launchctl stop com.xbot.harvester', { stdio: 'ignore' });
    execSync('launchctl unload ~/Library/LaunchAgents/com.xbot.harvester.plist 2>/dev/null || true', { stdio: 'ignore' });
  } catch {}
  
  // Stop executor
  try {
    execSync('launchctl stop com.xbot.executor', { stdio: 'ignore' });
    execSync('launchctl unload ~/Library/LaunchAgents/com.xbot.executor.plist 2>/dev/null || true', { stdio: 'ignore' });
  } catch {}
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Load harvester
  const harvesterPlist = join(process.cwd(), 'scripts/harvester/com.xbot.harvester.plist');
  if (existsSync(harvesterPlist)) {
    execSync(`cp ${harvesterPlist} ~/Library/LaunchAgents/com.xbot.harvester.plist`, { stdio: 'ignore' });
    execSync('launchctl load ~/Library/LaunchAgents/com.xbot.harvester.plist', { stdio: 'ignore' });
    console.log('✅ Harvester daemon restarted');
  }
  
  // Load executor
  const executorPlist = join(process.cwd(), 'scripts/runner/com.xbot.executor.plist');
  if (existsSync(executorPlist)) {
    execSync(`cp ${executorPlist} ~/Library/LaunchAgents/com.xbot.executor.plist`, { stdio: 'ignore' });
    execSync('launchctl load ~/Library/LaunchAgents/com.xbot.executor.plist', { stdio: 'ignore' });
    console.log('✅ Executor daemon restarted');
  }
  
  console.log('\n⏳ Waiting 10s for daemons to initialize...\n');
  await new Promise(resolve => setTimeout(resolve, 10000));
  
  // Check logs
  const executorLog = join(RUNNER_PROFILE_DIR, 'executor.log');
  if (existsSync(executorLog)) {
    const logContent = readFileSync(executorLog, 'utf-8');
    const lastLines = logContent.split('\n').slice(-20).join('\n');
    if (lastLines.includes('logged_in=true') && lastLines.includes('@SignalAndSynapse')) {
      console.log('✅ Executor auth verified in logs');
    } else {
      console.log('⚠️  Executor auth not yet verified in logs (may need more time)');
    }
  }
}

// Step E: Drive P1
async function driveP1(): Promise<void> {
  console.log('🚀 Step E: Driving P1 proving lane...\n');
  
  process.env.P1_MODE = 'true';
  process.env.P1_TARGET_MAX_AGE_MINUTES = '60';
  process.env.REPLY_V2_ROOT_ONLY = 'true';
  
  // 1. Harvest
  console.log('🌾 E1: Running harvester...');
  try {
    execSync('HARVESTING_ENABLED=true pnpm tsx scripts/ops/run-harvester-single-cycle.ts', {
      stdio: 'inherit',
      env: { ...process.env }
    });
  } catch (e) {
    console.error('⚠️  Harvester failed, continuing...');
  }
  
  // Check fresh opportunities
  const supabase = getSupabaseClient();
  const { data: opps } = await supabase
    .from('reply_opportunities')
    .select('tweet_posted_at, is_root_tweet, replied_to')
    .eq('is_root_tweet', true)
    .eq('replied_to', false);
  
  const now = Date.now();
  const fresh1h = opps?.filter(o => {
    if (!o.tweet_posted_at) return false;
    return new Date(o.tweet_posted_at).getTime() > now - 60 * 60 * 1000;
  }).length || 0;
  
  console.log(`   Fresh <1h: ${fresh1h}\n`);
  
  if (fresh1h === 0) {
    throw new Error('No fresh opportunities after harvest');
  }
  
  // 2. Planner/Scheduler
  console.log('🎯 E2: Running planner/scheduler...');
  try {
    execSync('REPLY_V2_ROOT_ONLY=true P1_MODE=true P1_TARGET_MAX_AGE_HOURS=1 REPLY_V2_PLAN_ONLY=true pnpm tsx scripts/ops/run-reply-v2-planner-once.ts', {
      stdio: 'inherit',
      env: { ...process.env }
    });
  } catch (e) {
    console.error('⚠️  Planner failed, continuing...');
  }
  
  // Check queued decisions
  const { count: queuedCount } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('*', { count: 'exact', head: true })
    .eq('decision_type', 'reply')
    .in('pipeline_source', ['reply_v2_planner', 'reply_v2_scheduler'])
    .eq('status', 'queued');
  
  console.log(`   Queued decisions: ${queuedCount || 0}\n`);
  
  if (!queuedCount || queuedCount === 0) {
    throw new Error('No queued decisions after planner');
  }
  
  // 3. Monitor executor (up to 10 attempts)
  console.log('⏳ E3: Monitoring executor (up to 10 attempts, 60s each)...\n');
  
  for (let attempt = 1; attempt <= 10; attempt++) {
    console.log(`   Attempt ${attempt}/10: Checking for posted reply...`);
    
    await new Promise(resolve => setTimeout(resolve, 60000));
    
    const { data: posted } = await supabase
      .from('content_generation_metadata_comprehensive')
      .select('decision_id, target_tweet_id, posted_tweet_id, features, created_at')
      .eq('decision_type', 'reply')
      .in('pipeline_source', ['reply_v2_planner', 'reply_v2_scheduler'])
      .not('posted_tweet_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (posted && posted.posted_tweet_id) {
      const url = `https://x.com/i/status/${posted.posted_tweet_id}`;
      const f = posted.features || {};
      
      console.log(`\n🎉 SUCCESS! Posted reply detected!\n`);
      console.log(`   decision_id: ${posted.decision_id}`);
      console.log(`   target_tweet_id: ${posted.target_tweet_id}`);
      console.log(`   posted_tweet_id: ${posted.posted_tweet_id}`);
      console.log(`   URL: ${url}`);
      console.log(`   runtime_preflight_status: ${f.runtime_preflight_status || 'N/A'}\n`);
      
      // Write proof doc
      const proofDoc = `# P1 First Posted Reply - PROOF

## Decision Details
- **decision_id**: ${posted.decision_id}
- **target_tweet_id**: ${posted.target_tweet_id}
- **posted_tweet_id**: ${posted.posted_tweet_id}
- **posted_url**: ${url}
- **created_at**: ${posted.created_at}

## Runtime Preflight Evidence
- **runtime_preflight_status**: ${f.runtime_preflight_status || 'N/A'}
- **runtime_preflight_reason**: ${f.runtime_preflight_reason || 'N/A'}
- **runtime_preflight_marker**: ${f.runtime_preflight_marker || 'N/A'}
- **runtime_preflight_latency_ms**: ${f.runtime_preflight_latency_ms || 'N/A'}

## Pipeline Status
- **pipeline_source**: ${posted.pipeline_source || 'N/A'}
- **status**: posted

---
**Timestamp**: ${new Date().toISOString()}
`;
      
      writeFileSync('docs/proofs/p1-reply-v2-first-post/FIRST_POST.md', proofDoc);
      console.log('✅ Proof document written: docs/proofs/p1-reply-v2-first-post/FIRST_POST.md\n');
      
      return; // Success!
    }
    
    // Check runtime preflight status
    const { data: runtimeOk } = await supabase
      .from('content_generation_metadata_comprehensive')
      .select('decision_id, features')
      .eq('decision_type', 'reply')
      .in('pipeline_source', ['reply_v2_planner', 'reply_v2_scheduler'])
      .eq('status', 'queued')
      .limit(1)
      .maybeSingle();
    
    if (runtimeOk) {
      const f = runtimeOk.features || {};
      console.log(`   Runtime preflight: ${f.runtime_preflight_status || 'unknown'}`);
    }
  }
  
  throw new Error('No posted reply after 10 attempts');
}

// Main
async function main() {
  try {
    // Stop daemons first
    await stopDaemonsAndReleaseLock();
    
    // Step A: Check auth
    const authStatus = await checkAuthStatus();
    
    // Step B: Login if needed
    if (!authStatus.logged_in) {
      await runInteractiveLogin();
      // Re-check after login
      const newAuthStatus = await checkAuthStatus();
      if (!newAuthStatus.logged_in) {
        throw new Error('Still not logged in after login attempt');
      }
    } else {
      console.log('✅ Already logged in, skipping login step\n');
    }
    
    // Step C: Sync session
    await syncSession();
    
    // Step D: Restart daemons
    await restartDaemons();
    
    // Step E: Drive P1
    await driveP1();
    
    console.log('═══════════════════════════════════════════════════════════════════════════════');
    console.log('✅ P1 COMPLETE: First posted reply achieved!');
    console.log('═══════════════════════════════════════════════════════════════════════════════\n');
    
  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main().catch(console.error);
