#!/usr/bin/env tsx
/**
 * 🍪 EXECUTOR COOKIE PERSISTENCE PROOF
 * 
 * Proves that cookies/session are actually being written and persisted in the userDataDir.
 * 
 * Usage:
 *   RUNNER_PROFILE_DIR=./.runner-profile pnpm run executor:prove:cookie-persist
 *   RUNNER_PROFILE_DIR=./.runner-profile BEFORE_AUTH=true pnpm run executor:prove:cookie-persist
 *   RUNNER_PROFILE_DIR=./.runner-profile AFTER_AUTH=true pnpm run executor:prove:cookie-persist
 *   RUNNER_PROFILE_DIR=./.runner-profile DELAY_MINUTES=5 pnpm run executor:prove:cookie-persist
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { chromium, BrowserContext } from 'playwright';
import { getRunnerPaths } from '../../src/infra/runnerProfile';

const paths = getRunnerPaths();
const BROWSER_USER_DATA_DIR_ABS = paths.user_data_dir_abs;

interface CookieCounts {
  x_com_count: number;
  twitter_com_count: number;
  total_count: number;
}

interface StorageFiles {
  cookies_db_exists: boolean;
  cookies_db_journal_exists: boolean;
  local_storage_exists: boolean;
  session_storage_exists: boolean;
  preferences_exists: boolean;
  login_data_exists: boolean;
}

interface CookiePersistenceResult {
  timestamp: string;
  phase: 'before_auth' | 'after_auth' | 'delayed_check';
  cookie_counts: CookieCounts;
  storage_files: StorageFiles;
  user_data_dir: string;
}

/**
 * Count cookies from browser context (counts only, no values)
 */
async function countCookies(context: BrowserContext): Promise<CookieCounts> {
  const cookies = await context.cookies();
  
  const xComCookies = cookies.filter(c => c.domain.includes('.x.com') || c.domain === 'x.com');
  const twitterComCookies = cookies.filter(c => c.domain.includes('.twitter.com') || c.domain === 'twitter.com');
  
  return {
    x_com_count: xComCookies.length,
    twitter_com_count: twitterComCookies.length,
    total_count: cookies.length,
  };
}

/**
 * Check existence of key storage files in profile directory
 */
function checkStorageFiles(userDataDir: string): StorageFiles {
  // Chrome stores cookies in SQLite database
  const cookiesDb = path.join(userDataDir, 'Default', 'Cookies');
  const cookiesDbJournal = path.join(userDataDir, 'Default', 'Cookies-journal');
  
  // Local storage (LevelDB)
  const localStorage = path.join(userDataDir, 'Default', 'Local Storage', 'leveldb');
  
  // Session storage
  const sessionStorage = path.join(userDataDir, 'Default', 'Session Storage');
  
  // Preferences (JSON)
  const preferences = path.join(userDataDir, 'Default', 'Preferences');
  
  // Login data (encrypted passwords, but we only check existence)
  const loginData = path.join(userDataDir, 'Default', 'Login Data');
  
  return {
    cookies_db_exists: fs.existsSync(cookiesDb),
    cookies_db_journal_exists: fs.existsSync(cookiesDbJournal),
    local_storage_exists: fs.existsSync(localStorage),
    session_storage_exists: fs.existsSync(sessionStorage),
    preferences_exists: fs.existsSync(preferences),
    login_data_exists: fs.existsSync(loginData),
  };
}

/**
 * Run cookie persistence check
 */
