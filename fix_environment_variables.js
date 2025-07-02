require('dotenv').config();
const fs = require('fs');

console.log('🔧 FIXING ENVIRONMENT VARIABLES...');

// Read current .env file
let envContent = '';
try {
  envContent = fs.readFileSync('.env', 'utf8');
} catch (error) {
  console.log('⚠️  No .env file found, please create one from env.example');
  process.exit(1);
}

console.log('📝 Current .env file analysis:');

// 1. Remove deprecated TWITTER_ACCESS_SECRET
if (envContent.includes('TWITTER_ACCESS_SECRET=') && !envContent.includes('TWITTER_ACCESS_TOKEN_SECRET=')) {
  console.log('❌ Found deprecated TWITTER_ACCESS_SECRET, will rename to TWITTER_ACCESS_TOKEN_SECRET');
  envContent = envContent.replace(/TWITTER_ACCESS_SECRET=/g, 'TWITTER_ACCESS_TOKEN_SECRET=');
} else if (envContent.includes('TWITTER_ACCESS_SECRET=') && envContent.includes('TWITTER_ACCESS_TOKEN_SECRET=')) {
  console.log('🗑️  Removing duplicate TWITTER_ACCESS_SECRET (keeping TWITTER_ACCESS_TOKEN_SECRET)');
  envContent = envContent.replace(/TWITTER_ACCESS_SECRET=.*\n/g, '');
}

// 2. Add missing configuration variables
const requiredVars = {
  'MAX_DAILY_TWEETS': '17',
  'DAILY_POSTING_TARGET': '17', 
  'NODE_ENV': 'production'
};

for (const [key, value] of Object.entries(requiredVars)) {
  if (!envContent.includes(`${key}=`)) {
    console.log(`➕ Adding missing variable: ${key}=${value}`);
    envContent += `\n${key}=${value}`;
  } else {
    console.log(`✅ Variable already exists: ${key}`);
  }
}

// 3. Ensure proper formatting
envContent = envContent.trim() + '\n';

// Write back to .env file
fs.writeFileSync('.env', envContent);

console.log('\n✅ Environment variables fixed!');
console.log('📋 Your .env file now has:');
console.log('   ✅ TWITTER_ACCESS_TOKEN_SECRET (correct naming)');
console.log('   ✅ MAX_DAILY_TWEETS=17 (Twitter free tier limit)'); 
console.log('   ✅ DAILY_POSTING_TARGET=17 (matching Twitter limit)');
console.log('   ✅ NODE_ENV=production (optimal setting)');
console.log('\n🚀 Ready to start posting up to 17 tweets per day!'); 