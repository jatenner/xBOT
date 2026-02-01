#!/usr/bin/env tsx
/**
 * Enumerate Chrome profiles and check for X.com auth cookies
 */

import { chromium } from 'playwright';
import { existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const DEFAULT_CHROME_USER_DATA_DIR = join(homedir(), 'Library/Application Support/Google/Chrome');

interface ProfileCheck {
  profileDir: string;
  exists: boolean;
  totalCookies: number;
  xCookies: number;
  hasAuthToken: boolean;
  hasCt0: boolean;
  authTokenDomain?: string;
  ct0Domain?: string;
}

async function checkProfile(userDataDir: string, profileDir: string): Promise<ProfileCheck> {
  const profilePath = join(userDataDir, profileDir);
  const result: ProfileCheck = {
    profileDir,
    exists: existsSync(profilePath),
    totalCookies: 0,
    xCookies: 0,
    hasAuthToken: false,
    hasCt0: false,
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
      const cookies = await context.cookies();
      result.totalCookies = cookies.length;
      
      const twitterCookies = cookies.filter(c => 
        c.domain && (c.domain.includes('.x.com') || c.domain.includes('.twitter.com'))
      );
      result.xCookies = twitterCookies.length;
      
      const authToken = twitterCookies.find(c => c.name === 'auth_token');
      const ct0 = twitterCookies.find(c => c.name === 'ct0');
      
      result.hasAuthToken = !!authToken;
      result.hasCt0 = !!ct0;
      result.authTokenDomain = authToken?.domain;
      result.ct0Domain = ct0?.domain;
      
      await context.close();
    } catch (err) {
      await context.close();
      throw err;
    }
  } catch (err: any) {
    // Profile might be locked or inaccessible
    return result;
  }
  
  return result;
}

async function main() {
  const userDataDir = process.env.CHROME_USER_DATA_DIR || DEFAULT_CHROME_USER_DATA_DIR;
  
  console.log('🔍 Enumerating Chrome Profiles');
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log(`Chrome User Data Dir: ${userDataDir}\n`);
  
  const profiles: string[] = [];
  
  // Check Default
  if (existsSync(join(userDataDir, 'Default'))) {
    profiles.push('Default');
  }
  
  // Check Profile 1..Profile 10
  for (let i = 1; i <= 10; i++) {
    const profilePath = join(userDataDir, `Profile ${i}`);
    if (existsSync(profilePath)) {
      profiles.push(`Profile ${i}`);
    }
  }
  
  if (profiles.length === 0) {
    console.error('❌ No profiles found');
    process.exit(1);
  }
  
  console.log(`Found ${profiles.length} profile(s): ${profiles.join(', ')}\n`);
  console.log('Checking each profile for X.com auth cookies...\n');
  
  const results: ProfileCheck[] = [];
  
  for (const profile of profiles) {
    process.stdout.write(`Checking ${profile}... `);
    const check = await checkProfile(userDataDir, profile);
    results.push(check);
    
    if (check.hasAuthToken && check.hasCt0) {
      console.log(`✅ HAS AUTH`);
    } else if (check.xCookies > 0) {
      console.log(`⚠️  ${check.xCookies} X cookies, no auth`);
    } else {
      console.log(`❌ No X cookies`);
    }
  }
  
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('Profile Summary Table');
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log('Profile          | Total Cookies | X Cookies | auth_token | ct0');
  console.log('-----------------|---------------|-----------|------------|-----');
  
  for (const r of results) {
    const profile = r.profileDir.padEnd(15);
    const total = String(r.totalCookies).padStart(13);
    const x = String(r.xCookies).padStart(9);
    const auth = (r.hasAuthToken ? 'YES' : 'NO').padEnd(10);
    const ct0 = r.hasCt0 ? 'YES' : 'NO';
    console.log(`${profile} | ${total} | ${x} | ${auth} | ${ct0}`);
  }
  
  console.log('\n═══════════════════════════════════════════════════════════');
  
  // Find best profile
  const validProfiles = results.filter(r => r.hasAuthToken && r.hasCt0);
  
  if (validProfiles.length === 0) {
    console.log('❌ No profiles found with auth_token AND ct0 cookies');
    console.log('\nAction: Log in to X.com in Chrome first, then re-run this script');
    process.exit(1);
  }
  
  // Sort by X cookie count (descending)
  validProfiles.sort((a, b) => b.xCookies - a.xCookies);
  const bestProfile = validProfiles[0];
  
  console.log(`\n✅ Best Profile: ${bestProfile.profileDir}`);
  console.log(`   Total cookies: ${bestProfile.totalCookies}`);
  console.log(`   X.com cookies: ${bestProfile.xCookies}`);
  console.log(`   auth_token: YES (domain: ${bestProfile.authTokenDomain})`);
  console.log(`   ct0: YES (domain: ${bestProfile.ct0Domain})`);
  console.log(`\n💡 Use this profile:`);
  console.log(`   CHROME_PROFILE_DIR="${bestProfile.profileDir}" pnpm tsx scripts/refresh-x-session.ts`);
  
  process.exit(0);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
