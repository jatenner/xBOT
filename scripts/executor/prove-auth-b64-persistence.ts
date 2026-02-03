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
const TICK_INTERVAL_SECONDS = parseInt(process.env.TICK_SECONDS || '60', 10);
const HUMAN_JITTER = process.env.HUMAN_JITTER === 'true';

// Create temp profile dir per run
const TEMP_PROFILE_BASE = path.join(process.cwd(), '.tmp', 'b64-auth-proofs');
const RUN_ID = `b64-persistence-${Date.now()}`;
const TEMP_PROFILE_DIR = path.join(TEMP_PROFILE_BASE, RUN_ID);

interface ForensicsSnapshot {
  timestamp: string;
  minute: number;
  final_url: string;
  logged_in: boolean;
  reason: string;
  cookie_count_x_com: number;
  cookie_count_twitter_com: number;
  has_auth_token: boolean;
  has_ct0: boolean;
  has_twid: boolean;
  has_cf_clearance: boolean;
  auth_token_expiry: number | null;
  ct0_expiry: number | null;
  twid_expiry: number | null;
  cf_clearance_expiry: number | null;
  localStorage_keys_count: number;
  sessionStorage_keys_count: number;
  indexeddb_exists: boolean;
  indexeddb_count: number;
  redirect_chain?: string[];
}

interface TickRecord {
  timestamp: string;
  minute: number;
  final_url: string;
  logged_in: boolean;
  reason: string;
  handle: string | null;
  forensics?: ForensicsSnapshot;
}

