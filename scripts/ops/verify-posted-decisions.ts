#!/usr/bin/env tsx
/**
 * Verification script for posted_decisions table existence
 * Checks information_schema before and after migrations
 */

import 'dotenv/config';
import { Client } from 'pg';

async function checkPostedDecisions(): Promise<void> {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  
  try {
    await client.connect();
    
    // Check if posted_decisions exists as table
    const tableCheck = await client.query(`
      SELECT table_name, table_type 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'posted_decisions'
    `);
    
    // Check if posted_decisions exists as view
    const viewCheck = await client.query(`
      SELECT table_name 
      FROM information_schema.views 
      WHERE table_schema = 'public' AND table_name = 'posted_decisions'
    `);
    
    console.log('posted_decisions table exists:', tableCheck.rows.length > 0);
    if (tableCheck.rows.length > 0) {
      console.log('  Type:', tableCheck.rows[0].table_type);
    }
    
    console.log('posted_decisions view exists:', viewCheck.rows.length > 0);
    
    // Check indexes
    if (tableCheck.rows.length > 0) {
      const indexes = await client.query(`
        SELECT indexname 
        FROM pg_indexes 
        WHERE schemaname = 'public' AND tablename = 'posted_decisions'
      `);
      console.log('Indexes on posted_decisions:', indexes.rows.map(r => r.indexname));
    }
    
  } catch (error: any) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

checkPostedDecisions().catch(console.error);
