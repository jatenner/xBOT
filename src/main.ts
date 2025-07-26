
import { unifiedScheduler } from './core/unifiedScheduler';
import { minimalSupabaseClient } from './utils/minimalSupabaseClient';
import { LIVE_MODE } from './config/liveMode';
import ProcessLock from './utils/processLock';

async function main() {
  console.log('🤖 Starting UNIFIED AUTONOMOUS TWITTER BOT...');
  
  // CRITICAL: Acquire process lock to prevent multiple instances
  const lockResult = await ProcessLock.acquire();
  if (!lockResult.success) {
    console.error('🚫 Cannot start bot:', lockResult.error);
    console.log('🔍 Make sure no other bot instances are running');
    process.exit(1);
  }
  
  console.log(`🔧 Live Mode: ${LIVE_MODE ? 'ENABLED' : 'DISABLED'}`);
  console.log('🎯 Mission: Autonomous, intelligent health content for maximum growth');
  console.log('📊 Architecture: Unified, bulletproof, self-healing');
  console.log('🚀 Capability: Truly autonomous operation without manual intervention');
  
  try {
    // Test database connection
    if (minimalSupabaseClient.supabase) {
      const result = await minimalSupabaseClient.supabase.from('tweets').select('count').limit(1);
      if (result?.error) {
        console.warn('⚠️ Database connection issue:', result.error.message);
      } else {
        console.log('✅ Database connected');
      }
    } else {
      console.log('⚠️ Database not configured');
    }
  } catch (error) {
    console.warn('⚠️ Database test failed:', error);
  }

  // Start the UNIFIED AUTONOMOUS SYSTEM
  await unifiedScheduler.start();
  
  console.log('🎉 UNIFIED AUTONOMOUS TWITTER BOT IS OPERATIONAL!');
  console.log('🤖 System is now fully autonomous and self-managing');
  console.log('📊 Performance metrics available via unifiedScheduler.getPerformanceMetrics()');
}

// Start the application
main().catch(error => {
  console.error('❌ Failed to start application:', error);
  process.exit(1);
});
