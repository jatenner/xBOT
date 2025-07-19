#!/usr/bin/env node

/**
 * 🔍 FIND REAL POSTING DATA - TABLE DISCOVERY
 * ==========================================
 * 
 * The post_history table doesn't exist, so we need to find
 * where the actual posting data is stored to verify if our
 * changes are working.
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function findPostingTables() {
  console.log('🔍 DISCOVERING POSTING DATA TABLES');
  console.log('=' .repeat(50));
  
  try {
    // Check for tables that might contain posting data
    const possibleTables = [
      'tweets',
      'posts', 
      'post_tweets',
      'tweet_history',
      'posted_tweets',
      'twitter_posts',
      'sent_tweets',
      'published_posts',
      'social_posts',
      'content_posts'
    ];
    
    for (const tableName of possibleTables) {
      try {
        const { data, error } = await supabase
          .from(tableName)
          .select('*')
          .limit(1);
        
        if (!error && data) {
          console.log(`✅ Found table: ${tableName}`);
          
          // Get count of records
          const { count } = await supabase
            .from(tableName)
            .select('*', { count: 'exact', head: true });
          
          console.log(`   📊 Total records: ${count}`);
          
          // Show sample structure
          if (data.length > 0) {
            console.log(`   📋 Sample columns: ${Object.keys(data[0]).join(', ')}`);
          }
          console.log('');
        }
      } catch (err) {
        // Table doesn't exist, continue
      }
    }
    
    // Also check for any table with "tweet" or "post" in the name
    console.log('🔍 Searching for any tables with "tweet" or "post":');
    
    // Use raw SQL to get table names
    const { data: tables, error: tablesError } = await supabase.rpc('get_table_names');
    
    if (tablesError) {
      console.log('⚠️  Could not query table names directly');
    }
    
  } catch (error) {
    console.error('❌ Error discovering tables:', error);
  }
}

async function checkRecentActivity() {
  console.log('📅 CHECKING RECENT SYSTEM ACTIVITY');
  console.log('=' .repeat(50));
  
  try {
    // Check bot_config for recent updates
    const { data: configs, error } = await supabase
      .from('bot_config')
      .select('key, updated_at')
      .order('updated_at', { ascending: false })
      .limit(10);
    
    if (!error && configs) {
      console.log('Recent config updates:');
      configs.forEach(config => {
        console.log(`  ${config.updated_at}: ${config.key}`);
      });
    }
    
    // Check if there are any daily_progress or similar tables
    const monitoringTables = [
      'daily_progress',
      'posting_schedule',
      'scheduler_jobs',
      'system_activity',
      'bot_activity',
      'posting_log',
      'execution_log'
    ];
    
    console.log('\n🔍 Checking monitoring tables:');
    for (const tableName of monitoringTables) {
      try {
        const { data, error } = await supabase
          .from(tableName)
          .select('*')
          .order('created_at', { ascending: false })
          .limit(3);
        
        if (!error && data && data.length > 0) {
          console.log(`✅ ${tableName}: ${data.length} recent records`);
          console.log(`   Latest: ${data[0].created_at || data[0].updated_at || 'No timestamp'}`);
        }
      } catch (err) {
        // Table doesn't exist
      }
    }
    
  } catch (error) {
    console.error('❌ Error checking recent activity:', error);
  }
}

async function checkCurrentSystemStatus() {
  console.log('\n⚡ CURRENT SYSTEM STATUS');
  console.log('=' .repeat(50));
  
  try {
    // Check if bot is currently enabled
    const { data: botStatus } = await supabase
      .from('bot_config')
      .select('*')
      .eq('key', 'bot_enabled')
      .single();
    
    if (botStatus) {
      console.log(`🤖 Bot Status: ${JSON.stringify(botStatus.value)}`);
      console.log(`   Last updated: ${botStatus.updated_at}`);
    }
    
    // Check emergency mode
    const { data: emergencyMode } = await supabase
      .from('bot_config')
      .select('*')
      .eq('key', 'emergency_mode_override')
      .single();
    
    if (emergencyMode) {
      console.log(`🚨 Emergency Mode: ${JSON.stringify(emergencyMode.value)}`);
    }
    
    // Check if daily budget is exhausted
    const { data: budget } = await supabase
      .from('bot_config')
      .select('*')
      .eq('key', 'daily_budget_status')
      .single();
    
    if (budget) {
      console.log(`💰 Budget Status: ${JSON.stringify(budget.value)}`);
    }
    
  } catch (error) {
    console.error('❌ Error checking system status:', error);
  }
}

async function main() {
  console.log('🔍 REAL DATA DISCOVERY');
  console.log('Finding where posting data is actually stored...\n');
  
  await findPostingTables();
  await checkRecentActivity();
  await checkCurrentSystemStatus();
  
  console.log('\n🎯 SUMMARY:');
  console.log('=' .repeat(50));
  console.log('We need to find the actual posting data to verify if our changes worked.');
  console.log('The system configurations are set correctly, but we need to check:');
  console.log('1. What table contains the actual tweets/posts');
  console.log('2. If the production system is reading our database configs');
  console.log('3. Why the system might still be burst posting despite our changes');
}

main().catch(console.error); 