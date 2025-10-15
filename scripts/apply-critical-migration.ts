/**
 * Apply Critical Migration: Add generation_metadata column
 * 
 * This fixes the "Could not find 'generation_metadata' column" error
 * that's preventing content from being saved.
 */

import { getSupabaseClient } from '../src/db';

async function applyCriticalMigration() {
  console.log('🔧 Applying critical migration: generation_metadata column...\n');

  const supabase = getSupabaseClient();

  const sql = `
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'content_metadata' 
    AND column_name = 'generation_metadata'
  ) THEN
    ALTER TABLE content_metadata 
    ADD COLUMN generation_metadata JSONB;
    
    COMMENT ON COLUMN content_metadata.generation_metadata IS 
      'Stores content_type_id, content_type_name, viral_formula, hook_used for learning';
      
    -- Add index for performance
    CREATE INDEX idx_content_metadata_generation_metadata_gin 
      ON content_metadata USING GIN (generation_metadata);
      
    RAISE NOTICE 'Successfully added generation_metadata column';
  ELSE
    RAISE NOTICE 'Column generation_metadata already exists';
  END IF;
END $$;
  `;

  try {
    console.log('Executing SQL...');
    
    // Use raw SQL execution via Supabase RPC
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
      // Try direct approach if RPC doesn't exist
      console.log('RPC approach failed, trying direct SQL...');
      
      // Direct SQL execution using from().insert() won't work for DDL
      // So we need to use the REST API directly
      const response = await fetch(
        `${process.env.SUPABASE_URL}/rest/v1/rpc/exec_sql`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY || '',
            'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
          },
          body: JSON.stringify({ sql_query: sql })
        }
      );

      if (!response.ok) {
        // Last resort: use pg client directly
        console.log('REST API failed, using direct PostgreSQL connection...');
        
        const { Client } = await import('pg');
        const client = new Client({
          connectionString: process.env.DATABASE_URL,
          ssl: {
            rejectUnauthorized: false
          }
        });

        await client.connect();
        console.log('✅ Connected to database');

        const result = await client.query(sql);
        console.log('✅ Migration executed successfully');
        console.log(result);

        await client.end();
        
        console.log('\n✅ MIGRATION COMPLETE!');
        console.log('The generation_metadata column has been added.');
        console.log('\nNext steps:');
        console.log('1. Restart your Railway deployment (or wait for next plan job)');
        console.log('2. Content will now save properly');
        console.log('3. Posts will appear on Twitter');
        console.log('4. Bulletproof scraper will collect real data');
        
        return;
      }

      console.log('✅ Migration executed via REST API');
    } else {
      console.log('✅ Migration executed via RPC');
      console.log(data);
    }

    console.log('\n✅ MIGRATION COMPLETE!');
    console.log('The generation_metadata column has been added.');
    console.log('\nYour system should now:');
    console.log('- Save generated content to database');
    console.log('- Fill posting queue');
    console.log('- Post to Twitter');
    console.log('- Collect real metrics');
    console.log('- Enable learning system');

  } catch (error: any) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

applyCriticalMigration();

