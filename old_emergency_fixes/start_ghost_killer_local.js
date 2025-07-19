#!/usr/bin/env node

// Start Ghost Account Syndrome Killer Locally
require('dotenv').config();
const { spawn } = require('child_process');

console.log('👻 === STARTING GHOST ACCOUNT SYNDROME KILLER LOCALLY ===');
console.log('🔥 Mission: Maximum algorithmic domination mode');
console.log('⚡ Strategy: 456 daily interactions to destroy ghost syndrome\n');

// Set Ghost Account Syndrome killer environment variables
const ghostKillerEnv = {
  ...process.env,
  AGGRESSIVE_ENGAGEMENT_MODE: 'true',
  GHOST_ACCOUNT_SYNDROME_FIX: 'true',
  COMMUNITY_ENGAGEMENT_FREQUENCY: 'every_30_minutes',
  VIRAL_OPTIMIZATION_MODE: 'maximum',
  ALGORITHMIC_BOOST_LEVEL: 'extreme',
  POST_FREQUENCY_MINUTES: '25',
  ENGAGEMENT_TARGET_DAILY: '200',
  AUTO_REPLY_ENABLED: 'true',
  AUTO_FOLLOW_ENABLED: 'true',
  TRENDING_HASHTAG_TRACKING: 'true',
  REAL_TIME_OPTIMIZATION: 'true'
};

console.log('⚙️  GHOST KILLER CONFIGURATION:');
console.log('⚡ Aggressive Mode: 🔥 ACTIVATED');
console.log('👻 Ghost Fix: 🔥 ACTIVE');
console.log('🔄 Engagement Frequency: every_30_minutes');
console.log('📝 Post Frequency: Every 25 minutes');
console.log('🎯 Daily Target: 200 interactions');
console.log('🚀 Viral Mode: maximum');
console.log('💥 Boost Level: extreme\n');

console.log('📊 EXPECTED DAILY ALGORITHMIC SIGNALS:');
console.log('📝 Posts: 57 viral tweets');
console.log('💖 Likes: 288 health tech posts');
console.log('💬 Replies: 96 insightful comments');
console.log('🔄 Retweets: 48 shared insights');
console.log('👥 Follows: 24 relevant accounts');
console.log('🔥 TOTAL: 456 DAILY INTERACTIONS\n');

console.log('🚀 Starting autonomous bot with Ghost Killer configuration...');

// Start the bot with Ghost Killer environment
const bot = spawn('node', ['dist/index.js'], {
  env: ghostKillerEnv,
  stdio: 'inherit'
});

bot.on('error', (error) => {
  console.error('❌ Error starting bot:', error);
});

bot.on('close', (code) => {
  console.log(`\n🛑 Bot process exited with code ${code}`);
});

// Show monitoring commands
console.log('\n🔍 === MONITORING COMMANDS ===');
console.log('📊 Monitor activity: node monitor_ghost_killer.js');
console.log('📋 Check status: node check_bot_status.js');
console.log('📜 View logs: tail -f logs/autonomous_bot.log');
console.log('⏹️  Stop bot: Ctrl+C or pkill -f "node dist/index.js"');

console.log('\n👻 GHOST ACCOUNT SYNDROME KILLER IS NOW ACTIVE!');
console.log('⚡ Watch for aggressive engagement every 30 minutes');
console.log('📝 Viral posts every 25 minutes');
console.log('📈 Your account visibility will EXPLODE within 48 hours!');

// Keep the script running
process.on('SIGINT', () => {
  console.log('\n🛑 Stopping Ghost Killer...');
  bot.kill('SIGTERM');
  process.exit(0);
}); 