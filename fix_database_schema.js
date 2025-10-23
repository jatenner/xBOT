#!/usr/bin/env node

// Load environment variables
require('dotenv').config();

// Use the project's existing database connection
const { makePgPool } = require('./src/db/pgClient');

async function fixDatabaseSchema() {
  console.log('🔧 Fixing post_attribution table schema...');
  
  const pool = makePgPool();
  const client = await pool.connect();
  
  try {
    // Check current schema
    console.log('📊 Checking current schema...');
    const schemaResult = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'post_attribution' 
      ORDER BY ordinal_position;
    `);
    
    console.log(`Found ${schemaResult.rows.length} columns:`);
    schemaResult.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type}`);
    });
    
    // Check for essential columns
    const essential = ['engagement_rate', 'impressions', 'followers_gained', 'hook_pattern', 'topic'];
    const existing = schemaResult.rows.map(r => r.column_name);
    const missing = essential.filter(col => !existing.includes(col));
    
    if (missing.length > 0) {
      console.log(`❌ MISSING ESSENTIAL COLUMNS: ${missing.join(', ')}`);
      console.log('🔧 Adding missing columns...');
      
      for (const col of missing) {
        let alterSQL = '';
        if (col === 'engagement_rate') {
          alterSQL = 'ALTER TABLE post_attribution ADD COLUMN engagement_rate NUMERIC(5,4) DEFAULT 0;';
        } else if (col === 'impressions') {
          alterSQL = 'ALTER TABLE post_attribution ADD COLUMN impressions INTEGER DEFAULT 0;';
        } else if (col === 'followers_gained') {
          alterSQL = 'ALTER TABLE post_attribution ADD COLUMN followers_gained INTEGER DEFAULT 0;';
        } else if (col === 'hook_pattern') {
          alterSQL = 'ALTER TABLE post_attribution ADD COLUMN hook_pattern TEXT;';
        } else if (col === 'topic') {
          alterSQL = 'ALTER TABLE post_attribution ADD COLUMN topic TEXT;';
        }
        
        if (alterSQL) {
          try {
            await client.query(alterSQL);
            console.log(`✅ Added column: ${col}`);
          } catch (error) {
            console.log(`⚠️  Column ${col} might already exist: ${error.message}`);
          }
        }
      }
      
      console.log('🎉 Schema fix completed!');
    } else {
      console.log('✅ All essential columns already exist');
    }
    
    // Verify the fix
    console.log('🔍 Verifying schema after fix...');
    const verifyResult = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'post_attribution' 
      ORDER BY ordinal_position;
    `);
    
    console.log(`📊 Updated schema (${verifyResult.rows.length} columns):`);
    verifyResult.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type}`);
    });
    
    // Check data count
    const countResult = await client.query('SELECT COUNT(*) as count FROM post_attribution;');
    const count = parseInt(countResult.rows[0].count);
    console.log(`📈 Total posts in post_attribution: ${count}`);
    
    if (count > 0) {
      // Get sample data
      const sampleResult = await client.query(`
        SELECT 
          posted_at,
          engagement_rate,
          impressions,
          followers_gained,
          topic,
          hook_pattern
        FROM post_attribution 
        ORDER BY posted_at DESC 
        LIMIT 3;
      `);
      
      console.log('📊 Recent posts sample:');
      sampleResult.rows.forEach((post, i) => {
        console.log(`  Post ${i + 1}:`);
        console.log(`    - posted_at: ${post.posted_at}`);
        console.log(`    - engagement_rate: ${post.engagement_rate || 'NULL'}`);
        console.log(`    - impressions: ${post.impressions || 'NULL'}`);
        console.log(`    - followers_gained: ${post.followers_gained || 'NULL'}`);
        console.log(`    - topic: ${post.topic || 'NULL'}`);
        console.log(`    - hook_pattern: ${post.hook_pattern || 'NULL'}`);
      });
    }
    
    console.log('✅ Database schema fix completed successfully!');
    
  } catch (error) {
    console.error('❌ Database error:', error.message);
    throw error;
  } finally {
    client.release();
  }
}

fixDatabaseSchema().catch(console.error);
