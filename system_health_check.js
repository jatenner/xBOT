/**
 * 🏥 COMPREHENSIVE SYSTEM HEALTH CHECK
 * Verify all migrations, database tables, and system components
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Use service role for admin access
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

async function systemHealthCheck() {
  console.log('🏥 COMPREHENSIVE SYSTEM HEALTH CHECK');
  console.log('====================================\n');

  const healthReport = {
    database: { status: 'unknown', issues: [] },
    migrations: { status: 'unknown', issues: [] },
    tables: { status: 'unknown', issues: [] },
    bulletproofSystem: { status: 'unknown', issues: [] },
    overall: 'unknown'
  };

  try {
    // Test 1: Database Connectivity
    console.log('1️⃣  TESTING DATABASE CONNECTIVITY');
    console.log('=================================');
    
    const { data: testData, error: testError } = await supabase
      .from('schema_migrations')
      .select('version')
      .limit(1);

    if (testError) {
      console.log('❌ Database connection failed:', testError.message);
      healthReport.database.status = 'failed';
      healthReport.database.issues.push(testError.message);
    } else {
      console.log('✅ Database connection successful');
      healthReport.database.status = 'healthy';
    }

    // Test 2: Check Required Tables
    console.log('\n2️⃣  CHECKING REQUIRED TABLES');
    console.log('============================');
    
    const requiredTables = [
      'tweets',
      'learning_posts', 
      'tweet_analytics',
      'schema_migrations',
      'prompt_performance'  // New bulletproof table
    ];

    const tableResults = {};
    
    for (const table of requiredTables) {
      try {
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .limit(1);
        
        if (error) {
          console.log(`❌ Table "${table}": ${error.message}`);
          tableResults[table] = { status: 'missing', error: error.message };
          healthReport.tables.issues.push(`Table ${table}: ${error.message}`);
        } else {
          console.log(`✅ Table "${table}": Accessible`);
          tableResults[table] = { status: 'healthy' };
        }
      } catch (err) {
        console.log(`❌ Table "${table}": ${err.message}`);
        tableResults[table] = { status: 'error', error: err.message };
        healthReport.tables.issues.push(`Table ${table}: ${err.message}`);
      }
    }

    // Test 3: Check Schema Migrations
    console.log('\n3️⃣  CHECKING SCHEMA MIGRATIONS');
    console.log('==============================');
    
    try {
      const { data: migrations, error: migError } = await supabase
        .from('schema_migrations')
        .select('*')
        .order('version', { ascending: false });

      if (migError) {
        console.log('❌ Cannot access schema_migrations:', migError.message);
        healthReport.migrations.status = 'failed';
        healthReport.migrations.issues.push(migError.message);
      } else {
        console.log(`✅ Found ${migrations?.length || 0} migration records`);
        
        if (migrations && migrations.length > 0) {
          console.log('\nRecent migrations:');
          migrations.slice(0, 5).forEach(migration => {
            console.log(`   - ${migration.version}: ${new Date(migration.inserted_at).toLocaleDateString()}`);
          });
          
          // Check for bulletproof migration
          const bulletproofMigration = migrations.find(m => 
            m.version && m.version.includes('20241216') || 
            m.version.includes('prompt_performance')
          );
          
          if (bulletproofMigration) {
            console.log('✅ Bulletproof system migration found');
          } else {
            console.log('⚠️  Bulletproof system migration NOT found');
            healthReport.migrations.issues.push('Bulletproof migration missing');
          }
        }
        
        healthReport.migrations.status = 'healthy';
      }
    } catch (migErr) {
      console.log('❌ Migration check failed:', migErr.message);
      healthReport.migrations.status = 'error';
      healthReport.migrations.issues.push(migErr.message);
    }

    // Test 4: Check Bulletproof System Tables
    console.log('\n4️⃣  CHECKING BULLETPROOF SYSTEM REQUIREMENTS');
    console.log('============================================');
    
    // Check prompt_performance table specifically
    try {
      const { data: promptPerfData, error: promptPerfError } = await supabase
        .from('prompt_performance')
        .select('*')
        .limit(1);

      if (promptPerfError) {
        console.log('❌ prompt_performance table missing or inaccessible');
        console.log('   Error:', promptPerfError.message);
        console.log('   💡 This table is required for Thompson Sampling optimization');
        healthReport.bulletproofSystem.issues.push('prompt_performance table missing');
        
        // Try to create the table
        console.log('\n🔧 ATTEMPTING TO CREATE MISSING TABLE...');
        console.log('========================================');
        
        const createTableSQL = `
          CREATE TABLE IF NOT EXISTS prompt_performance (
            id SERIAL PRIMARY KEY,
            post_id TEXT NOT NULL,
            prompt_version TEXT NOT NULL,
            persona TEXT NOT NULL,
            emotion TEXT NOT NULL,
            framework TEXT NOT NULL,
            likes INTEGER DEFAULT 0,
            retweets INTEGER DEFAULT 0,
            replies INTEGER DEFAULT 0,
            impressions INTEGER DEFAULT 0,
            follows INTEGER DEFAULT 0,
            engagement_rate DECIMAL(5,4) DEFAULT 0,
            viral_score INTEGER DEFAULT 0,
            hours_after_post INTEGER DEFAULT 0,
            recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
        `;
        
        try {
          const { error: createError } = await supabase.rpc('exec_sql', { 
            sql: createTableSQL 
          });
          
          if (createError) {
            console.log('❌ Failed to create table:', createError.message);
            console.log('📝 Manual SQL needed in Supabase dashboard:');
            console.log(createTableSQL);
          } else {
            console.log('✅ Table created successfully');
          }
        } catch (createErr) {
          console.log('❌ Table creation failed:', createErr.message);
          console.log('\n📝 MANUAL MIGRATION REQUIRED');
          console.log('============================');
          console.log('Please run this SQL in Supabase SQL Editor:');
          console.log(createTableSQL);
        }
        
      } else {
        console.log('✅ prompt_performance table exists and accessible');
        healthReport.bulletproofSystem.status = 'healthy';
      }
    } catch (tableErr) {
      console.log('❌ Bulletproof table check failed:', tableErr.message);
      healthReport.bulletproofSystem.issues.push(tableErr.message);
    }

    // Test 5: Check Core Tables Structure
    console.log('\n5️⃣  CHECKING CORE TABLE STRUCTURES');
    console.log('==================================');
    
    const coreTableChecks = [
      {
        table: 'tweets',
        requiredColumns: ['id', 'content', 'created_at'],
        test: () => supabase.from('tweets').select('id, content, created_at').limit(1)
      },
      {
        table: 'learning_posts', 
        requiredColumns: ['id', 'content', 'viral_score'],
        test: () => supabase.from('learning_posts').select('id, content, viral_score').limit(1)
      }
    ];

    for (const check of coreTableChecks) {
      try {
        const { data, error } = await check.test();
        if (error) {
          console.log(`❌ ${check.table} structure issue: ${error.message}`);
          healthReport.tables.issues.push(`${check.table}: ${error.message}`);
        } else {
          console.log(`✅ ${check.table} structure valid`);
        }
      } catch (err) {
        console.log(`❌ ${check.table} check failed: ${err.message}`);
      }
    }

    // Test 6: Environment Variables
    console.log('\n6️⃣  CHECKING ENVIRONMENT VARIABLES');
    console.log('==================================');
    
    const requiredEnvVars = [
      'SUPABASE_URL',
      'SUPABASE_ANON_KEY', 
      'OPENAI_API_KEY'
    ];

    const missingEnvVars = [];
    
    requiredEnvVars.forEach(envVar => {
      if (process.env[envVar]) {
        console.log(`✅ ${envVar}: Set`);
      } else {
        console.log(`❌ ${envVar}: Missing`);
        missingEnvVars.push(envVar);
      }
    });

    if (missingEnvVars.length > 0) {
      healthReport.bulletproofSystem.issues.push(`Missing env vars: ${missingEnvVars.join(', ')}`);
    }

    // Calculate Overall Health
    healthReport.tables.status = healthReport.tables.issues.length === 0 ? 'healthy' : 'issues';
    
    const totalIssues = [
      ...healthReport.database.issues,
      ...healthReport.migrations.issues,
      ...healthReport.tables.issues,
      ...healthReport.bulletproofSystem.issues
    ].length;

    if (totalIssues === 0) {
      healthReport.overall = 'healthy';
    } else if (totalIssues <= 2) {
      healthReport.overall = 'warnings';
    } else {
      healthReport.overall = 'critical';
    }

    // Final Report
    console.log('\n🏥 FINAL HEALTH REPORT');
    console.log('======================');
    
    const healthEmoji = {
      healthy: '✅',
      warnings: '⚠️',
      critical: '❌',
      failed: '❌',
      unknown: '❓'
    };

    console.log(`${healthEmoji[healthReport.database.status]} Database: ${healthReport.database.status}`);
    console.log(`${healthEmoji[healthReport.migrations.status]} Migrations: ${healthReport.migrations.status}`);
    console.log(`${healthEmoji[healthReport.tables.status]} Tables: ${healthReport.tables.status}`);
    console.log(`${healthEmoji[healthReport.bulletproofSystem.status]} Bulletproof System: ${healthReport.bulletproofSystem.status}`);
    console.log(`${healthEmoji[healthReport.overall]} Overall: ${healthReport.overall.toUpperCase()}`);

    if (totalIssues > 0) {
      console.log('\n🔧 ISSUES TO RESOLVE:');
      console.log('=====================');
      let issueNum = 1;
      
      [...healthReport.database.issues, ...healthReport.migrations.issues, 
       ...healthReport.tables.issues, ...healthReport.bulletproofSystem.issues].forEach(issue => {
        console.log(`${issueNum}. ${issue}`);
        issueNum++;
      });
    }

    // Action Items
    console.log('\n🎯 NEXT ACTIONS');
    console.log('===============');
    
    if (healthReport.overall === 'healthy') {
      console.log('✅ All systems operational! Bulletproof system ready.');
      console.log('🚀 Ready for aggressive learning and posting.');
    } else {
      console.log('🔧 Fix the issues above before full deployment.');
      console.log('💡 Most critical: Ensure prompt_performance table exists.');
      console.log('🏥 Run this health check again after fixes.');
    }

    return healthReport;

  } catch (error) {
    console.error('💥 HEALTH_CHECK_FAILED:', error.message);
    healthReport.overall = 'failed';
    return healthReport;
  }
}

// Run the health check
if (require.main === module) {
  systemHealthCheck().catch(console.error);
}

module.exports = { systemHealthCheck };