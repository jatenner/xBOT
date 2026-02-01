#!/usr/bin/env tsx
/**
 * 🔄 Sync Twitter Session from Executor Profile
 * 
 * Extracts authenticated session from executor's persistent Chrome profile
 * and updates TWITTER_SESSION_B64 in .env automatically.
 * 
 * No manual login required - uses existing logged-in profile.
 */

import 'dotenv/config';
import { launchRunnerPersistent } from '../../src/infra/playwright/runnerLauncher';
import { checkWhoami } from '../../src/utils/whoamiAuth';
import { getSupabaseClient } from '../../src/db/index';
import { writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
// No base64 import needed - using Buffer

const SESSION_FILE = join(process.cwd(), 'twitter_session.json');
const ENV_FILE = join(process.cwd(), '.env');

async function main() {
  console.log('🔄 Sync Twitter Session from Executor Profile');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  // Step 1: Launch context from executor profile
  console.log('📁 Step 1: Connecting to executor profile...');
  const RUNNER_PROFILE_DIR = process.env.RUNNER_PROFILE_DIR || join(process.cwd(), '.runner-profile');
  console.log(`   Profile directory: ${RUNNER_PROFILE_DIR}`);
  
  let context;
  let page;
  
  try {
    // Use same launcher as executor
    process.env.RUNNER_MODE = 'true';
    process.env.RUNNER_BROWSER = process.env.RUNNER_BROWSER || 'cdp';
    process.env.RUNNER_PROFILE_DIR = RUNNER_PROFILE_DIR;
    
    context = await launchRunnerPersistent(true); // headless
    page = await context.newPage();
    
    console.log('✅ Connected to executor profile\n');
  } catch (error: any) {
    console.error(`❌ Failed to connect to executor profile: ${error.message}`);
    console.error('\nTroubleshooting:');
    console.error('  - Ensure executor is running or Chrome CDP is active');
    console.error('  - Check RUNNER_PROFILE_DIR environment variable');
    process.exit(1);
  }
  
  // Step 2: Check cookies before navigation
  console.log('🍪 Step 2: Checking cookies in profile...');
  const cookiesBefore = await context.cookies();
  const twitterCookies = cookiesBefore.filter(c => 
    c.domain && (c.domain.includes('x.com') || c.domain.includes('twitter.com'))
  );
  
  const authToken = twitterCookies.find(c => c.name === 'auth_token');
  const ct0 = twitterCookies.find(c => c.name === 'ct0');
  
  console.log(`   Total cookies: ${cookiesBefore.length}`);
  console.log(`   Twitter cookies: ${twitterCookies.length}`);
  console.log(`   auth_token: ${authToken ? '✅ YES' : '❌ NO'}`);
  console.log(`   ct0: ${ct0 ? '✅ YES' : '❌ NO'}`);
  
  if (twitterCookies.length > 0) {
    const cookieNames = twitterCookies.map(c => c.name).slice(0, 10);
    console.log(`   Cookie names: ${cookieNames.join(', ')}${twitterCookies.length > 10 ? '...' : ''}`);
  }
  console.log('');
  
  // Step 3: Navigate and check auth
  console.log('🔍 Step 3: Checking authentication status...');
  try {
    await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000); // Let page load
    
    const whoami = await checkWhoami(page);
    
    console.log(`   logged_in: ${whoami.logged_in ? '✅ true' : '❌ false'}`);
    console.log(`   handle: ${whoami.handle || 'unknown'}`);
    console.log(`   url: ${whoami.url}`);
    console.log(`   reason: ${whoami.reason}\n`);
    
    if (!whoami.logged_in) {
      console.error('❌ Profile is not logged in');
      console.error(`   Reason: ${whoami.reason}`);
      console.error('\nAction: Profile needs manual login first');
      console.error('   1. Run: pnpm run runner:login');
      console.error('   2. Log in to X.com in the browser window');
      console.error('   3. Re-run this sync script\n');
      
      // Emit system event
      await emitSystemEvent('SESSION_SYNC_FAILED', {
        reason: whoami.reason,
        url: whoami.url,
        handle: whoami.handle
      });
      
      await page.close();
      await context.close();
      process.exit(1);
    }
    
    // Step 4: Export storage state
    console.log('💾 Step 4: Exporting storage state...');
    const storageState = await context.storageState();
    const storageStateJson = JSON.stringify(storageState, null, 2);
    
    writeFileSync(SESSION_FILE, storageStateJson);
    const cookieCount = storageState.cookies?.length || 0;
    console.log(`✅ Session saved to ${SESSION_FILE}`);
    console.log(`   Cookies: ${cookieCount}\n`);
    
    // Step 5: Base64 encode (single line, no newlines)
    console.log('📦 Step 5: Encoding to base64...');
    const sessionBytes = Buffer.from(storageStateJson, 'utf-8');
    const b64 = sessionBytes.toString('base64');
    console.log(`✅ Base64 encoded, length: ${b64.length}`);
    console.log(`   First 40: ${b64.substring(0, 40)}...`);
    console.log(`   Last 40: ...${b64.substring(b64.length - 40)}\n`);
    
    // Step 6: Update .env file
    console.log('📝 Step 6: Updating .env file...');
    let envContent = readFileSync(ENV_FILE, 'utf-8');
    
    // Remove existing TWITTER_SESSION_B64 line if present
    const lines = envContent.split('\n');
    const filteredLines = lines.filter(line => !line.trim().startsWith('TWITTER_SESSION_B64='));
    
    // Add new TWITTER_SESSION_B64 line
    filteredLines.push(`TWITTER_SESSION_B64=${b64}`);
    
    // Write back
    writeFileSync(ENV_FILE, filteredLines.join('\n') + '\n');
    console.log(`✅ Updated ${ENV_FILE}\n`);
    
    // Step 7: Verify the update
    console.log('✅ Step 7: Verification...');
    console.log(`   Session file written: ✅ YES`);
    console.log(`   .env updated: ✅ YES`);
    console.log(`   Base64 length: ${b64.length}`);
    console.log(`   Cookies exported: ${cookieCount}`);
    console.log(`   Auth cookies: auth_token=${authToken ? 'YES' : 'NO'}, ct0=${ct0 ? 'YES' : 'NO'}\n`);
    
    // Emit system event
    await emitSystemEvent('SESSION_SYNC_OK', {
      handle: whoami.handle,
      cookie_count: cookieCount,
      auth_token_present: !!authToken,
      ct0_present: !!ct0,
      base64_length: b64.length
    });
    
    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ Session sync complete!');
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log('📋 Next steps:');
    console.log('   1. Verify: pnpm tsx scripts/ops/verify-harvester-auth.ts');
    console.log('   2. Run harvester: HARVESTING_ENABLED=true pnpm tsx scripts/ops/run-harvester-single-cycle.ts\n');
    
    await page.close();
    await context.close();
    process.exit(0);
    
  } catch (error: any) {
    console.error(`\n❌ Error during sync: ${error.message}`);
    if (error.stack) {
      console.error(error.stack);
    }
    
    await emitSystemEvent('SESSION_SYNC_FAILED', {
      reason: `error: ${error.message}`
    });
    
    if (page) await page.close().catch(() => {});
    if (context) await context.close().catch(() => {});
    process.exit(1);
  }
}

async function emitSystemEvent(eventType: string, eventData: any) {
  try {
    const supabase = getSupabaseClient();
    await supabase.from('system_events').insert({
      event_type: eventType,
      event_data: eventData,
      created_at: new Date().toISOString()
    });
    console.log(`📊 System event emitted: ${eventType}`);
  } catch (error: any) {
    console.warn(`⚠️  Failed to emit system event: ${error.message}`);
  }
}

main().catch(console.error);
