#!/usr/bin/env tsx
/**
 * Export X session from Chrome via CDP
 * Connects to existing Chrome instance and exports storageState
 */

import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const CDP_URL = 'http://127.0.0.1:9222';
const JSON_OUTPUT = '/Users/jonahtenner/Desktop/xBOT/twitter_session.json';
const B64_OUTPUT = '/Users/jonahtenner/Desktop/xBOT/twitter_session.b64';

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('        📤 EXPORT X SESSION VIA CDP');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log(`🔌 Connecting to CDP: ${CDP_URL}`);
  const browser = await chromium.connectOverCDP(CDP_URL);
  
  console.log(`✅ Connected to browser`);
  
  // Get existing contexts or create one
  const contexts = browser.contexts();
  let context = contexts.length > 0 ? contexts[0] : await browser.newContext();
  
  console.log(`📦 Using context (${contexts.length} existing contexts)`);
  
  // Get storageState
  console.log(`📥 Extracting storageState...`);
  const storageState = await context.storageState();
  
  console.log(`   Raw cookies: ${storageState.cookies.length}`);
  
  // Normalize: ensure auth_token and ct0 exist on .x.com and x.com
  console.log(`🔄 Normalizing cookies (expanding domains for critical cookies)...`);
  
  const normalizedCookies: any[] = [];
  const seen = new Set<string>();
  
  function expandDomainsForCookie(cookie: any): any[] {
    const domains = new Set<string>();
    const base = cookie.domain || '.x.com';
    const cookieName = cookie.name.toLowerCase();
    const isCriticalCookie = cookieName === 'auth_token' || cookieName === 'ct0';
    
    domains.add(base);
    
    if (base.endsWith('.twitter.com')) {
      domains.add('.twitter.com');
      domains.add('.x.com');
      if (isCriticalCookie) {
        domains.add('x.com');
      }
    } else if (base.endsWith('.x.com')) {
      domains.add('.x.com');
      domains.add('.twitter.com');
      if (isCriticalCookie) {
        domains.add('x.com');
      }
    } else if (base === 'x.com') {
      domains.add('.x.com');
      domains.add('.twitter.com');
    } else if (base.includes('twitter.com')) {
      domains.add('.twitter.com');
      domains.add('.x.com');
      if (isCriticalCookie) {
        domains.add('x.com');
      }
    } else if (base.includes('x.com')) {
      domains.add('.twitter.com');
      domains.add('.x.com');
      if (isCriticalCookie) {
        domains.add('x.com');
      }
    } else {
      if (isCriticalCookie) {
        domains.add('.x.com');
        domains.add('x.com');
        domains.add('.twitter.com');
      }
    }
    
    const variants: any[] = [];
    for (const domain of domains) {
      let formatted: string;
      if (isCriticalCookie && domain === 'x.com') {
        formatted = 'x.com';
      } else if (isCriticalCookie && domain === '.x.com') {
        formatted = '.x.com';
      } else {
        formatted = domain.startsWith('.') ? domain : `.${domain}`;
      }
      variants.push({ ...cookie, domain: formatted });
    }
    return variants;
  }
  
  for (const cookie of storageState.cookies) {
    if (!cookie?.name || cookie.value === undefined || cookie.value === null) {
      continue;
    }
    
    const variants = expandDomainsForCookie(cookie);
    for (const variant of variants) {
      const key = `${variant.name}|${variant.domain}|${variant.path || '/'}|${variant.secure}`;
      if (seen.has(key)) continue;
      seen.add(key);
      normalizedCookies.push(variant);
    }
  }
  
  const normalizedState = {
    ...storageState,
    cookies: normalizedCookies,
  };
  
  console.log(`   Normalized cookies: ${normalizedCookies.length}`);
  
  // Count auth_token and ct0 by domain
  const authTokenCounts: Record<string, number> = {};
  const ct0Counts: Record<string, number> = {};
  
  normalizedCookies.forEach(cookie => {
    if (cookie.name.toLowerCase() === 'auth_token') {
      authTokenCounts[cookie.domain] = (authTokenCounts[cookie.domain] || 0) + 1;
    }
    if (cookie.name.toLowerCase() === 'ct0') {
      ct0Counts[cookie.domain] = (ct0Counts[cookie.domain] || 0) + 1;
    }
  });
  
  // Write JSON file
  console.log(`💾 Writing JSON to ${JSON_OUTPUT}...`);
  fs.writeFileSync(JSON_OUTPUT, JSON.stringify(normalizedState, null, 2), 'utf8');
  
  // Write base64 file
  const jsonString = JSON.stringify(normalizedState);
  const b64 = Buffer.from(jsonString).toString('base64');
  console.log(`💾 Writing base64 to ${B64_OUTPUT}...`);
  fs.writeFileSync(B64_OUTPUT, b64, 'utf8');
  
  // Calculate SHA12
  const hash = crypto.createHash('sha256').update(b64).digest('hex');
  const sha12 = hash.substring(0, 12);
  
  // Check if auth_token and ct0 exist on .x.com
  const hasAuthTokenXCom = !!normalizedCookies.find(
    c => c.name.toLowerCase() === 'auth_token' && c.domain === '.x.com'
  );
  const hasCt0XCom = !!normalizedCookies.find(
    c => c.name.toLowerCase() === 'ct0' && c.domain === '.x.com'
  );
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('                    EXPORT RESULTS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  console.log(`Total cookies: ${normalizedCookies.length}`);
  console.log(`B64 length: ${b64.length}`);
  console.log(`SHA12: ${sha12}`);
  console.log(`\nCookie counts by domain:`);
  console.log(`  auth_token: ${JSON.stringify(authTokenCounts)}`);
  console.log(`  ct0: ${JSON.stringify(ct0Counts)}`);
  console.log(`\nCritical cookies on .x.com:`);
  console.log(`  auth_token: ${hasAuthTokenXCom ? 'YES' : 'NO'}`);
  console.log(`  ct0: ${hasCt0XCom ? 'YES' : 'NO'}`);
  
  if (hasAuthTokenXCom && hasCt0XCom) {
    console.log('\n✅ SUCCESS: Session exported with auth_token and ct0 on .x.com');
  } else {
    console.log('\n⚠️  WARNING: Missing critical cookies on .x.com');
  }
  
  await browser.close();
}

main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
