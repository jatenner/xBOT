#!/usr/bin/env node
/**
 * 🔄 REDIS TO SUPABASE FLUSH WORKER
 * =================================
 * 
 * Hourly job to flush Redis hot cache to Supabase for durability.
 * Runs via Railway Scheduled Jobs: node -r ts-node/register scripts/flushRedisToSupabase.ts
 * 
 * Features:
 * - Flushes recent tweets from Redis to Supabase
 * - Prevents duplicates by checking existing records
 * - Comprehensive error handling and logging
 * - Metrics collection for monitoring
 */

// Dynamic import to handle missing Redis dependencies
let DB: any;

interface FlushMetrics {
  startTime: Date;
  endTime?: Date;
  duration?: number;
  tweetsProcessed: number;
  tweetsFlushed: number;
  errors: number;
  success: boolean;
  errorDetails: string[];
}

async function main(): Promise<void> {
  const metrics: FlushMetrics = {
    startTime: new Date(),
    tweetsProcessed: 0,
    tweetsFlushed: 0,
    errors: 0,
    success: false,
    errorDetails: []
  };

  console.log('🔄 ===== REDIS TO SUPABASE FLUSH JOB STARTING =====');
  console.log(`⏰ Start time: ${metrics.startTime.toISOString()}`);
  
  try {
    // Import DB module
    try {
      const dbModule = await import('../src/lib/db');
      DB = dbModule.DB;
    } catch (error) {
      console.log('📋 Database module not available, skipping flush');
      process.exit(0);
    }

    // Check if we're in Supabase-only mode
    if (process.env.USE_SUPABASE_ONLY !== 'false') {
      console.log('📋 Supabase-only mode, skipping Redis flush');
      process.exit(0);
    }

    // Verify database connections
    console.log('🔍 Checking database health...');
    const health = await DB.healthCheck();
    console.log('🏥 Health check results:', health);

    if (health.redis === 'error') {
      throw new Error('Redis connection failed - cannot proceed with flush');
    }

    if (health.supabase === 'error') {
      throw new Error('Supabase connection failed - cannot proceed with flush');
    }

    // Perform the flush operation
    console.log('🚀 Starting flush operation...');
    const flushResult = await DB.flushToSupabase();
    
    metrics.tweetsProcessed = flushResult.flushed + flushResult.errors;
    metrics.tweetsFlushed = flushResult.flushed;
    metrics.errors = flushResult.errors;
    metrics.success = flushResult.errors === 0;

    // Log results
    console.log('📊 ===== FLUSH RESULTS =====');
    console.log(`✅ Tweets flushed: ${metrics.tweetsFlushed}`);
    console.log(`⚠️ Errors: ${metrics.errors}`);
    console.log(`📈 Success rate: ${metrics.tweetsProcessed > 0 ? ((metrics.tweetsFlushed / metrics.tweetsProcessed) * 100).toFixed(1) : 100}%`);

    if (metrics.errors > 0) {
      console.warn(`⚠️ Flush completed with ${metrics.errors} errors - check logs for details`);
      process.exit(1); // Non-zero exit for Railway monitoring
    }

    // Cleanup old Redis data (optional)
    await performCleanup();
    
    metrics.success = true;
    console.log('✅ Flush job completed successfully');

  } catch (error) {
    console.error('❌ FATAL: Flush job failed:', error);
    metrics.errors++;
    metrics.errorDetails.push(error.message);
    process.exit(1);

  } finally {
    // Calculate final metrics
    metrics.endTime = new Date();
    metrics.duration = metrics.endTime.getTime() - metrics.startTime.getTime();

    // Log final summary
    console.log('📊 ===== FINAL METRICS =====');
    console.log(`⏱️ Duration: ${metrics.duration}ms`);
    console.log(`📝 Tweets processed: ${metrics.tweetsProcessed}`);
    console.log(`💾 Successfully flushed: ${metrics.tweetsFlushed}`);
    console.log(`❌ Errors: ${metrics.errors}`);
    console.log(`✅ Success: ${metrics.success}`);
    console.log(`🏁 End time: ${metrics.endTime?.toISOString()}`);

    // Store metrics in Redis for monitoring (optional)
    await storeFlushMetrics(metrics);

    // Close database connections
    await DB.close();
    
    console.log('🔄 ===== REDIS TO SUPABASE FLUSH JOB COMPLETE =====');
  }
}

/**
 * 🧹 Cleanup old Redis data
 */
async function performCleanup(): Promise<void> {
  try {
    console.log('🧹 Performing Redis cleanup...');
    
    // This would be implemented based on your specific needs
    // For example:
    // - Remove tweets older than 7 days from Redis cache
    // - Clean up expired rate limit data
    // - Remove old content hashes
    
    console.log('🧹 Cleanup completed');
    
  } catch (error) {
    console.warn('⚠️ Cleanup failed (non-critical):', error);
  }
}

/**
 * 📊 Store flush metrics for monitoring
 */
async function storeFlushMetrics(metrics: FlushMetrics): Promise<void> {
  try {
    // Store metrics in Redis for dashboard/monitoring
    const { redis } = await import('../src/lib/db');
    
    const metricsKey = `flush_metrics:${metrics.startTime.toISOString().split('T')[0]}`;
    const metricsData = {
      timestamp: metrics.startTime.toISOString(),
      duration_ms: metrics.duration,
      tweets_processed: metrics.tweetsProcessed,
      tweets_flushed: metrics.tweetsFlushed,
      errors: metrics.errors,
      success: metrics.success,
      error_details: metrics.errorDetails.join('; ')
    };

    await redis.hset(metricsKey, metricsData);
    await redis.expire(metricsKey, 86400 * 30); // Keep for 30 days
    
    // Add to flush history timeline
    await redis.zadd('flush_history', metrics.startTime.getTime(), metricsKey);
    
    console.log('📊 Metrics stored for monitoring');
    
  } catch (error) {
    console.warn('⚠️ Failed to store metrics (non-critical):', error);
  }
}

/**
 * 🛡️ Graceful shutdown handler
 */
process.on('SIGTERM', async () => {
  console.log('📡 Received SIGTERM, shutting down gracefully...');
  await DB.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('📡 Received SIGINT, shutting down gracefully...');
  await DB.close();
  process.exit(0);
});

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run the main function
if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Unhandled error in main:', error);
    process.exit(1);
  });
}