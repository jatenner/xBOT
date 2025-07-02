#!/usr/bin/env node

/**
 * 🔍 Twitter API Credentials Verification Script
 * Checks if all required Twitter API environment variables are properly configured
 */

const requiredEnvVars = [
    'TWITTER_API_KEY',
    'TWITTER_API_SECRET', 
    'TWITTER_ACCESS_TOKEN',
    'TWITTER_ACCESS_TOKEN_SECRET',
    'TWITTER_BEARER_TOKEN'
];

const optionalEnvVars = [
    'TWITTER_USER_ID'
];

console.log('🔍 Verifying Twitter API Credentials...\n');

let allGood = true;

// Check required variables
console.log('📋 Required Environment Variables:');
requiredEnvVars.forEach(varName => {
    const value = process.env[varName];
    if (value) {
        const maskedValue = value.substring(0, 5) + '...' + value.substring(value.length - 4);
        console.log(`✅ ${varName}: ${maskedValue} (${value.length} chars)`);
    } else {
        console.log(`❌ ${varName}: MISSING`);
        allGood = false;
    }
});

console.log('\n📋 Optional Environment Variables:');
optionalEnvVars.forEach(varName => {
    const value = process.env[varName];
    if (value) {
        console.log(`✅ ${varName}: ${value}`);
    } else {
        console.log(`⚠️  ${varName}: Not set (recommended for performance)`);
    }
});

console.log('\n🔍 Credential Format Validation:');

// Validate formats
const apiKey = process.env.TWITTER_API_KEY;
if (apiKey) {
    if (apiKey.length === 25) {
        console.log('✅ TWITTER_API_KEY: Correct length (25 chars)');
    } else {
        console.log(`⚠️  TWITTER_API_KEY: Unexpected length (${apiKey.length} chars, expected 25)`);
    }
}

const apiSecret = process.env.TWITTER_API_SECRET;
if (apiSecret) {
    if (apiSecret.length === 50) {
        console.log('✅ TWITTER_API_SECRET: Correct length (50 chars)');
    } else {
        console.log(`⚠️  TWITTER_API_SECRET: Unexpected length (${apiSecret.length} chars, expected 50)`);
    }
}

const accessToken = process.env.TWITTER_ACCESS_TOKEN;
if (accessToken) {
    if (accessToken.includes('-') && accessToken.length > 40) {
        console.log('✅ TWITTER_ACCESS_TOKEN: Correct format');
    } else {
        console.log('⚠️  TWITTER_ACCESS_TOKEN: Unexpected format (should contain "-" and be 40+ chars)');
    }
}

const accessSecret = process.env.TWITTER_ACCESS_TOKEN_SECRET;
if (accessSecret) {
    if (accessSecret.length === 45) {
        console.log('✅ TWITTER_ACCESS_TOKEN_SECRET: Correct length (45 chars)');
    } else {
        console.log(`⚠️  TWITTER_ACCESS_TOKEN_SECRET: Unexpected length (${accessSecret.length} chars, expected 45)`);
    }
}

const bearerToken = process.env.TWITTER_BEARER_TOKEN;
if (bearerToken) {
    if (bearerToken.startsWith('AAAAAAAAAAAAAAAAAAA') && bearerToken.length > 100) {
        console.log('✅ TWITTER_BEARER_TOKEN: Correct format');
    } else {
        console.log('⚠️  TWITTER_BEARER_TOKEN: Unexpected format (should start with "AAAAAAAAAAAAAAAAAAA" and be 100+ chars)');
    }
}

console.log('\n🎯 Summary:');
if (allGood) {
    console.log('✅ All required Twitter API credentials are configured!');
    console.log('🚀 Your bot should be able to initialize the Twitter client successfully.');
    
    if (!process.env.TWITTER_USER_ID) {
        console.log('\n💡 Recommendation: Set TWITTER_USER_ID for better performance');
        console.log('   Run: node get_twitter_user_id.js');
    }
} else {
    console.log('❌ Some required Twitter API credentials are missing!');
    console.log('📝 Please set all required environment variables in your deployment platform.');
    console.log('\n🔧 Required variables:');
    requiredEnvVars.forEach(varName => {
        if (!process.env[varName]) {
            console.log(`   - ${varName}`);
        }
    });
}

console.log('\n📚 For help getting Twitter API credentials:');
console.log('   https://developer.twitter.com/en/portal/dashboard'); 