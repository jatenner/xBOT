#!/usr/bin/env node

/**
 * EMERGENCY RAILWAY VARIABLE DEPLOYMENT
 * Direct deployment bypassing CLI issues
 */

const https = require('https');
const fs = require('fs');

console.log('🚨 EMERGENCY RAILWAY VARIABLE DEPLOYMENT');
console.log('========================================');
console.log('');

// The aggressive configuration that needs to be deployed
const CRITICAL_VARS = {
  MODE: 'live',
  JOBS_AUTOSTART: 'true',
  JOBS_PLAN_INTERVAL_MIN: '15',        // CRITICAL: Plan content every 15 minutes
  JOBS_POSTING_INTERVAL_MIN: '5',      // CRITICAL: Check posting queue every 5 minutes  
  JOBS_REPLY_INTERVAL_MIN: '20',       // CRITICAL: Generate replies every 20 minutes
  JOBS_LEARN_INTERVAL_MIN: '60',       // CRITICAL: Learn every hour
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

console.log('🎯 CRITICAL ISSUE IDENTIFIED:');
console.log('==============================');
console.log('');
console.log('❌ Current system using DEFAULT intervals:');
console.log('   • Plan Job: 30 minutes (too slow!)');
console.log('   • Reply Job: 60 minutes (too slow!)');
console.log('   • Posting Job: 10 minutes (too slow!)');
console.log('');
console.log('✅ Required AGGRESSIVE intervals:');
console.log('   • Plan Job: 15 minutes (4x per hour)');
console.log('   • Reply Job: 20 minutes (3x per hour)');
console.log('   • Posting Job: 5 minutes (12x per hour)');
console.log('');

console.log('📋 DEPLOYMENT METHODS AVAILABLE:');
console.log('=================================');
console.log('');

console.log('🚀 METHOD 1: Railway Web Dashboard (RECOMMENDED)');
console.log('================================================');
console.log('');
console.log('1. Open: https://railway.app');
console.log('2. Navigate to your xBOT project');
console.log('3. Go to Variables tab');
console.log('4. Add/Update these variables:');
console.log('');

// Print variables in copy-paste format
Object.entries(CRITICAL_VARS).forEach(([key, value]) => {
  console.log(`   ${key} = ${value}`);
});

console.log('');
console.log('5. Click "Deploy" or "Redeploy" service');
console.log('6. Wait 2-3 minutes for deployment');
console.log('');

console.log('🔧 METHOD 2: Railway CLI (If Working)');
console.log('=====================================');
console.log('');
console.log('Get your Project ID from Railway dashboard, then run:');
console.log('   node railway-connect.js [PROJECT_ID]');
console.log('');

console.log('📊 METHOD 3: Environment File Export');
console.log('====================================');
console.log('');

// Create .env file for manual copying
let envContent = '# EMERGENCY RAILWAY DEPLOYMENT VARIABLES\n';
envContent += '# Copy these to Railway Variables tab\n';
envContent += '# CRITICAL: These fix the job interval issue\n\n';

Object.entries(CRITICAL_VARS).forEach(([key, value]) => {
  envContent += `${key}=${value}\n`;
});

fs.writeFileSync('.env.emergency-deploy', envContent);
console.log('📄 Created: .env.emergency-deploy');
console.log('   Use this file to copy/paste variables to Railway');
console.log('');

console.log('⚡ IMMEDIATE VERIFICATION:');
console.log('=========================');
console.log('');
console.log('After deploying variables:');
console.log('1. Wait 3-5 minutes for Railway restart');
console.log('2. Run: npm run logs');
console.log('3. Look for: Jobs: Plans>0 Posts>0 Replies>0');
console.log('4. System should start generating content within 15 minutes');
console.log('');

console.log('🎯 EXPECTED TIMELINE:');
console.log('=====================');
console.log('');
console.log('✅ T+5 minutes: Railway deployment complete');
console.log('✅ T+15 minutes: First content planned (Plans>0)');
console.log('✅ T+20 minutes: First reply generated (Replies>0)');
console.log('✅ T+30 minutes: First post published (Posts>0)');
console.log('✅ T+60 minutes: Full system operational');
console.log('');

console.log('🚨 THIS IS THE ROOT CAUSE:');
console.log('===========================');
console.log('');
console.log('The system shows "Timers: Plan=✅ Reply=✅ Post=✅ Learn=✅"');
console.log('BUT is using DEFAULT slow intervals instead of aggressive ones.');
console.log('');
console.log('Current intervals on Railway (DEFAULT):');
console.log('   • JOBS_PLAN_INTERVAL_MIN: 30 (default)');
console.log('   • JOBS_REPLY_INTERVAL_MIN: 60 (default)'); 
console.log('   • JOBS_POSTING_INTERVAL_MIN: 10 (default)');
console.log('');
console.log('Required intervals (AGGRESSIVE):');
console.log('   • JOBS_PLAN_INTERVAL_MIN: 15');
console.log('   • JOBS_REPLY_INTERVAL_MIN: 20');
console.log('   • JOBS_POSTING_INTERVAL_MIN: 5');
console.log('');

console.log('🚀 DEPLOY THESE VARIABLES NOW TO FIX THE SYSTEM!');
console.log('=================================================');
console.log('');
console.log('The moment you deploy these variables to Railway,');
console.log('your system will immediately start operating at');
console.log('the aggressive growth rate: 2 posts + 3 replies per hour!');
