#!/usr/bin/env tsx
/**
 * 🔬 POOL SESSION DIAGNOSTIC
 * 
 * Diagnoses whether UnifiedBrowserPool correctly applies TWITTER_SESSION_B64
 * via storageState in the same path the harvester uses.
 */

import 'dotenv/config';
import * as crypto from 'crypto';
import { UnifiedBrowserPool } from '../../src/browser/UnifiedBrowserPool';

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('        🔬 POOL SESSION DIAGNOSTIC');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // STEP 1: Load and print env info
  console.log('STEP 1 — Environment Check\n');
  
  console.log(`   EXECUTION_MODE: ${process.env.EXECUTION_MODE || 'not set'}`);
  console.log(`   P1_MODE: ${process.env.P1_MODE || 'not set'}`);
  
  const sessionB64 = process.env.TWITTER_SESSION_B64?.trim();
  if (!sessionB64) {
    console.error('   ❌ TWITTER_SESSION_B64 is not set');
    process.exit(1);
  }
  
  console.log(`   TWITTER_SESSION_B64 length: ${sessionB64.length}`);
  
  // Calculate sha12 (first 12 chars of SHA256 hash)
  const hash = crypto.createHash('sha256').update(sessionB64).digest('hex');
  const sha12 = hash.substring(0, 12);
  console.log(`   TWITTER_SESSION_B64 sha12: ${sha12}\n`);

  // STEP 2: Acquire context using UnifiedBrowserPool (same as harvester)
  console.log('STEP 2 — Acquiring Browser Context via UnifiedBrowserPool\n');
  
  const pool = UnifiedBrowserPool.getInstance();
  const page = await pool.acquirePage('pool_session_diagnostic');
  
  console.log(`   ✅ Context acquired\n`);

  // STEP 3: Navigate to /home and wait
  console.log('STEP 3 — Navigation Test\n');
  
  console.log(`   Navigating to https://x.com/home...`);
  await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded', timeout: 30000 });
  
  console.log(`   Waiting 8 seconds after page load...`);
  await page.waitForTimeout(8000);
  
  const finalUrl = page.url();
  const title = await page.title();
  
  console.log(`   ✅ Navigation complete`);
  console.log(`   Final URL: ${finalUrl}`);
  console.log(`   Page title: ${title}\n`);

  // STEP 4: Check DOM markers
  console.log('STEP 4 — DOM Markers Check\n');
  
  const domCheck = await page.evaluate(() => {
    const primaryColumn = document.querySelector('[data-testid="primaryColumn"]');
    const homeTimeline = document.querySelector('[aria-label="Home timeline"]');
    const composeButton = document.querySelector('[data-testid="SideNav_NewTweet_Button"]');
    
    return {
      hasPrimaryColumn: !!primaryColumn,
      hasHomeTimeline: !!homeTimeline,
      hasComposeButton: !!composeButton,
      bodyText: document.body?.innerText?.substring(0, 200) || '',
    };
  });
  
  console.log(`   hasPrimaryColumn: ${domCheck.hasPrimaryColumn}`);
  console.log(`   hasHomeTimeline: ${domCheck.hasHomeTimeline}`);
  console.log(`   hasComposeButton: ${domCheck.hasComposeButton}`);
  console.log(`   Body text preview: ${domCheck.bodyText.substring(0, 100)}...\n`);

  // STEP 5: Cookie diagnostics
  console.log('STEP 5 — Cookie Diagnostics\n');
  
  const context = page.context();
  const cookies = await context.cookies();
  
  console.log(`   Total cookies count: ${cookies.length}`);
  
  const authTokenCookie = cookies.find(c => c.name.toLowerCase() === 'auth_token');
  const ct0Cookie = cookies.find(c => c.name.toLowerCase() === 'ct0');
  
  console.log(`   auth_token exists: ${!!authTokenCookie}`);
  if (authTokenCookie) {
    console.log(`   auth_token domain: ${authTokenCookie.domain}`);
    console.log(`   auth_token path: ${authTokenCookie.path}`);
    console.log(`   auth_token expires: ${authTokenCookie.expires === -1 ? 'session' : new Date(authTokenCookie.expires * 1000).toISOString()}`);
  }
  
  console.log(`   ct0 exists: ${!!ct0Cookie}`);
  if (ct0Cookie) {
    console.log(`   ct0 domain: ${ct0Cookie.domain}`);
    console.log(`   ct0 path: ${ct0Cookie.path}`);
    console.log(`   ct0 expires: ${ct0Cookie.expires === -1 ? 'session' : new Date(ct0Cookie.expires * 1000).toISOString()}`);
  }
  
  // Show cookie domains breakdown
  const domainCounts: Record<string, number> = {};
  cookies.forEach(c => {
    domainCounts[c.domain] = (domainCounts[c.domain] || 0) + 1;
  });
  console.log(`\n   Cookie domains:`);
  Object.entries(domainCounts).forEach(([domain, count]) => {
    console.log(`     ${domain}: ${count} cookies`);
  });
  
  // Check if auth_token/ct0 exist for both domains
  const authTokenXCom = cookies.find(c => c.name.toLowerCase() === 'auth_token' && c.domain === '.x.com');
  const authTokenTwitterCom = cookies.find(c => c.name.toLowerCase() === 'auth_token' && c.domain === '.twitter.com');
  const ct0XCom = cookies.find(c => c.name.toLowerCase() === 'ct0' && c.domain === '.x.com');
  const ct0TwitterCom = cookies.find(c => c.name.toLowerCase() === 'ct0' && c.domain === '.twitter.com');
  
  console.log(`\n   Critical cookies domain check:`);
  console.log(`     auth_token on .x.com: ${!!authTokenXCom}`);
  console.log(`     auth_token on .twitter.com: ${!!authTokenTwitterCom}`);
  console.log(`     ct0 on .x.com: ${!!ct0XCom}`);
  console.log(`     ct0 on .twitter.com: ${!!ct0TwitterCom}`);

  // STEP 6: Check storageState path
  console.log('\nSTEP 6 — StorageState Path Check\n');
  
  // Check if twitter_session.json exists
  const fs = await import('fs');
  const path = await import('path');
  const sessionFile = path.join(process.cwd(), 'twitter_session.json');
  if (fs.existsSync(sessionFile)) {
    const stats = fs.statSync(sessionFile);
    console.log(`   twitter_session.json exists: yes`);
    console.log(`   twitter_session.json path: ${sessionFile}`);
    console.log(`   twitter_session.json modified: ${stats.mtime.toISOString()}`);
    console.log(`   twitter_session.json size: ${stats.size} bytes`);
    
    try {
      const sessionData = JSON.parse(fs.readFileSync(sessionFile, 'utf-8'));
      console.log(`   twitter_session.json cookies count: ${sessionData.cookies?.length || 0}`);
      
      // Check if auth_token and ct0 are in the file
      const fileAuthToken = sessionData.cookies?.find((c: any) => c.name?.toLowerCase() === 'auth_token');
      const fileCt0 = sessionData.cookies?.find((c: any) => c.name?.toLowerCase() === 'ct0');
      console.log(`   twitter_session.json has auth_token: ${!!fileAuthToken}`);
      console.log(`   twitter_session.json has ct0: ${!!fileCt0}`);
      if (fileAuthToken) {
        console.log(`   twitter_session.json auth_token domain: ${fileAuthToken.domain || 'N/A'}`);
      }
      if (fileCt0) {
        console.log(`   twitter_session.json ct0 domain: ${fileCt0.domain || 'N/A'}`);
      }
    } catch (e) {
      console.log(`   twitter_session.json parse error: ${(e as Error).message}`);
    }
  } else {
    console.log(`   twitter_session.json exists: no`);
  }
  
  // Check if cookies match between context and file
  console.log(`\n   Cookie comparison:`);
  console.log(`   - Context cookies: ${cookies.length}`);
  if (fs.existsSync(sessionFile)) {
    try {
      const sessionData = JSON.parse(fs.readFileSync(sessionFile, 'utf-8'));
      const fileCookies = sessionData.cookies || [];
      console.log(`   - File cookies: ${fileCookies.length}`);
      console.log(`   - Match: ${cookies.length === fileCookies.length ? 'yes' : 'no'}`);
    } catch (e) {
      console.log(`   - File cookies: parse error`);
    }
  }

  await pool.releasePage(page);
  
  // STEP 7: Result determination
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('                    RESULT');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  const isLoginRedirect = finalUrl.includes('/i/flow/login') || finalUrl.includes('/login');
  const isLoginTitle = title.toLowerCase().includes('log in') || title.toLowerCase().includes('sign in');
  const hasAuthToken = !!authTokenCookie;
  const hasCt0 = !!ct0Cookie;
  const hasLoggedInMarkers = domCheck.hasPrimaryColumn || domCheck.hasHomeTimeline || domCheck.hasComposeButton;
  
  if (!isLoginRedirect && !isLoginTitle && hasAuthToken && hasCt0 && hasLoggedInMarkers) {
    console.log('✅ SUCCESS:');
    console.log(`   - Final URL stays on x.com/home: ${!isLoginRedirect}`);
    console.log(`   - Title is not "Log in to X": ${!isLoginTitle}`);
    console.log(`   - auth_token exists: ${hasAuthToken}`);
    console.log(`   - ct0 exists: ${hasCt0}`);
    console.log(`   - Logged-in markers present: ${hasLoggedInMarkers}`);
    process.exit(0);
  } else {
    console.log('❌ FAILURE:');
    console.log(`   - Final URL: ${finalUrl}`);
    console.log(`   - Is login redirect: ${isLoginRedirect}`);
    console.log(`   - Title: ${title}`);
    console.log(`   - Is login title: ${isLoginTitle}`);
    console.log(`   - auth_token exists: ${hasAuthToken}`);
    console.log(`   - ct0 exists: ${hasCt0}`);
    console.log(`   - Logged-in markers: ${hasLoggedInMarkers}`);
    
    console.log(`\n   StorageState diagnostics:`);
    console.log(`   - twitter_session.json path: ${sessionFile}`);
    console.log(`   - twitter_session.json exists: ${fs.existsSync(sessionFile)}`);
    console.log(`   - Pool using same path: Check UnifiedBrowserPool storageState loading`);
    
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
