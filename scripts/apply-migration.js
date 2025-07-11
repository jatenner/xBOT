#!/usr/bin/env node

/**
 * 🚀 DATABASE MIGRATION APPLIER
 * 
 * Executes the robust architecture migration via Supabase client
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function applyMigration() {
  console.log('🚀 === APPLYING ROBUST ARCHITECTURE MIGRATION ===');
  
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, '..', 'migrations', '20250119_robust_architecture_upgrade.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📄 Migration file loaded');
    console.log('🔄 Executing migration...');
    
    // Execute the migration
    const { data, error } = await supabase.rpc('exec_sql', { sql: migrationSQL });
    
    if (error) {
      console.error('❌ Migration failed:', error);
      
      // Try executing individual statements
      console.log('🔄 Trying to execute statements individually...');
      
      const statements = migrationSQL
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'))
        .filter(s => !s.match(/^(SELECT|COMMENT)/i));
      
      let successCount = 0;
      let errorCount = 0;
      
      for (const statement of statements) {
        try {
          console.log(`📝 Executing: ${statement.substring(0, 50)}...`);
          
          const { error: stmtError } = await supabase.rpc('exec_sql', { 
            sql: statement + ';' 
          });
          
          if (stmtError) {
            console.warn(`⚠️ Statement failed: ${stmtError.message}`);
            errorCount++;
          } else {
            successCount++;
          }
        } catch (err) {
          console.warn(`⚠️ Statement error: ${err.message}`);
          errorCount++;
        }
      }
      
      console.log(`📊 Results: ${successCount} successful, ${errorCount} failed`);
      
      if (successCount === 0) {
        throw new Error('All migration statements failed');
      }
    } else {
      console.log('✅ Migration executed successfully');
    }
    
    // Verify the migration
    console.log('🔍 Verifying migration...');
    
    const tables = [
      'twitter_rate_limits',
      'tweet_performance', 
      'daily_growth',
      'quality_improvements',
      'cached_insights',
      'content_templates',
      'system_logs'
    ];
    
    let verificationResults = {};
    
    for (const table of tables) {
      try {
        const { count, error } = await supabase
          .from(table)
          .select('*', { count: 'exact', head: true });
        
        if (error) {
          verificationResults[table] = { exists: false, error: error.message };
        } else {
          verificationResults[table] = { exists: true, count };
        }
      } catch (err) {
        verificationResults[table] = { exists: false, error: err.message };
      }
    }
    
    console.log('\n📋 VERIFICATION RESULTS:');
    for (const [table, result] of Object.entries(verificationResults)) {
      if (result.exists) {
        console.log(`✅ ${table} - Created (${result.count || 0} rows)`);
      } else {
        console.log(`❌ ${table} - Missing: ${result.error}`);
      }
    }
    
    // Check content templates specifically
    const { data: templates, error: templatesError } = await supabase
      .from('content_templates')
      .select('count(*)', { count: 'exact' });
    
    if (!templatesError && templates) {
      console.log(`📝 Content templates seeded: ${templates.length || 0} templates`);
    }
    
    console.log('\n🎉 Migration application complete!');
    
  } catch (error) {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  }
}

// Helper function to create exec_sql function if it doesn't exist
async function ensureExecSqlFunction() {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  
  const createFunctionSQL = `
    CREATE OR REPLACE FUNCTION exec_sql(sql text)
    RETURNS text AS $$
    BEGIN
      EXECUTE sql;
      RETURN 'OK';
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;
  `;
  
  try {
    // This might not work due to security restrictions
    console.log('🔧 Attempting to create exec_sql function...');
    const { error } = await supabase.rpc('exec_sql', { sql: createFunctionSQL });
    if (error) {
      console.log('ℹ️ exec_sql function creation skipped (expected in hosted environments)');
    }
  } catch (err) {
    console.log('ℹ️ exec_sql function not available - using alternative method');
  }
}

applyMigration(); 