async function runCookiePersistenceCheck(phase: 'before_auth' | 'after_auth' | 'delayed_check'): Promise<CookiePersistenceResult> {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`           🍪 COOKIE PERSISTENCE PROOF - ${phase.toUpperCase().replace('_', ' ')}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  console.log(`📋 Configuration:`);
  console.log(`   user_data_dir_abs: ${paths.user_data_dir_abs}`);
  console.log(`   Phase: ${phase}`);
  console.log('');
  
  // Check storage files first (before launching browser)
  const storageFiles = checkStorageFiles(BROWSER_USER_DATA_DIR_ABS);
  
  console.log(`📁 Storage Files (existence check):`);
  console.log(`   Cookies DB: ${storageFiles.cookies_db_exists ? '✅ EXISTS' : '❌ MISSING'}`);
  console.log(`   Cookies DB Journal: ${storageFiles.cookies_db_journal_exists ? '✅ EXISTS' : '❌ MISSING'}`);
  console.log(`   Local Storage: ${storageFiles.local_storage_exists ? '✅ EXISTS' : '❌ MISSING'}`);
  console.log(`   Session Storage: ${storageFiles.session_storage_exists ? '✅ EXISTS' : '❌ MISSING'}`);
  console.log(`   Preferences: ${storageFiles.preferences_exists ? '✅ EXISTS' : '❌ MISSING'}`);
  console.log(`   Login Data: ${storageFiles.login_data_exists ? '✅ EXISTS' : '❌ MISSING'}`);
  console.log('');
  
  // Launch browser to check cookies
  console.log(`🚀 Launching browser to check cookies...`);
  const context = await chromium.launchPersistentContext(BROWSER_USER_DATA_DIR_ABS, {
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
  
  try {
    // Navigate to x.com to load cookies
    const page = await context.newPage();
    await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000); // Let cookies load
    
    // Count cookies
    const cookieCounts = await countCookies(context);
    
    console.log(`🍪 Cookie Counts (counts only, no values):`);
    console.log(`   .x.com cookies: ${cookieCounts.x_com_count}`);
    console.log(`   .twitter.com cookies: ${cookieCounts.twitter_com_count}`);
    console.log(`   Total cookies: ${cookieCounts.total_count}`);
    console.log('');
    
    await page.close();
    
    return {
      timestamp: new Date().toISOString(),
      phase,
      cookie_counts: cookieCounts,
      storage_files: storageFiles,
      user_data_dir: BROWSER_USER_DATA_DIR_ABS,
    };
  } finally {
    await context.close();
  }
}

async function main(): Promise<void> {
  const beforeAuth = process.env.BEFORE_AUTH === 'true';
  const afterAuth = process.env.AFTER_AUTH === 'true';
  const delayMinutes = parseInt(process.env.DELAY_MINUTES || '0', 10);
  
  let phase: 'before_auth' | 'after_auth' | 'delayed_check';
  if (beforeAuth) {
    phase = 'before_auth';
  } else if (afterAuth) {
    phase = 'after_auth';
  } else if (delayMinutes > 0) {
    phase = 'delayed_check';
  } else {
    // Default: run all phases
    console.log('📋 Running full cookie persistence check (before auth, after auth, delayed)...\n');
    
    // Phase 1: Before auth
    const resultBefore = await runCookiePersistenceCheck('before_auth');
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // Phase 2: After auth (if AUTH_OK exists)
    const AUTH_OK_PATH = paths.auth_marker_path;
    if (fs.existsSync(AUTH_OK_PATH)) {
      const resultAfter = await runCookiePersistenceCheck('after_auth');
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      
      // Phase 3: Delayed check (5 minutes)
      console.log(`⏱️  Waiting ${delayMinutes || 5} minutes before delayed check...\n`);
      await new Promise(resolve => setTimeout(resolve, (delayMinutes || 5) * 60 * 1000));
      
      const resultDelayed = await runCookiePersistenceCheck('delayed_check');
      
      // Summary
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('           📊 Cookie Persistence Summary');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      
      console.log(`Before Auth:`);
      console.log(`  .x.com cookies: ${resultBefore.cookie_counts.x_com_count}`);
      console.log(`  .twitter.com cookies: ${resultBefore.cookie_counts.twitter_com_count}`);
      console.log(`  Cookies DB exists: ${resultBefore.storage_files.cookies_db_exists ? '✅' : '❌'}`);
      
      console.log(`\nAfter Auth:`);
      console.log(`  .x.com cookies: ${resultAfter.cookie_counts.x_com_count}`);
      console.log(`  .twitter.com cookies: ${resultAfter.cookie_counts.twitter_com_count}`);
      console.log(`  Cookies DB exists: ${resultAfter.storage_files.cookies_db_exists ? '✅' : '❌'}`);
      
      console.log(`\nDelayed Check (${delayMinutes || 5} min):`);
      console.log(`  .x.com cookies: ${resultDelayed.cookie_counts.x_com_count}`);
      console.log(`  .twitter.com cookies: ${resultDelayed.cookie_counts.twitter_com_count}`);
      console.log(`  Cookies DB exists: ${resultDelayed.storage_files.cookies_db_exists ? '✅' : '❌'}`);
      
      // Analysis
      const cookiesIncreased = resultAfter.cookie_counts.x_com_count > resultBefore.cookie_counts.x_com_count ||
                                resultAfter.cookie_counts.twitter_com_count > resultBefore.cookie_counts.twitter_com_count;
      const cookiesPersisted = resultDelayed.cookie_counts.x_com_count >= resultAfter.cookie_counts.x_com_count &&
                               resultDelayed.cookie_counts.twitter_com_count >= resultAfter.cookie_counts.twitter_com_count;
      
      console.log(`\n📊 Analysis:`);
      console.log(`  Cookies increased after auth: ${cookiesIncreased ? '✅ YES' : '❌ NO'}`);
      console.log(`  Cookies persisted after delay: ${cookiesPersisted ? '✅ YES' : '❌ NO'}`);
      console.log(`  Storage files exist: ${resultDelayed.storage_files.cookies_db_exists ? '✅ YES' : '❌ NO'}`);
      
      if (!cookiesIncreased) {
        console.log(`\n⚠️  WARNING: Cookies did not increase after auth - session may not be persisted`);
      }
      if (!cookiesPersisted) {
        console.log(`\n⚠️  WARNING: Cookies decreased after delay - persistence may be failing`);
      }
      if (!resultDelayed.storage_files.cookies_db_exists) {
        console.log(`\n⚠️  WARNING: Cookies DB file does not exist - cookies may not be persisted to disk`);
      }
      
      process.exit(cookiesIncreased && cookiesPersisted && resultDelayed.storage_files.cookies_db_exists ? 0 : 1);
    } else {
      console.log('⚠️  AUTH_OK marker not found - skipping after_auth and delayed checks');
      console.log('   Run: pnpm run executor:auth first');
      process.exit(1);
    }
    return;
  }
  
  // Single phase run
  const result = await runCookiePersistenceCheck(phase);
  
  console.log('\n✅ Cookie persistence check complete');
  process.exit(0);
}

if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}
