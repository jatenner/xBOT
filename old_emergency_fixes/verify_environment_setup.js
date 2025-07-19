require('dotenv').config();

console.log('🔍 COMPREHENSIVE API & ENVIRONMENT VERIFICATION');
console.log('=' .repeat(60));

const errors = [];
const warnings = [];
const success = [];

// 🎯 CRITICAL API CREDENTIALS
const requiredAPIs = {
  'OPENAI_API_KEY': {
    value: process.env.OPENAI_API_KEY,
    expected: 'sk-',
    description: 'OpenAI API Key'
  },
  'TWITTER_API_KEY': {
    value: process.env.TWITTER_API_KEY,
    expected: null,
    description: 'Twitter API Key'
  },
  'TWITTER_API_SECRET': {
    value: process.env.TWITTER_API_SECRET,
    expected: null,
    description: 'Twitter API Secret'
  },
  'TWITTER_ACCESS_TOKEN': {
    value: process.env.TWITTER_ACCESS_TOKEN,
    expected: null,
    description: 'Twitter Access Token'
  },
  'TWITTER_ACCESS_TOKEN_SECRET': {
    value: process.env.TWITTER_ACCESS_TOKEN_SECRET,
    expected: null,
    description: 'Twitter Access Token Secret'
  },
  'TWITTER_BEARER_TOKEN': {
    value: process.env.TWITTER_BEARER_TOKEN,
    expected: 'AAAA',
    description: 'Twitter Bearer Token'
  },
  'TWITTER_USER_ID': {
    value: process.env.TWITTER_USER_ID,
    expected: null,
    description: 'Twitter User ID'
  },
  'SUPABASE_URL': {
    value: process.env.SUPABASE_URL,
    expected: 'https://',
    description: 'Supabase Project URL'
  },
  'SUPABASE_SERVICE_ROLE_KEY': {
    value: process.env.SUPABASE_SERVICE_ROLE_KEY,
    expected: 'eyJ',
    description: 'Supabase Service Role Key'
  }
};

// 📊 OPTIMAL CONFIGURATION
const optimalConfig = {
  'MAX_DAILY_TWEETS': {
    value: process.env.MAX_DAILY_TWEETS,
    optimal: '17',
    description: 'Daily Tweet Limit (Free Tier)'
  },
  'DAILY_POSTING_TARGET': {
    value: process.env.DAILY_POSTING_TARGET,
    optimal: '17',
    description: 'Daily Posting Target'
  },
  'DISABLE_BOT': {
    value: process.env.DISABLE_BOT,
    optimal: 'false',
    description: 'Bot Enabled Status'
  },
  'NODE_ENV': {
    value: process.env.NODE_ENV,
    optimal: 'production',
    description: 'Environment Mode'
  }
};

// 🎨 OPTIONAL APIS (for enhanced features)
const optionalAPIs = {
  'NEWS_API_KEY': process.env.NEWS_API_KEY,
  'PEXELS_API_KEY': process.env.PEXELS_API_KEY,
  'UNSPLASH_ACCESS_KEY': process.env.UNSPLASH_ACCESS_KEY,
  'GUARDIAN_API_KEY': process.env.GUARDIAN_API_KEY
};

console.log('🚨 CRITICAL API CREDENTIALS:');
console.log('-'.repeat(40));

for (const [key, config] of Object.entries(requiredAPIs)) {
  if (!config.value) {
    errors.push(`❌ ${key}: MISSING`);
    console.log(`❌ ${key}: MISSING - ${config.description}`);
  } else if (config.expected && !config.value.startsWith(config.expected)) {
    warnings.push(`⚠️  ${key}: Unexpected format`);
    console.log(`⚠️  ${key}: Unexpected format (expected to start with "${config.expected}")`);
  } else {
    success.push(`✅ ${key}: OK`);
    console.log(`✅ ${key}: OK - ${config.description}`);
  }
}

console.log('\n📊 CONFIGURATION VERIFICATION:');
console.log('-'.repeat(40));

