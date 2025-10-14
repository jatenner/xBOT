#!/usr/bin/env node

/**
 * MANUAL RAILWAY CONFIGURATION GUIDE
 * Since Railway CLI has API issues, this provides manual steps
 */

const fs = require('fs');

console.log('🔧 MANUAL RAILWAY CONFIGURATION GUIDE');
console.log('=====================================');
console.log('');
console.log('Since Railway CLI is having API issues, follow these manual steps:');
console.log('');

console.log('📡 STEP 1: Connect Railway CLI to xBOT Project');
console.log('==============================================');
console.log('');
console.log('1. Open Railway Dashboard: https://railway.app');
console.log('2. Find your "xBOT" project');
console.log('3. Click on the project');
console.log('4. Go to Settings → General');
console.log('5. Copy the Project ID');
console.log('6. Run: railway link [PROJECT_ID]');
console.log('');

console.log('🚀 STEP 2: Set Environment Variables Manually');
console.log('=============================================');
console.log('');
console.log('In your Railway project dashboard:');
console.log('1. Go to Variables tab');
console.log('2. Add these variables:');
console.log('');

// Environment variables to set
const VARS = {
  MODE: 'live',
  JOBS_AUTOSTART: 'true',
  JOBS_PLAN_INTERVAL_MIN: '15',
  JOBS_POSTING_INTERVAL_MIN: '5', 
  JOBS_REPLY_INTERVAL_MIN: '20',
  JOBS_LEARN_INTERVAL_MIN: '60',
  MAX_POSTS_PER_HOUR: '2',
  MAX_DAILY_POSTS: '48',
  REPLY_MAX_PER_DAY: '72',
  REPLY_MINUTES_BETWEEN: '20',
  ENABLE_REPLIES: 'true',
  ENABLE_THREADS: 'true',
  THREAD_PERCENTAGE: '10',
  MIN_QUALITY_SCORE: '0.7',
  EXPLORE_RATIO_MIN: '0.1',
  EXPLORE_RATIO_MAX: '0.3',
  DAILY_OPENAI_LIMIT_USD: '10.0',
  BUDGET_STRICT: 'false',
  GRACE_MINUTES: '5',
  MIN_POST_INTERVAL_MINUTES: '30',
  FEATURE_HOOK_EVOLUTION: 'true',
  FEATURE_FOLLOWER_OPTIMIZATION: 'true',
  FEATURE_PERFORMANCE_TRACKING: 'true'
};

Object.entries(VARS).forEach(([key, value]) => {
  console.log(`   ${key} = ${value}`);
});

console.log('');
console.log('🔄 STEP 3: Redeploy Service');
console.log('===========================');
console.log('');
console.log('1. After setting all variables');
console.log('2. Go to Deployments tab');
console.log('3. Click "Redeploy" on the latest deployment');
console.log('4. Wait for deployment to complete');
console.log('');

console.log('✅ STEP 4: Verify Fix');
console.log('=====================');
console.log('');
console.log('1. Wait 2-3 minutes after redeploy');
console.log('2. Run: npm run logs');
console.log('3. Look for: Jobs: Plans>0 Posts>0 Replies>0');
console.log('4. System should start posting within 15 minutes');
console.log('');

// Create a .env file for local reference
let envContent = '# AGGRESSIVE TWITTER GROWTH CONFIGURATION\n';
envContent += '# Copy these to Railway Variables tab\n\n';

Object.entries(VARS).forEach(([key, value]) => {
  envContent += `${key}=${value}\n`;
});

fs.writeFileSync('.env.railway-manual', envContent);
console.log('📄 Created .env.railway-manual for reference');
console.log('');

console.log('🎯 EXPECTED RESULTS AFTER MANUAL SETUP:');
console.log('========================================');
console.log('');
console.log('✅ Railway CLI: Connected to xBOT project');
console.log('✅ Jobs: Plans>0 Posts>0 Replies>0');
console.log('✅ Content: Planning every 15 minutes');
console.log('✅ Posting: 2 posts per hour');
console.log('✅ Replies: 3 replies per hour');
console.log('✅ Hooks: Evolution system active');
console.log('');

console.log('💡 ALTERNATIVE: Use Railway Web Interface');
console.log('==========================================');
console.log('');
console.log('If CLI issues persist:');
console.log('1. Monitor via Railway web dashboard');
console.log('2. Use: npm run logs (our bulletproof monitor)');
console.log('3. Check logs at: https://railway.app → xBOT → Observability');
console.log('');

console.log('🚀 MANUAL CONFIGURATION GUIDE COMPLETE!');


