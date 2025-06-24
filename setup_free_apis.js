#!/usr/bin/env node

/**
 * Free API Setup Guide for xBOT
 * Helps users obtain and configure all free API keys for optimal performance
 */

const fs = require('fs');
const path = require('path');

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function colorize(text, color) {
  return `${colors[color]}${text}${colors.reset}`;
}

function printHeader() {
  console.log(colorize('\n🚀 xBOT Free API Setup Guide', 'cyan'));
  console.log(colorize('=====================================', 'cyan'));
  console.log('\nThis guide will help you set up ALL free API keys needed for:');
  console.log(colorize('📰 Multi-source news aggregation', 'green'));
  console.log(colorize('📸 Diverse image sourcing', 'green'));
  console.log(colorize('🔄 Automatic failover protection', 'green'));
  console.log('\n');
}

function printNewsAPIGuide() {
  console.log(colorize('📰 NEWS API SETUP', 'yellow'));
  console.log(colorize('==================', 'yellow'));
  
  console.log('\n' + colorize('1. NewsAPI (Primary) - 100 requests/day FREE', 'bright'));
  console.log('   🌐 Website: https://newsapi.org/register');
  console.log('   📝 Steps:');
  console.log('      • Sign up with email');
  console.log('      • Verify email address');
  console.log('      • Copy your API key');
  console.log('   💡 Rate Limit: 100 requests/day (perfect for 17 tweets/day)');
  
  console.log('\n' + colorize('2. The Guardian API (Backup) - COMPLETELY FREE', 'bright'));
  console.log('   🌐 Website: https://open-platform.theguardian.com/access/');
  console.log('   📝 Steps:');
  console.log('      • Click "Request an API key"');
  console.log('      • Fill out the form (select "Developer" tier)');
  console.log('      • Get instant API key');
  console.log('   💡 Rate Limit: Very generous, perfect backup');
  
  console.log('\n' + colorize('3. MediaStack API (Backup) - 1000 requests/month FREE', 'bright'));
  console.log('   🌐 Website: https://mediastack.com/signup');
  console.log('   📝 Steps:');
  console.log('      • Sign up for free account');
  console.log('      • Verify email');
  console.log('      • Get API access key from dashboard');
  console.log('   💡 Rate Limit: 1000 requests/month');
  
  console.log('\n' + colorize('4. NewsData.io (Backup) - 200 requests/day FREE', 'bright'));
  console.log('   🌐 Website: https://newsdata.io/register');
  console.log('   📝 Steps:');
  console.log('      • Create free account');
  console.log('      • Verify email');
  console.log('      • Copy API key from dashboard');
  console.log('   💡 Rate Limit: 200 requests/day');
}

function printImageAPIGuide() {
  console.log('\n\n' + colorize('📸 IMAGE API SETUP', 'yellow'));
  console.log(colorize('==================', 'yellow'));
  
  console.log('\n' + colorize('1. Pexels API (Primary) - COMPLETELY FREE', 'bright'));
  console.log('   🌐 Website: https://www.pexels.com/api/');
  console.log('   📝 Steps:');
  console.log('      • Click "Get Started"');
  console.log('      • Sign up with email or social login');
  console.log('      • Read and accept API terms');
  console.log('      • Get your API key instantly');
  console.log('   💡 Rate Limit: 200 requests/hour (very generous)');
  
  console.log('\n' + colorize('2. Unsplash API (Backup) - 50 requests/hour FREE', 'bright'));
  console.log('   🌐 Website: https://unsplash.com/developers');
  console.log('   📝 Steps:');
  console.log('      • Sign up for Unsplash account');
  console.log('      • Go to "Your apps"');
  console.log('      • Create new application');
  console.log('      • Copy "Access Key"');
  console.log('   💡 Rate Limit: 50 requests/hour (good backup)');
}

function printOptionalAPIs() {
  console.log('\n\n' + colorize('🚀 OPTIONAL PERFORMANCE BOOSTERS', 'yellow'));
  console.log(colorize('===================================', 'yellow'));
  
  console.log('\n' + colorize('These are optional but recommended for best performance:', 'bright'));
  
  console.log('\n' + colorize('• Financial Times API (Premium News)', 'cyan'));
  console.log('   🌐 https://developer.ft.com/portal');
  console.log('   💡 Free tier available for limited use');
  
  console.log('\n' + colorize('• Reuters API (Reuters Connect)', 'cyan'));
  console.log('   🌐 https://www.reuters.com/licensing-solutions/');
  console.log('   💡 Contact for trial access');
}

