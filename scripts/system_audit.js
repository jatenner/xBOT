#!/usr/bin/env node

/**
 * 🔍 COMPREHENSIVE SYSTEM AUDIT
 * Tests all Twitter automation components for functionality
 */

const path = require('path');
const fs = require('fs');

async function runSystemAudit() {
  console.log('🔍 TWITTER AUTOMATION SYSTEM AUDIT');
  console.log('==================================\n');

  const results = {
    posting: { status: 'unknown', issues: [] },
    analytics: { status: 'unknown', issues: [] },
    database: { status: 'unknown', issues: [] },
    browser: { status: 'unknown', issues: [] },
    session: { status: 'unknown', issues: [] }
  };

  // 1. Check Environment Variables
  console.log('📋 1. ENVIRONMENT VARIABLES');
  console.log('----------------------------');
  
  const requiredEnvVars = [
    'TWITTER_SESSION_B64',
    'SUPABASE_URL', 
    'SUPABASE_ANON_KEY',
    'OPENAI_API_KEY',
    'REDIS_URL'
  ];

  for (const envVar of requiredEnvVars) {
    const value = process.env[envVar];
    if (value) {
      console.log(`✅ ${envVar}: Set (${value.length} chars)`);
    } else {
      console.log(`❌ ${envVar}: Missing`);
      results.session.issues.push(`Missing ${envVar}`);
    }
  }

  // 2. Check Session Data
  console.log('\n🔐 2. TWITTER SESSION');
  console.log('---------------------');
  
  try {
    const sessionB64 = process.env.TWITTER_SESSION_B64;
    if (sessionB64) {
      const sessionData = JSON.parse(Buffer.from(sessionB64, 'base64').toString());
      if (sessionData.cookies && Array.isArray(sessionData.cookies)) {
        console.log(`✅ Session: ${sessionData.cookies.length} cookies loaded`);
        results.session.status = 'healthy';
      } else {
        console.log('❌ Session: Invalid format');
        results.session.status = 'error';
        results.session.issues.push('Invalid session format');
      }
    }
  } catch (error) {
    console.log(`❌ Session: Parse error - ${error.message}`);
    results.session.status = 'error';
    results.session.issues.push(`Parse error: ${error.message}`);
  }

  // 3. Check Database Connection
  console.log('\n💾 3. DATABASE CONNECTION');
  console.log('-------------------------');
  
  try {
    const { admin: supabase } = require('../src/lib/supabaseClients');
    
    // Test basic connection
    const { data, error } = await supabase
      .from('learning_posts')
      .select('count')
      .limit(1);
    
    if (error) {
      console.log(`❌ Database: ${error.message}`);
      results.database.status = 'error';
      results.database.issues.push(error.message);
    } else {
      console.log('✅ Database: Connected successfully');
      results.database.status = 'healthy';
    }
  } catch (error) {
    console.log(`❌ Database: Connection failed - ${error.message}`);
    results.database.status = 'error';
    results.database.issues.push(`Connection failed: ${error.message}`);
  }

  // 4. Check Required Tables
  console.log('\n🗄️ 4. DATABASE TABLES');
  console.log('----------------------');
  
  const requiredTables = [
    'learning_posts',
    'tweet_analytics',
    'profile_analytics',
    'bulletproof_posts',
    'follower_growth_content',
    'aggressive_posts',
    'engagement_records'
  ];

  try {
    const { admin: supabase } = require('../src/lib/supabaseClients');
    
    for (const table of requiredTables) {
      try {
        const { error } = await supabase
          .from(table)
          .select('count')
          .limit(1);
        
        if (error) {
          console.log(`❌ Table ${table}: ${error.message}`);
          results.database.issues.push(`Table ${table}: ${error.message}`);
        } else {
          console.log(`✅ Table ${table}: Accessible`);
        }
      } catch (tableError) {
        console.log(`❌ Table ${table}: ${tableError.message}`);
        results.database.issues.push(`Table ${table}: ${tableError.message}`);
      }
    }
  } catch (error) {
    console.log(`❌ Table check failed: ${error.message}`);
    results.database.issues.push(`Table check failed: ${error.message}`);
  }

  // 5. Check Core Files
  console.log('\n📁 5. CORE FILES');
  console.log('-----------------');
  
  const coreFiles = [
    'src/main-bulletproof.ts',
    'src/posting/bulletproofPoster.ts',
    'src/posting/bulletproofBrowserManager.ts',
    'src/ai/followerGrowthContentEngine.ts',
    'src/engagement/aggressiveEngagementEngine.ts',
    'src/analytics/twitterAnalyticsScraper.ts'
  ];

  for (const file of coreFiles) {
    const filePath = path.join(process.cwd(), file);
    if (fs.existsSync(filePath)) {
      const size = fs.statSync(filePath).size;
      console.log(`✅ ${file}: Exists (${size} bytes)`);
    } else {
      console.log(`❌ ${file}: Missing`);
      results.posting.issues.push(`Missing file: ${file}`);
    }
  }

  // 6. Browser Test (Light)
  console.log('\n🌐 6. BROWSER SYSTEM');
  console.log('--------------------');
  
  try {
    const { bulletproofBrowser } = require('../src/posting/bulletproofBrowserManager');
    const status = bulletproofBrowser.getStatus();
    
    console.log(`Browser Status:`, status);
    
    if (status.browserConnected) {
      console.log('✅ Browser: Connected');
      results.browser.status = 'healthy';
    } else {
      console.log('⚠️ Browser: Not connected (will launch on demand)');
      results.browser.status = 'ready';
    }
    
  } catch (error) {
    console.log(`❌ Browser: ${error.message}`);
    results.browser.status = 'error';
    results.browser.issues.push(error.message);
  }

  // 7. Test Bulletproof Poster
  console.log('\n🚀 7. BULLETPROOF POSTER');
  console.log('-------------------------');
  
  try {
    const { bulletproofPoster } = require('../src/posting/bulletproofPoster');
    const status = bulletproofPoster.getStatus();
    
    console.log('Poster Status:', status);
    
    const healthCheck = await bulletproofPoster.healthCheck();
    if (healthCheck) {
      console.log('✅ Bulletproof Poster: Ready');
      results.posting.status = 'healthy';
    } else {
      console.log('⚠️ Bulletproof Poster: Health check failed');
      results.posting.status = 'warning';
      results.posting.issues.push('Health check failed');
    }
    
  } catch (error) {
    console.log(`❌ Bulletproof Poster: ${error.message}`);
    results.posting.status = 'error';
    results.posting.issues.push(error.message);
  }

  // 8. Summary
  console.log('\n📊 AUDIT SUMMARY');
  console.log('================');
  
  let overallStatus = 'healthy';
  
  for (const [component, result] of Object.entries(results)) {
    const emoji = result.status === 'healthy' ? '✅' : 
                  result.status === 'warning' ? '⚠️' : 
                  result.status === 'ready' ? '🟡' : '❌';
    
    console.log(`${emoji} ${component.toUpperCase()}: ${result.status}`);
    
    if (result.issues.length > 0) {
      result.issues.forEach(issue => console.log(`   - ${issue}`));
      if (result.status === 'error') overallStatus = 'error';
      else if (result.status === 'warning' && overallStatus === 'healthy') overallStatus = 'warning';
    }
  }
  
  console.log(`\n🎯 OVERALL STATUS: ${overallStatus.toUpperCase()}`);
  
  if (overallStatus === 'healthy') {
    console.log('\n🚀 SYSTEM READY FOR AUTONOMOUS OPERATION!');
  } else if (overallStatus === 'warning') {
    console.log('\n⚠️ SYSTEM FUNCTIONAL BUT HAS WARNINGS');
  } else {
    console.log('\n❌ SYSTEM HAS CRITICAL ISSUES - NEEDS ATTENTION');
  }
  
  return results;
}

// Run audit
runSystemAudit().catch(error => {
  console.error('Audit failed:', error);
  process.exit(1);
});
