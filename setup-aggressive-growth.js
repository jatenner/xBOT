#!/usr/bin/env node

/**
 * AGGRESSIVE TWITTER GROWTH CONFIGURATION
 * Sets optimal environment variables for maximum engagement and growth
 */

const fs = require('fs');

const AGGRESSIVE_CONFIG = {
  // Core Mode
  MODE: 'live',
  JOBS_AUTOSTART: 'true',
  
  // Job Intervals - AGGRESSIVE SCHEDULING
  JOBS_PLAN_INTERVAL_MIN: '15',        // Plan content every 15 minutes (4x per hour)
  JOBS_POSTING_INTERVAL_MIN: '5',      // Check posting queue every 5 minutes
  JOBS_REPLY_INTERVAL_MIN: '20',       // Generate replies every 20 minutes (3 per hour)
  JOBS_LEARN_INTERVAL_MIN: '60',       // Learn every hour
  
  // Rate Limits - 2 POSTS + 3 REPLIES PER HOUR
  MAX_POSTS_PER_HOUR: '2',             // Exactly 2 posts per hour
  MAX_DAILY_POSTS: '48',               // 2 * 24 hours
  REPLY_MAX_PER_DAY: '72',             // 3 * 24 hours
  REPLY_MINUTES_BETWEEN: '20',         // 20 minutes = 3 per hour
  
  // Content Generation - ENHANCED
  ENABLE_REPLIES: 'true',              // Enable reply generation
  ENABLE_THREADS: 'true',              // Enable thread posting
  THREAD_PERCENTAGE: '10',             // 10% of posts as threads
  
  // Learning & Quality - MAXIMUM PERFORMANCE
  MIN_QUALITY_SCORE: '0.7',           // High quality threshold
  EXPLORE_RATIO_MIN: '0.1',           // 10% exploration
  EXPLORE_RATIO_MAX: '0.3',           // 30% exploration
  
  // AI Budget - AGGRESSIVE USAGE
  DAILY_OPENAI_LIMIT_USD: '10.0',     // Higher budget for quality content
  BUDGET_STRICT: 'false',             // Allow budget flexibility
  
  // Posting Configuration
  GRACE_MINUTES: '5',                 // 5 minute grace window for posting
  MIN_POST_INTERVAL_MINUTES: '30',    // Minimum 30 minutes between posts
  
  // Enhanced Features
  FEATURE_HOOK_EVOLUTION: 'true',     // Enable hook evolution
  FEATURE_FOLLOWER_OPTIMIZATION: 'true', // Enable follower-focused content
  FEATURE_PERFORMANCE_TRACKING: 'true',  // Enable learning system
};

console.log('🚀 DEPLOYING AGGRESSIVE TWITTER GROWTH CONFIGURATION');
console.log('==================================================');

// Create .env.aggressive file
let envContent = '# AGGRESSIVE TWITTER GROWTH CONFIGURATION\n';
envContent += '# Generated: ' + new Date().toISOString() + '\n\n';

Object.entries(AGGRESSIVE_CONFIG).forEach(([key, value]) => {
  envContent += `${key}=${value}\n`;
});

fs.writeFileSync('.env.aggressive', envContent);
console.log('✅ Created .env.aggressive');

// Create deployment script
const deployScript = `#!/bin/bash

echo "🚀 DEPLOYING AGGRESSIVE TWITTER GROWTH SYSTEM"
echo "============================================="

# Set all environment variables in Railway
${Object.entries(AGGRESSIVE_CONFIG).map(([key, value]) => 
  `railway variables set ${key}="${value}"`
).join('\n')}

echo "✅ All environment variables set!"
echo "🔄 Restarting Railway service..."
railway service restart

echo "🎯 AGGRESSIVE CONFIGURATION DEPLOYED:"
echo "   📝 Content Planning: Every 15 minutes"
echo "   📮 Posting Rate: 2 posts per hour"
echo "   💬 Reply Rate: 3 replies per hour"
echo "   🧬 Hook Evolution: ENABLED"
echo "   📊 Learning System: ENABLED"
echo "   🎯 Follower Optimization: ENABLED"
echo ""
echo "🚀 Your Twitter growth system is now optimized for maximum engagement!"
`;

fs.writeFileSync('deploy-aggressive-config.sh', deployScript);
fs.chmodSync('deploy-aggressive-config.sh', '755');
console.log('✅ Created deploy-aggressive-config.sh');

console.log('\n🎯 CONFIGURATION SUMMARY:');
console.log('   📝 Content Planning: Every 15 minutes (4x per hour)');
console.log('   📮 Posting Rate: 2 posts per hour (48 per day)');
console.log('   💬 Reply Rate: 3 replies per hour (72 per day)');
console.log('   🧬 Hook Evolution: ENABLED');
console.log('   📊 Learning System: ENABLED');
console.log('   🎯 Follower Optimization: ENABLED');

console.log('\n🚀 NEXT STEPS:');
console.log('   1. Run: ./deploy-aggressive-config.sh');
console.log('   2. Or manually copy .env.aggressive to Railway');
console.log('   3. Monitor: npm run logs');

console.log('\n✅ AGGRESSIVE GROWTH CONFIGURATION READY!');