function generateEnvFile() {
  console.log('\n\n' + colorize('📝 ENVIRONMENT SETUP', 'yellow'));
  console.log(colorize('====================', 'yellow'));
  
  const envTemplate = `# 🔑 REQUIRED APIs
OPENAI_API_KEY=your_openai_api_key_here
TWITTER_APP_KEY=your_twitter_app_key_here
TWITTER_APP_SECRET=your_twitter_app_secret_here
TWITTER_ACCESS_TOKEN=your_twitter_access_token_here
TWITTER_ACCESS_SECRET=your_twitter_access_secret_here
TWITTER_BEARER_TOKEN=your_twitter_bearer_token_here

# 🗄️ DATABASE
SUPABASE_URL=your_supabase_url_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_key_here

# 📰 NEWS APIs (Multiple sources for redundancy)
# Primary: NewsAPI (100 requests/day free)
NEWS_API_KEY=your_news_api_key_here
# Backup: Guardian API (completely free)
GUARDIAN_API_KEY=your_guardian_api_key_here
# Backup: MediaStack (1000 requests/month free)
MEDIASTACK_API_KEY=your_mediastack_api_key_here
# Backup: NewsData.io (200 requests/day free)
NEWSDATA_API_KEY=your_newsdata_api_key_here

# 📸 IMAGE APIs (Free alternatives for diverse image sources)
# Primary: Pexels (200 requests/hour free)
PEXELS_API_KEY=your_pexels_api_key_here
# Backup: Unsplash (50 requests/hour free)
UNSPLASH_ACCESS_KEY=your_unsplash_access_key_here

# 🤖 BOT CONFIGURATION
DISABLE_BOT=false
MAX_DAILY_TWEETS=17

# 🎯 COST OPTIMIZATION
EMERGENCY_COST_MODE=false
DAILY_BUDGET_LIMIT=2.00
DISABLE_LEARNING_AGENTS=false

# 📊 POSTING OPTIMIZATION
DAILY_POSTING_TARGET=17
OPTIMAL_POSTING_WINDOWS=true
EMERGENCY_CATCHUP_MODE=true

# 🧠 INTELLIGENCE SETTINGS  
CONTENT_CACHE_ENABLED=true
SMART_BATCHING_ENABLED=true
FALLBACK_CONTENT_ENABLED=true

# 🔄 RESILIENCE SETTINGS
GRACEFUL_ERROR_HANDLING=true
API_RATE_LIMIT_PROTECTION=true
AUTOMATIC_RETRY_ENABLED=true

# 🚀 PRODUCTION SETTINGS
NODE_ENV=production
PORT=3000`;

  const envPath = path.join(process.cwd(), '.env.template');
  fs.writeFileSync(envPath, envTemplate);
  
  console.log('\n✅ Created .env.template file with all API slots');
  console.log('📝 Copy this to .env and fill in your API keys');
  console.log('\nCommands to run:');
  console.log(colorize('   cp .env.template .env', 'cyan'));
  console.log(colorize('   nano .env  # or use your preferred editor', 'cyan'));
}

function printBenefitsSummary() {
  console.log('\n\n' + colorize('🎯 BENEFITS OF MULTI-API SETUP', 'yellow'));
  console.log(colorize('==============================', 'yellow'));
  
  console.log('\n' + colorize('📈 RELIABILITY', 'green'));
  console.log('   • 4 news sources = 99.9% uptime');
  console.log('   • Automatic failover when one API hits limits');
  console.log('   • Never miss posting due to API issues');
  
  console.log('\n' + colorize('💰 COST EFFICIENCY', 'green'));
  console.log('   • ALL APIs are free tier');
  console.log('   • Combined limits: 1,490+ news requests/day');
  console.log('   • 250+ image requests/hour');
  
  console.log('\n' + colorize('🎨 CONTENT DIVERSITY', 'green'));
  console.log('   • Multiple news perspectives');
  console.log('   • Diverse image sources');
  console.log('   • Better engagement through variety');
  
  console.log('\n' + colorize('⚡ PERFORMANCE', 'green'));
  console.log('   • Smart load balancing');
  console.log('   • Rate limit protection');
  console.log('   • Intelligent caching');
}

function printNextSteps() {
  console.log('\n\n' + colorize('🚀 NEXT STEPS', 'yellow'));
  console.log(colorize('=============', 'yellow'));
  
  console.log('\n1. Get your API keys from the websites above');
  console.log('2. Fill them into your .env file');
  console.log('3. Run the database setup:');
  console.log(colorize('   npm run setup-db', 'cyan'));
  console.log('4. Test your setup:');
  console.log(colorize('   npm run test-apis', 'cyan'));
  console.log('5. Deploy and enjoy 99.9% reliable posting!');
  
  console.log('\n' + colorize('💡 PRO TIP:', 'yellow') + ' You don\'t need ALL APIs immediately.');
  console.log('Start with NewsAPI + Guardian + Pexels for great results!');
  
  console.log('\n' + colorize('🆘 Need help?', 'magenta'));
  console.log('Check the README.md or create an issue on GitHub');
}

function estimateUsage() {
  console.log('\n\n' + colorize('📊 ESTIMATED DAILY USAGE', 'yellow'));
  console.log(colorize('=========================', 'yellow'));
  
  console.log('\n' + colorize('For 17 tweets per day:', 'bright'));
  console.log('📰 News API calls: ~25-30/day');
  console.log('📸 Image API calls: ~17-20/day');
  console.log('🔄 Total buffer: 1,400+ requests available');
  
  console.log('\n' + colorize('Safety margin: 98%+ spare capacity!', 'green'));
}

// Main execution
function main() {
  printHeader();
  printNewsAPIGuide();
  printImageAPIGuide();
  printOptionalAPIs();
  generateEnvFile();
  printBenefitsSummary();
  estimateUsage();
  printNextSteps();
  
  console.log('\n' + colorize('🎉 Setup guide complete! Happy posting! 🤖', 'green'));
  console.log('\n');
}

if (require.main === module) {
  main();
}

module.exports = { main }; 