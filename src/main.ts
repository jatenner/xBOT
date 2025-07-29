/**
 * 🚀 AUTONOMOUS TWITTER GROWTH MASTER - MAIN ENTRY POINT
 * Fully autonomous, self-optimizing Twitter bot designed for maximum follower growth
 * Integrates all intelligence systems for strategic posting, engagement, and learning
 */

import { startHealthServer, updateBotStatus } from './healthServer';
import { MasterAutonomousController } from './core/masterAutonomousController';
import { validateEnvironment, PRODUCTION_CONFIG } from './config/productionConfig';

let botController: MasterAutonomousController | null = null;

/**
 * 🤖 INITIALIZE BOT LOGIC
 * This runs AFTER the health server is already responding to Railway
 */
async function initializeBot(): Promise<void> {
  try {
    console.log('🚀 === AUTONOMOUS TWITTER GROWTH MASTER STARTING ===');
    console.log(`📅 ${new Date().toISOString()}`);
    console.log('🎯 Mission: Achieve 15+ followers/day with 45%+ engagement rate');
    console.log('🧠 Intelligence: AI-powered optimization and learning systems');
    console.log('🤖 Operation: Fully autonomous posting, engagement, and growth');
    console.log('');

    updateBotStatus('validating_environment');

    // Environment validation - DON'T throw errors that kill health server
    console.log('🔧 Validating system configuration...');
    
    let envCheck;
    try {
      envCheck = validateEnvironment();
    } catch (envError) {
      console.error('❌ Environment validation failed:', envError);
      updateBotStatus('environment_validation_error');
      
      // Schedule retry instead of throwing
      setTimeout(() => {
        console.log('🔄 Retrying bot initialization...');
        initializeBot().catch(console.error);
      }, 5 * 60 * 1000); // 5 minutes
      
      return; // Exit gracefully without throwing
    }
    
    if (!envCheck.valid) {
      console.error('❌ Missing required environment variables:');
      envCheck.missing.forEach((key: string) => console.error(`   - ${key}`));
      console.error('');
      console.error('💡 Please configure these environment variables in Railway:');
      console.error('   1. Go to your Railway project settings');
      console.error('   2. Navigate to Variables tab');
      console.error('   3. Add the missing environment variables');
      console.error('   4. Redeploy the service');
      console.error('');
      console.error('🏥 Health server will continue running for Railway health checks');
      console.error('🔄 Bot will retry initialization every 5 minutes until env vars are set');
      updateBotStatus('environment_error');
      
      // Schedule retry instead of throwing
      setTimeout(() => {
        console.log('🔄 Retrying bot initialization...');
        initializeBot().catch(console.error);
      }, 5 * 60 * 1000); // 5 minutes
      
      return; // Exit gracefully without throwing
    }

    if (envCheck.warnings.length > 0) {
      console.warn('⚠️ Optional environment variables missing:');
      envCheck.warnings.forEach((key: string) => console.warn(`   - ${key}`));
      console.warn('   (System will operate with reduced functionality)');
      console.log('');
    }

    console.log('⚙️ === PRODUCTION CONFIGURATION ===');
    console.log(`💰 Daily Budget: $${PRODUCTION_CONFIG.budget.dailyLimit}`);
    console.log(`📝 Max Daily Posts: ${PRODUCTION_CONFIG.posting.maxDailyPosts}`);
    console.log(`🤝 Daily Engagement: ${PRODUCTION_CONFIG.engagement.dailyLikes} likes, ${PRODUCTION_CONFIG.engagement.dailyReplies} replies, ${PRODUCTION_CONFIG.engagement.dailyFollows} follows`);
    console.log(`🎯 Growth Targets: ${PRODUCTION_CONFIG.targets.dailyFollowerGrowth} followers/day, ${(PRODUCTION_CONFIG.targets.engagementRate * 100)}% engagement, ${(PRODUCTION_CONFIG.targets.viralHitRate * 100)}% viral rate`);
    console.log(`🧠 Intelligence: ${PRODUCTION_CONFIG.intelligence.enabled ? 'ENABLED' : 'DISABLED'} (${PRODUCTION_CONFIG.intelligence.optimizationLevel} mode)`);
    console.log(`🛡️ Safety: Anti-spam ${PRODUCTION_CONFIG.safety.antiSpamEnabled ? 'ON' : 'OFF'}, Human-like behavior ${PRODUCTION_CONFIG.safety.humanLikeBehavior ? 'ON' : 'OFF'}`);
    console.log('');

    updateBotStatus('initializing_controller');
    console.log('🧠 Initializing Master Autonomous Controller...');
    botController = MasterAutonomousController.getInstance();

    updateBotStatus('starting_bot');
    await botController.startAutonomousOperation();

    updateBotStatus('running', botController);
    console.log('🤖 Bot initialized');

    // Success message
    console.log('');
    console.log('🎉 === AUTONOMOUS TWITTER GROWTH MASTER ONLINE ===');
    console.log('');
    console.log('📊 Dashboard: Available on Railway deployment URL');
    console.log('🤖 The bot is now fully autonomous and learning...');
    console.log('');
    console.log('🔥 EXPECTED RESULTS:');
    console.log('   • 15+ new followers every day');
    console.log('   • 45%+ engagement rate on posts');
    console.log('   • 15%+ viral hit rate');
    console.log('   • Intelligent timing optimization');
    console.log('   • Strategic influencer engagement');
    console.log('   • Daily performance learning');
    console.log('');
    console.log('🎯 THE BOT WILL:');
    console.log('   ✅ Post intelligently based on optimal timing');
    console.log('   ✅ Reply to high-value health discussions');
    console.log('   ✅ Like and follow strategic health accounts');
    console.log('   ✅ Learn from performance and adapt daily');
    console.log('   ✅ Optimize content for maximum viral potential');
    console.log('   ✅ Track and unfollow non-followbacks automatically');
    console.log('   ✅ Generate comprehensive growth analytics');
    console.log('');
    console.log('🚀 FULLY AUTONOMOUS - NO HUMAN INTERVENTION REQUIRED!');
    console.log('');

    // Status monitoring
    setInterval(() => {
      if (botController) {
        try {
          const status = botController.getSystemStatus();
          console.log(`🤖 System Status: ${status.systemHealth.overall.toUpperCase()} | Uptime: ${Math.floor(status.uptime / 1000 / 60)}min | Posts: ${status.operationalMetrics.posting.totalPosts} | Actions: ${status.operationalMetrics.engagement.totalActions}`);
        } catch (error) {
          console.log(`🤖 System Status: MONITORING | Uptime: ${Math.floor(process.uptime() / 60)}min`);
        }
      }
    }, 5 * 60 * 1000); // 5 minutes

  } catch (error) {
    updateBotStatus('error');
    console.error('❌ Bot initialization failed:', error);
    console.error('');
    console.error('🔧 Troubleshooting tips:');
    console.error('   1. Check your Railway environment variables');
    console.error('   2. Ensure Supabase database is accessible');
    console.error('   3. Verify OpenAI API key has sufficient credits');
    console.error('   4. Check Twitter API credentials are valid');
    console.error('   5. Ensure twitter-auth.json session file exists');
    console.error('');
    console.error('⚠️ Health server will continue running for Railway health checks');
    console.error('🔄 Bot will attempt to restart in 5 minutes...');
    
    // Schedule retry without throwing
    setTimeout(() => {
      console.log('🔄 Attempting to restart bot...');
      initializeBot().catch(console.error);
    }, 5 * 60 * 1000);
  }
}

