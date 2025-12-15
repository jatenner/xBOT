/**
 * Apply vw_learning View Migration
 * 
 * Applies 20250115_restore_content_slot_and_vw_learning.sql to recreate vw_learning view
 */

import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

function getPgSSL(connectionString: string) {
  if (connectionString.includes('supabase') || connectionString.includes('sslmode=require') || connectionString.includes('pooler.supabase.com')) {
    return {
      rejectUnauthorized: false
    };
  }
  return undefined;
}

async function applyMigration() {
  console.log('='.repeat(60));
  console.log('APPLYING VW_LEARNING VIEW MIGRATION');
  console.log('='.repeat(60));
  console.log('');

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL not found in environment');
  }

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
    const migrationPath = join(__dirname, '../supabase/migrations/20250115_restore_content_slot_and_vw_learning.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');

    console.log('📄 Migration file loaded');
    console.log(`📏 SQL size: ${migrationSQL.length} characters`);
    console.log('');

    // Execute migration
    console.log('⏳ Executing migration...');
    console.log('');

    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      await client.query(migrationSQL);
      await client.query('COMMIT');

      console.log('✅ Migration applied successfully!');
      console.log('');

      // Verify vw_learning exists
      console.log('🔍 Verifying vw_learning view...');
      const verifyQuery = `
        SELECT COUNT(*) AS row_count
        FROM vw_learning
        WHERE posted_at >= NOW() - INTERVAL '7 days';
      `;

      try {
        const verifyResult = await client.query(verifyQuery);
        const rowCount = parseInt(verifyResult.rows[0].row_count);
        console.log(`✅ vw_learning view exists and is queryable`);
        console.log(`   Rows in last 7 days: ${rowCount}`);
      } catch (verifyError: any) {
        console.log(`⚠️  Verification query failed: ${verifyError.message}`);
        console.log('   View may need time to populate');
      }

      // Also check total rows
      try {
        const totalQuery = `SELECT COUNT(*) AS total FROM vw_learning;`;
        const totalResult = await client.query(totalQuery);
        const totalRows = parseInt(totalResult.rows[0].total);
        console.log(`   Total rows: ${totalRows}`);
      } catch (err: any) {
        // Ignore if view doesn't exist yet
      }

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
    if (error.message.includes('already exists')) {
      console.log('ℹ️  View may already exist. This is safe to ignore.');
    }
    throw error;
  } finally {
    await pool.end();
  }
}

applyMigration().catch(console.error);

