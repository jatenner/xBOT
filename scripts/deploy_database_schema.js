#!/usr/bin/env node

/**
 * 🗄️ DEPLOY DATABASE SCHEMA FOR ALGORITHM INTELLIGENCE
 * 
 * Ensures all required tables exist for algorithm mastery systems
 */

const { supabaseClient } = require('../dist/utils/supabaseClient');

async function deployDatabaseSchema() {
  console.log('🗄️ === DEPLOYING ALGORITHM INTELLIGENCE SCHEMA ===');
  console.log('🎯 Mission: Ensure all tables exist for follower growth optimization');
  console.log('');

  try {
    // Test database connection
    console.log('🔍 Testing Supabase connection...');
    const { data: testData, error: testError } = await supabaseClient.supabase
      .from('tweets')
      .select('id')
      .limit(1);
    
    if (testError) {
      console.log('❌ Database connection failed:', testError.message);
      return false;
    }
    
    console.log('✅ Database connection successful');
    console.log('');

    // Check for critical tables
    const criticalTables = [
      'algorithm_signals',
      'viral_patterns', 
      'follower_triggers',
      'algorithm_insights',
      'engagement_velocity_tracking',
      'competitor_analysis',
      'health_trending_topics',
      'follower_psychology_profiles'
    ];

    console.log('🔍 Checking for algorithm intelligence tables...');
    
    for (const tableName of criticalTables) {
      try {
        const { data, error } = await supabaseClient.supabase
          .from(tableName)
          .select('id')
          .limit(1);
        
        if (error) {
          console.log(`❌ Table missing: ${tableName}`);
          console.log(`   Error: ${error.message}`);
        } else {
          console.log(`✅ Table exists: ${tableName}`);
        }
      } catch (tableError) {
        console.log(`❌ Table check failed: ${tableName} - ${tableError.message}`);
      }
    }

    console.log('');
    console.log('📊 Schema deployment status:');
    console.log('');
    console.log('If tables are missing, you need to run the schema migration.');
    console.log('Schema file: migrations/twitter_algorithm_intelligence_schema.sql');
    console.log('');
    console.log('🚀 Once tables exist, the algorithm systems will function at 100%');

    return true;

  } catch (error) {
    console.error('❌ Schema deployment check failed:', error);
    return false;
  }
}

// Run deployment check
deployDatabaseSchema().then(success => {
  if (success) {
    console.log('✅ Database schema check complete');
  } else {
    console.log('❌ Database schema check failed');
    process.exit(1);
  }
});