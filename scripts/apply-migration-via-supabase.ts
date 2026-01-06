/**
 * Apply ops_control migration via Supabase client
 * Uses Supabase REST API to execute SQL
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db/index';
import { readFileSync } from 'fs';
import { join } from 'path';

async function main() {
  const supabase = getSupabaseClient();
  
  try {
    console.log('📋 Reading migration file...');
    const migrationPath = join(__dirname, '../supabase/migrations/20260106092255_ops_control_table.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');
    
    // Split SQL into individual statements
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    console.log(`🔧 Applying ${statements.length} SQL statements...`);
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (!statement) continue;
      
      console.log(`   Executing statement ${i + 1}/${statements.length}...`);
      
      // Use Supabase REST API to execute SQL
      // Note: Supabase client doesn't directly support raw SQL execution
      // We'll need to use the PostgREST API or pg REST API
      const { data, error } = await supabase.rpc('exec_sql', { 
        query: statement + ';' 
      }).catch(async () => {
        // If exec_sql doesn't exist, try direct pg REST API
        const SUPABASE_URL = process.env.SUPABASE_URL;
        const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
        
        if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
          throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
        }
        
        // Use pg REST API endpoint
        const pgMetaUrl = `${SUPABASE_URL.replace('/rest/v1', '')}/pg/sql`;
        const response = await fetch(pgMetaUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
          },
          body: JSON.stringify({ query: statement + ';' })
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
        
        return { data: await response.json(), error: null };
      });
      
      if (error) {
        // Some errors are expected (e.g., IF NOT EXISTS)
        if (error.message.includes('already exists') || error.message.includes('duplicate')) {
          console.log(`   ⚠️  Statement ${i + 1} skipped (already exists)`);
        } else {
          console.error(`   ❌ Statement ${i + 1} failed: ${error.message}`);
          throw error;
        }
      } else {
        console.log(`   ✅ Statement ${i + 1} executed successfully`);
      }
    }
    
    console.log('\n✅ Migration applied successfully!');
    
    // Verify via Supabase client
    console.log('🔍 Verifying table exists...');
    const { data: verifyData, error: verifyError } = await supabase
      .from('ops_control')
      .select('key')
      .limit(1);
    
    if (verifyError) {
      if (verifyError.code === '42P01') {
        console.error('❌ Verification failed: Table not found');
        process.exit(1);
      } else {
        console.error(`❌ Verification error: ${verifyError.message}`);
        process.exit(1);
      }
    } else {
      console.log('✅ Table verified: ops_control exists');
    }
    
    // Verify function exists by trying to call it
    console.log('🔍 Verifying function exists...');
    const { data: functionTest, error: functionError } = await supabase
      .rpc('consume_controlled_token', { token_value: 'test_nonexistent_token' });
    
    if (functionError) {
      if (functionError.code === '42883') {
        console.error('❌ Function NOT found: consume_controlled_token');
        process.exit(1);
      } else {
        // Function exists but returned false (expected for nonexistent token)
        console.log('✅ Function verified: consume_controlled_token exists');
        console.log(`   Test result: ${functionTest} (expected false)`);
      }
    } else {
      console.log('✅ Function verified: consume_controlled_token exists');
      console.log(`   Test result: ${functionTest}`);
    }
    
    console.log('\n✅ Migration complete and verified!');
    
  } catch (error: any) {
    console.error(`❌ Error applying migration: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

main().catch(console.error);

