
import { scheduler } from './agents/scheduler';
import { minimalSupabaseClient } from './utils/minimalSupabaseClient';
import { LIVE_MODE } from './config/liveMode';

async function main() {
  console.log('🚀 Starting Simple Health Twitter Bot...');
  console.log(`🔧 Live Mode: ${LIVE_MODE ? 'ENABLED' : 'DISABLED'}`);
  
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

  // Start scheduler
  await scheduler.start();
  
  console.log('🎉 Simple Health Twitter Bot is running!');
  console.log('🍌 Posting simple, viral health tips');
  console.log('📊 Check logs for posting activity');
}

// Start the application
main().catch(error => {
  console.error('❌ Failed to start application:', error);
  process.exit(1);
});
