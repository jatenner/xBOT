#!/usr/bin/env tsx
/**
 * 🔐 EXECUTOR B64 AUTH PERSISTENCE PROOF
 * 
 * Measures cookie lifetime by running persistence proof using B64 cookie injection.
 * Uses a brand new temp profile dir per run (same as b64-readwrite proof).
 * 
 * Usage:
 *   TWITTER_SESSION_B64=<b64> pnpm run executor:prove:auth-b64-persistence
 *   PROOF_DURATION_MINUTES=30 TWITTER_SESSION_B64=<b64> pnpm run executor:prove:auth-b64-persistence
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { chromium, BrowserContext, Page, Cookie } from 'playwright';
import { getSupabaseClient } from '../../src/db/index';

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

interface FailureFingerprint {
  reason: string;
  url: string;
  minute: number;
  screenshot_path: string | null;
}

interface ProofResult {
  ticks: TickRecord[];
  minutes_ok: number;
  first_failure_minute: number | null;
  fail_rate: number;
  passed: boolean;
  first_failure_tick: TickRecord | null;
  failure_fingerprints: FailureFingerprint[];
}

function loadB64Cookies(): { cookies: Cookie[]; origins: any[] } {
  const b64 = process.env.TWITTER_SESSION_B64?.trim();
  if (!b64) {
    throw new Error('TWITTER_SESSION_B64 environment variable is required');
  }
  
  try {
    const decoded = Buffer.from(b64, 'base64').toString('utf8');
    const state = JSON.parse(decoded);
    
    if (!Array.isArray(state?.cookies)) {
      throw new Error('Invalid session format: cookies array not found');
    }
    
    // Normalize domains (ensure both .x.com and .twitter.com)
    const normalizedCookies: Cookie[] = [];
    for (const cookie of state.cookies) {
      if (cookie.domain && (cookie.domain.includes('x.com') || cookie.domain.includes('twitter.com'))) {
        // Add for .x.com
        normalizedCookies.push({
          ...cookie,
          domain: '.x.com',
        });
        // Add for .twitter.com if different
        if (!cookie.domain.includes('twitter.com')) {
          normalizedCookies.push({
            ...cookie,
            domain: '.twitter.com',
          });
        }
      } else {
        normalizedCookies.push(cookie);
      }
    }
    
    return {
      cookies: normalizedCookies,
      origins: state.origins || [],
    };
  } catch (error: any) {
    throw new Error(`Failed to decode TWITTER_SESSION_B64: ${error.message}`);
  }
}

async function checkLoggedInRobust(page: Page): Promise<{ logged_in: boolean; reason: string; handle: string | null; url: string }> {
  try {
    await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000); // Let page settle
    
    const finalUrl = page.url();
    
    // 🔍 CLASSIFICATION: Check for challenge URLs first
    if (finalUrl.includes('/account/access') || 
        finalUrl.includes('/i/flow/challenge') ||
        finalUrl.includes('/i/flow/verify') ||
        finalUrl.includes('/account/verify')) {
      return {
        logged_in: false,
        reason: 'challenge_suspected',
        handle: null,
        url: finalUrl,
      };
    }
    
    // 🔍 CLASSIFICATION: Check for login redirect
    if (finalUrl.includes('/i/flow/login') || finalUrl.includes('/login')) {
      return {
        logged_in: false,
        reason: 'login_redirect',
        handle: null,
        url: finalUrl,
      };
    }
    
    // 🔍 CLASSIFICATION: Check for consent wall
    const consentCheck = await page.evaluate(() => {
      const bodyText = document.body.textContent || '';
      const hasConsentWall = 
        bodyText.includes('Accept all cookies') ||
        bodyText.includes('Accept cookies') ||
        bodyText.includes('cookie preferences') ||
        bodyText.includes('cookie settings') ||
        !!document.querySelector('[role="dialog"][aria-label*="cookie" i]') ||
        !!document.querySelector('[data-testid*="cookie" i]') ||
        !!document.querySelector('button:has-text("Accept")') ||
        !!document.querySelector('button:has-text("Accept all")');
      
      const url = window.location.href;
      const isConsentFlow = url.includes('/i/flow/consent');
      
      return {
        hasConsentWall,
        isConsentFlow,
      };
    });
    
    if (consentCheck.hasConsentWall || consentCheck.isConsentFlow) {
      const hasTimeline = await page.evaluate(() => {
        return !!document.querySelector('[data-testid="primaryColumn"]') || 
               !!document.querySelector('main') ||
               !!document.querySelector('article[data-testid="tweet"]');
      });
      
      if (!hasTimeline) {
        return {
          logged_in: false,
          reason: 'consent_wall_detected',
          handle: null,
          url: finalUrl,
        };
      }
    }
    
    // Robust logged-in detection
    const loggedInIndicators = await page.evaluate(() => {
      const composeBox = document.querySelector('[data-testid="tweetTextarea_0"]') ||
                        document.querySelector('[data-testid="toolBar"]') ||
                        document.querySelector('div[data-testid="tweetButton"]');
      
      const accountSwitcher = document.querySelector('[data-testid="SideNav_AccountSwitcher_Button"]');
      const timeline = document.querySelector('[data-testid="primaryColumn"]') || document.querySelector('main');
      
      let handle: string | null = null;
      const profileLink = document.querySelector('a[href*="/"][href*="/status"]')?.closest('nav')?.querySelector('a[href^="/"]');
      if (profileLink) {
        const href = (profileLink as HTMLAnchorElement).href;
        const match = href.match(/x\.com\/([^\/\?]+)/);
        if (match && match[1] && !match[1].includes('home') && !match[1].includes('explore')) {
          handle = match[1];
        }
      }
      
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
        reason = 'unknown';
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

async function runB64AuthPersistenceProof(): Promise<ProofResult> {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           🔐 EXECUTOR B64 AUTH PERSISTENCE PROOF');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log(`📋 Configuration:`);
  console.log(`   Proof Duration: ${PROOF_DURATION_MINUTES} minutes`);
  console.log(`   Tick Interval: ${TICK_INTERVAL_SECONDS} seconds`);
  console.log(`   Profile: Temp (new per run)\n`);

  // Load B64 cookies
  let sessionState: { cookies: Cookie[]; origins: any[] };
  try {
    sessionState = loadB64Cookies();
    console.log(`✅ Loaded ${sessionState.cookies.length} cookies from TWITTER_SESSION_B64\n`);
  } catch (error: any) {
    console.error(`❌ FATAL: Failed to load cookies: ${error.message}`);
    process.exit(1);
  }

  // Create temp profile dir
  const tempProfileDir = path.join(process.cwd(), '.tmp', `b64-auth-proof-${Date.now()}`);
  fs.mkdirSync(tempProfileDir, { recursive: true });

  const ticks: TickRecord[] = [];
  const seenFailureReasons = new Set<string>();
  const failureFingerprints: FailureFingerprint[] = [];
  let firstFailureMinute: number | null = null;
  let firstFailureTick: TickRecord | null = null;

  let context: BrowserContext | null = null;
  let page: Page | null = null;

  try {
    // Launch browser with temp profile
    console.log(`[B64_AUTH_PROVE] 🚀 Launching browser with temp profile...`);
    context = await chromium.launchPersistentContext(tempProfileDir, {
      headless: true,
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

    // Inject cookies
    await context.addCookies(sessionState.cookies);
    console.log(`[B64_AUTH_PROVE] ✅ Injected ${sessionState.cookies.length} cookies\n`);

    page = await context.newPage();

    // Run ticks
    const totalTicks = Math.ceil((PROOF_DURATION_MINUTES * 60) / TICK_INTERVAL_SECONDS);
    console.log(`[B64_AUTH_PROVE] 📊 Running ${totalTicks} ticks over ${PROOF_DURATION_MINUTES} minutes...\n`);

    for (let tick = 0; tick < totalTicks; tick++) {
      const startTime = Date.now();
      const minute = Math.floor((tick * TICK_INTERVAL_SECONDS) / 60);
      const timestamp = new Date().toISOString();

      const checkResult = await checkLoggedInRobust(page);
      
      const tickRecord: TickRecord = {
        timestamp,
        minute,
        final_url: checkResult.url,
        logged_in: checkResult.logged_in,
        reason: checkResult.reason,
        handle: checkResult.handle,
      };
      
      ticks.push(tickRecord);

      const statusIcon = checkResult.logged_in ? '✅' : '❌';
      console.log(`[B64_AUTH_PROVE] ${statusIcon} Tick ${tick + 1}/${totalTicks} (minute ${minute}): ${checkResult.logged_in ? 'LOGGED_IN' : checkResult.reason} ${checkResult.handle || ''}`);

      // Handle failures
      if (!checkResult.logged_in) {
        if (firstFailureMinute === null) {
          firstFailureMinute = minute;
          firstFailureTick = tickRecord;
        }

        // Screenshot on first occurrence of each unique failure reason
        if (!seenFailureReasons.has(checkResult.reason)) {
          seenFailureReasons.add(checkResult.reason);
          
          const reportsDir = path.join(process.cwd(), 'docs', 'proofs', 'auth');
          fs.mkdirSync(reportsDir, { recursive: true });
          const screenshotPath = path.join(reportsDir, `b64-auth-fail-${checkResult.reason}-${Date.now()}.png`);
          
          try {
            await page.screenshot({ path: screenshotPath, fullPage: false });
          } catch {
            // Screenshot failed, continue
          }
          
          failureFingerprints.push({
            reason: checkResult.reason,
            url: checkResult.url,
            minute,
            screenshot_path: screenshotPath,
          });

          // Emit event
          try {
            const supabase = getSupabaseClient();
            await supabase.from('system_events').insert({
              event_type: 'EXECUTOR_B64_AUTH_FAILURE_CLASSIFIED',
              event_data: {
                reason: checkResult.reason,
                final_url: checkResult.url,
                minute,
                screenshot_path: screenshotPath,
              },
            });
          } catch {
            // Non-blocking
          }
        }
      }

      // Wait for next tick (except last one)
      if (tick < totalTicks - 1) {
        const elapsed = Date.now() - startTime;
        const waitTime = Math.max(0, (TICK_INTERVAL_SECONDS * 1000) - elapsed);
        await page.waitForTimeout(waitTime);
      }
    }

    // Calculate results
    const successfulTicks = ticks.filter(t => t.logged_in).length;
    const minutesOk = Math.floor(successfulTicks * TICK_INTERVAL_SECONDS / 60);
    const failRate = ticks.length > 0 ? ((ticks.length - successfulTicks) / ticks.length) * 100 : 0;

    // HARD ASSERTION: PASS only if logged_in=true for full duration with no login_redirect/challenge
    const hasLoginRedirect = ticks.some(t => t.reason === 'login_redirect');
    const hasChallenge = ticks.some(t => t.reason === 'challenge_suspected');
    const passed = !hasLoginRedirect && !hasChallenge && successfulTicks === ticks.length;

    return {
      ticks,
      minutes_ok: minutesOk,
      first_failure_minute: firstFailureMinute,
      fail_rate: failRate,
      passed,
      first_failure_tick: firstFailureTick,
      failure_fingerprints,
    };
  } finally {
    if (page) {
      await page.close().catch(() => {});
    }
    if (context) {
      await context.close().catch(() => {});
    }
    // Cleanup temp profile
    try {
      fs.rmSync(tempProfileDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }
}

async function writeReport(result: ProofResult): Promise<string> {
  const reportsDir = path.join(process.cwd(), 'docs', 'proofs', 'auth');
  fs.mkdirSync(reportsDir, { recursive: true });
  
  const timestamp = Date.now();
  const reportPath = path.join(reportsDir, `b64-auth-persistence-${timestamp}.md`);
  
  const statusIcon = result.passed ? '✅' : '❌';
  const statusText = result.passed ? 'PASS' : 'FAIL';
  
  const report = `# B64 Auth Persistence Proof Report

**Generated:** ${new Date().toISOString()}
**Proof ID:** ${timestamp}
**Duration:** ${PROOF_DURATION_MINUTES} minutes
**Tick Interval:** ${TICK_INTERVAL_SECONDS} seconds

## Summary

**Status:** ${statusIcon} **${statusText}**

- **Minutes OK:** ${result.minutes_ok} / ${PROOF_DURATION_MINUTES}
- **First Failure Minute:** ${result.first_failure_minute !== null ? result.first_failure_minute : 'N/A'}
- **Fail Rate:** ${result.fail_rate.toFixed(1)}%
- **Total Ticks:** ${result.ticks.length}
- **Successful Ticks:** ${result.ticks.filter(t => t.logged_in).length}

## Tick Records

| Minute | Timestamp | URL | Logged In | Reason | Handle |
|--------|-----------|-----|-----------|-------|--------|
${result.ticks.map(t => `| ${t.minute} | ${t.timestamp} | ${t.final_url.substring(0, 50)}... | ${t.logged_in ? '✅' : '❌'} | ${t.reason} | ${t.handle || 'N/A'} |`).join('\n')}

## Failure Fingerprints

${result.failure_fingerprints.length > 0 ? `
| Reason | URL | Minute | Screenshot |
|--------|-----|--------|------------|
${result.failure_fingerprints.map(f => `| ${f.reason} | ${f.url.substring(0, 50)}... | ${f.minute} | ${f.screenshot_path || 'N/A'} |`).join('\n')}
` : 'No failures detected.'}

## Hard Assertion

**PASS Criteria:**
- ✅ logged_in=true for full duration
- ✅ No login_redirect events
- ✅ No challenge_suspected events

**Result:** ${result.passed ? '✅ PASS' : '❌ FAIL'}
${!result.passed && result.first_failure_tick ? `
**First Failure:**
- Minute: ${result.first_failure_tick.minute}
- Reason: ${result.first_failure_tick.reason}
- URL: ${result.first_failure_tick.url}
` : ''}
`;

  fs.writeFileSync(reportPath, report, 'utf-8');
  return reportPath;
}

async function main(): Promise<void> {
  try {
    const result = await runB64AuthPersistenceProof();
    
    const reportPath = await writeReport(result);
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`           ${result.passed ? '✅ PASS' : '❌ FAIL'}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    console.log(`📊 Results:`);
    console.log(`   Minutes OK: ${result.minutes_ok} / ${PROOF_DURATION_MINUTES}`);
    console.log(`   Fail Rate: ${result.fail_rate.toFixed(1)}%`);
    if (result.first_failure_minute !== null) {
      console.log(`   First Failure: Minute ${result.first_failure_minute} (${result.first_failure_tick?.reason})`);
    }
    console.log(`\n📄 Report: ${reportPath}\n`);
    
    if (!result.passed) {
      console.error(`❌ FAIL: Auth persistence proof did not pass`);
      if (result.failure_fingerprints.length > 0) {
        console.error(`   Failure reasons: ${result.failure_fingerprints.map(f => f.reason).join(', ')}`);
      }
      process.exit(1);
    }
    
    console.log(`✅ PASS: Auth persisted for full ${PROOF_DURATION_MINUTES} minutes`);
  } catch (error: any) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}
