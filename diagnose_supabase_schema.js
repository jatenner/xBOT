#!/usr/bin/env node

/**
 * 🔍 SUPABASE DATABASE SCHEMA DIAGNOSIS
 * 
 * This script will examine your Supabase database using the correct API approach
 * to understand exactly what exists and what's missing.
 */

const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function diagnoseDatabaseSchema() {
  try {
    console.log('🔍 SUPABASE DATABASE SCHEMA DIAGNOSIS');
    console.log('=' .repeat(70));
    console.log(`🔗 Connected to: ${supabaseUrl}`);
    console.log('');

    // 1. Test known bot-related table names that might exist
    console.log('🤖 TESTING FOR EXISTING BOT TABLES:');
    console.log('-' .repeat(50));
    
    const possibleTables = [
      'posts', 'tweets', 'bot_posts', 'learning_posts',
      'contextual_bandit_arms', 'contextual_bandit_history', 
      'enhanced_timing_stats', 'engagement_metrics',
      'budget_optimization_log', 'content_generation_sessions',
      'simple_bandit_arms', 'simple_learning_data',
      'viral_tweets_learned', 'influencer_tweets',
      'engagement_feedback_tracking', 'format_stats',
      'tweet_performance_analysis', 'ai_learning_insights'
    ];

    const existingTables = [];
    const missingTables = [];

    for (const tableName of possibleTables) {
      try {
        const { data, error } = await supabase
          .from(tableName)
          .select('*')
          .limit(1);
          
        if (error) {
          if (error.message.includes('does not exist') || error.message.includes('relation') || error.code === '42P01') {
            console.log(`❌ ${tableName} - MISSING`);
            missingTables.push(tableName);
          } else {
            console.log(`⚠️  ${tableName} - EXISTS but error: ${error.message}`);
            existingTables.push({ name: tableName, status: 'error', error: error.message });
          }
        } else {
          console.log(`✅ ${tableName} - EXISTS (${data?.length || 0} rows tested)`);
          existingTables.push({ name: tableName, status: 'exists', data });
        }
      } catch (err) {
        console.log(`❌ ${tableName} - ERROR: ${err.message}`);
        missingTables.push(tableName);
      }
    }

    console.log(`\n📊 SUMMARY:`);
    console.log(`✅ Existing tables: ${existingTables.length}`);
    console.log(`❌ Missing tables: ${missingTables.length}`);

    // 2. For existing tables, get detailed information
    if (existingTables.length > 0) {
      console.log('\n📋 DETAILED ANALYSIS OF EXISTING TABLES:');
      console.log('-' .repeat(50));
      
      for (const table of existingTables) {
        if (table.status === 'exists') {
          console.log(`\n🔍 Table: ${table.name}`);
          
          try {
            // Get sample data to understand structure
            const { data: sampleData, error: sampleError } = await supabase
              .from(table.name)
              .select('*')
              .limit(3);
              
            if (sampleError) {
              console.log(`   ❌ Could not fetch sample data: ${sampleError.message}`);
            } else if (sampleData && sampleData.length > 0) {
              console.log(`   📊 Columns found:`);
              const columns = Object.keys(sampleData[0]);
              columns.forEach(col => {
                const sampleValue = sampleData[0][col];
                const type = typeof sampleValue;
                console.log(`   - ${col}: ${type} (sample: ${sampleValue})`);
              });
              
              // Get row count
              const { count, error: countError } = await supabase
                .from(table.name)
                .select('*', { count: 'exact', head: true });
                
              if (!countError) {
                console.log(`   📈 Total rows: ${count}`);
              }
            } else {
              console.log(`   📭 Table exists but is empty`);
            }
          } catch (err) {
            console.log(`   ❌ Analysis error: ${err.message}`);
          }
        }
      }
    }

    // 3. Test RPC function availability
    console.log('\n🔧 TESTING RPC FUNCTION AVAILABILITY:');
    console.log('-' .repeat(50));
    
    const testFunctions = [
      'exec', 'calculate_engagement_score', 'get_optimal_posting_time', 
      'get_bandit_arm_statistics', 'simple_engagement_score', 'get_best_format'
    ];

    for (const funcName of testFunctions) {
      try {
        const { data, error } = await supabase.rpc(funcName, {});
        
        if (error) {
          if (error.message.includes('find the function') || error.message.includes('does not exist')) {
            console.log(`❌ ${funcName} - MISSING`);
          } else {
            console.log(`⚠️  ${funcName} - EXISTS but error: ${error.message}`);
          }
        } else {
          console.log(`✅ ${funcName} - EXISTS and functional`);
        }
      } catch (err) {
        console.log(`❌ ${funcName} - ERROR: ${err.message}`);
      }
    }

    // 4. Identify the core posting table
    console.log('\n🎯 IDENTIFYING CORE POSTING TABLE:');
    console.log('-' .repeat(50));
    
    let mainPostingTable = null;
    const postingTableCandidates = existingTables.filter(t => 
      t.name.includes('post') || t.name.includes('tweet') || t.name.includes('bot')
    );

    if (postingTableCandidates.length > 0) {
      console.log(`Found ${postingTableCandidates.length} potential posting tables:`);
      for (const table of postingTableCandidates) {
        console.log(`   - ${table.name}`);
        if (!mainPostingTable) {
          mainPostingTable = table.name;
        }
      }
      console.log(`🎯 Using '${mainPostingTable}' as main posting table`);
    } else {
      console.log('❌ No posting tables found - will need to create one');
    }

    // 5. Generate recommendations
    console.log('\n💡 DIAGNOSIS RESULTS & RECOMMENDATIONS:');
    console.log('-' .repeat(50));
    
    const recommendations = [];
    
    if (existingTables.length === 0) {
      recommendations.push('🔴 CRITICAL: No bot tables found. Database needs complete setup.');
      recommendations.push('🔧 ACTION: Create fresh enhanced learning system from scratch.');
    } else {
      recommendations.push(`✅ Found ${existingTables.length} existing tables to work with.`);
      
      if (mainPostingTable) {
        recommendations.push(`✅ Main posting table identified: ${mainPostingTable}`);
        recommendations.push(`🔧 ACTION: Enhance '${mainPostingTable}' with learning columns.`);
      } else {
        recommendations.push('🔴 CRITICAL: No main posting table identified.');
        recommendations.push('🔧 ACTION: Create main posting table.');
      }
      
      if (!existingTables.find(t => t.name.includes('bandit'))) {
        recommendations.push('🟡 Missing: Bandit learning system for content optimization.');
        recommendations.push('🔧 ACTION: Create bandit tables for ML-driven content selection.');
      }
      
      if (!existingTables.find(t => t.name.includes('timing'))) {
        recommendations.push('🟡 Missing: Timing optimization for posting schedule.');
        recommendations.push('🔧 ACTION: Create timing analytics tables.');
      }
    }
    
    recommendations.forEach(rec => console.log(rec));

    console.log('\n🚀 NEXT STEPS BASED ON DIAGNOSIS:');
    console.log('-' .repeat(50));
    
    if (existingTables.length === 0) {
      console.log('1. Create complete enhanced learning system from scratch');
      console.log('2. Use table names that don\'t conflict with any existing schema');
      console.log('3. Build foundation tables first, then add learning components');
    } else {
      console.log('1. Create targeted SQL that works with existing tables');
      console.log(`2. Enhance '${mainPostingTable || 'main table'}' with learning columns`);
      console.log('3. Add missing learning tables without conflicts');
      console.log('4. Create functions that work with actual table structure');
    }

    console.log('\n' + '=' .repeat(70));
    console.log('🔍 DIAGNOSIS COMPLETE - READY FOR TARGETED SOLUTION');
    console.log('=' .repeat(70));

    return {
      existingTables: existingTables.map(t => t.name),
      missingTables,
      mainPostingTable,
      needsCompleteSetup: existingTables.length === 0,
      hasLearningTables: existingTables.some(t => t.name.includes('bandit') || t.name.includes('learning')),
      hasTimingTables: existingTables.some(t => t.name.includes('timing'))
    };

  } catch (error) {
    console.error('❌ Diagnosis failed:', error);
    console.error('Stack trace:', error.stack);
    return null;
  }
}

// Run the diagnosis
if (require.main === module) {
  diagnoseDatabaseSchema()
    .then(result => {
      if (result) {
        console.log('\n🎯 Ready to create perfectly targeted SQL solution!');
        process.exit(0);
      } else {
        console.log('\n❌ Diagnosis failed. Please check connection and permissions.');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('❌ Unexpected error:', error);
      process.exit(1);
    });
}

module.exports = { diagnoseDatabaseSchema }; 