#!/usr/bin/env tsx

/**
 * 📋 Railway Session Update Helper
 * 
 * Prints the exact Railway command to update TWITTER_SESSION_B64
 * 
 * Usage:
 *   1. Base64 encode twitter_session.json:
 *      base64 -i twitter_session.json | pbcopy  (mac)
 *      OR base64 twitter_session.json > twitter_session.b64
 *   
 *   2. Run this script:
 *      pnpm exec tsx scripts/print-railway-session-update.ts
 *   
 *   3. Copy the command and replace <PASTE_BASE64> with your base64 string
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const SESSION_PATH = join(process.cwd(), 'twitter_session.json');
const SESSION_B64_PATH = join(process.cwd(), 'twitter_session.b64');

function printRailwayCommand(): void {
  console.log('📋 Railway Session Update Command');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  
  // Try to read base64 file if it exists
  let base64Content: string | null = null;
  
  if (existsSync(SESSION_B64_PATH)) {
    try {
      base64Content = readFileSync(SESSION_B64_PATH, 'utf-8').trim();
      console.log('✅ Found twitter_session.b64 file');
    } catch (error) {
      console.log('⚠️  Could not read twitter_session.b64 file');
    }
  }
  
  if (!base64Content && existsSync(SESSION_PATH)) {
    try {
      const sessionJson = readFileSync(SESSION_PATH, 'utf-8');
      const Buffer = require('buffer').Buffer;
      base64Content = Buffer.from(sessionJson).toString('base64');
      console.log('✅ Generated base64 from twitter_session.json');
    } catch (error) {
      console.log('⚠️  Could not generate base64 from twitter_session.json');
    }
  }
  
  console.log('');
  console.log('📋 Railway Command:');
  console.log('');
  
  if (base64Content) {
    // Show command with placeholder (don't print full base64 - too long)
    const preview = base64Content.substring(0, 50) + '...';
    console.log(`railway variables --set "TWITTER_SESSION_B64=${preview}"`);
    console.log('');
    console.log('⚠️  IMPORTANT: Replace the preview above with your FULL base64 string!');
    console.log('');
    console.log('Or use this template:');
    console.log('');
    console.log('railway variables --set "TWITTER_SESSION_B64=<PASTE_YOUR_FULL_BASE64_HERE>"');
  } else {
    console.log('railway variables --set "TWITTER_SESSION_B64=<PASTE_BASE64_HERE>"');
  }
  
  console.log('');
  console.log('📝 Steps:');
  console.log('  1. Base64 encode twitter_session.json:');
  console.log('     base64 -i twitter_session.json | pbcopy  (mac)');
  console.log('     OR base64 twitter_session.json > twitter_session.b64');
  console.log('');
  console.log('  2. Copy the base64 string');
  console.log('');
  console.log('  3. Run the Railway command above, replacing <PASTE_BASE64_HERE>');
  console.log('');
  console.log('  4. Verify:');
  console.log('     railway variables | grep TWITTER_SESSION_B64');
  console.log('');
  console.log('  5. Test harvester:');
  console.log('     railway run -- pnpm exec tsx scripts/debug-harvester.ts --minutes 240 --max-seeds 2');
  console.log('');
  console.log('✅ Look for: [HARVESTER_AUTH] ok=true');
  console.log('');
}

printRailwayCommand();

