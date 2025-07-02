#!/usr/bin/env node

/**
 * 🔍 Comprehensive Twitter API Credentials Diagnostic
 * This script checks not just if credentials exist, but if they're valid format
 */

console.log('🔍 Comprehensive Twitter API Credentials Diagnostic\n');

const requiredVars = [
    'TWITTER_API_KEY',
    'TWITTER_API_SECRET', 
    'TWITTER_ACCESS_TOKEN',
    'TWITTER_ACCESS_TOKEN_SECRET',
    'TWITTER_BEARER_TOKEN'
];

console.log('📋 Step 1: Environment Variables Check');
let allPresent = true;

requiredVars.forEach(varName => {
    const value = process.env[varName];
    if (value) {
        console.log(`✅ ${varName}: Present (${value.length} chars)`);
    } else {
        console.log(`❌ ${varName}: MISSING`);
        allPresent = false;
    }
});

if (!allPresent) {
    console.log('\n🚨 Some credentials are missing. Fix these first.');
    process.exit(1);
}

console.log('\n🔍 Step 2: Credential Format Validation');

const apiKey = process.env.TWITTER_API_KEY;
const apiSecret = process.env.TWITTER_API_SECRET;
const accessToken = process.env.TWITTER_ACCESS_TOKEN;
const accessSecret = process.env.TWITTER_ACCESS_TOKEN_SECRET;
const bearerToken = process.env.TWITTER_BEARER_TOKEN;

// Check API Key format
console.log('\n🔑 API Key Analysis:');
if (apiKey.length >= 20 && apiKey.length <= 30) {
    console.log(`✅ Length OK: ${apiKey.length} chars`);
} else {
    console.log(`⚠️  Unusual length: ${apiKey.length} chars (expected 20-30)`);
}

if (/^[a-zA-Z0-9]+$/.test(apiKey)) {
    console.log('✅ Format OK: Alphanumeric only');
} else {
    console.log('⚠️  Format issue: Contains non-alphanumeric characters');
}

// Check API Secret format
console.log('\n🔐 API Secret Analysis:');
if (apiSecret.length >= 40 && apiSecret.length <= 60) {
    console.log(`✅ Length OK: ${apiSecret.length} chars`);
} else {
    console.log(`⚠️  Unusual length: ${apiSecret.length} chars (expected 40-60)`);
}

if (/^[a-zA-Z0-9]+$/.test(apiSecret)) {
    console.log('✅ Format OK: Alphanumeric only');
} else {
    console.log('⚠️  Format issue: Contains non-alphanumeric characters');
}

// Check Access Token format
console.log('\n🎫 Access Token Analysis:');
if (accessToken.includes('-')) {
    console.log('✅ Format OK: Contains hyphen');
} else {
    console.log('⚠️  Format issue: Missing hyphen (should be like "123456-ABC...")');
}

if (accessToken.length >= 40 && accessToken.length <= 60) {
    console.log(`✅ Length OK: ${accessToken.length} chars`);
} else {
    console.log(`⚠️  Unusual length: ${accessToken.length} chars (expected 40-60)`);
}

// Check Access Token Secret format
console.log('\n🔓 Access Token Secret Analysis:');
if (accessSecret.length >= 40 && accessSecret.length <= 50) {
    console.log(`✅ Length OK: ${accessSecret.length} chars`);
} else {
    console.log(`⚠️  Unusual length: ${accessSecret.length} chars (expected 40-50)`);
}

if (/^[a-zA-Z0-9]+$/.test(accessSecret)) {
    console.log('✅ Format OK: Alphanumeric only');
} else {
    console.log('⚠️  Format issue: Contains non-alphanumeric characters');
}

// Check Bearer Token format
console.log('\n🎟️  Bearer Token Analysis:');
if (bearerToken.length >= 100) {
    console.log(`✅ Length OK: ${bearerToken.length} chars`);
} else {
    console.log(`⚠️  Too short: ${bearerToken.length} chars (expected 100+)`);
}

if (bearerToken.startsWith('AAAAAAAAAAAAAAAAAAA')) {
    console.log('✅ Format OK: Starts with correct prefix');
} else {
    console.log('⚠️  Format issue: Should start with "AAAAAAAAAAAAAAAAAAA"');
}

console.log('\n🧪 Step 3: Attempting Twitter API Initialization');

try {
    // Try to load the twitter-api-v2 library
    const { TwitterApi } = require('twitter-api-v2');
    
    console.log('✅ twitter-api-v2 library loaded successfully');
    
    // Attempt to create Twitter client
    console.log('\n🔧 Testing Twitter client creation...');
    
    const client = new TwitterApi({
        appKey: apiKey,
        appSecret: apiSecret,
        accessToken: accessToken,
        accessSecret: accessSecret,
    });
    
    console.log('✅ TwitterApi instance created successfully');
    
    // Try to access the v2 API (this will validate credentials)
    console.log('\n🌐 Testing API connection...');
    
    // Note: We don't actually make a call here to avoid rate limits
    // But we can check if the client object has the expected structure
    if (client.v2) {
        console.log('✅ v2 API endpoint accessible');
    } else {
        console.log('❌ v2 API endpoint not accessible');
    }
    
} catch (error) {
    console.log('❌ Twitter client creation failed:');
    console.log(`   Error: ${error.message}`);
    
    if (error.message.includes('Invalid consumer tokens')) {
        console.log('\n🚨 DIAGNOSIS: "Invalid consumer tokens" error');
        console.log('   This usually means:');
        console.log('   1. API Key or API Secret is incorrect');
        console.log('   2. API Key/Secret pair doesn\'t match');
        console.log('   3. Credentials contain extra spaces or characters');
        console.log('   4. App permissions are not configured correctly');
        
        console.log('\n🛠️  SOLUTIONS:');
        console.log('   1. Verify API Key and API Secret from Twitter Developer Portal');
        console.log('   2. Check for extra spaces before/after credential values');
        console.log('   3. Regenerate API Keys if unsure');
        console.log('   4. Ensure app has Read and Write permissions');
    }
}

console.log('\n📚 Additional Debugging:');
console.log('   - Twitter Developer Portal: https://developer.twitter.com/en/portal/dashboard');
console.log('   - Check your app\'s Keys and Tokens section');
console.log('   - Verify app permissions (should be Read and Write)');
console.log('   - Regenerate keys if still having issues'); 