interface FailureFingerprint {
  reason: string;
  url: string;
  minute: number;
  screenshot_path: string | null;
  forensics_snapshot_path: string | null;
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

/**
 * Capture safe forensics snapshot (no cookie values, no secrets)
 */
async function captureForensics(page: Page, context: BrowserContext, minute: number, finalUrl: string, loggedIn: boolean, reason: string): Promise<ForensicsSnapshot> {
  try {
    // Get cookies (names and expiries only, no values)
    const cookies = await context.cookies();
    const xComCookies = cookies.filter(c => c.domain === '.x.com');
    const twitterComCookies = cookies.filter(c => c.domain === '.twitter.com');
    
    const cookieNames = new Set(cookies.map(c => c.name.toLowerCase()));
    const hasAuthToken = cookieNames.has('auth_token');
    const hasCt0 = cookieNames.has('ct0');
    const hasTwid = cookieNames.has('twid');
    const hasCfClearance = cookieNames.has('cf_clearance');
    
    // Get expiries (timestamps only)
    const authTokenCookie = cookies.find(c => c.name.toLowerCase() === 'auth_token');
    const ct0Cookie = cookies.find(c => c.name.toLowerCase() === 'ct0');
    const twidCookie = cookies.find(c => c.name.toLowerCase() === 'twid');
    const cfClearanceCookie = cookies.find(c => c.name.toLowerCase() === 'cf_clearance');
    
    // Get storage counts
    const storageCounts = await page.evaluate(() => {
      return {
        localStorage_keys_count: Object.keys(localStorage).length,
        sessionStorage_keys_count: Object.keys(sessionStorage).length,
      };
    });
    
    // Check IndexedDB
    const indexedDbInfo = await page.evaluate(() => {
      return new Promise<{ exists: boolean; count: number }>((resolve) => {
        if (!window.indexedDB) {
          resolve({ exists: false, count: 0 });
          return;
        }
        
        const request = indexedDB.databases();
        request.then((dbs) => {
          const xDb = dbs.find(db => db.name?.includes('x.com') || db.name?.includes('twitter'));
          resolve({
            exists: !!xDb,
            count: dbs.length,
          });
        }).catch(() => {
          resolve({ exists: false, count: 0 });
        });
      });
    });
    
    return {
      timestamp: new Date().toISOString(),
      minute,
      final_url: finalUrl,
      logged_in: loggedIn,
      reason,
      cookie_count_x_com: xComCookies.length,
      cookie_count_twitter_com: twitterComCookies.length,
      has_auth_token: hasAuthToken,
      has_ct0: hasCt0,
      has_twid: hasTwid,
      has_cf_clearance: hasCfClearance,
      auth_token_expiry: authTokenCookie?.expires ? Math.floor(authTokenCookie.expires) : null,
      ct0_expiry: ct0Cookie?.expires ? Math.floor(ct0Cookie.expires) : null,
      twid_expiry: twidCookie?.expires ? Math.floor(twidCookie.expires) : null,
      cf_clearance_expiry: cfClearanceCookie?.expires ? Math.floor(cfClearanceCookie.expires) : null,
      localStorage_keys_count: storageCounts.localStorage_keys_count,
      sessionStorage_keys_count: storageCounts.sessionStorage_keys_count,
      indexeddb_exists: indexedDbInfo.exists,
      indexeddb_count: indexedDbInfo.count,
    };
  } catch (error: any) {
    // Return minimal snapshot on error
    return {
      timestamp: new Date().toISOString(),
      minute,
      final_url: finalUrl,
      logged_in: loggedIn,
      reason,
      cookie_count_x_com: 0,
      cookie_count_twitter_com: 0,
      has_auth_token: false,
      has_ct0: false,
      has_twid: false,
      has_cf_clearance: false,
      auth_token_expiry: null,
      ct0_expiry: null,
      twid_expiry: null,
      cf_clearance_expiry: null,
      localStorage_keys_count: 0,
      sessionStorage_keys_count: 0,
      indexeddb_exists: false,
      indexeddb_count: 0,
    };
  }
}

async function checkLoggedInRobust(page: Page, context: BrowserContext, minute: number): Promise<{ logged_in: boolean; reason: string; handle: string | null; url: string; redirect_chain?: string[] }> {
  try {
    const urlBeforeGoto = page.url();
    const redirectChain: string[] = [urlBeforeGoto];
    
    // Capture redirect chain if login_redirect occurs
    const responseHandler = (response: any) => {
      const responseUrl = response.url();
      if (responseUrl && responseUrl !== urlBeforeGoto && !redirectChain.includes(responseUrl)) {
        redirectChain.push(responseUrl);
      }
    };
    
    page.on('response', responseHandler);
    
    try {
      await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2000); // Let page settle
      
      const finalUrl = page.url();
      if (!redirectChain.includes(finalUrl)) {
        redirectChain.push(finalUrl);
      }
    } finally {
      // Clean up listener
      page.removeListener('response', responseHandler);
    }
    
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
        redirect_chain: redirectChain.length > 1 ? redirectChain : undefined,
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
      const checkResult = await checkLoggedInRobust(page, context, Math.floor((Date.now() - startTime) / 60000));
      const currentMinute = Math.floor((Date.now() - startTime) / 60000);
      
      // Capture forensics snapshot on every tick
      const forensics = await captureForensics(page, context, currentMinute, checkResult.url, checkResult.logged_in, checkResult.reason);
      
      const tick: TickRecord = {
        timestamp: new Date().toISOString(),
        minute: currentMinute,
        final_url: checkResult.url,
        logged_in: checkResult.logged_in,
        reason: checkResult.reason,
        handle: checkResult.handle,
        forensics,
      };
      
      ticks.push(tick);
      
      const status = checkResult.logged_in ? '✅' : '❌';
      const forensicsSummary = `cookies:${forensics.cookie_count_x_com + forensics.cookie_count_twitter_com} auth_token:${forensics.has_auth_token} ct0:${forensics.has_ct0}`;
      console.log(`[B64_AUTH_PROOF] [${currentMinute}m] ${status} ${checkResult.reason} | ${forensicsSummary} | ${checkResult.url.substring(0, 50)}...`);
      
      // Handle failures
      if (!checkResult.logged_in) {
        // Take screenshot and forensics snapshot for unique failure reasons
        if (!seenFailureReasons.has(checkResult.reason)) {
          seenFailureReasons.add(checkResult.reason);
          
          const timestamp = Date.now();
          const screenshotPath = path.join(
            process.cwd(),
            'docs',
            'proofs',
            'auth',
            `b64-auth-persistence-fail-${checkResult.reason}-${timestamp}.png`
          );
          
          const forensicsSnapshotPath = path.join(
            process.cwd(),
            'docs',
            'proofs',
            'auth',
            `b64-auth-flip-snapshot-${checkResult.reason}-${timestamp}.json`
          );
          
          // Ensure directory exists
          const artifactsDir = path.join(process.cwd(), 'docs', 'proofs', 'auth');
          if (!fs.existsSync(artifactsDir)) {
            fs.mkdirSync(artifactsDir, { recursive: true });
          }
          
          let screenshotSaved = false;
          try {
            await page.screenshot({ path: screenshotPath, fullPage: true });
            screenshotSaved = true;
            console.log(`[B64_AUTH_PROOF] 📸 Screenshot saved: ${screenshotPath}`);
          } catch (e) {
            console.log(`[B64_AUTH_PROOF] ⚠️  Screenshot failed: ${e}`);
          }
          
          // Write forensics snapshot JSON (safe, no secrets)
          const snapshot = {
            ...forensics,
            redirect_chain: checkResult.redirect_chain,
          };
          
          try {
            fs.writeFileSync(forensicsSnapshotPath, JSON.stringify(snapshot, null, 2), 'utf-8');
            console.log(`[B64_AUTH_PROOF] 🔍 Forensics snapshot saved: ${forensicsSnapshotPath}`);
          } catch (e) {
            console.log(`[B64_AUTH_PROOF] ⚠️  Forensics snapshot failed: ${e}`);
          }
          
          failureFingerprints.push({
            reason: checkResult.reason,
            url: checkResult.url,
            minute: currentMinute,
            screenshot_path: screenshotSaved ? screenshotPath : null,
            forensics_snapshot_path: fs.existsSync(forensicsSnapshotPath) ? forensicsSnapshotPath : null,
          });
          
          // Emit event
          try {
            const supabase = getSupabaseClient();
            await supabase.from('system_events').insert({
              event_type: 'EXECUTOR_B64_AUTH_FAILURE_CLASSIFIED',
              event_data: {
                reason: checkResult.reason,
                final_url: checkResult.url,
                minute: currentMinute,
                temp_profile_dir: TEMP_PROFILE_DIR,
                screenshot_path: screenshotSaved ? screenshotPath : null,
                forensics_snapshot_path: fs.existsSync(forensicsSnapshotPath) ? forensicsSnapshotPath : null,
                forensics: snapshot,
              },
            });
          } catch (e) {
            // Don't fail on event write
          }
        }
      }
      
      // Wait for next tick (or until end time) with optional jitter
      let waitTime = Math.min(TICK_INTERVAL_SECONDS * 1000, endTime - Date.now());
      if (HUMAN_JITTER && waitTime > 0) {
        // Add ±20% jitter
        const jitterAmount = waitTime * 0.2;
        const jitter = (Math.random() * 2 - 1) * jitterAmount; // -20% to +20%
        waitTime = Math.max(1000, waitTime + jitter); // Minimum 1 second
      }
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

${result.failure_fingerprints.length > 0 ? result.failure_fingerprints.map(f => {
  const tick = result.ticks.find(t => t.minute === f.minute && t.reason === f.reason);
  const forensics = tick?.forensics;
  
  return `
### ${f.reason}

- **Minute:** ${f.minute}
- **URL:** ${f.url}
- **Screenshot:** ${f.screenshot_path ? `[${path.basename(f.screenshot_path)}](${f.screenshot_path})` : 'N/A'}
- **Forensics Snapshot:** ${f.forensics_snapshot_path ? `[${path.basename(f.forensics_snapshot_path)}](${f.forensics_snapshot_path})` : 'N/A'}
${forensics ? `
**Failure Fingerprint:**
- Cookie count (.x.com): ${forensics.cookie_count_x_com}
- Cookie count (.twitter.com): ${forensics.cookie_count_twitter_com}
- Has auth_token: ${forensics.has_auth_token}
- Has ct0: ${forensics.has_ct0}
- Has twid: ${forensics.has_twid}
- Has cf_clearance: ${forensics.has_cf_clearance}
- auth_token expiry: ${forensics.auth_token_expiry ? new Date(forensics.auth_token_expiry * 1000).toISOString() : 'N/A'}
- ct0 expiry: ${forensics.ct0_expiry ? new Date(forensics.ct0_expiry * 1000).toISOString() : 'N/A'}
- localStorage keys: ${forensics.localStorage_keys_count}
- sessionStorage keys: ${forensics.sessionStorage_keys_count}
- IndexedDB exists: ${forensics.indexeddb_exists}
- IndexedDB count: ${forensics.indexeddb_count}
` : ''}
`;
}).join('\n') : '- None'}

## Forensics Comparison

${result.ticks.length > 0 ? (() => {
  const firstTick = result.ticks[0];
  const failureTick = result.ticks.find(t => !t.logged_in);
  
  if (!failureTick || !firstTick?.forensics || !failureTick?.forensics) {
    return '- No forensics data available';
  }
  
  const f0 = firstTick.forensics;
  const fFail = failureTick.forensics;
  
  return `
### Minute 0 (Baseline)
- Cookies (.x.com): ${f0.cookie_count_x_com}
- Cookies (.twitter.com): ${f0.cookie_count_twitter_com}
- auth_token: ${f0.has_auth_token} (expiry: ${f0.auth_token_expiry ? new Date(f0.auth_token_expiry * 1000).toISOString() : 'N/A'})
- ct0: ${f0.has_ct0} (expiry: ${f0.ct0_expiry ? new Date(f0.ct0_expiry * 1000).toISOString() : 'N/A'})
- twid: ${f0.has_twid}
- localStorage: ${f0.localStorage_keys_count} keys
- sessionStorage: ${f0.sessionStorage_keys_count} keys
- IndexedDB: ${f0.indexeddb_exists ? 'exists' : 'none'} (${f0.indexeddb_count} DBs)

### Minute ${failureTick.minute} (Failure)
- Cookies (.x.com): ${fFail.cookie_count_x_com}
- Cookies (.twitter.com): ${fFail.cookie_count_twitter_com}
- auth_token: ${fFail.has_auth_token} (expiry: ${fFail.auth_token_expiry ? new Date(fFail.auth_token_expiry * 1000).toISOString() : 'N/A'})
- ct0: ${fFail.has_ct0} (expiry: ${fFail.ct0_expiry ? new Date(fFail.ct0_expiry * 1000).toISOString() : 'N/A'})
- twid: ${fFail.has_twid}
- localStorage: ${fFail.localStorage_keys_count} keys
- sessionStorage: ${fFail.sessionStorage_keys_count} keys
- IndexedDB: ${fFail.indexeddb_exists ? 'exists' : 'none'} (${fFail.indexeddb_count} DBs)

### Changes
- Cookie count change: ${(fFail.cookie_count_x_com + fFail.cookie_count_twitter_com) - (f0.cookie_count_x_com + f0.cookie_count_twitter_com)}
- auth_token disappeared: ${f0.has_auth_token && !fFail.has_auth_token ? 'YES ⚠️' : 'NO'}
- ct0 disappeared: ${f0.has_ct0 && !fFail.has_ct0 ? 'YES ⚠️' : 'NO'}
- twid disappeared: ${f0.has_twid && !fFail.has_twid ? 'YES ⚠️' : 'NO'}
`;
})() : '- No ticks recorded'}

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
