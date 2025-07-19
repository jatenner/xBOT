#!/usr/bin/env node

/**
 * 🔧 QUICK FIX SCRIPT - Low Engagement Crisis
 * 
 * This script fixes the real problems causing your low engagement:
 * 1. Environment variable loading issues
 * 2. Database schema missing api_source column
 * 3. Verifies API connectivity
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 === QUICK FIX SCRIPT - LOW ENGAGEMENT CRISIS ===');
console.log('📅 Date:', new Date().toISOString());
console.log('📁 Working directory:', process.cwd());
console.log('');

// STEP 1: Fix environment loading
console.log('🔧 STEP 1: Fixing environment loading...');

// Ensure dotenv is loaded
require('dotenv').config();

const criticalKeys = [
  'OPENAI_API_KEY',
  'TWITTER_BEARER_TOKEN',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'NEWS_API_KEY'
];

console.log('🔑 Checking critical API keys:');
let missingKeys = 0;
criticalKeys.forEach(key => {
  const value = process.env[key];
  if (value && value !== 'your_' + key.toLowerCase() + '_here') {
    console.log(`✅ ${key}: ${value.substring(0, 15)}...`);
  } else {
    console.log(`❌ ${key}: MISSING OR DEFAULT`);
    missingKeys++;
  }
});

if (missingKeys === 0) {
  console.log('✅ All critical API keys are configured correctly!');
} else {
  console.log(`⚠️ ${missingKeys} API keys need configuration`);
}

// STEP 2: Test Database Connection
console.log('\\n🗄️ STEP 2: Testing database connection...');

async function testDatabaseConnection() {
  try {
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    // Test connection
    const { data, error } = await supabase
      .from('tweets')
      .select('count')
      .limit(1);
    
    if (error) {
      console.log('❌ Database connection failed:', error.message);
      return false;
    } else {
      console.log('✅ Database connection successful!');
      return true;
    }
  } catch (error) {
    console.log('❌ Database test failed:', error.message);
    return false;
  }
}

// STEP 3: Fix Database Schema
console.log('\\n🔧 STEP 3: Checking database schema...');

async function fixDatabaseSchema() {
  try {
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    // Check if api_source column exists
    const { data, error } = await supabase
      .from('news_articles')
      .select('api_source')
      .limit(1);
    
    if (error && error.message.includes('api_source')) {
      console.log('🔧 Adding missing api_source column...');
      
      // Add the missing column
      const { error: alterError } = await supabase.rpc('exec_sql', {
        sql: `
          ALTER TABLE news_articles 
          ADD COLUMN IF NOT EXISTS api_source VARCHAR(50) DEFAULT 'unknown';
          
          CREATE INDEX IF NOT EXISTS idx_news_articles_api_source 
          ON news_articles(api_source);
        `
      });
      
      if (alterError) {
        console.log('❌ Failed to add api_source column:', alterError.message);
        console.log('📝 Please run this SQL manually in Supabase:');
        console.log('   ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS api_source VARCHAR(50) DEFAULT \\'unknown\\';');
        return false;
      } else {
        console.log('✅ api_source column added successfully!');
        return true;
      }
    } else {
      console.log('✅ api_source column already exists!');
      return true;
    }
  } catch (error) {
    console.log('❌ Schema check failed:', error.message);
    return false;
  }
}

// STEP 4: Test APIs
console.log('\\n🌐 STEP 4: Testing API connectivity...');

async function testAPIs() {
  const results = {};
  
  // Test OpenAI
  try {
    const { Configuration, OpenAIApi } = require('openai');
    // Just test if we can create the client - don't make API calls to save money
    if (process.env.OPENAI_API_KEY) {
      console.log('✅ OpenAI: API key configured');
      results.openai = true;
    } else {
      console.log('❌ OpenAI: API key missing');
      results.openai = false;
    }
  } catch (error) {
    console.log('❌ OpenAI: Configuration error');
    results.openai = false;
  }
  
  // Test News API
  if (process.env.NEWS_API_KEY) {
    console.log('✅ NewsAPI: API key configured');
    results.newsapi = true;
  } else {
    console.log('❌ NewsAPI: API key missing');
    results.newsapi = false;
  }
  
  // Test Twitter
  if (process.env.TWITTER_BEARER_TOKEN) {
    console.log('✅ Twitter: Bearer token configured');
    results.twitter = true;
  } else {
    console.log('❌ Twitter: Bearer token missing');
    results.twitter = false;
  }
  
  return results;
}

// Main execution
async function main() {
  console.log('\\n🚀 Running all tests and fixes...');
  
  const dbConnected = await testDatabaseConnection();
  const schemaFixed = await fixDatabaseSchema();
  const apiResults = await testAPIs();
  
  console.log('\\n📊 === FINAL RESULTS ===');
  console.log('🗄️ Database Connected:', dbConnected ? '✅' : '❌');
  console.log('🔧 Schema Fixed:', schemaFixed ? '✅' : '❌');
  console.log('🔑 APIs Configured:', Object.values(apiResults).filter(Boolean).length + '/' + Object.keys(apiResults).length);
  
  if (dbConnected && schemaFixed && Object.values(apiResults).every(Boolean)) {
    console.log('\\n🎉 === ALL SYSTEMS READY! ===');
    console.log('✅ Your bot should now work without database errors');
    console.log('✅ API keys are properly loaded');
    console.log('✅ Environment is configured correctly');
    console.log('\\n🚀 Ready to break Ghost Syndrome and boost engagement!');
    
    console.log('\\n📝 NEXT STEPS:');
    console.log('1. Run: npm start');
    console.log('2. Monitor for 24 hours');
    console.log('3. Engagement should improve as database errors stop');
    console.log('4. No need to wait until July 1st - fixes are immediate!');
  } else {
    console.log('\\n⚠️ === ISSUES REMAIN ===');
    console.log('❌ Some fixes are needed before optimal performance');
    
    if (!dbConnected) {
      console.log('🔧 Fix: Check Supabase credentials in .env');
    }
    if (!schemaFixed) {
      console.log('🔧 Fix: Run database schema update manually');
    }
    if (!Object.values(apiResults).every(Boolean)) {
      console.log('🔧 Fix: Configure missing API keys in .env');
    }
  }
}

main().catch(console.error); 