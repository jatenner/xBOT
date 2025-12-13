#!/usr/bin/env tsx
import { readFileSync } from 'fs';
import { join } from 'path';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

function getPgSSL(connectionString: string) {
  if (connectionString.includes('supabase') || connectionString.includes('pooler') || connectionString.includes('sslmode')) {
    return { rejectUnauthorized: false };
  }
  return undefined;
}

async function apply() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL not found');
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: getPgSSL(databaseUrl),
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000
  });

  const migrationSQL = readFileSync(join(__dirname, '../supabase/migrations/20251205_create_vw_learning.sql'), 'utf-8');
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(migrationSQL);
    await client.query('COMMIT');
    console.log('✅ vw_learning view created successfully');
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

apply().catch(error => {
  console.error('Failed:', error);
  process.exit(1);
});