/**
 * 🏠 MAIN ENTRY POINT
 * Health server starts FIRST, then bot initializes
 */
async function main(): Promise<void> {
  try {
    // STEP 1: Start health server immediately (Railway requirement)
    console.log('🏥 Starting health server for Railway...');
    await startHealthServer();
    console.log('✅ Health server ready - Railway health checks will now pass');
    console.log('');

    // STEP 2: Initialize bot (can fail without affecting health server)
    console.log('🤖 Starting bot initialization...');
    
    // Wrap bot initialization in try-catch to prevent it from killing health server
    try {
      await initializeBot();
    } catch (botError) {
      console.error('❌ Bot initialization failed, but health server continues running:', botError);
      updateBotStatus('bot_init_failed');
      
      // Schedule retry
      setTimeout(() => {
        console.log('🔄 Retrying bot initialization...');
        initializeBot().catch((retryError) => {
          console.error('❌ Bot retry failed:', retryError);
          updateBotStatus('bot_retry_failed');
        });
      }, 5 * 60 * 1000);
    }

  } catch (error) {
    console.error('❌ Fatal error in main():', error);
    console.error('⚠️ Attempting to restart health server...');
    updateBotStatus('main_error');
    
    // If health server fails, try to restart it
    setTimeout(async () => {
      console.log('🔄 Attempting to restart health server...');
      try {
        await startHealthServer();
        console.log('✅ Health server restarted successfully');
      } catch (restartError) {
        console.error('❌ Failed to restart health server:', restartError);
        process.exit(1); // Exit completely if we can't start health server
      }
    }, 5000);
  }
}

/**
 * 🛑 GRACEFUL SHUTDOWN HANDLING
 */
function setupGracefulShutdown(): void {
  const shutdown = async (signal: string) => {
    console.log(`\n🛑 Received ${signal} signal - shutting down gracefully...`);
    
    try {
      if (botController) {
        await botController.stopAutonomousOperation();
        console.log('🤖 Bot controller stopped');
      }
    } catch (error) {
      console.error('❌ Error stopping bot controller:', error);
    }

    // Health server handles its own shutdown via healthServer.ts
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  process.on('uncaughtException', async (error) => {
    console.error('❌ Uncaught Exception:', error);
    updateBotStatus('uncaught_exception');
    
    // Don't exit - let health server stay alive
    setTimeout(() => {
      console.log('🔄 Attempting to restart after uncaught exception...');
      initializeBot();
    }, 5 * 60 * 1000);
  });

  process.on('unhandledRejection', async (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    updateBotStatus('unhandled_rejection');
    
    // Don't exit - let health server stay alive
    setTimeout(() => {
      console.log('🔄 Attempting to restart after unhandled rejection...');
      initializeBot();
    }, 5 * 60 * 1000);
  });

  process.on('warning', (warning) => {
    console.warn('⚠️ Process Warning:', warning.name, warning.message);
  });
}

// Start the application
if (require.main === module) {
  setupGracefulShutdown();
  main().catch((error) => {
    console.error('❌ Failed to start application:', error);
    updateBotStatus('startup_failed');
    // Don't exit - health server should stay alive
  });
}