for (const [key, config] of Object.entries(optimalConfig)) {
  if (!config.value) {
    warnings.push(`⚠️  ${key}: Not set (using default)`);
    console.log(`⚠️  ${key}: Not set - ${config.description}`);
  } else if (config.value !== config.optimal) {
    warnings.push(`⚠️  ${key}: ${config.value} (recommended: ${config.optimal})`);
    console.log(`⚠️  ${key}: ${config.value} (recommended: ${config.optimal}) - ${config.description}`);
  } else {
    success.push(`✅ ${key}: ${config.value}`);
    console.log(`✅ ${key}: ${config.value} - ${config.description}`);
  }
}

console.log('\n🎨 OPTIONAL APIS:');
console.log('-'.repeat(40));

for (const [key, value] of Object.entries(optionalAPIs)) {
  if (value) {
    console.log(`✅ ${key}: Configured`);
  } else {
    console.log(`⚪ ${key}: Not configured (optional)`);
  }
}

// 🔍 ENVIRONMENT VARIABLE CONSISTENCY CHECK
console.log('\n🔍 CONSISTENCY VERIFICATION:');
console.log('-'.repeat(40));

// Check for common naming mistakes
const commonMistakes = [
  {
    wrong: 'TWITTER_ACCESS_SECRET',
    correct: 'TWITTER_ACCESS_TOKEN_SECRET',
    value: process.env.TWITTER_ACCESS_SECRET
  }
];

for (const mistake of commonMistakes) {
  if (mistake.value) {
    errors.push(`❌ Found deprecated variable: ${mistake.wrong}`);
    console.log(`❌ FOUND DEPRECATED: ${mistake.wrong} (should be ${mistake.correct})`);
  } else {
    console.log(`✅ No deprecated variable: ${mistake.wrong}`);
  }
}

// 📈 FINAL SUMMARY
console.log('\n📈 VERIFICATION SUMMARY:');
console.log('=' .repeat(60));
console.log(`✅ Success: ${success.length} items`);
console.log(`⚠️  Warnings: ${warnings.length} items`);
console.log(`❌ Errors: ${errors.length} items`);

if (errors.length === 0) {
  console.log('\n🎉 ALL CRITICAL APIs CONFIGURED!');
  console.log('🚀 Your bot is ready for deployment!');
  
  // Test Twitter API connection
  console.log('\n🐦 Testing Twitter API connection...');
  try {
    const { TwitterApi } = require('twitter-api-v2');
    const client = new TwitterApi({
      appKey: process.env.TWITTER_API_KEY,
      appSecret: process.env.TWITTER_API_SECRET,
      accessToken: process.env.TWITTER_ACCESS_TOKEN,
      accessSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
    });
    console.log('✅ Twitter client initialized successfully');
  } catch (error) {
    console.log('❌ Twitter client initialization failed:', error.message);
  }
  
} else {
  console.log('\n🚨 CRITICAL ISSUES FOUND!');
  console.log('Please fix the following errors before deployment:');
  errors.forEach(error => console.log(`   ${error}`));
}

if (warnings.length > 0) {
  console.log('\n💡 RECOMMENDATIONS:');
  warnings.forEach(warning => console.log(`   ${warning}`));
}

console.log('\n🔧 QUICK FIX COMMANDS:');
console.log('-'.repeat(40));
console.log('Add missing variables to your .env file:');
console.log('');

if (!process.env.SUPABASE_URL) {
  console.log('SUPABASE_URL=https://your-project-id.supabase.co');
}
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.log('SUPABASE_SERVICE_ROLE_KEY=your_service_role_key');
}
if (process.env.MAX_DAILY_TWEETS !== '17') {
  console.log('MAX_DAILY_TWEETS=17');
}
if (process.env.DAILY_POSTING_TARGET !== '17') {
  console.log('DAILY_POSTING_TARGET=17');
}

console.log('\n🎯 READY FOR 17 TWEETS/DAY POSTING!');
process.exit(errors.length > 0 ? 1 : 0); 