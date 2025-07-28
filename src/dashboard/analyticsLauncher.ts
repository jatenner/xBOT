/**
 * 🎯 ANALYTICS DASHBOARD LAUNCHER
 * 
 * Starts the real-time analytics server for the Twitter bot dashboard.
 */

import { analyticsServer } from './analyticsServer';

async function main() {
  console.log('🚀 Starting Analytics Dashboard...');
  
  try {
    await analyticsServer.start();
    
    console.log('✅ Analytics Dashboard ready!');
    console.log('📊 Visit: http://localhost:3002');
    console.log('💡 Press Ctrl+C to stop');
    
    // Send initial activity log
    analyticsServer.sendActivityLog('Analytics Dashboard started successfully', 'success');
    
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n🛑 Shutting down Analytics Dashboard...');
      await analyticsServer.stop();
      process.exit(0);
    });
    
  } catch (error) {
    console.error('❌ Failed to start Analytics Dashboard:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { analyticsServer }; 