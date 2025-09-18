#!/usr/bin/env node

/**
 * Simple migration to create outcomes table
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigration() {
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
    // Test connection
    const client = await pool.connect();
    console.log('✅ Database connected');
    
    // Read migration file
    const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20250918_outcomes_table.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📝 Running migration: 20250918_outcomes_table.sql');
    
    // Execute migration
    await client.query(migrationSQL);
    
    console.log('✅ Migration completed successfully');
    
    // Verify table exists
    const result = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'outcomes'
      ORDER BY ordinal_position
    `);
    
    console.log(`📊 Outcomes table created with ${result.rows.length} columns:`);
    result.rows.forEach(row => {
      console.log(`   • ${row.column_name}: ${row.data_type}`);
    });
    
    client.release();
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
