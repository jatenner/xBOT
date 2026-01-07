/**
 * Audit seed account list
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db/index';

async function main() {
  console.log('🔍 Seed Account Audit\n');
  
  // Try to import SEED_ACCOUNTS from seedAccountHarvester
  let seedAccounts: any[] = [];
  let seedSource = 'unknown';
  
  try {
    const seedModule = await import('../src/ai/seedAccountHarvester');
    if (seedModule.SEED_ACCOUNTS) {
      seedAccounts = seedModule.SEED_ACCOUNTS;
      seedSource = 'seedAccountHarvester.SEED_ACCOUNTS';
    }
  } catch (err: any) {
    console.error(`❌ Error importing SEED_ACCOUNTS: ${err.message}`);
  }
  
  // Check database for seed accounts table if exists
  const supabase = getSupabaseClient();
  let dbSeedCount = 0;
  let dbLastUpdated: string | null = null;
  
  try {
    // Check if seed_accounts table exists
    const { data: dbSeeds, error: dbError } = await supabase
      .from('seed_accounts')
      .select('username, updated_at', { count: 'exact' })
      .limit(1);
    
    if (!dbError && dbSeeds) {
      const { count } = await supabase
        .from('seed_accounts')
        .select('*', { count: 'exact', head: true });
      
      dbSeedCount = count || 0;
      
      // Get last updated
      const { data: lastUpdated } = await supabase
        .from('seed_accounts')
        .select('updated_at')
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();
      
      if (lastUpdated?.updated_at) {
        dbLastUpdated = lastUpdated.updated_at;
      }
    }
  } catch (err: any) {
    // Table might not exist, that's OK
    console.log(`ℹ️  seed_accounts table not found or error: ${err.message}`);
  }
  
  // Print results
  console.log('=== Seed Account Source ===');
  console.log(`Source: ${seedSource}`);
  console.log(`Total seed count: ${seedAccounts.length}`);
  
  if (dbSeedCount > 0) {
    console.log(`Database seed count: ${dbSeedCount}`);
    if (dbLastUpdated) {
      console.log(`Database last updated: ${dbLastUpdated}`);
    }
  }
  
  console.log('\n=== Sample Handles (first 20) ===');
  const sampleHandles = seedAccounts.slice(0, 20).map((acc: any) => {
    if (typeof acc === 'string') return acc;
    return acc.username || acc.handle || acc;
  });
  
  sampleHandles.forEach((handle, i) => {
    console.log(`${i + 1}. ${handle}`);
  });
  
  if (seedAccounts.length > 20) {
    console.log(`... and ${seedAccounts.length - 20} more`);
  }
  
  console.log('\n=== Seed Account Structure ===');
  if (seedAccounts.length > 0) {
    const first = seedAccounts[0];
    console.log(`First account type: ${typeof first}`);
    if (typeof first === 'object') {
      console.log(`First account keys: ${Object.keys(first).join(', ')}`);
      console.log(`First account sample: ${JSON.stringify(first, null, 2)}`);
    }
  }
  
  process.exit(0);
}

main().catch(console.error);

