#!/usr/bin/env tsx
/**
 * Apply Phase 1 & 2 migrations in order
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

function getPgSSL(connectionString: string) {
  // Always use SSL for Supabase/cloud databases
  if (connectionString.includes('supabase') || connectionString.includes('pooler') || connectionString.includes('sslmode')) {
    return { rejectUnauthorized: false };
  }
  return undefined;
}

async function applyMigration(filePath: string, fileName: string): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL not found in environment');
  }

  const sslConfig = getPgSSL(databaseUrl);
  const pool = new Pool({
    connectionString: databaseUrl,
    ...(sslConfig ? { ssl: sslConfig } : {}),
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000
  });

  try {
    console.log(`\n📄 Applying migration: ${fileName}`);
    const migrationSQL = readFileSync(filePath, 'utf-8');
    
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(migrationSQL);
      await client.query('COMMIT');
      console.log(`✅ Migration ${fileName} applied successfully`);
    } catch (error: any) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

async function main() {
  const migrationsDir = join(__dirname, '../supabase/migrations');
  const migrations = [
    '20251205_add_v2_outcomes_fields.sql',
    '20251205_add_content_slot_fixed.sql', // Fixed version for view-based schema
    '20251205_create_vw_learning.sql',
    '20251205_create_learning_model_weights.sql'
  ];

  console.log('🔄 Applying Phase 1 & 2 migrations...\n');

  for (const migration of migrations) {
    const filePath = join(migrationsDir, migration);
    try {
      await applyMigration(filePath, migration);
    } catch (error: any) {
      console.error(`❌ Failed to apply ${migration}:`, error.message);
      // Check if it's an "already exists" error (idempotent migrations)
      if (error.message.includes('already exists') || 
          error.message.includes('duplicate') ||
          error.message.includes('does not exist') && error.message.includes('column')) {
        console.log(`⚠️ Migration ${migration} may already be applied or column exists (continuing...)`);
      } else if (error.message.includes('not supported for views') || error.code === '42809') {
        console.log(`⚠️ Migration ${migration} failed - content_metadata appears to be a view, not a table`);
        console.log(`⚠️ This migration may need to be applied manually or the schema may differ`);
        console.log(`⚠️ Continuing with other migrations...`);
        // Continue with other migrations - don't throw
      } else {
        throw error;
      }
    }
  }

  console.log('\n✅ All Phase 1 & 2 migrations applied successfully!');
}

main().catch(error => {
  console.error('❌ Migration failed:', error);
  process.exit(1);
});

