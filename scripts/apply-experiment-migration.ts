/**
 * Apply Experiment Metadata Migration
 * 
 * Applies 20250116_add_experiment_metadata.sql to add experiment_group and hook_variant columns
 */

import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';
import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load env
dotenv.config();

async function applyMigration() {
  console.log('='.repeat(60));
  console.log('APPLYING EXPERIMENT METADATA MIGRATION');
  console.log('='.repeat(60));
  console.log('');

  // Try Supabase client first (for DDL via RPC if available)
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (supabaseUrl && supabaseKey) {
    console.log('📡 Attempting via Supabase client...');
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Read migration file
    const migrationPath = join(__dirname, '../supabase/migrations/20250116_add_experiment_metadata.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');

    console.log('📄 Migration file loaded');
    console.log(`📏 SQL size: ${migrationSQL.length} characters`);
    console.log('');

    // Try RPC exec_sql if available
    try {
      const { data, error } = await supabase.rpc('exec_sql', { sql_query: migrationSQL });
      
      if (!error) {
        console.log('✅ Migration applied via Supabase RPC!');
        await verifyMigration(supabase);
        return;
      } else {
        console.log('⚠️  RPC not available, trying direct PostgreSQL connection...');
        console.log('');
      }
    } catch (err: any) {
      console.log('⚠️  RPC not available, trying direct PostgreSQL connection...');
      console.log('');
    }
  }

  // Fallback to direct PostgreSQL connection
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL not found in environment');
  }

  // Remove sslmode from connection string and handle SSL in Pool config
  const cleanUrl = databaseUrl.replace(/[?&]sslmode=[^&]*/g, '');
  
  const pool = new Pool({
    connectionString: cleanUrl,
    ssl: {
      rejectUnauthorized: false
    },
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000
  });

  try {
    // Read migration file
    const migrationPath = join(__dirname, '../supabase/migrations/20250116_add_experiment_metadata.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');

    console.log('📄 Migration file loaded');
    console.log(`📏 SQL size: ${migrationSQL.length} characters`);
    console.log('');

    // Execute migration
    console.log('⏳ Executing migration via PostgreSQL...');
    console.log('');

    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      await client.query(migrationSQL);
      await client.query('COMMIT');

      console.log('✅ Migration applied successfully!');
      console.log('');

      await verifyMigrationDirect(client);

    } catch (error: any) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    console.log('');
    console.log('='.repeat(60));
    console.log('MIGRATION COMPLETE');
    console.log('='.repeat(60));

  } catch (error: any) {
    console.error('');
    console.error('❌ Migration failed:', error.message);
    console.error('');
    console.error('Error details:');
    console.error(error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

async function verifyMigration(supabase: any) {
  console.log('🔍 Verifying migration...');
  
  // Check base table columns
  const { data: columns, error: colError } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('content_slot, experiment_group, hook_variant')
    .limit(1);
  
  if (colError) {
    if (colError.message.includes('experiment_group') || colError.message.includes('hook_variant')) {
      console.log('⚠️  Columns may not exist yet:', colError.message);
    } else {
      console.log('✅ Base table queryable');
    }
  } else {
    console.log('✅ Base table includes experiment columns');
  }
  
  // Check VIEW
  const { data: viewData, error: viewError } = await supabase
    .from('content_metadata')
    .select('experiment_group, hook_variant')
    .limit(1);
  
  if (viewError) {
    if (viewError.message.includes('experiment_group') || viewError.message.includes('hook_variant')) {
      console.log('⚠️  VIEW may not include experiment columns yet');
      console.log('   (PostgREST cache may need refresh)');
    }
  } else {
    console.log('✅ VIEW includes experiment columns');
  }
}

async function verifyMigrationDirect(client: any) {
  console.log('🔍 Verifying migration...');
  
  const verifyQuery = `
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'content_generation_metadata_comprehensive' 
    AND column_name IN ('content_slot', 'experiment_group', 'hook_variant')
    ORDER BY column_name;
  `;

  const verifyResult = await client.query(verifyQuery);
  const columns = verifyResult.rows.map((row: any) => row.column_name);

  console.log('Columns found:');
  columns.forEach((col: string) => {
    console.log(`  ✅ ${col}`);
  });

  if (columns.length < 3) {
    const missing = ['content_slot', 'experiment_group', 'hook_variant'].filter(
      col => !columns.includes(col)
    );
    console.log('');
    console.log('⚠️  Missing columns:', missing.join(', '));
  } else {
    console.log('');
    console.log('✅ All required columns exist!');
  }

  // Verify VIEW
  console.log('');
  console.log('🔍 Verifying content_metadata VIEW...');
  const viewQuery = `
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'content_metadata' 
    AND column_name IN ('experiment_group', 'hook_variant')
    ORDER BY column_name;
  `;

  const viewResult = await client.query(viewQuery);
  const viewColumns = viewResult.rows.map((row: any) => row.column_name);

  if (viewColumns.length === 2) {
    console.log('✅ VIEW includes experiment columns:');
    viewColumns.forEach((col: string) => {
      console.log(`  ✅ ${col}`);
    });
  } else {
    console.log('⚠️  VIEW may not include experiment columns yet');
    console.log('   (PostgREST cache may need refresh)');
  }
}

applyMigration().catch(console.error);

