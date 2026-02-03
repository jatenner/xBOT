#!/usr/bin/env tsx
/**
 * 🔐 EXECUTOR AUTH - Operator-Driven Login Repair
 * 
 * Headed browser session for repairing login/challenge walls.
 * STRICTLY operator-driven: no automated login attempts.
 * 
 * Usage:
 *   RUNNER_PROFILE_DIR=./.runner-profile pnpm run executor:auth
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { chromium, BrowserContext, Page } from 'playwright';
import { getRunnerPaths, RUNNER_PROFILE_PATHS } from '../../src/infra/runnerProfile';
import { checkWhoami } from '../../src/utils/whoamiAuth';

const paths = getRunnerPaths();
const BROWSER_USER_DATA_DIR = paths.user_data_dir_abs;
const AUTH_REQUIRED_PATH = RUNNER_PROFILE_PATHS.authRequired();
const AUTH_OK_PATH = paths.auth_marker_path;
const PIDFILE_PATH = RUNNER_PROFILE_PATHS.pidFile();

async function checkLoggedInRobust(page: Page): Promise<{ logged_in: boolean; handle: string | null; url: string; reason: string }> {
  try {
    await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded', timeout: 60000 });
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

async function main(): Promise<void> {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           🔐 EXECUTOR AUTH - Operator-Driven Login Repair');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  console.log(`📋 Configuration:`);
  console.log(`   RUNNER_PROFILE_DIR: ${paths.runner_profile_dir_raw}`);
  console.log(`   Browser profile: ${BROWSER_USER_DATA_DIR}`);
  console.log(`   Mode: HEADED (visible browser)`);
  console.log(`   Auth marker: ${AUTH_OK_PATH}`);
  console.log('');
  
  // Warn if daemon is running
  if (fs.existsSync(PIDFILE_PATH)) {
    try {
      const pidfileContent = fs.readFileSync(PIDFILE_PATH, 'utf-8').trim();
      const pid = parseInt(pidfileContent.split(':')[0], 10);
      try {
        execSync(`ps -p ${pid} > /dev/null 2>&1`, { encoding: 'utf-8' });
        console.log('⚠️  WARNING: Executor daemon is running (PID: ' + pid + ')');
        console.log('⚠️  Consider stopping daemon first: pnpm run executor:stop');
        console.log('');
      } catch {
        // Stale lock - ignore
      }
    } catch {
      // Ignore
    }
  }
  
  // Check if AUTH_REQUIRED file exists
  if (fs.existsSync(AUTH_REQUIRED_PATH)) {
    console.log('⚠️  AUTH_REQUIRED file detected - login repair needed');
  }
  
  // Ensure user data dir exists
  if (!fs.existsSync(BROWSER_USER_DATA_DIR)) {
    fs.mkdirSync(BROWSER_USER_DATA_DIR, { recursive: true });
  }
  
  console.log('🚀 Launching headed browser...');
  // Use launchPersistentContext to use the profile directory directly
  const context = await chromium.launchPersistentContext(BROWSER_USER_DATA_DIR, {
    headless: false, // HEADED for login repair
    channel: 'chrome',
    args: [
      '--no-first-run',
      '--no-default-browser-check',
    ],
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 720 },
  });
  
  const page = await context.newPage();
  
  console.log('🌐 Navigating to https://x.com/home...');
  await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(3000); // Let page settle
  
  // Check initial auth state
  const initialAuth = await checkLoggedInRobust(page);
  
  if (initialAuth.logged_in) {
    console.log(`✅ Already logged in: handle=${initialAuth.handle || 'unknown'}`);
    
    // Write AUTH_OK.json immediately
    const authOkData = {
      timestamp: new Date().toISOString(),
      handle: initialAuth.handle,
      runner_profile_dir_abs: paths.runner_profile_dir_abs,
      user_data_dir_abs: paths.user_data_dir_abs,
      last_success_url: initialAuth.url,
    };
    
    fs.writeFileSync(AUTH_OK_PATH, JSON.stringify(authOkData, null, 2), 'utf-8');
    console.log(`✅ AUTH_OK marker written: ${AUTH_OK_PATH}`);
    
    // Emit EXECUTOR_AUTH_OK event
    try {
      const { getSupabaseClient } = await import('../../src/db/index');
      const supabase = getSupabaseClient();
      await supabase.from('system_events').insert({
        event_type: 'EXECUTOR_AUTH_OK',
        severity: 'info',
        message: `Executor auth OK: logged_in=true handle=${initialAuth.handle || 'unknown'}`,
        event_data: {
          handle: initialAuth.handle,
          url: initialAuth.url,
          runner_profile_dir_abs: paths.runner_profile_dir_abs,
          user_data_dir_abs: paths.user_data_dir_abs,
          timestamp: new Date().toISOString(),
        },
        created_at: new Date().toISOString(),
      });
    } catch (e) {
      console.warn(`⚠️  Failed to emit event: ${(e as Error).message}`);
    }
    
    // Remove AUTH_REQUIRED file if it exists
    if (fs.existsSync(AUTH_REQUIRED_PATH)) {
      fs.unlinkSync(AUTH_REQUIRED_PATH);
      console.log('✅ Removed AUTH_REQUIRED file');
    }
    
    await page.close();
    await context.close();
    console.log('✅ Auth session complete');
    process.exit(0);
  }
  
  // Not logged in - operator-driven repair
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           ⏸️  OPERATOR ACTION REQUIRED');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log(`Current URL: ${initialAuth.url}`);
  console.log(`Status: ${initialAuth.logged_in ? 'Logged in' : `Not logged in (${initialAuth.reason})`}`);
  console.log('');
  console.log('📋 Instructions:');
  console.log('   1. Complete login/consent manually in the open browser window');
  console.log('   2. Navigate to https://x.com/home if needed');
  console.log('   3. Ensure you see your timeline (compose box visible)');
  console.log('   4. Press ENTER in this terminal to continue');
  console.log('');
  
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  
  await new Promise<void>((resolve) => {
    rl.question('Press ENTER after completing login/consent in browser... ', () => {
      rl.close();
      resolve();
    });
  });
  
  // Re-check auth after operator input
  console.log('\n🔍 Re-checking authentication...');
  const finalAuth = await checkLoggedInRobust(page);
  
  if (!finalAuth.logged_in) {
    console.error(`❌ Still not logged in: reason=${finalAuth.reason}`);
    console.error(`   URL: ${finalAuth.url}`);
    
    // Save screenshot
    const reportsDir = path.join(process.cwd(), 'docs', 'proofs', 'auth');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }
    const screenshotPath = path.join(reportsDir, `auth-repair-fail-${Date.now()}.png`);
    try {
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log(`📸 Screenshot saved: ${screenshotPath}`);
    } catch (e) {
      console.warn(`⚠️  Failed to take screenshot: ${(e as Error).message}`);
    }
    
    // Emit EXECUTOR_AUTH_REQUIRED
    try {
      const { getSupabaseClient } = await import('../../src/db/index');
      const supabase = getSupabaseClient();
      await supabase.from('system_events').insert({
        event_type: 'EXECUTOR_AUTH_REQUIRED',
        severity: 'warning',
        message: `Auth repair failed: ${finalAuth.reason}`,
        event_data: {
          reason: finalAuth.reason,
          url: finalAuth.url,
          runner_profile_dir_abs: paths.runner_profile_dir_abs,
          user_data_dir_abs: paths.user_data_dir_abs,
          timestamp: new Date().toISOString(),
        },
        created_at: new Date().toISOString(),
      });
    } catch (e) {
      console.warn(`⚠️  Failed to emit event: ${(e as Error).message}`);
    }
    
    await page.close();
    await context.close();
    console.error('\n❌ Auth repair failed - AUTH_OK.json not created');
    process.exit(1);
  }
  
  // Success - write AUTH_OK.json
  console.log(`✅ Login verified: handle=${finalAuth.handle || 'unknown'}`);
  
  const authOkData = {
    timestamp: new Date().toISOString(),
    handle: finalAuth.handle,
    runner_profile_dir_abs: paths.runner_profile_dir_abs,
    user_data_dir_abs: paths.user_data_dir_abs,
    last_success_url: finalAuth.url,
  };
  
  fs.writeFileSync(AUTH_OK_PATH, JSON.stringify(authOkData, null, 2), 'utf-8');
  console.log(`✅ AUTH_OK marker written: ${AUTH_OK_PATH}`);
  
  // Emit EXECUTOR_AUTH_OK event
  try {
    const { getSupabaseClient } = await import('../../src/db/index');
    const supabase = getSupabaseClient();
    await supabase.from('system_events').insert({
      event_type: 'EXECUTOR_AUTH_OK',
      severity: 'info',
      message: `Executor auth OK: logged_in=true handle=${finalAuth.handle || 'unknown'}`,
      event_data: {
        handle: finalAuth.handle,
        url: finalAuth.url,
        runner_profile_dir_abs: paths.runner_profile_dir_abs,
        user_data_dir_abs: paths.user_data_dir_abs,
        timestamp: new Date().toISOString(),
      },
      created_at: new Date().toISOString(),
    });
  } catch (e) {
    console.warn(`⚠️  Failed to emit event: ${(e as Error).message}`);
  }
  
  console.log('🧹 Closing browser...');
  await page.close();
  await context.close();
  
  // Remove AUTH_REQUIRED file if it exists
  if (fs.existsSync(AUTH_REQUIRED_PATH)) {
    fs.unlinkSync(AUTH_REQUIRED_PATH);
    console.log('✅ Removed AUTH_REQUIRED file');
  }
  
  console.log('✅ Auth session complete');
}

main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
