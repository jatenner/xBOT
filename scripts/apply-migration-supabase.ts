#!/usr/bin/env tsx
/**
 * Apply database migration using Supabase client
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load env
dotenv.config();

async function applyMigration() {
  console.log('🔄 Applying database migration via Supabase...\n');

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required');
  }

  // Create Supabase client
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  try {
    // Read migration file
    const migrationPath = join(__dirname, '../supabase/migrations/20251104_reply_system_enhancements.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');

    console.log('📄 Migration file loaded');
    console.log(`📏 SQL size: ${migrationSQL.length} characters\n`);

    // Split SQL into individual statements (split on semicolons outside of quotes)
    // For now, let's use rpc if available, or execute directly
    console.log('⏳ Executing migration...\n');

    // Use Supabase RPC to execute raw SQL
    // Note: Supabase doesn't have direct SQL execution, so we'll use the REST API
    // Actually, let's use the pg pool from the project's existing code
    
    // Use Supabase client's RPC to execute SQL
    // Since direct SQL execution via Supabase client is limited, 
    // we'll create a temporary connection with proper SSL
    
    const { Pool } = await import('pg');
    const databaseUrl = process.env.DATABASE_URL;
    
    if (!databaseUrl) {
      throw new Error('DATABASE_URL not found');
    }
    
    // Force SSL with rejectUnauthorized: false for Supabase
    // Note: If you get SSL errors, you may need to set NODE_TLS_REJECT_UNAUTHORIZED=0
    const pool = new Pool({
      connectionString: databaseUrl,
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    });
    
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      
      // Execute the migration
      await client.query(migrationSQL);
      
      await client.query('COMMIT');
      
      console.log('✅ Migration applied successfully!\n');
      
      // Verify tables were created
      console.log('🔍 Verifying new tables...\n');
      
      const { rows: newTables } = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_name IN ('conversation_opportunities', 'ab_tests', 'ab_test_results', 'system_events')
        AND table_schema = 'public'
        ORDER BY table_name
      `);
      
      console.log(`✅ New tables created: ${newTables.length}/4`);
      newTables.forEach((row: any) => {
        console.log(`   • ${row.table_name}`);
      });
      
      // Verify old tables were dropped
      const { rows: oldTables } = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_name IN ('reply_targets', 'real_reply_opportunities')
        AND table_schema = 'public'
      `);
      
      if (oldTables.length === 0) {
        console.log('\n✅ Unused tables dropped successfully');
        console.log('   • reply_targets (dropped)');
        console.log('   • real_reply_opportunities (dropped)');
      } else {
        console.log('\n⚠️  Some tables still exist:');
        oldTables.forEach((row: any) => {
          console.log(`   • ${row.table_name} (not dropped)`);
        });
      }
      
      console.log('\n' + '═'.repeat(80));
      console.log('✅ MIGRATION COMPLETE');
      console.log('═'.repeat(80) + '\n');
      
    } catch (error: any) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
      await pool.end();
    }

  } catch (error: any) {
    console.error('\n❌ Migration failed!');
    console.error(`Error: ${error.message}\n`);
    
    if (error.message.includes('already exists')) {
      console.log('ℹ️  Some tables may already exist. This is safe to ignore.');
    }
    
    throw error;
  }
}

// Run migration
applyMigration()
  .then(() => {
    console.log('✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  });

