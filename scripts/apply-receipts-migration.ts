import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

async function applyMigration() {
  require('dotenv/config');
  
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!url || !key) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }
  
  console.log('[MIGRATION] Applying post_receipts migration...');
  console.log(`[MIGRATION] Target: ${url.substring(0, 30)}...`);
  
  const supabase = createClient(url, key);
  
  // Read migration file
  const migrationPath = path.join(__dirname, '../supabase/migrations/20251219_post_receipts.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');
  
  console.log('[MIGRATION] Executing SQL...');
  
  // Execute via rpc (raw SQL)
  const { data, error } = await supabase.rpc('exec_sql', { sql_string: sql }).catch(async () => {
    // If exec_sql doesn't exist, try direct query
    console.log('[MIGRATION] Trying direct query method...');
    return await (supabase as any).rpc('query', { query: sql });
  }).catch(async () => {
    // Last resort: use pg client
    console.log('[MIGRATION] Using pg client...');
    const { Client } = await import('pg');
    const client = new Client({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });
    await client.connect();
    const result = await client.query(sql);
    await client.end();
    return { data: result, error: null };
  });
  
  if (error) {
    console.error('[MIGRATION] ❌ Error:', error.message);
    process.exit(1);
  }
  
  console.log('[MIGRATION] ✅ SQL executed');
  
  // Verify table exists
  console.log('[MIGRATION] Verifying table...');
  const { data: verifyData, error: verifyError } = await supabase
    .from('post_receipts')
    .select('receipt_id')
    .limit(1);
  
  if (verifyError) {
    console.error('[MIGRATION] ❌ Verification failed:', verifyError.message);
    process.exit(1);
  }
  
  console.log('[MIGRATION] ✅ Table post_receipts verified');
  
  // Check indexes
  console.log('[MIGRATION] Checking indexes...');
  const { data: indexes } = await supabase
    .rpc('exec_sql', { 
      sql_string: `
        SELECT indexname 
        FROM pg_indexes 
        WHERE tablename = 'post_receipts' 
        AND schemaname = 'public';
      `
    }).catch(() => ({ data: null }));
  
  if (indexes) {
    console.log('[MIGRATION] ✅ Indexes found:', indexes);
  }
  
  console.log('[MIGRATION] ✅ Migration complete');
}

applyMigration().catch(err => {
  console.error('[MIGRATION] Fatal error:', err.message);
  process.exit(1);
});

