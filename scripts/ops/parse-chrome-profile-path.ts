#!/usr/bin/env tsx
/**
 * Parse Chrome Profile Path from chrome://version output
 * 
 * Usage:
 *   pnpm tsx scripts/ops/parse-chrome-profile-path.ts "/Users/jonahtenner/Library/Application Support/Google/Chrome/Profile 1"
 */

import { dirname, basename } from 'path';

const profilePath = process.argv[2];

if (!profilePath) {
  console.error('Usage: pnpm tsx scripts/ops/parse-chrome-profile-path.ts "<Profile Path from chrome://version>"');
  console.error('');
  console.error('Example:');
  console.error('  pnpm tsx scripts/ops/parse-chrome-profile-path.ts "/Users/jonahtenner/Library/Application Support/Google/Chrome/Profile 1"');
  process.exit(1);
}

const userDataDir = dirname(profilePath);
const profileDir = basename(profilePath);

console.log('═══════════════════════════════════════════════════════════');
console.log('Chrome Profile Path Parser');
console.log('═══════════════════════════════════════════════════════════\n');
console.log(`Profile Path: ${profilePath}`);
console.log(`User Data Dir: ${userDataDir}`);
console.log(`Profile Dir: ${profileDir}\n`);
console.log('═══════════════════════════════════════════════════════════');
console.log('Export Command:');
console.log('═══════════════════════════════════════════════════════════\n');
console.log(`CHROME_USER_DATA_DIR="${userDataDir}" CHROME_PROFILE_DIR="${profileDir}" pnpm tsx scripts/refresh-x-session.ts\n`);
