
import { scheduler } from './agents/scheduler';
import { minimalSupabaseClient } from './utils/minimalSupabaseClient';
import { LIVE_MODE } from './config/liveMode';
import ProcessLock from './utils/processLock';

async function main() {
  console.log('🔥 Starting VIRAL HEALTH Twitter Bot...');
  
  // CRITICAL: Acquire process lock to prevent multiple instances
  const lockResult = await ProcessLock.acquire();
  if (!lockResult.success) {
    console.error('🚫 Cannot start bot:', lockResult.error);
    console.log('🔍 Make sure no other bot instances are running');
    process.exit(1);
  }
  
  console.log(`🔧 Live Mode: ${LIVE_MODE ? 'ENABLED' : 'DISABLED'}`);
  console.log('🎯 Content: Health news, supplements, fitness, biohacking, food tips');
  console.log('📊 Target: 17 viral health posts per day (FREE TIER COMPLIANT)');
  
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

  // Start our ONLY scheduler (no other systems)
  await scheduler.start();
  
  console.log('🎉 VIRAL HEALTH Twitter Bot is LIVE!');
  console.log('🔥 Generating diverse health content for maximum followers');
  console.log('📊 Check logs for posting activity every ~50 minutes');
}

// Start the application
main().catch(error => {
  console.error('❌ Failed to start application:', error);
  process.exit(1);
});
