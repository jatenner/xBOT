#!/usr/bin/env node
// scripts/health-check.js
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const REQUIRED_TABLES = {
  // Analytics tables with specific column requirements
  tweet_metrics: [
    'tweet_id', 'captured_at', 'like_count', 'retweet_count', 
    'reply_count', 'quote_count', 'impression_count', 'json_payload'
  ],
  bot_dashboard: [
    'date', 'planned_posts_json', 'created_at', 'updated_at'
  ],
  // Core bot tables (existence check only)
  tweets: [],
  tweet_topics: [],
  tweet_images: []
};

async function checkTable(tableName, requiredColumns = []) {
  try {
    // First try to select from the table to check if it exists
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .limit(1);
    
    if (error) {
      if (error.code === 'PGRST116' || error.code === '42P01' || error.message.includes('does not exist')) {
        return { status: 'missing', message: 'Table missing' };
      } else {
        return { status: 'error', message: error.message };
      }
    }
    
    // Now get the count since table exists
    const { count, error: countError } = await supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      return { status: 'error', message: countError.message };
    }
    
    // If no specific columns required, just check existence
    if (requiredColumns.length === 0) {
      return { status: 'ok', count, message: `${count} rows` };
    }
    
    // Test required columns by selecting them
    const selectFields = requiredColumns.join(', ');
    const { data: colData, error: colError } = await supabase
      .from(tableName)
      .select(selectFields)
      .limit(1);
      
    if (colError) {
      // Parse column error to identify missing columns
      const missingCols = requiredColumns.filter(col => 
        colError.message.includes(`column "${col}" does not exist`)
      );
      
      if (missingCols.length > 0) {
        return { 
          status: 'incomplete', 
          count,
          message: `Missing columns: ${missingCols.join(', ')}` 
        };
      } else {
        return { status: 'error', message: colError.message };
      }
    }
    
    return { 
      status: 'ok', 
      count, 
      message: `${requiredColumns.length} columns OK, ${count} rows` 
    };
    
  } catch (error) {
    return { status: 'error', message: error.message };
  }
}

async function main() {
  console.log('🔍 xBOT Database Health Check');
  console.log('=' .repeat(40));
  
  let allPassed = true;
  const results = [];
  
  for (const [tableName, requiredColumns] of Object.entries(REQUIRED_TABLES)) {
    const result = await checkTable(tableName, requiredColumns);
    results.push({ tableName, ...result });
    
    const icon = result.status === 'ok' ? '✅' : '❌';
    const name = tableName.padEnd(15);
    
    console.log(`${icon} ${name} | ${result.message}`);
    
    if (result.status !== 'ok') {
      allPassed = false;
    }
  }
  
  console.log('=' .repeat(40));
  
  if (!allPassed) {
    console.log('🚨 Database health check FAILED');
    console.log('\n💡 To fix issues:');
    console.log('   1. Run: npx supabase db push');
    console.log('   2. Check migration files in /migrations/');
    process.exit(1);
  }
  
  console.log('✅ Database health check PASSED');
  console.log('\n📊 Summary:');
  results.forEach(r => {
    if (r.count !== undefined) {
      console.log(`   ${r.tableName}: ${r.count} rows`);
    }
  });
  
  process.exit(0);
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { checkTable, main }; 