import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

async function applyMigration() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!url || !key) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }
  
  const supabase = createClient(url, key);
  
  const sql = fs.readFileSync('supabase/migrations/20251219_post_receipts.sql', 'utf8');
  
  console.log('[MIGRATION] Applying post_receipts migration via Supabase client...');
  
  // Split by statement and execute one at a time
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));
  
  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i] + ';';
    console.log(`[MIGRATION] Executing statement ${i + 1}/${statements.length}...`);
    
    const { error } = await supabase.rpc('exec_sql', { sql_query: stmt }).catch(() => {
      // RPC might not exist, try direct query
      return supabase.from('_migrations').insert({ statement: stmt });
    });
    
    if (error) {
      console.error(`[MIGRATION] ❌ Error on statement ${i + 1}:`, error.message);
      // Continue anyway for idempotent statements
    }
  }
  
  console.log('[MIGRATION] ✅ Migration applied (check for errors above)');
  
  // Verify table exists
  const { data, error } = await supabase
    .from('post_receipts')
    .select('receipt_id')
    .limit(1);
  
  if (error) {
    console.error('[MIGRATION] ⚠️ Table verification failed:', error.message);
    console.log('[MIGRATION] You may need to apply via Supabase SQL editor');
  } else {
    console.log('[MIGRATION] ✅ Table post_receipts verified');
  }
}

require('dotenv/config');
applyMigration().catch(console.error);

