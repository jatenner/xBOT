import { Scheduler } from './agents/scheduler';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function main() {
  console.log('🚀 Snap2Health Autonomous X-Bot Starting...');
  console.log('=====================================');

  try {
    // Initialize scheduler
    const scheduler = new Scheduler();

    // Check if running in test mode
    if (process.env.NODE_ENV === 'test' || process.argv.includes('--test')) {
      console.log('🧪 Running in test mode...');
      await scheduler.testAllAgents();
      console.log('💚 All agents completed');
      process.exit(0);
    }

    // Check if running single cycle
    if (process.argv.includes('--once')) {
      console.log('🔄 Running single cycle...');
      await scheduler.runOnce();
      console.log('💚 Single cycle completed');
      process.exit(0);
    }

    // Start continuous operation
    scheduler.start();

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n🛑 Received SIGINT, shutting down gracefully...');
      scheduler.stop();
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
      scheduler.stop();
      process.exit(0);
    });

    process.on('uncaughtException', (error) => {
      console.error('❌ Uncaught Exception:', error);
      scheduler.stop();
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
      scheduler.stop();
      process.exit(1);
    });

  } catch (error) {
    console.error('❌ Fatal error during startup:', error);
    process.exit(1);
  }
}

// Run the application
if (require.main === module) {
  main();
} 