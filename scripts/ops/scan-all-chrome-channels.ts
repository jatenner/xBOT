#!/usr/bin/env tsx
/**
 * Scan all Chrome channels (Chrome, Chrome Beta, Chrome Canary) for X.com auth cookies
 */

import { chromium } from 'playwright';
import { existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

interface ProfileResult {
  channel: string;
  profileDir: string;
  profilePath: string;
  exists: boolean;
  totalCookies: number;
  xCookieCount: number;
  authToken: boolean;
  ct0: boolean;
  authTokenDomain?: string;
  ct0Domain?: string;
}

const channels = [
  { name: 'Chrome', path: join(homedir(), 'Library/Application Support/Google/Chrome') },
  { name: 'Chrome Beta', path: join(homedir(), 'Library/Application Support/Google/Chrome Beta') },
  { name: 'Chrome Canary', path: join(homedir(), 'Library/Application Support/Google/Chrome Canary') },
];

async function checkProfile(channel: string, profileDir: string, profilePath: string): Promise<ProfileResult> {
  const result: ProfileResult = {
    channel,
    profileDir,
    profilePath,
    exists: existsSync(profilePath),
    totalCookies: 0,
    xCookieCount: 0,
    authToken: false,
    ct0: false,
  };
  
  if (!result.exists) {
    return result;
  }
  
  try {
    const context = await chromium.launchPersistentContext(profilePath, {
      headless: true,
      channel: 'chrome',
      args: ['--no-first-run', '--disable-blink-features=AutomationControlled'],
    });
    
    try {
      // Navigate to x.com to load cookies
      const page = await context.newPage();
      await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
      await page.waitForTimeout(2000);
      
      const cookies = await context.cookies();
      result.totalCookies = cookies.length;
      
      const twitterCookies = cookies.filter(c => 
        c.domain && (c.domain.includes('.x.com') || c.domain.includes('.twitter.com'))
      );
      result.xCookieCount = twitterCookies.length;
      
      const authToken = twitterCookies.find(c => c.name === 'auth_token');
      const ct0 = twitterCookies.find(c => c.name === 'ct0');
      
      result.authToken = !!authToken;
      result.ct0 = !!ct0;
      result.authTokenDomain = authToken?.domain;
      result.ct0Domain = ct0?.domain;
      
      await page.close();
      await context.close();
    } catch (err) {
      await context.close();
      throw err;
    }
  } catch (err: any) {
    if (err.message.includes('already in use')) {
      // Profile locked - skip
      return result;
    }
    // Other error - return empty result
    return result;
  }
  
  return result;
}

async function findProfiles(userDataDir: string): Promise<string[]> {
  if (!existsSync(userDataDir)) {
    return [];
  }
  
  const profiles: string[] = [];
  
  if (existsSync(join(userDataDir, 'Default'))) {
    profiles.push('Default');
  }
  
  for (let i = 1; i <= 10; i++) {
    const profilePath = join(userDataDir, `Profile ${i}`);
    if (existsSync(profilePath)) {
      profiles.push(`Profile ${i}`);
    }
  }
  
  return profiles;
}

async function main() {
  console.log('🔍 Scanning All Chrome Channels for X.com Auth Cookies');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  const results: ProfileResult[] = [];
  
  for (const channel of channels) {
    if (!existsSync(channel.path)) {
      console.log(`⏭️  ${channel.name}: Not installed\n`);
      continue;
    }
    
    console.log(`📁 ${channel.name}: ${channel.path}`);
    const profiles = await findProfiles(channel.path);
    console.log(`   Found ${profiles.length} profile(s): ${profiles.join(', ')}\n`);
    
    for (const profileDir of profiles) {
      const profilePath = join(channel.path, profileDir);
      process.stdout.write(`   Checking ${profileDir}... `);
      
      const check = await checkProfile(channel.name, profileDir, profilePath);
      results.push(check);
      
      if (check.authToken && check.ct0) {
        console.log(`✅ HAS AUTH`);
      } else if (check.xCookieCount > 0) {
        console.log(`⚠️  ${check.xCookieCount} X cookies, no auth`);
      } else if (check.exists) {
        console.log(`❌ No X cookies`);
      } else {
        console.log(`❌ Not accessible`);
      }
    }
    console.log('');
  }
  
  console.log('═══════════════════════════════════════════════════════════');
  console.log('Summary Table');
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log('Channel        | Profile Dir | X Cookies | auth_token | ct0');
  console.log('---------------|-------------|-----------|------------|-----');
  
  for (const r of results) {
    const channel = r.channel.padEnd(13);
    const profile = r.profileDir.padEnd(11);
    const x = String(r.xCookieCount).padStart(9);
    const auth = (r.authToken ? 'YES' : 'NO').padEnd(10);
    const ct0 = r.ct0 ? 'YES' : 'NO';
    console.log(`${channel} | ${profile} | ${x} | ${auth} | ${ct0}`);
  }
  
  console.log('\n═══════════════════════════════════════════════════════════');
  
  // Find best profile
  const validProfiles = results.filter(r => r.authToken && r.ct0);
  
  if (validProfiles.length === 0) {
    console.log('❌ No profiles found with auth_token AND ct0 cookies\n');
    process.exit(1);
  }
  
  // Sort by X cookie count
  validProfiles.sort((a, b) => b.xCookieCount - a.xCookieCount);
  const best = validProfiles[0];
  
  console.log(`\n✅ Best Profile: ${best.channel} - ${best.profileDir}`);
  console.log(`   Path: ${best.profilePath}`);
  console.log(`   X cookies: ${best.xCookieCount}`);
  console.log(`   auth_token: YES (domain: ${best.authTokenDomain})`);
  console.log(`   ct0: YES (domain: ${best.ct0Domain})\n`);
  
  // Generate export command
  if (best.channel === 'Chrome') {
    const userDataDir = dirname(best.profilePath);
    const profileDir = basename(best.profilePath);
    console.log('💡 Export command:');
    console.log(`   CHROME_USER_DATA_DIR="${userDataDir}" CHROME_PROFILE_DIR="${profileDir}" pnpm tsx scripts/refresh-x-session.ts\n`);
  } else {
    console.log('💡 Export command (Beta/Canary):');
    console.log(`   CHROME_USER_DATA_DIR="${dirname(best.profilePath)}" CHROME_PROFILE_DIR="${basename(best.profilePath)}" pnpm tsx scripts/refresh-x-session.ts\n`);
  }
  
  process.exit(0);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
