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

if (process.env.REDIS_URL || process.env.REDIS_CONNECTION_STRING) {
  console.log('✅ Redis URL detected, installing Redis dependencies...');
  
  try {
    execSync('npm install ioredis @types/ioredis', { stdio: 'inherit' });
    console.log('✅ Redis dependencies installed successfully!');
    console.log('🚀 Redis Cloud hot-path is now active!');
  } catch (error) {
    console.error('❌ Failed to install Redis dependencies:', error.message);
    console.log('⚠️ Continuing with Supabase-only mode...');
  }
} else {
  console.log('📋 No Redis URL found, using Supabase-only mode');
  console.log('💡 To enable Redis hot-path:');
  console.log('   1. Add Redis service in Railway dashboard');
  console.log('   2. Set REDIS_URL environment variable');
  console.log('   3. Run: node scripts/setupRedis.js');
}