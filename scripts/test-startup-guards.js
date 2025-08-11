#!/usr/bin/env node

/**
 * 🧪 STARTUP GUARDS TEST
 * 
 * PURPOSE: Test schema guard and Redis health utilities
 * USAGE: node scripts/test-startup-guards.js
 */

const path = require('path');

// Add src to module path for testing
require('ts-node').register({
  project: path.join(__dirname, '..', 'tsconfig.json')
});

async function testStartupGuards() {
  console.log('🧪 Testing Startup Guards...\n');

  try {
    // Test 1: Schema Guard
    console.log('1️⃣ Testing Schema Guard...');
    const { SchemaGuard } = require('../src/utils/schemaGuard');
    
    const schemaGuard = new SchemaGuard();
    const schemaResult = await schemaGuard.checkSchemaVersion();
    
    console.log('   Schema Check Result:', {
      compatible: schemaResult.compatible,
      dbVersion: schemaResult.dbVersion,
      appVersion: schemaResult.appVersion,
      error: schemaResult.error
    });

    if (schemaResult.compatible) {
      console.log('   ✅ Schema is compatible');
    } else {
      console.log('   ⚠️ Schema compatibility issue:', schemaResult.error);
    }

  } catch (error) {
    console.log('   ❌ Schema Guard test failed:', error.message);
  }

  console.log('');

  try {
    // Test 2: Redis Health
    console.log('2️⃣ Testing Redis Health...');
    const { redisHealth, checkRedisHealth } = require('../src/utils/redisHealth');

    const healthResult = await checkRedisHealth();
    
    console.log('   Redis Health Result:', {
      connected: healthResult.connected,
      ping: healthResult.ping,
      prefix: healthResult.prefix,
      error: healthResult.error
    });

    if (healthResult.connected) {
      console.log('   ✅ Redis is healthy');
      
      // Test prefix functionality
      console.log('   🔧 Testing prefix functionality...');
      const testKey = 'test-key';
      const testValue = 'test-value';
      
      const setResult = await redisHealth.set(testKey, testValue, 60);
      if (setResult) {
        const getValue = await redisHealth.get(testKey);
        if (getValue === testValue) {
          console.log('   ✅ Redis prefix functionality works');
        } else {
          console.log('   ❌ Redis prefix test failed - value mismatch');
        }
      } else {
        console.log('   ❌ Redis prefix test failed - could not set value');
      }
      
    } else {
      console.log('   ⚠️ Redis health issue:', healthResult.error);
    }

  } catch (error) {
    console.log('   ❌ Redis Health test failed:', error.message);
  }

  console.log('');

  // Test 3: Environment Variables
  console.log('3️⃣ Testing Environment Variables...');
  const requiredEnvVars = [
    'APP_SCHEMA_VERSION',
    'APP_ENV',
    'REDIS_PREFIX',
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY'
  ];

  const optionalEnvVars = [
    'REDIS_URL',
    'STAGING_PROJECT_REF',
    'PROD_PROJECT_REF'
  ];

  console.log('   Required Environment Variables:');
  for (const envVar of requiredEnvVars) {
    const value = process.env[envVar];
    if (value) {
      console.log(`   ✅ ${envVar}: SET`);
    } else {
      console.log(`   ❌ ${envVar}: MISSING`);
    }
  }

  console.log('   Optional Environment Variables:');
  for (const envVar of optionalEnvVars) {
    const value = process.env[envVar];
    if (value) {
      console.log(`   ✅ ${envVar}: SET`);
    } else {
      console.log(`   ⚠️ ${envVar}: NOT SET`);
    }
  }

  console.log('\n🎉 Startup Guards Test Complete!');
}

// Handle environment setup
const requiredEnvVars = {
  APP_SCHEMA_VERSION: '1.0.0',
  APP_ENV: 'staging',
  REDIS_PREFIX: 'stg:',
  SUPABASE_URL: 'https://uokidynvzfkxwvxlpnfu.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'dummy-key-for-testing'
};

console.log('🔧 Setting up test environment variables...');
for (const [key, value] of Object.entries(requiredEnvVars)) {
  if (!process.env[key]) {
    process.env[key] = value;
    console.log(`   Set ${key}`);
  }
}

// Run the test
testStartupGuards().catch(error => {
  console.error('❌ Test script failed:', error);
  process.exit(1);
});