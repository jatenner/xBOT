/**
 * Script to bulk add accounts to VI system
 * 
 * Usage:
 *   tsx scripts/bulk-add-vi-accounts.ts
 * 
 * Edit the ACCOUNTS array below with your list
 */

import { bulkAddVIAccounts } from '../src/intelligence/viAccountBulkAdder';

// ✅ ADD YOUR 100 ACCOUNTS HERE
// Format: { username: 'accountname', followers: 50000, bio: 'optional bio' }
const ACCOUNTS = [
  // Example format:
  // { username: 'example1', followers: 50000 },
  // { username: 'example2', followers: 5000, bio: 'Health researcher' },
  // ... add 100 more accounts
];

async function main() {
  console.log(`\n🚀 Starting bulk add of ${ACCOUNTS.length} accounts...\n`);
  
  if (ACCOUNTS.length === 0) {
    console.log('❌ No accounts provided! Edit the ACCOUNTS array in this file.');
    process.exit(1);
  }
  
  await bulkAddVIAccounts(ACCOUNTS);
  
  console.log('\n✅ Done!\n');
  process.exit(0);
}

main().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});

