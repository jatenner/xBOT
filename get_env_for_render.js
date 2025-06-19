#!/usr/bin/env node

// Helper script to get environment variables for Render deployment
const fs = require('fs');

console.log('🔐 Environment Variables for Render Deployment\n');

if (!fs.existsSync('.env')) {
  console.log('❌ .env file not found');
  console.log('📋 Make sure you have a .env file with your API keys');
  process.exit(1);
}

const envContent = fs.readFileSync('.env', 'utf-8');
const envLines = envContent.split('\n').filter(line => line.trim() && !line.startsWith('#'));

console.log('📋 Copy these to your Render dashboard environment variables:\n');

// Core environment variables for production
console.log('NODE_ENV=production');
console.log('TZ=UTC');

envLines.forEach(line => {
  const [key, value] = line.split('=');
  if (key && value && !key.includes('#')) {
    // Filter only the keys we need for deployment
    const neededKeys = [
      'OPENAI_API_KEY',
      'TWITTER_APP_KEY', 
      'TWITTER_APP_SECRET',
      'TWITTER_ACCESS_TOKEN',
      'TWITTER_ACCESS_SECRET', 
      'TWITTER_BEARER_TOKEN',
      'SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY',
      'NEWS_API_KEY'
    ];
    
    if (neededKeys.includes(key.trim())) {
      console.log(`${key.trim()}=${value.trim()}`);
    }
  }
});

console.log('DISABLE_BOT=false');
console.log('MAX_DAILY_TWEETS=280');

console.log('\n✅ Copy-paste these into Render dashboard → Environment Variables');
console.log('🚀 Then deploy your bot for 24/7 operation!'); 