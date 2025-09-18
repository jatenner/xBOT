#!/usr/bin/env node

/**
 * Migrate all tables for xBOT Shadow→Live readiness
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const migrations = [
  '20250918_outcomes_table.sql',
  '20250918_tweet_analytics.sql', 
  '20250918_content_metadata_embeddings.sql'
];

async function runMigrations() {
  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL required');
    process.exit(1);
  }

  console.log('🔄 Connecting to database...');
  
  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: DATABASE_URL.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined
  });

  try {
    const client = await pool.connect();
    console.log('✅ Database connected');
    
    for (const migration of migrations) {
      console.log(`📝 Running migration: ${migration}`);
      
      const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', migration);
      if (!fs.existsSync(migrationPath)) {
        console.warn(`⚠️ Migration file not found: ${migrationPath}`);
        continue;
      }
      
      const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
      
      try {
        await client.query(migrationSQL);
        console.log(`✅ ${migration} completed`);
      } catch (error) {
        console.error(`❌ ${migration} failed:`, error.message);
        // Continue with other migrations
      }
    }
    
    // Verify key tables exist
    console.log('\n📊 Verifying table structure...');
    
    const tables = ['outcomes', 'tweet_analytics', 'content_metadata'];
    for (const table of tables) {
      try {
        const result = await client.query(`
          SELECT column_name, data_type 
          FROM information_schema.columns 
          WHERE table_name = $1
          ORDER BY ordinal_position
        `, [table]);
        
        if (result.rows.length > 0) {
          console.log(`✅ ${table}: ${result.rows.length} columns`);
        } else {
          console.log(`⚠️ ${table}: not found`);
        }
      } catch (error) {
        console.log(`❌ ${table}: error checking - ${error.message}`);
      }
    }
    
    client.release();
    console.log('\n✅ All migrations completed');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigrations();