/**
 * MANUAL RAILWAY CONFIGURATION GUIDE
 * Since Railway CLI has API issues, this provides manual steps
 */

const fs = require('fs');

console.log('🔧 MANUAL RAILWAY CONFIGURATION GUIDE');
console.log('=====================================');
console.log('');
console.log('Since Railway CLI is having API issues, follow these manual steps:');
console.log('');

console.log('📡 STEP 1: Connect Railway CLI to xBOT Project');
console.log('==============================================');
console.log('');
console.log('1. Open Railway Dashboard: https://railway.app');
console.log('2. Find your "xBOT" project');
console.log('3. Click on the project');
console.log('4. Go to Settings → General');
console.log('5. Copy the Project ID');
console.log('6. Run: railway link [PROJECT_ID]');
console.log('');

console.log('🚀 STEP 2: Set Environment Variables Manually');
console.log('=============================================');
console.log('');
console.log('In your Railway project dashboard:');
console.log('1. Go to Variables tab');
console.log('2. Add these variables:');
console.log('');

// Environment variables to set
const VARS = {
  MODE: 'live',
  JOBS_AUTOSTART: 'true',
  JOBS_PLAN_INTERVAL_MIN: '15',
  JOBS_POSTING_INTERVAL_MIN: '5', 
  JOBS_REPLY_INTERVAL_MIN: '20',
  JOBS_LEARN_INTERVAL_MIN: '60',
  MAX_POSTS_PER_HOUR: '2',
  MAX_DAILY_POSTS: '48',
  REPLY_MAX_PER_DAY: '72',
  REPLY_MINUTES_BETWEEN: '20',
  ENABLE_REPLIES: 'true',
  ENABLE_THREADS: 'true',
  THREAD_PERCENTAGE: '10',
  MIN_QUALITY_SCORE: '0.7',
  EXPLORE_RATIO_MIN: '0.1',
  EXPLORE_RATIO_MAX: '0.3',
  DAILY_OPENAI_LIMIT_USD: '10.0',
  BUDGET_STRICT: 'false',
  GRACE_MINUTES: '5',
  MIN_POST_INTERVAL_MINUTES: '30',
  FEATURE_HOOK_EVOLUTION: 'true',
  FEATURE_FOLLOWER_OPTIMIZATION: 'true',
  FEATURE_PERFORMANCE_TRACKING: 'true'
};

Object.entries(VARS).forEach(([key, value]) => {
  console.log(`   ${key} = ${value}`);
});

console.log('');
console.log('🔄 STEP 3: Redeploy Service');
console.log('===========================');
console.log('');
console.log('1. After setting all variables');
console.log('2. Go to Deployments tab');
console.log('3. Click "Redeploy" on the latest deployment');
console.log('4. Wait for deployment to complete');
console.log('');

console.log('✅ STEP 4: Verify Fix');
console.log('=====================');
console.log('');
console.log('1. Wait 2-3 minutes after redeploy');
console.log('2. Run: npm run logs');
console.log('3. Look for: Jobs: Plans>0 Posts>0 Replies>0');
console.log('4. System should start posting within 15 minutes');
console.log('');

// Create a .env file for local reference
let envContent = '# AGGRESSIVE TWITTER GROWTH CONFIGURATION\n';
envContent += '# Copy these to Railway Variables tab\n\n';

Object.entries(VARS).forEach(([key, value]) => {
  envContent += `${key}=${value}\n`;
});

fs.writeFileSync('.env.railway-manual', envContent);
console.log('📄 Created .env.railway-manual for reference');
console.log('');

console.log('🎯 EXPECTED RESULTS AFTER MANUAL SETUP:');
console.log('========================================');
console.log('');
console.log('✅ Railway CLI: Connected to xBOT project');
console.log('✅ Jobs: Plans>0 Posts>0 Replies>0');
console.log('✅ Content: Planning every 15 minutes');
console.log('✅ Posting: 2 posts per hour');
console.log('✅ Replies: 3 replies per hour');
console.log('✅ Hooks: Evolution system active');
console.log('');

console.log('💡 ALTERNATIVE: Use Railway Web Interface');
console.log('==========================================');
console.log('');
console.log('If CLI issues persist:');
console.log('1. Monitor via Railway web dashboard');
console.log('2. Use: npm run logs (our bulletproof monitor)');
console.log('3. Check logs at: https://railway.app → xBOT → Observability');
console.log('');

console.log('🚀 MANUAL CONFIGURATION GUIDE COMPLETE!');
