#!/usr/bin/env tsx
/**
 * Find executor's actual cookie store and check for auth cookies
 */

import { chromium } from 'playwright';
import { existsSync, readFileSync } from 'fs';
import { join, dirname, basename } from 'path';
import { homedir } from 'os';

// Read executor config to get exact path
const EXECUTOR_CONFIG_PATH = join(process.cwd(), '.runner-profile/EXECUTOR_CONFIG.json');
let executorUserDataDir = join(process.cwd(), '.runner-profile/executor-chrome-profile');

if (existsSync(EXECUTOR_CONFIG_PATH)) {
  try {
    const config = JSON.parse(readFileSync(EXECUTOR_CONFIG_PATH, 'utf8'));
    if (config.user_data_dir) {
      executorUserDataDir = config.user_data_dir;
    }
  } catch {}
}

console.log('🔍 Finding Executor Cookie Store');
console.log('═══════════════════════════════════════════════════════════\n');
console.log(`Executor User Data Dir: ${executorUserDataDir}\n`);

async function checkProfile(profilePath: string, label: string): Promise<{ hasAuth: boolean; xCount: number; authDomain?: string; ct0Domain?: string }> {
  if (!existsSync(profilePath)) {
    return { hasAuth: false, xCount: 0 };
  }
  
  try {
    const context = await chromium.launchPersistentContext(profilePath, {
      headless: true,
      channel: 'chrome',
      args: ['--no-first-run', '--disable-blink-features=AutomationControlled'],
    });
    
    try {
      const page = await context.newPage();
      await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
      await page.waitForTimeout(2000);
      
      const cookies = await context.cookies();
      const twitterCookies = cookies.filter(c => 
        c.domain && (c.domain.includes('.x.com') || c.domain.includes('.twitter.com'))
      );
      
      const authToken = twitterCookies.find(c => c.name === 'auth_token');
      const ct0 = twitterCookies.find(c => c.name === 'ct0');
      
      await page.close();
      await context.close();
      
      return {
        hasAuth: !!(authToken && ct0),
        xCount: twitterCookies.length,
        authDomain: authToken?.domain,
        ct0Domain: ct0?.domain,
      };
    } catch {
      await context.close();
      return { hasAuth: false, xCount: 0 };
    }
  } catch (err: any) {
    if (err.message.includes('already in use')) {
      return { hasAuth: false, xCount: -1 }; // Locked
    }
    return { hasAuth: false, xCount: 0 };
  }
}

async function scanChromeChannels(): Promise<Array<{ channel: string; profileDir: string; path: string; result: any }>> {
  const channels = [
    { name: 'Chrome', path: join(homedir(), 'Library/Application Support/Google/Chrome') },
    { name: 'Chrome Beta', path: join(homedir(), 'Library/Application Support/Google/Chrome Beta') },
    { name: 'Chrome Canary', path: join(homedir(), 'Library/Application Support/Google/Chrome Canary') },
  ];
  
  const allResults: Array<{ channel: string; profileDir: string; path: string; result: any }> = [];
  
  for (const channel of channels) {
    if (!existsSync(channel.path)) continue;
    
    const profiles: string[] = [];
    if (existsSync(join(channel.path, 'Default'))) profiles.push('Default');
    for (let i = 1; i <= 10; i++) {
      const p = `Profile ${i}`;
      if (existsSync(join(channel.path, p))) profiles.push(p);
    }
    
    for (const profileDir of profiles) {
      const profilePath = join(channel.path, profileDir);
      const result = await checkProfile(profilePath, `${channel.name}/${profileDir}`);
      allResults.push({ channel: channel.name, profileDir, path: profilePath, result });
    }
  }
  
  return allResults;
}

async function main() {
  // 1. Check executor profile
  console.log('1. Checking Executor Profile...');
  const executorResult = await checkProfile(executorUserDataDir, 'executor-chrome-profile');
  console.log(`   X cookies: ${executorResult.xCount >= 0 ? executorResult.xCount : 'LOCKED'}`);
  console.log(`   auth_token: ${executorResult.hasAuth ? '✅ YES' : '❌ NO'}`);
  console.log(`   ct0: ${executorResult.hasAuth ? '✅ YES' : '❌ NO'}\n`);
  
  if (executorResult.hasAuth) {
    console.log('✅ FOUND: Executor profile has auth cookies!');
    console.log(`\n💡 Export using:`);
    console.log(`   CHROME_PROFILE_PATH="${executorUserDataDir}" pnpm tsx scripts/refresh-x-session.ts\n`);
    process.exit(0);
  }
  
  // 2. Scan all Chrome channels
  console.log('2. Scanning All Chrome Channels...\n');
  const channelResults = await scanChromeChannels();
  
  console.log('═══════════════════════════════════════════════════════════');
  console.log('Chrome Channels Summary');
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log('Channel        | Profile Dir | X Cookies | auth_token | ct0');
  console.log('---------------|-------------|-----------|------------|-----');
  
  for (const r of channelResults) {
    const channel = r.channel.padEnd(13);
    const profile = r.profileDir.padEnd(11);
    const x = r.result.xCount < 0 ? 'LOCKED'.padStart(9) : String(r.result.xCount).padStart(9);
    const auth = (r.result.hasAuth ? 'YES' : 'NO').padEnd(10);
    const ct0 = r.result.hasAuth ? 'YES' : 'NO';
    console.log(`${channel} | ${profile} | ${x} | ${auth} | ${ct0}`);
  }
  
  const validProfiles = channelResults.filter(r => r.result.hasAuth);
  
  if (validProfiles.length === 0) {
    console.log('\n❌ No profiles found with auth_token AND ct0 cookies');
    process.exit(1);
  }
  
  const best = validProfiles[0];
  console.log(`\n✅ FOUND: ${best.channel} - ${best.profileDir}`);
  console.log(`   Path: ${best.path}`);
  console.log(`   auth_token domain: ${best.result.authDomain}`);
  console.log(`   ct0 domain: ${best.result.ct0Domain}\n`);
  
  const userDataDir = dirname(best.path);
  const profileDir = basename(best.path);
  console.log('💡 Export command:');
  console.log(`   CHROME_USER_DATA_DIR="${userDataDir}" CHROME_PROFILE_DIR="${profileDir}" pnpm tsx scripts/refresh-x-session.ts\n`);
  
  process.exit(0);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
