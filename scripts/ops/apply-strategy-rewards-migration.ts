#!/usr/bin/env tsx
/**
 * Apply strategy_rewards migration directly
 */

import 'dotenv/config';
import { getSupabaseClient } from '../../src/db/index';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const supabase = getSupabaseClient();
  
  console.log('🔧 Applying strategy_rewards migration...\n');
  
  // Read migration file
  const migrationPath = path.join(process.cwd(), 'supabase/migrations/20260127_strategy_rewards.sql');
  if (!fs.existsSync(migrationPath)) {
    console.error(`❌ Migration file not found: ${migrationPath}`);
    process.exit(1);
  }
  
  const sql = fs.readFileSync(migrationPath, 'utf8');
  console.log('📄 Migration file contents:');
  console.log('─'.repeat(60));
  console.log(sql.substring(0, 500) + '...\n');
  
  // Check if table already exists
  const { data: existingTable, error: checkError } = await supabase
    .rpc('exec_sql', { sql: "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'strategy_rewards');" })
    .catch(() => ({ data: null, error: { message: 'RPC not available' } }));
  
  if (checkError && checkError.message !== 'RPC not available') {
    // Try direct query
    const { error: directError } = await supabase
      .from('strategy_rewards')
      .select('*')
      .limit(0);
    
    if (!directError) {
      console.log('✅ Table strategy_rewards already exists');
      process.exit(0);
    }
  }
  
  // Apply migration using Supabase client
  // Note: Supabase JS client doesn't support DDL directly, so we'll need to use a workaround
  console.log('⚠️  Supabase JS client cannot execute DDL statements directly');
  console.log('💡 Please apply this migration via:');
  console.log('   1. Supabase Dashboard → SQL Editor');
  console.log('   2. Copy the SQL from: supabase/migrations/20260127_strategy_rewards.sql');
  console.log('   3. Paste and execute');
  console.log('\nOr use Railway CLI:');
  console.log('   railway run --service xBOT node scripts/bulletproof_migrate.js');
  
  process.exit(1);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
