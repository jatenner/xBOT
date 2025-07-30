#!/usr/bin/env node

/**
 * 🔧 APPLY COLUMN FIX MIGRATION
 * ============================
 * Handles missing database columns with proper error handling
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

require('dotenv').config();

async function applyColumnFix() {
  console.log('🚀 === APPLYING COLUMN FIX MIGRATION ===');
  
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, '..', 'migrations', '20250130_fix_missing_columns_proper.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📄 Migration file loaded');
    console.log('🔄 Executing migration...');
    
    // Try using exec_sql function first
    try {
      const { data, error } = await supabase.rpc('exec_sql', { sql: migrationSQL });
      
      if (error) {
        throw error;
      }
      
      console.log('✅ Migration executed successfully via exec_sql function');
      return;
    } catch (execSqlError) {
      console.log('⚠️ exec_sql function not available, trying alternative method...');
      console.log(`   Error: ${execSqlError.message}`);
    }
    
    // Alternative: Execute statements individually using direct SQL
    console.log('🔄 Executing statements individually...');
    
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))
      .filter(s => !s.match(/^(SELECT|COMMENT)/i)); // Skip SELECT and COMMENT
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const statement of statements) {
      try {
        console.log(`📝 Executing: ${statement.substring(0, 60)}...`);
        
        // For DDL operations, try direct query execution
        if (statement.toUpperCase().includes('ALTER TABLE') ||
            statement.toUpperCase().includes('CREATE INDEX') ||
            statement.toUpperCase().includes('UPDATE') ||
            statement.toUpperCase().includes('INSERT')) {
          
          // Use from().select() for DDL operations (Supabase workaround)
          try {
            // This is a workaround - we'll manually execute in Supabase SQL Editor
            console.log(`   ⚠️ DDL Statement requires manual execution in Supabase SQL Editor`);
            console.log(`   SQL: ${statement}`);
            errorCount++;
          } catch (ddlError) {
            console.warn(`   ❌ DDL Statement failed: ${ddlError.message}`);
            errorCount++;
          }
        } else {
          // For other operations, log them for manual execution
          console.log(`   📋 Statement logged for manual execution`);
          successCount++;
        }
        
      } catch (err) {
        console.warn(`⚠️ Statement error: ${err.message}`);
        errorCount++;
      }
    }
    
    console.log(`📊 Results: ${successCount} logged, ${errorCount} require manual execution`);
    
    // Provide manual execution instructions
    console.log('\n🔧 === MANUAL EXECUTION REQUIRED ===');
    console.log('The following SQL needs to be run manually in Supabase SQL Editor:');
    console.log('\n' + '='.repeat(60));
    console.log(migrationSQL);
    console.log('='.repeat(60));
    console.log('\n📝 Instructions:');
    console.log('1. Copy the SQL above');
    console.log('2. Go to your Supabase SQL Editor');
    console.log('3. Paste and run the SQL');
    console.log('4. This will fix the missing column errors in the logs');
    
  } catch (error) {
    console.error('💥 Migration failed:', error);
    console.log('\n🆘 === FALLBACK SOLUTION ===');
    console.log('Run this SQL manually in Supabase SQL Editor:');
    console.log('\n-- Add missing columns');
    console.log('ALTER TABLE learning_posts ADD COLUMN IF NOT EXISTS bandit_confidence REAL DEFAULT 0.5;');
    console.log('ALTER TABLE tweets ADD COLUMN IF NOT EXISTS posted BOOLEAN DEFAULT TRUE;');
    console.log('UPDATE tweets SET posted = TRUE WHERE posted IS NULL;');
    console.log('CREATE INDEX IF NOT EXISTS idx_tweets_posted ON tweets(posted);');
    console.log('CREATE INDEX IF NOT EXISTS idx_learning_posts_bandit_confidence ON learning_posts(bandit_confidence);');
    
    process.exit(1);
  }
}

applyColumnFix();