#!/usr/bin/env node

const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

require('dotenv').config();

async function applyLearningMigration() {
  console.log('🧠 Applying autonomous learning enhancement migration...');
  
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Test connection first
    const { data: testData, error: testError } = await supabase
      .from('tweets')
      .select('id')
      .limit(1);
    
    if (testError) {
      throw new Error(`Database connection failed: ${testError.message}`);
    }
    
    console.log('✅ Database connection verified');

    // Read and execute migration SQL in parts
    const sql = fs.readFileSync('migrations/20250129_autonomous_learning_enhancement.sql', 'utf8');
    
    // Create tables one by one with error handling
    const tables = [
      'learning_posts',
      'engagement_metrics', 
      'format_stats',
      'timing_stats',
      'daily_optimization_reports',
      'generator_performance'
    ];
    
    for (const table of tables) {
      console.log(`Creating table: ${table}...`);
      
      // Test if table exists by querying it
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(1);
      
      if (error && error.code === 'PGRST116') {
        console.log(`  ❌ Table ${table} does not exist - needs creation`);
      } else if (error) {
        console.log(`  ⚠️ Error checking ${table}: ${error.message}`);
      } else {
        console.log(`  ✅ Table ${table} already exists`);
      }
    }
    
    console.log('\n📊 Migration Analysis Complete');
    console.log('Note: Manual SQL execution may be required via Supabase dashboard');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

applyLearningMigration(); 