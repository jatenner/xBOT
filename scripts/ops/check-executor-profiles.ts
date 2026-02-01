#!/usr/bin/env tsx
/**
 * Check executor profile directories for X.com auth cookies
 */

import { chromium } from 'playwright';
import { existsSync, readdirSync } from 'fs';
import { join } from 'path';

const RUNNER_PROFILE_DIR = process.env.RUNNER_PROFILE_DIR || './.runner-profile';

interface ProfileCheck {
  profilePath: string;
  exists: boolean;
  totalCookies: number;
  xCookies: number;
  hasAuthToken: boolean;
  hasCt0: boolean;
  authTokenDomain?: string;
  ct0Domain?: string;
}

async function checkProfile(profilePath: string): Promise<ProfileCheck> {
  const result: ProfileCheck = {
    profilePath,
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
  console.log('🔍 Checking Executor Profile Directories');
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log(`Runner Profile Dir: ${RUNNER_PROFILE_DIR}\n`);
  
  if (!existsSync(RUNNER_PROFILE_DIR)) {
    console.error(`❌ Profile directory not found: ${RUNNER_PROFILE_DIR}`);
    process.exit(1);
  }
  
  // Find all subdirectories that might be Chrome profiles
  const candidates: string[] = [];
  
  // Check known executor profile paths
  const knownPaths = [
    join(RUNNER_PROFILE_DIR, 'executor-chrome-profile'),
    join(RUNNER_PROFILE_DIR, 'Default'),
    join(RUNNER_PROFILE_DIR, 'chrome-profile'),
    join(RUNNER_PROFILE_DIR, 'chrome-cdp-profile'),
    join(RUNNER_PROFILE_DIR, '.chrome-cdp-profile'),
  ];
  
  for (const path of knownPaths) {
    if (existsSync(path)) {
      candidates.push(path);
    }
  }
  
  // Also check subdirectories
  try {
    const entries = readdirSync(RUNNER_PROFILE_DIR, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && !candidates.includes(join(RUNNER_PROFILE_DIR, entry.name))) {
        candidates.push(join(RUNNER_PROFILE_DIR, entry.name));
      }
    }
  } catch (err) {
    // Ignore
  }
  
  if (candidates.length === 0) {
    console.error('❌ No candidate profiles found');
    process.exit(1);
  }
  
  console.log(`Found ${candidates.length} candidate profile(s)\n`);
  console.log('Checking each profile for X.com auth cookies...\n');
  
  const results: ProfileCheck[] = [];
  
  for (const profilePath of candidates) {
    const relPath = profilePath.replace(process.cwd() + '/', '');
    process.stdout.write(`Checking ${relPath}... `);
    const check = await checkProfile(profilePath);
    results.push(check);
    
    if (check.hasAuthToken && check.hasCt0) {
      console.log(`✅ HAS AUTH`);
    } else if (check.xCookies > 0) {
      console.log(`⚠️  ${check.xCookies} X cookies, no auth`);
    } else if (check.exists) {
      console.log(`❌ No X cookies`);
    } else {
      console.log(`❌ Not accessible`);
    }
  }
  
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('Profile Summary Table');
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log('Profile Path                                    | Total | X Cookies | auth_token | ct0');
  console.log('------------------------------------------------|-------|-----------|------------|-----');
  
  for (const r of results) {
    const relPath = r.profilePath.replace(process.cwd() + '/', '').substring(0, 45).padEnd(45);
    const total = String(r.totalCookies).padStart(5);
    const x = String(r.xCookies).padStart(9);
    const auth = (r.hasAuthToken ? 'YES' : 'NO').padEnd(10);
    const ct0 = r.hasCt0 ? 'YES' : 'NO';
    console.log(`${relPath} | ${total} | ${x} | ${auth} | ${ct0}`);
  }
  
  console.log('\n═══════════════════════════════════════════════════════════');
  
  // Find best profile
  const validProfiles = results.filter(r => r.hasAuthToken && r.hasCt0);
  
  if (validProfiles.length === 0) {
    console.log('❌ No profiles found with auth_token AND ct0 cookies');
    process.exit(1);
  }
  
  // Sort by X cookie count (descending)
  validProfiles.sort((a, b) => b.xCookies - a.xCookies);
  const bestProfile = validProfiles[0];
  
  console.log(`\n✅ Best Profile: ${bestProfile.profilePath}`);
  console.log(`   Total cookies: ${bestProfile.totalCookies}`);
  console.log(`   X.com cookies: ${bestProfile.xCookies}`);
  console.log(`   auth_token: YES (domain: ${bestProfile.authTokenDomain})`);
  console.log(`   ct0: YES (domain: ${bestProfile.ct0Domain})`);
  
  // Determine if this is a Chrome user data dir or a profile subdirectory
  const isChromeUserDataDir = bestProfile.profilePath.includes('Library/Application Support/Google/Chrome');
  if (isChromeUserDataDir) {
    // Extract profile name
    const parts = bestProfile.profilePath.split('/');
    const profileName = parts[parts.length - 1];
    const userDataDir = parts.slice(0, -1).join('/');
    console.log(`\n💡 Use this profile:`);
    console.log(`   CHROME_USER_DATA_DIR="${userDataDir}" CHROME_PROFILE_DIR="${profileName}" pnpm tsx scripts/refresh-x-session.ts`);
  } else {
    // This is an executor profile - we need to modify refresh script to accept direct path
    console.log(`\n💡 This is an executor profile. Export directly:`);
    console.log(`   (Need to modify refresh script to accept direct profile path)`);
  }
  
  process.exit(0);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
