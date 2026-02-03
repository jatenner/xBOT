#!/usr/bin/env tsx
/**
 * 🔐 EXECUTOR AUTH PERSISTENCE PROOF (Phase 1)
 * 
 * Deterministic proof that authentication persists over time using the exact same
 * persistent context config as the daemon.
 * 
 * Usage:
 *   RUNNER_PROFILE_DIR=./.runner-profile pnpm run executor:prove:auth-persistence
 *   PROOF_DURATION_MINUTES=30 pnpm run executor:prove:auth-persistence
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { chromium, BrowserContext, Page } from 'playwright';
import { ensureRunnerProfileDir, RUNNER_PROFILE_PATHS } from '../../src/infra/runnerProfile';
import { checkWhoami } from '../../src/utils/whoamiAuth';

const RUNNER_PROFILE_DIR = ensureRunnerProfileDir();
const RUNNER_PROFILE_DIR_ABS = path.resolve(process.cwd(), RUNNER_PROFILE_DIR);
const BROWSER_USER_DATA_DIR = RUNNER_PROFILE_PATHS.chromeProfile();
const BROWSER_USER_DATA_DIR_ABS = path.resolve(BROWSER_USER_DATA_DIR);
const AUTH_OK_PATH = RUNNER_PROFILE_PATHS.authOk();

const PROOF_DURATION_MINUTES = parseInt(process.env.PROOF_DURATION_MINUTES || '30', 10);
const TICK_INTERVAL_SECONDS = 60;

interface TickRecord {
  timestamp: string;
  minute: number;
  final_url: string;
  logged_in: boolean;
  reason: string;
  handle: string | null;
}

interface ProofResult {
  ticks: TickRecord[];
  minutes_ok: number;
  first_failure_minute: number | null;
  fail_rate: number;
  passed: boolean;
  first_failure_tick: TickRecord | null;
}

async function checkLoggedInRobust(page: Page): Promise<{ logged_in: boolean; reason: string; handle: string | null; url: string }> {
  try {
    await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000); // Let page settle
    
    const finalUrl = page.url();
    
    // Check for login redirect
    if (finalUrl.includes('/i/flow/login') || finalUrl.includes('/login')) {
      return {
        logged_in: false,
        reason: 'login_redirect',
        handle: null,
        url: finalUrl,
      };
    }
    
    // Robust logged-in detection: compose box OR account menu
    const loggedInIndicators = await page.evaluate(() => {
      // Compose box (most reliable)
      const composeBox = document.querySelector('[data-testid="tweetTextarea_0"]') ||
                        document.querySelector('[data-testid="toolBar"]') ||
                        document.querySelector('div[data-testid="tweetButton"]');
      
      // Account switcher button
      const accountSwitcher = document.querySelector('[data-testid="SideNav_AccountSwitcher_Button"]');
      
      // Timeline container
      const timeline = document.querySelector('[data-testid="primaryColumn"]') || document.querySelector('main');
      
      // Extract handle from profile link if available
      let handle: string | null = null;
      const profileLink = document.querySelector('a[href*="/"][href*="/status"]')?.closest('nav')?.querySelector('a[href^="/"]');
      if (profileLink) {
        const href = (profileLink as HTMLAnchorElement).href;
        const match = href.match(/x\.com\/([^\/\?]+)/);
        if (match && match[1] && !match[1].includes('home') && !match[1].includes('explore')) {
          handle = match[1];
        }
      }
      
      // Try to get handle from account switcher
      if (!handle && accountSwitcher) {
        const text = accountSwitcher.textContent || '';
        const handleMatch = text.match(/@(\w+)/);
        if (handleMatch) {
          handle = handleMatch[1];
        }
      }
      
      return {
        hasComposeBox: !!composeBox,
        hasAccountSwitcher: !!accountSwitcher,
        hasTimeline: !!timeline,
        handle,
      };
    });
    
    const isLoggedIn = loggedInIndicators.hasComposeBox || 
                       loggedInIndicators.hasAccountSwitcher ||
                       (loggedInIndicators.hasTimeline && !finalUrl.includes('/i/flow/login'));
    
    let reason = 'ok';
    if (!isLoggedIn) {
      if (finalUrl.includes('/i/flow/login') || finalUrl.includes('/login')) {
        reason = 'login_redirect';
      } else if (!loggedInIndicators.hasTimeline) {
        reason = 'no_timeline';
      } else {
        reason = 'no_indicators';
      }
    }
    
    return {
      logged_in: isLoggedIn,
      reason,
      handle: loggedInIndicators.handle ? `@${loggedInIndicators.handle}` : null,
      url: finalUrl,
    };
  } catch (error: any) {
    return {
      logged_in: false,
      reason: `error: ${error.message}`,
      handle: null,
      url: page.url(),
    };
  }
}

async function runAuthPersistenceProof(): Promise<ProofResult> {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           🔐 EXECUTOR AUTH PERSISTENCE PROOF (Phase 1)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log(`📋 Configuration:`);
  console.log(`   RUNNER_PROFILE_DIR: ${RUNNER_PROFILE_DIR}`);
  console.log(`   RUNNER_PROFILE_DIR_ABS: ${RUNNER_PROFILE_DIR_ABS}`);
  console.log(`   UserDataDir: ${BROWSER_USER_DATA_DIR_ABS}`);
  console.log(`   Duration: ${PROOF_DURATION_MINUTES} minutes`);
  console.log(`   Tick Interval: ${TICK_INTERVAL_SECONDS} seconds`);
  console.log('');

  // Check AUTH_OK marker
  if (!fs.existsSync(AUTH_OK_PATH)) {
    console.error(`❌ AUTH_OK marker missing: ${AUTH_OK_PATH}`);
    console.error(`   Run executor:auth first to create authentication`);
    process.exit(1);
  }

  let authOkData: any = null;
  try {
    const content = fs.readFileSync(AUTH_OK_PATH, 'utf-8');
    authOkData = JSON.parse(content);
    console.log(`✅ AUTH_OK marker found: handle=${authOkData.handle || 'unknown'}, timestamp=${authOkData.timestamp}`);
  } catch (e) {
    console.warn(`⚠️  AUTH_OK marker exists but unreadable: ${(e as Error).message}`);
  }

  // Use EXACT same config as daemon
  console.log(`\n🚀 Launching browser with daemon config...`);
  const context = await chromium.launchPersistentContext(BROWSER_USER_DATA_DIR_ABS, {
    headless: true, // Same as daemon
    channel: 'chrome',
    args: [
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 720 },
  });

  const page = await context.newPage();
  const ticks: TickRecord[] = [];
  let firstFailureTick: TickRecord | null = null;
  let screenshotTaken = false;

  const startTime = Date.now();
  const endTime = startTime + (PROOF_DURATION_MINUTES * 60 * 1000);
  let tickNumber = 0;

  console.log(`\n⏱️  Starting ${PROOF_DURATION_MINUTES}-minute persistence test...`);
  console.log(`   Checking every ${TICK_INTERVAL_SECONDS} seconds\n`);

  try {
    while (Date.now() < endTime) {
      tickNumber++;
      const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
      const elapsedMinutes = Math.floor(elapsedSeconds / 60);
      
      const checkResult = await checkLoggedInRobust(page);
      const tick: TickRecord = {
        timestamp: new Date().toISOString(),
        minute: elapsedMinutes,
        final_url: checkResult.url,
        logged_in: checkResult.logged_in,
        reason: checkResult.reason,
        handle: checkResult.handle,
      };
      
      ticks.push(tick);
      
      const statusIcon = tick.logged_in ? '✅' : '❌';
      console.log(`[${elapsedMinutes}m] ${statusIcon} Tick ${tickNumber}: logged_in=${tick.logged_in}, reason=${tick.reason}, handle=${tick.handle || 'N/A'}`);
      
      // On first failure: screenshot + emit event
      if (!tick.logged_in && !firstFailureTick) {
        firstFailureTick = tick;
        
        if (!screenshotTaken) {
          screenshotTaken = true;
          const reportsDir = path.join(process.cwd(), 'docs', 'proofs', 'auth');
          if (!fs.existsSync(reportsDir)) {
            fs.mkdirSync(reportsDir, { recursive: true });
          }
          const screenshotPath = path.join(reportsDir, `auth-persistence-fail-${Date.now()}.png`);
          try {
            await page.screenshot({ path: screenshotPath, fullPage: true });
            console.log(`\n📸 Screenshot saved: ${screenshotPath}`);
          } catch (e) {
            console.warn(`⚠️  Failed to take screenshot: ${(e as Error).message}`);
          }
        }
        
        // Emit EXECUTOR_AUTH_INVALID event
        try {
          const { getSupabaseClient } = await import('../../src/db/index');
          const supabase = getSupabaseClient();
          await supabase.from('system_events').insert({
            event_type: 'EXECUTOR_AUTH_INVALID',
            severity: 'warning',
            message: `Auth persistence proof detected login failure`,
            event_data: {
              final_url: tick.final_url,
              reason: tick.reason,
              runner_profile_dir_abs: RUNNER_PROFILE_DIR_ABS,
              user_data_dir_abs: BROWSER_USER_DATA_DIR_ABS,
              tick_number: tickNumber,
              elapsed_minutes: elapsedMinutes,
              timestamp: tick.timestamp,
            },
            created_at: new Date().toISOString(),
          });
          console.log(`📊 Emitted EXECUTOR_AUTH_INVALID event`);
        } catch (e) {
          console.warn(`⚠️  Failed to emit event: ${(e as Error).message}`);
        }
      }
      
      // Sleep until next tick (or end time)
      const now = Date.now();
      const nextTickTime = startTime + (tickNumber * TICK_INTERVAL_SECONDS * 1000);
      const sleepMs = Math.min(nextTickTime - now, endTime - now);
      
      if (sleepMs > 0) {
        await new Promise(resolve => setTimeout(resolve, sleepMs));
      }
    }
  } finally {
    await page.close();
    await context.close();
  }

  // Calculate summary
  const totalTicks = ticks.length;
  const okTicks = ticks.filter(t => t.logged_in).length;
  const failedTicks = ticks.filter(t => !t.logged_in).length;
  const loginRedirectTicks = ticks.filter(t => t.reason === 'login_redirect').length;
  
  const minutesOk = okTicks;
  const firstFailureMinute = firstFailureTick ? firstFailureTick.minute : null;
  const failRate = totalTicks > 0 ? failedTicks / totalTicks : 0;
  
  // Hard assertion: logged_in must be true for full duration with 0 login_redirect events
  const passed = loginRedirectTicks === 0 && failedTicks === 0;

  return {
    ticks,
    minutes_ok: minutesOk,
    first_failure_minute: firstFailureMinute,
    fail_rate: failRate,
    passed,
    first_failure_tick: firstFailureTick,
  };
}

async function writeReport(result: ProofResult, authOkData: any): Promise<string> {
  const reportsDir = path.join(process.cwd(), 'docs', 'proofs', 'auth');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const timestamp = Date.now();
  const reportPath = path.join(reportsDir, `auth-persistence-${timestamp}.md`);

  const report = `# Auth Persistence Proof (Phase 1)

**Timestamp:** ${new Date().toISOString()}
**Proof Time:** ${timestamp}
**Duration:** ${PROOF_DURATION_MINUTES} minutes
**Tick Interval:** ${TICK_INTERVAL_SECONDS} seconds

## Environment

- **CWD:** \`${process.cwd()}\`
- **RUNNER_PROFILE_DIR:** \`${RUNNER_PROFILE_DIR}\`
- **RUNNER_PROFILE_DIR_ABS:** \`${RUNNER_PROFILE_DIR_ABS}\`
- **UserDataDir:** \`${BROWSER_USER_DATA_DIR_ABS}\`

## AUTH_OK Marker

${authOkData ? `
- **Handle:** ${authOkData.handle || 'N/A'}
- **Timestamp:** ${authOkData.timestamp}
- **UserDataDir:** \`${authOkData.userDataDir}\`
- **CWD:** \`${authOkData.cwd}\`
` : '**Missing**'}

## Summary

- **Total Ticks:** ${result.ticks.length}
- **Minutes OK:** ${result.minutes_ok}
- **First Failure Minute:** ${result.first_failure_minute !== null ? result.first_failure_minute : 'N/A'}
- **Fail Rate:** ${(result.fail_rate * 100).toFixed(2)}%
- **Login Redirect Events:** ${result.ticks.filter(t => t.reason === 'login_redirect').length}
- **Status:** ${result.passed ? '✅ **PASS**' : '❌ **FAIL**'}

${result.first_failure_tick ? `
## First Failure

- **Minute:** ${result.first_failure_tick.minute}
- **Timestamp:** ${result.first_failure_tick.timestamp}
- **URL:** ${result.first_failure_tick.final_url}
- **Reason:** ${result.first_failure_tick.reason}
` : ''}

## Tick Records

| Minute | Timestamp | URL | Logged In | Reason | Handle |
|--------|-----------|-----|-----------|--------|--------|
${result.ticks.map(t => `| ${t.minute} | ${t.timestamp} | ${t.final_url.substring(0, 50)}... | ${t.logged_in ? '✅' : '❌'} | ${t.reason} | ${t.handle || 'N/A'} |`).join('\n')}

## Result

${result.passed ? `
✅ **PASS** - Authentication persisted for the full ${PROOF_DURATION_MINUTES} minutes with 0 login_redirect events.
` : `
❌ **FAIL** - Authentication did not persist for the full duration.

**Analysis:**
- First failure at minute ${result.first_failure_minute !== null ? result.first_failure_minute : 'unknown'}
- Fail rate: ${(result.fail_rate * 100).toFixed(2)}%
- Login redirect events: ${result.ticks.filter(t => t.reason === 'login_redirect').length}

**Recommendation:** ${result.ticks.filter(t => t.reason === 'login_redirect').length > 0 ? 'Session revocation likely; Option 1 (browser session) unreliable.' : 'Investigate failure reason.'}
`}

---

*Generated by scripts/executor/prove-auth-persistence.ts*
`;

  fs.writeFileSync(reportPath, report, 'utf-8');
  return reportPath;
}

async function main(): Promise<void> {
  const result = await runAuthPersistenceProof();
  
  let authOkData: any = null;
  if (fs.existsSync(AUTH_OK_PATH)) {
    try {
      const content = fs.readFileSync(AUTH_OK_PATH, 'utf-8');
      authOkData = JSON.parse(content);
    } catch (e) {
      // Ignore
    }
  }
  
  const reportPath = await writeReport(result, authOkData);
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           📊 Proof Summary');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log(`Total Ticks: ${result.ticks.length}`);
  console.log(`Minutes OK: ${result.minutes_ok}`);
  console.log(`First Failure Minute: ${result.first_failure_minute !== null ? result.first_failure_minute : 'N/A'}`);
  console.log(`Fail Rate: ${(result.fail_rate * 100).toFixed(2)}%`);
  console.log(`Login Redirect Events: ${result.ticks.filter(t => t.reason === 'login_redirect').length}`);
  console.log(`Status: ${result.passed ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`\n📄 Report: ${reportPath}`);

  if (!result.passed) {
    console.log('\n⚠️  FAILURE ANALYSIS:');
    if (result.first_failure_tick) {
      console.log(`   First failure at minute ${result.first_failure_tick.minute}`);
      console.log(`   URL: ${result.first_failure_tick.final_url}`);
      console.log(`   Reason: ${result.first_failure_tick.reason}`);
    }
    const loginRedirectCount = result.ticks.filter(t => t.reason === 'login_redirect').length;
    if (loginRedirectCount > 0) {
      console.log(`\n❌ Session revocation detected (${loginRedirectCount} login_redirect events)`);
      console.log(`   Recommendation: Option 1 (browser session) unreliable`);
      console.log(`   Mean time to failure: ${result.first_failure_minute !== null ? result.first_failure_minute : 'unknown'} minutes`);
    }
  }

  process.exit(result.passed ? 0 : 1);
}

if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}
