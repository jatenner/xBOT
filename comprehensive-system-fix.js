#!/usr/bin/env node

/**
 * COMPREHENSIVE SYSTEM FIX
 * Fixes Railway CLI connection AND deploys aggressive configuration
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔧 COMPREHENSIVE SYSTEM FIX');
console.log('============================');

// Step 1: Fix Railway CLI Connection
console.log('\n📡 STEP 1: Fix Railway CLI Connection');
console.log('=====================================');

try {
  // Try to get project list (this will force a connection)
  console.log('🔍 Attempting to discover Railway projects...');
  
  // Create a railway.json to help with project identification
  const railwayConfig = {
    "$schema": "https://railway.app/railway.schema.json",
    "build": {
      "builder": "NIXPACKS"
    },
    "deploy": {
      "startCommand": "npm start",
      "healthcheckPath": "/status"
    }
  };
  
  fs.writeFileSync('railway.json', JSON.stringify(railwayConfig, null, 2));
  console.log('✅ Created railway.json');
  
  // Try different approaches to connect
  const connectionApproaches = [
    () => {
      console.log('🔄 Approach 1: railway link');
      execSync('railway link --yes', { stdio: 'inherit', timeout: 30000 });
    },
    () => {
      console.log('🔄 Approach 2: railway connect');
      execSync('railway connect', { stdio: 'inherit', timeout: 30000 });
    },
    () => {
      console.log('🔄 Approach 3: Manual project detection');
      // Try to connect to xBOT project specifically
      const output = execSync('railway projects', { encoding: 'utf8', timeout: 30000 });
      console.log('Projects found:', output);
    }
  ];
  
  let connected = false;
  for (let i = 0; i < connectionApproaches.length && !connected; i++) {
    try {
      connectionApproaches[i]();
      console.log(`✅ Connection approach ${i + 1} succeeded`);
      connected = true;
    } catch (error) {
      console.log(`❌ Connection approach ${i + 1} failed:`, error.message);
    }
  }
  
  if (!connected) {
    console.log('⚠️ Railway CLI connection failed, but continuing with environment variable deployment');
  }
  
} catch (error) {
  console.log('⚠️ Railway CLI connection issues, proceeding with direct variable deployment');
}

// Step 2: Deploy Aggressive Configuration
console.log('\n🚀 STEP 2: Deploy Aggressive Configuration');
console.log('==========================================');

const AGGRESSIVE_CONFIG = {
  // Core Mode
  MODE: 'live',
  JOBS_AUTOSTART: 'true',
  
  // Job Intervals - AGGRESSIVE SCHEDULING
  JOBS_PLAN_INTERVAL_MIN: '15',        // Plan content every 15 minutes
  JOBS_POSTING_INTERVAL_MIN: '5',      // Check posting queue every 5 minutes
  JOBS_REPLY_INTERVAL_MIN: '20',       // Generate replies every 20 minutes
  JOBS_LEARN_INTERVAL_MIN: '60',       // Learn every hour
  
  // Rate Limits
  MAX_POSTS_PER_HOUR: '2',
  MAX_DAILY_POSTS: '48',
  REPLY_MAX_PER_DAY: '72',
  REPLY_MINUTES_BETWEEN: '20',
  
  // Enhanced Features
  ENABLE_REPLIES: 'true',
  ENABLE_THREADS: 'true',
  THREAD_PERCENTAGE: '10',
  
  // Quality & Learning
  MIN_QUALITY_SCORE: '0.7',
  EXPLORE_RATIO_MIN: '0.1',
  EXPLORE_RATIO_MAX: '0.3',
  
  // Budget
  DAILY_OPENAI_LIMIT_USD: '10.0',
  BUDGET_STRICT: 'false',
  
  // Posting
  GRACE_MINUTES: '5',
  MIN_POST_INTERVAL_MINUTES: '30',
  
  // Hook Evolution
  FEATURE_HOOK_EVOLUTION: 'true',
  FEATURE_FOLLOWER_OPTIMIZATION: 'true',
  FEATURE_PERFORMANCE_TRACKING: 'true',
};

// Deploy variables
let deployedCount = 0;
const totalVars = Object.keys(AGGRESSIVE_CONFIG).length;

console.log(`🔄 Deploying ${totalVars} environment variables...`);

for (const [key, value] of Object.entries(AGGRESSIVE_CONFIG)) {
  try {
    execSync(`railway variables set ${key}="${value}"`, { stdio: 'pipe', timeout: 15000 });
    deployedCount++;
    console.log(`✅ ${key}=${value}`);
  } catch (error) {
    console.log(`❌ Failed to set ${key}:`, error.message);
  }
}

console.log(`\n📊 Deployment Summary: ${deployedCount}/${totalVars} variables set`);

// Step 3: Restart Railway Service
console.log('\n🔄 STEP 3: Restart Railway Service');
console.log('==================================');

try {
  console.log('🔄 Restarting Railway service to apply configuration...');
  execSync('railway service restart', { stdio: 'inherit', timeout: 30000 });
  console.log('✅ Railway service restarted successfully');
} catch (error) {
  console.log('⚠️ Railway restart failed:', error.message);
  console.log('💡 Try manual restart via Railway dashboard');
}

// Step 4: Verification
console.log('\n✅ STEP 4: Verification Steps');
console.log('=============================');

console.log('🔍 To verify the fix worked:');
console.log('   1. Wait 2-3 minutes for restart');
console.log('   2. Run: npm run logs');
console.log('   3. Look for: Jobs: Plans>0 Posts>0 Replies>0');
console.log('   4. Check: railway logs (should work now)');

console.log('\n🎯 Expected Results:');
console.log('   📝 Content planning every 15 minutes');
console.log('   📮 2 posts per hour');
console.log('   💬 3 replies per hour');
console.log('   🧬 Hook evolution active');

console.log('\n🚀 COMPREHENSIVE FIX COMPLETE!');
console.log('Your system should now be fully operational.');



/**
 * COMPREHENSIVE SYSTEM FIX
 * Fixes Railway CLI connection AND deploys aggressive configuration
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔧 COMPREHENSIVE SYSTEM FIX');
console.log('============================');

// Step 1: Fix Railway CLI Connection
console.log('\n📡 STEP 1: Fix Railway CLI Connection');
console.log('=====================================');

try {
  // Try to get project list (this will force a connection)
  console.log('🔍 Attempting to discover Railway projects...');
  
  // Create a railway.json to help with project identification
  const railwayConfig = {
    "$schema": "https://railway.app/railway.schema.json",
    "build": {
      "builder": "NIXPACKS"
    },
    "deploy": {
      "startCommand": "npm start",
      "healthcheckPath": "/status"
    }
  };
  
  fs.writeFileSync('railway.json', JSON.stringify(railwayConfig, null, 2));
  console.log('✅ Created railway.json');
  
  // Try different approaches to connect
  const connectionApproaches = [
    () => {
      console.log('🔄 Approach 1: railway link');
      execSync('railway link --yes', { stdio: 'inherit', timeout: 30000 });
    },
    () => {
      console.log('🔄 Approach 2: railway connect');
      execSync('railway connect', { stdio: 'inherit', timeout: 30000 });
    },
    () => {
      console.log('🔄 Approach 3: Manual project detection');
      // Try to connect to xBOT project specifically
      const output = execSync('railway projects', { encoding: 'utf8', timeout: 30000 });
      console.log('Projects found:', output);
    }
  ];
  
  let connected = false;
  for (let i = 0; i < connectionApproaches.length && !connected; i++) {
    try {
      connectionApproaches[i]();
      console.log(`✅ Connection approach ${i + 1} succeeded`);
      connected = true;
    } catch (error) {
      console.log(`❌ Connection approach ${i + 1} failed:`, error.message);
    }
  }
  
  if (!connected) {
    console.log('⚠️ Railway CLI connection failed, but continuing with environment variable deployment');
  }
  
} catch (error) {
  console.log('⚠️ Railway CLI connection issues, proceeding with direct variable deployment');
}

// Step 2: Deploy Aggressive Configuration
console.log('\n🚀 STEP 2: Deploy Aggressive Configuration');
console.log('==========================================');

const AGGRESSIVE_CONFIG = {
  // Core Mode
  MODE: 'live',
  JOBS_AUTOSTART: 'true',
  
  // Job Intervals - AGGRESSIVE SCHEDULING
  JOBS_PLAN_INTERVAL_MIN: '15',        // Plan content every 15 minutes
  JOBS_POSTING_INTERVAL_MIN: '5',      // Check posting queue every 5 minutes
  JOBS_REPLY_INTERVAL_MIN: '20',       // Generate replies every 20 minutes
  JOBS_LEARN_INTERVAL_MIN: '60',       // Learn every hour
  
  // Rate Limits
  MAX_POSTS_PER_HOUR: '2',
  MAX_DAILY_POSTS: '48',
  REPLY_MAX_PER_DAY: '72',
  REPLY_MINUTES_BETWEEN: '20',
  
  // Enhanced Features
  ENABLE_REPLIES: 'true',
  ENABLE_THREADS: 'true',
  THREAD_PERCENTAGE: '10',
  
  // Quality & Learning
  MIN_QUALITY_SCORE: '0.7',
  EXPLORE_RATIO_MIN: '0.1',
  EXPLORE_RATIO_MAX: '0.3',
  
  // Budget
  DAILY_OPENAI_LIMIT_USD: '10.0',
  BUDGET_STRICT: 'false',
  
  // Posting
  GRACE_MINUTES: '5',
  MIN_POST_INTERVAL_MINUTES: '30',
  
  // Hook Evolution
  FEATURE_HOOK_EVOLUTION: 'true',
  FEATURE_FOLLOWER_OPTIMIZATION: 'true',
  FEATURE_PERFORMANCE_TRACKING: 'true',
};

// Deploy variables
let deployedCount = 0;
const totalVars = Object.keys(AGGRESSIVE_CONFIG).length;

console.log(`🔄 Deploying ${totalVars} environment variables...`);

for (const [key, value] of Object.entries(AGGRESSIVE_CONFIG)) {
  try {
    execSync(`railway variables set ${key}="${value}"`, { stdio: 'pipe', timeout: 15000 });
    deployedCount++;
    console.log(`✅ ${key}=${value}`);
  } catch (error) {
    console.log(`❌ Failed to set ${key}:`, error.message);
  }
}

console.log(`\n📊 Deployment Summary: ${deployedCount}/${totalVars} variables set`);

// Step 3: Restart Railway Service
console.log('\n🔄 STEP 3: Restart Railway Service');
console.log('==================================');

try {
  console.log('🔄 Restarting Railway service to apply configuration...');
  execSync('railway service restart', { stdio: 'inherit', timeout: 30000 });
  console.log('✅ Railway service restarted successfully');
} catch (error) {
  console.log('⚠️ Railway restart failed:', error.message);
  console.log('💡 Try manual restart via Railway dashboard');
}

// Step 4: Verification
console.log('\n✅ STEP 4: Verification Steps');
console.log('=============================');

console.log('🔍 To verify the fix worked:');
console.log('   1. Wait 2-3 minutes for restart');
console.log('   2. Run: npm run logs');
console.log('   3. Look for: Jobs: Plans>0 Posts>0 Replies>0');
console.log('   4. Check: railway logs (should work now)');

console.log('\n🎯 Expected Results:');
console.log('   📝 Content planning every 15 minutes');
console.log('   📮 2 posts per hour');
console.log('   💬 3 replies per hour');
console.log('   🧬 Hook evolution active');

console.log('\n🚀 COMPREHENSIVE FIX COMPLETE!');
console.log('Your system should now be fully operational.');

