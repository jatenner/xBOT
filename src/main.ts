
import { scheduler } from './agents/scheduler';
import { supabaseClient } from './utils/supabaseClient';
import { LIVE_MODE } from './config/liveMode';

async function main() {
  console.log('🚀 Starting Clean Twitter Bot...');
  console.log(`🔧 Live Mode: ${LIVE_MODE ? 'ENABLED' : 'DISABLED'}`);
  
  try {
    // Test database connection
    const { data, error } = await supabaseClient.supabase?.from('tweets').select('count').limit(1);
    if (error) {
      console.warn('⚠️ Database connection issue:', error.message);
    } else {
      console.log('✅ Database connected');
    }
  } catch (error) {
    console.warn('⚠️ Database test failed:', error);
  }

  // Start scheduler
  await scheduler.start();
  
  console.log('🎉 Clean Twitter Bot is running!');
  console.log('🐦 Will post every 2 hours');
  console.log('📊 Check logs for posting activity');
}

// Start the application
main().catch(error => {
  console.error('❌ Failed to start application:', error);
  process.exit(1);
});
