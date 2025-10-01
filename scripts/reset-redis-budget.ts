#!/usr/bin/env tsx
/**
 * Reset Redis budget counter to fix negative balance display
 * Run this when refunds have caused the daily budget to go negative
 */

import Redis from 'ioredis';

async function resetBudget() {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    console.error('❌ REDIS_URL environment variable not set');
    process.exit(1);
  }

  const redis = new Redis(redisUrl);
  const prefix = process.env.REDIS_PREFIX || 'prod:';
  const today = new Date().toISOString().split('T')[0];
  const todayKey = `${prefix}openai_cost:${today}`;
  const callsKey = `${todayKey}:calls`;

  try {
    // Get current values
    const currentSpend = await redis.get(todayKey);
    const currentCalls = await redis.get(callsKey);

    console.log('📊 Current Redis Budget Status:');
    console.log(`   Key: ${todayKey}`);
    console.log(`   Spend: $${currentSpend || '0'}`);
    console.log(`   Calls: ${currentCalls || '0'}`);
    console.log('');

    if (parseFloat(currentSpend || '0') < 0) {
      console.log('🔧 Resetting negative balance to $0.00');
      await redis.set(todayKey, '0');
      await redis.expire(todayKey, 86400 * 2); // 2-day expiry
      console.log('✅ Budget counter reset to $0.00');
    } else {
      console.log('✅ Budget is not negative, no reset needed');
    }

    // Ensure calls counter is set
    if (!currentCalls) {
      await redis.set(callsKey, '0');
      await redis.expire(callsKey, 86400 * 2);
      console.log('✅ Calls counter initialized to 0');
    }

    // Show final state
    const finalSpend = await redis.get(todayKey);
    const finalCalls = await redis.get(callsKey);
    console.log('');
    console.log('📊 Final Redis Budget Status:');
    console.log(`   Spend: $${finalSpend || '0'}`);
    console.log(`   Calls: ${finalCalls || '0'}`);

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await redis.quit();
  }
}

resetBudget();

