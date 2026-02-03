#!/usr/bin/env tsx
/**
 * 🔐 EXECUTOR B64 AUTH PERSISTENCE PROOF
 * 
 * Measures how long cookie auth (from TWITTER_SESSION_B64) stays valid.
 * Uses a brand new temp profile dir per run (no persistent profile).
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

// Create temp profile dir per run
const TEMP_PROFILE_BASE = path.join(process.cwd(), '.tmp', 'b64-auth-proofs');
const RUN_ID = `b64-persistence-${Date.now()}`;
const TEMP_PROFILE_DIR = path.join(TEMP_PROFILE_BASE, RUN_ID);

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
  failure_fingerprints: FailureFingerprint[];
}

/**
 * Load cookies from TWITTER_SESSION_B64 environment variable
 */
function loadCookiesFromB64(): Cookie[] {
  const sessionB64 = process.env.TWITTER_SESSION_B64?.trim();
  
  if (!sessionB64) {
    throw new Error('TWITTER_SESSION_B64 environment variable is required');
  }

  try {
    // Decode base64
    const decoded = Buffer.from(sessionB64, 'base64').toString('utf8');
    const sessionData = JSON.parse(decoded);
    
    // Normalize cookie format (handle both {cookies: [...]} and direct array)
    let cookies: any[] = [];
    if (Array.isArray(sessionData.cookies)) {
      cookies = sessionData.cookies;
    } else if (Array.isArray(sessionData)) {
      cookies = sessionData;
    } else {
      throw new Error('Invalid session format: expected {cookies: [...]} or [...]');
    }
    
    // Normalize to Playwright cookie format
    const normalizedCookies: Cookie[] = cookies.map((c: any) => {
      // Handle both .x.com and .twitter.com domains
      const domain = c.domain || c.Domain || '';
      const normalizedDomain = domain.startsWith('.') ? domain : `.${domain}`;
      
      return {
        name: c.name || c.Name || '',
        value: c.value || c.Value || '',
        domain: normalizedDomain.includes('x.com') ? '.x.com' : '.twitter.com',
        path: c.path || c.Path || '/',
        expires: c.expires || c.Expires || -1,
        httpOnly: c.httpOnly || c.HttpOnly || false,
        secure: c.secure || c.Secure !== false,
        sameSite: c.sameSite || c.SameSite || 'None',
      };
    });
    
    // Duplicate for both domains
    const duplicatedCookies: Cookie[] = [];
    for (const cookie of normalizedCookies) {
      duplicatedCookies.push(cookie);
      // Also add for the other domain
      if (cookie.domain === '.x.com') {
        duplicatedCookies.push({ ...cookie, domain: '.twitter.com' });
      } else if (cookie.domain === '.twitter.com') {
        duplicatedCookies.push({ ...cookie, domain: '.x.com' });
      }
    }
    
    console.log(`[B64_AUTH_PROOF] ✅ Loaded ${duplicatedCookies.length} cookies from TWITTER_SESSION_B64`);
    return duplicatedCookies;
    
  } catch (error: any) {
    throw new Error(`Failed to load cookies from TWITTER_SESSION_B64: ${error.message}`);
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
        !!document.querySelector('[data-testid*="cookie" i]');
      
      const url = window.location.href;
      const isConsentFlow = url.includes('/i/flow/consent');
      
      return {
        hasConsentWall: hasConsentWall || isConsentFlow,
        url: window.location.href,
      };
    });
    
    if (consentCheck.hasConsentWall) {
      return {
        logged_in: false,
        reason: 'consent_wall_detected',
        handle: null,
        url: consentCheck.url,
      };
    }
    
    // Check for logged-in indicators
    const loggedInCheck = await page.evaluate(() => {
      // Check for compose box
      const composeBox = document.querySelector('[data-testid="tweetTextarea_0"]') ||
                         document.querySelector('[data-testid="tweetTextarea_0"]') ||
                         document.querySelector('[contenteditable="true"][data-testid*="tweet"]');
      
      // Check for account menu
      const accountMenu = document.querySelector('[data-testid="SideNav_AccountSwitcher_Button"]') ||
                          document.querySelector('[data-testid="AppTabBar_Profile_Link"]');
      
      // Check for home timeline
      const timeline = document.querySelector('[data-testid="primaryColumn"]') ||
                       document.querySelector('[aria-label="Home timeline"]');
      
      // Try to extract handle from page
      let handle: string | null = null;
      const handleMatch = window.location.href.match(/x\.com\/([^\/\?]+)/);
      if (handleMatch && handleMatch[1] && handleMatch[1] !== 'home' && handleMatch[1] !== 'i') {
        handle = handleMatch[1];
      }
      
      // Check for handle in account switcher
      if (!handle) {
        const accountButton = document.querySelector('[data-testid="SideNav_AccountSwitcher_Button"]');
        if (accountButton) {
          const text = accountButton.textContent || '';
          const handleMatch = text.match(/@(\w+)/);
          if (handleMatch) {
            handle = handleMatch[1];
          }
        }
      }
      
      return {
        logged_in: !!(composeBox || accountMenu || timeline),
        handle: handle,
      };
    });
    
    if (loggedInCheck.logged_in) {
      return {
        logged_in: true,
        reason: 'ok',
        handle: loggedInCheck.handle,
        url: finalUrl,
      };
    }
    
    // Default to unknown failure
    return {
      logged_in: false,
      reason: 'unknown',
      handle: null,
      url: finalUrl,
    };
    
  } catch (error: any) {
    return {
      logged_in: false,
      reason: 'unknown',
      handle: null,
      url: page.url(),
    };
  }
}

