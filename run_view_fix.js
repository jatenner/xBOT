#!/usr/bin/env node
/**
 * Fix content_with_outcomes view column names
 */

require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');

// Bypass SSL certificate validation
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function fixView() {
  console.log('🔧 Fixing content_with_outcomes view...\n');
  
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    // Read SQL file
    let sql = fs.readFileSync('fix_content_with_outcomes_view.sql', 'utf8');
    
    // Remove psql-specific commands
    sql = sql
      .split('\n')
      .filter(line => {
        const trimmed = line.trim();
        return !trimmed.startsWith('\\echo') && 
               !trimmed.startsWith('\\') &&
               trimmed.length > 0;
      })
      .join('\n');

    console.log('📝 Executing SQL...\n');
    
    // Execute the SQL
    const result = await client.query(sql);
    
    console.log('\n✅ View fixed successfully!');
    console.log('📊 Verification query returned:', result.rows?.length || 0, 'rows\n');
    
    if (result.rows && result.rows.length > 0) {
      console.log('Sample data:');
      result.rows.forEach(row => {
        console.log(`  - ${row.content?.substring(0, 60)}... (${row.actual_likes} likes)`);
      });
    }
    
    console.log('\n✅ DATABASE VIEW FIX COMPLETE!\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Details:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

fixView().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

