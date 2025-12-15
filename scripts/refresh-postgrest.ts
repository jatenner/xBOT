/**
 * Refresh PostgREST Schema Cache
 */

import { Pool } from 'pg';
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

async function refreshPostgREST() {
  console.log('Refreshing PostgREST schema cache...');
  
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
    const client = await pool.connect();
    try {
      await client.query("NOTIFY pgrst, 'reload schema'");
      await client.query("NOTIFY pgrst, 'reload config'");
      console.log('✅ PostgREST schema reload notifications sent');
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('❌ Failed to refresh PostgREST:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

refreshPostgREST().catch(console.error);

