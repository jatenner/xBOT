#!/usr/bin/env tsx
/**
 * Test database privileges
 */

import 'dotenv/config';
import { Client } from 'pg';

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL not set');
    process.exit(1);
  }

  // Parse and sanitize URL for display
  const parsed = new URL(databaseUrl);
  console.log('📊 Database Connection Info:');
  console.log('   Host:', parsed.hostname);
  console.log('   Port:', parsed.port || '5432');
  console.log('   Database:', parsed.pathname.slice(1));
  console.log('   User:', parsed.username);
  console.log('');

  const client = new Client({ connectionString: databaseUrl });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    // Test CREATE TABLE privilege
    try {
      await client.query('CREATE TABLE IF NOT EXISTS _xbot_priv_test(id int)');
      console.log('✅ CREATE TABLE privilege: OK');
      
      await client.query('DROP TABLE _xbot_priv_test');
      console.log('✅ DROP TABLE privilege: OK');
    } catch (e: any) {
      console.error('❌ Privilege test failed:', e.message);
      process.exit(1);
    }

    // Get current user and database
    const { rows } = await client.query('SELECT current_user, current_database()');
    console.log('   Current user:', rows[0].current_user);
    console.log('   Current database:', rows[0].current_database);
    console.log('');
    console.log('✅ All privilege tests passed');

  } catch (error: any) {
    console.error('❌ Connection failed:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main().catch(console.error);