async function runAuthB64PersistenceProof(): Promise<ProofResult> {
  const cookies = loadCookiesFromB64();
  
  // Ensure temp profile dir exists
  if (!fs.existsSync(TEMP_PROFILE_DIR)) {
    fs.mkdirSync(TEMP_PROFILE_DIR, { recursive: true });
  }
  
  const ticks: TickRecord[] = [];
  const failureFingerprints: FailureFingerprint[] = [];
  const seenFailureReasons = new Set<string>();
  
  let context: BrowserContext | null = null;
  let page: Page | null = null;
  
  try {
    // Launch browser with temp profile
    console.log(`[B64_AUTH_PROOF] 🚀 Launching browser with temp profile: ${TEMP_PROFILE_DIR}`);
    context = await chromium.launchPersistentContext(TEMP_PROFILE_DIR, {
      headless: true,
      channel: 'chrome',
      args: [
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-blink-features=AutomationControlled',
      ],
    });
    
    page = await context.newPage();
    
    // Inject cookies
    console.log(`[B64_AUTH_PROOF] 📋 Injecting ${cookies.length} cookies...`);
    await context.addCookies(cookies);
    console.log(`[B64_AUTH_PROOF] ✅ Cookies injected`);
    
    const startTime = Date.now();
    const endTime = startTime + (PROOF_DURATION_MINUTES * 60 * 1000);
    let minute = 0;
    
    console.log(`[B64_AUTH_PROOF] ⏱️  Starting ${PROOF_DURATION_MINUTES}-minute persistence proof...`);
    console.log(`[B64_AUTH_PROOF]   Ticking every ${TICK_INTERVAL_SECONDS} seconds\n`);
    
    while (Date.now() < endTime) {
      const checkResult = await checkLoggedInRobust(page);
      const currentMinute = Math.floor((Date.now() - startTime) / 60000);
      
      const tick: TickRecord = {
        timestamp: new Date().toISOString(),
        minute: currentMinute,
        final_url: checkResult.url,
        logged_in: checkResult.logged_in,
        reason: checkResult.reason,
        handle: checkResult.handle,
      };
      
      ticks.push(tick);
      
      const status = checkResult.logged_in ? '✅' : '❌';
      console.log(`[B64_AUTH_PROOF] [${currentMinute}m] ${status} ${checkResult.reason} | ${checkResult.url.substring(0, 50)}...`);
      
      // Handle failures
      if (!checkResult.logged_in) {
        // Take screenshot for unique failure reasons
        if (!seenFailureReasons.has(checkResult.reason)) {
          seenFailureReasons.add(checkResult.reason);
          
          const screenshotPath = path.join(
            process.cwd(),
            'docs',
            'proofs',
            'auth',
            `b64-auth-persistence-fail-${checkResult.reason}-${Date.now()}.png`
          );
          
          // Ensure directory exists
          const screenshotDir = path.dirname(screenshotPath);
          if (!fs.existsSync(screenshotDir)) {
            fs.mkdirSync(screenshotDir, { recursive: true });
          }
          
          try {
            await page.screenshot({ path: screenshotPath, fullPage: true });
            
            failureFingerprints.push({
              reason: checkResult.reason,
              url: checkResult.url,
              minute: currentMinute,
              screenshot_path: screenshotPath,
            });
            
            // Emit event
            const supabase = getSupabaseClient();
            await supabase.from('system_events').insert({
              event_type: 'EXECUTOR_B64_AUTH_FAILURE_CLASSIFIED',
              event_data: {
                reason: checkResult.reason,
                final_url: checkResult.url,
                minute: currentMinute,
                temp_profile_dir: TEMP_PROFILE_DIR,
                screenshot_path: screenshotPath,
              },
            }).catch(() => {}); // Don't fail on event write
            
            console.log(`[B64_AUTH_PROOF] 📸 Screenshot saved: ${screenshotPath}`);
          } catch (e) {
            failureFingerprints.push({
              reason: checkResult.reason,
              url: checkResult.url,
              minute: currentMinute,
              screenshot_path: null,
            });
          }
        }
      }
      
      // Wait for next tick (or until end time)
      const waitTime = Math.min(TICK_INTERVAL_SECONDS * 1000, endTime - Date.now());
      if (waitTime > 0) {
        await page.waitForTimeout(waitTime);
      }
      
      minute++;
    }
    
  } finally {
    if (page) {
      await page.close().catch(() => {});
    }
    if (context) {
      await context.close().catch(() => {});
    }
    
    // Cleanup temp profile
    try {
      fs.rmSync(TEMP_PROFILE_DIR, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }
  
  // Calculate results
  const successfulTicks = ticks.filter(t => t.logged_in).length;
  const minutesOk = successfulTicks;
  const firstFailureTick = ticks.find(t => !t.logged_in);
  const firstFailureMinute = firstFailureTick ? firstFailureTick.minute : null;
  const failRate = ticks.length > 0 ? ((ticks.length - successfulTicks) / ticks.length) * 100 : 0;
  
  // HARD ASSERTION: PASS only if logged_in=true for full duration with no login_redirect/challenge
  const hasLoginRedirect = ticks.some(t => t.reason === 'login_redirect');
  const hasChallenge = ticks.some(t => t.reason === 'challenge_suspected');
  const allLoggedIn = ticks.every(t => t.logged_in);
  
  const passed = allLoggedIn && !hasLoginRedirect && !hasChallenge;
  
  return {
    ticks,
    minutes_ok: minutesOk,
    first_failure_minute: firstFailureMinute,
    fail_rate: failRate,
    passed,
    failure_fingerprints: failureFingerprints,
  };
}

async function writeReport(result: ProofResult): Promise<string> {
  const reportsDir = path.join(process.cwd(), 'docs', 'proofs', 'auth');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }
  
  const reportPath = path.join(reportsDir, `b64-auth-persistence-${Date.now()}.md`);
  
  const statusEmoji = result.passed ? '✅' : '❌';
  const statusText = result.passed ? 'PASS' : 'FAIL';
  
  const report = `# B64 Auth Persistence Proof Report

**Generated:** ${new Date().toISOString()}
**Duration:** ${PROOF_DURATION_MINUTES} minutes
**Tick Interval:** ${TICK_INTERVAL_SECONDS} seconds

## Status

**Status:** ${statusEmoji} **${statusText}**

## Summary

- **Minutes OK:** ${result.minutes_ok} / ${PROOF_DURATION_MINUTES}
- **First Failure Minute:** ${result.first_failure_minute !== null ? result.first_failure_minute : 'N/A'}
- **Fail Rate:** ${result.fail_rate.toFixed(1)}%
- **Total Ticks:** ${result.ticks.length}

## Tick Table

| Minute | Timestamp | Logged In | Reason | Handle | URL |
|--------|-----------|-----------|--------|--------|-----|
${result.ticks.map(t => `| ${t.minute} | ${t.timestamp} | ${t.logged_in ? '✅' : '❌'} | ${t.reason} | ${t.handle || 'N/A'} | ${t.final_url.substring(0, 60)}... |`).join('\n')}

## Failure Fingerprints

${result.failure_fingerprints.length > 0 ? result.failure_fingerprints.map(f => `
### ${f.reason}

- **Minute:** ${f.minute}
- **URL:** ${f.url}
- **Screenshot:** ${f.screenshot_path ? `[${path.basename(f.screenshot_path)}](${f.screenshot_path})` : 'N/A'}
`).join('\n') : '- None'}

## Hard Assertion

**PASS Criteria:**
- ✅ All ticks logged_in=true
- ✅ No login_redirect events
- ✅ No challenge_suspected events

**Result:** ${result.passed ? '✅ PASS' : '❌ FAIL'}
${!result.passed ? `
**Failure Reason:** ${result.failure_fingerprints.length > 0 ? result.failure_fingerprints[0].reason : 'Unknown'}
` : ''}
`;

  fs.writeFileSync(reportPath, report, 'utf-8');
  return reportPath;
}

async function main(): Promise<void> {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           🔐 B64 AUTH PERSISTENCE PROOF');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  console.log(`📋 Configuration:`);
  console.log(`   Duration: ${PROOF_DURATION_MINUTES} minutes`);
  console.log(`   Tick Interval: ${TICK_INTERVAL_SECONDS} seconds`);
  console.log(`   Temp Profile: ${TEMP_PROFILE_DIR}\n`);
  
  try {
    const result = await runAuthB64PersistenceProof();
    const reportPath = await writeReport(result);
    
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    console.log(`📄 Report written: ${reportPath}\n`);
    
    if (result.passed) {
      console.log(`✅ PASS: Auth persisted for ${result.minutes_ok} minutes with 0 failures`);
      process.exit(0);
    } else {
      console.log(`❌ FAIL: Auth failed after ${result.first_failure_minute !== null ? result.first_failure_minute : 'unknown'} minutes`);
      console.log(`   Failure reason: ${result.failure_fingerprints.length > 0 ? result.failure_fingerprints[0].reason : 'unknown'}`);
      console.log(`   Report: ${reportPath}`);
      process.exit(1);
    }
    
  } catch (error: any) {
    console.error(`❌ FATAL ERROR: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}
