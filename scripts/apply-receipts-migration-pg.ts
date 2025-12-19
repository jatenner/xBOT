import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

async function applyMigration() {
  require('dotenv/config');
  
  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    console.error('❌ Missing DATABASE_URL');
    process.exit(1);
  }
  
  console.log('[MIGRATION] Applying post_receipts migration via pg client...');
  
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    console.log('[MIGRATION] ✅ Connected to database');
    
    // Read migration file
    const migrationPath = path.join(__dirname, '../supabase/migrations/20251219_post_receipts.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('[MIGRATION] Executing SQL...');
    await client.query(sql);
    console.log('[MIGRATION] ✅ SQL executed');
    
    // Verify table exists
    console.log('[MIGRATION] Verifying table...');
    const verifyResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'post_receipts';
    `);
    
    if (verifyResult.rows.length === 0) {
      throw new Error('Table post_receipts not found after migration');
    }
    
    console.log('[MIGRATION] ✅ Table post_receipts verified');
    
    // Check indexes
    console.log('[MIGRATION] Checking indexes...');
    const indexResult = await client.query(`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'post_receipts' 
      AND schemaname = 'public';
    `);
    
    console.log(`[MIGRATION] ✅ Found ${indexResult.rows.length} indexes:`);
    indexResult.rows.forEach(row => {
      console.log(`[MIGRATION]    - ${row.indexname}`);
    });
    
    // Test insert
    console.log('[MIGRATION] Testing insert...');
    const testResult = await client.query(`
      INSERT INTO public.post_receipts (
        decision_id, tweet_ids, root_tweet_id, post_type, posted_at, metadata
      ) VALUES (
        gen_random_uuid(), 
        ARRAY['test_id'], 
        'test_id', 
        'single', 
        NOW(), 
        '{"test": true}'::jsonb
      )
      RETURNING receipt_id;
    `);
    
    console.log(`[MIGRATION] ✅ Test insert successful: ${testResult.rows[0].receipt_id}`);
    
    // Clean up test
    await client.query(`DELETE FROM public.post_receipts WHERE root_tweet_id = 'test_id';`);
    console.log('[MIGRATION] ✅ Test cleanup complete');
    
    console.log('[MIGRATION] ✅✅✅ MIGRATION COMPLETE AND VERIFIED ✅✅✅');
    
  } catch (err: any) {
    console.error('[MIGRATION] ❌ Error:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

applyMigration();

