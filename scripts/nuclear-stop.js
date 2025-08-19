#!/usr/bin/env node

/**
 * NUCLEAR STOP - Emergency script to completely halt all posting
 * This sets emergency flags in Redis to stop all posting activity
 */

const Redis = require('ioredis');

async function emergencyStop() {
  console.log('🚨 INITIATING NUCLEAR STOP...');
  
  let redis;
  
  try {
    // Connect to Redis
    const redisUrl = process.env.REDIS_URL || process.env.KV_URL;
    if (!redisUrl) {
      throw new Error('No Redis URL found in environment');
    }
    
    redis = new Redis(redisUrl, {
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
    });
    
    console.log('📡 Connected to Redis...');
    
    // Set emergency stop flags
    const stopUntil = Date.now() + (2 * 60 * 60 * 1000); // 2 hours
    
    await redis.setex('xbot:emergency_stop', 7200, stopUntil.toString());
    await redis.setex('xbot:posting_disabled', 7200, 'true');
    await redis.setex('xbot:viral_engine_disabled', 7200, 'true');
    
    // Clear any existing posting locks
    const lockKeys = await redis.keys('*post*lock*');
    if (lockKeys.length > 0) {
      await redis.del(...lockKeys);
      console.log(`🔓 Cleared ${lockKeys.length} posting locks`);
    }
    
    // Set failure counters to trigger circuit breakers
    await redis.setex('xbot:consecutive_failures', 3600, '10');
    
    console.log('✅ NUCLEAR STOP ACTIVATED');
    console.log('🚨 All posting disabled for 2 hours');
    console.log('⏰ Stop until:', new Date(stopUntil).toISOString());
    
  } catch (error) {
    console.error('❌ Nuclear stop failed:', error);
    process.exit(1);
  } finally {
    if (redis) {
      redis.disconnect();
    }
  }
}

// Run immediately if called directly
if (require.main === module) {
  emergencyStop()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('❌ Nuclear stop failed:', error);
      process.exit(1);
    });
}

module.exports = { emergencyStop };
