#!/usr/bin/env node
/**
 * 🚀 REDIS SETUP SCRIPT
 * ======================
 * 
 * Installs Redis dependencies when Redis Cloud is available.
 * Run this after adding Redis service to Railway.
 */

const { execSync } = require('child_process');

console.log('🔍 Checking for Redis Cloud configuration...');

// Check for both Redis URL and explicit install flag
const hasRedisUrl = process.env.REDIS_URL || process.env.REDIS_CONNECTION_STRING;
const shouldInstallRedis = process.env.INSTALL_REDIS_DEPS === 'true';

if (hasRedisUrl && shouldInstallRedis) {
  console.log('✅ Redis URL + install flag detected, installing Redis dependencies...');
  
  try {
    execSync('npm install ioredis@5.3.2', { stdio: 'inherit' });
    console.log('✅ Redis dependencies installed successfully!');
    console.log('🚀 Redis Cloud hot-path is now active!');
  } catch (error) {
    console.error('❌ Failed to install Redis dependencies:', error.message);
    console.log('⚠️ Continuing with Supabase-only mode...');
  }
} else if (hasRedisUrl && !shouldInstallRedis) {
  console.log('📋 Redis URL found but INSTALL_REDIS_DEPS not set to true');
  console.log('💡 To enable Redis hot-path, set: INSTALL_REDIS_DEPS=true');
} else {
  console.log('📋 No Redis URL found, using Supabase-only mode');
  console.log('💡 To enable Redis hot-path:');
  console.log('   1. Add Redis service in Railway dashboard');
  console.log('   2. Set REDIS_URL environment variable');
  console.log('   3. Set INSTALL_REDIS_DEPS=true');
  console.log('   4. Redeploy');
}