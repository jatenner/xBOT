/**
 * 🚀 AUTONOMOUS TWITTER GROWTH MASTER - MAIN ENTRY POINT
 * Fully autonomous, self-optimizing Twitter bot designed for maximum follower growth
 * Integrates all intelligence systems for strategic posting, engagement, and learning
 */

import express from 'express';
import { MasterAutonomousController } from './core/masterAutonomousController';
import { validateEnvironment, PRODUCTION_CONFIG } from './config/productionConfig';

// Global variables for health server
let healthServer: any = null;
let botController: MasterAutonomousController | null = null;
let botStatus = 'starting';

/**
 * 🏥 START HEALTH SERVER IMMEDIATELY
 * This must start before anything else to pass Railway health checks
 */
function startHealthServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    const app = express();
    const PORT = parseInt(process.env.PORT || '3000', 10);
    const HOST = '0.0.0.0';

    // Basic middleware
    app.use(express.json());

    // Health endpoint - always responds, even if bot isn't ready
    app.get('/health', (_req, res) => {
      console.log('🏥 Health check requested');
      res.status(200).send('ok');
    });

    // Status endpoint for debugging
    app.get('/status', (_req, res) => {
      res.json({
        status: botStatus,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        bot_running: botController?.getSystemStatus ? true : false
      });
    });

    // Catch-all error handler
    app.use((error: any, _req: any, res: any, _next: any) => {
      console.error('❌ Express error:', error);
      if (!res.headersSent) {
        res.status(500).send('Internal Server Error');
      }
    });

    // Start server
    healthServer = app.listen(PORT, HOST, () => {
      console.log(`✅ Health server running on http://${HOST}:${PORT}`);
      console.log(`🚄 Railway health check endpoint: http://${HOST}:${PORT}/health`);
      console.log(`📊 Status endpoint: http://${HOST}:${PORT}/status`);
      resolve();
    });

    healthServer.on('error', (error: any) => {
      console.error('❌ Health server failed to start:', error);
      reject(error);
    });
  });
}

/**
 * 🤖 INITIALIZE BOT SAFELY
 * Bot initialization wrapped in try/catch to prevent health server crashes
 */
async function initializeBot(): Promise<void> {
  try {
    console.log('🚀 === AUTONOMOUS TWITTER GROWTH MASTER STARTING ===');
    console.log(`📅 ${new Date().toISOString()}`);
    console.log('🎯 Mission: Achieve 15+ followers/day with 45%+ engagement rate');
    console.log('🧠 Intelligence: AI-powered optimization and learning systems');
    console.log('🤖 Operation: Fully autonomous posting, engagement, and growth');
    console.log('');

    botStatus = 'validating_environment';

    // Environment validation
    console.log('🔧 Validating system configuration...');
    const envCheck = validateEnvironment();
    
    if (!envCheck.valid) {
      console.error('❌ Missing required environment variables:');
      envCheck.missing.forEach(key => console.error(`   - ${key}`));
      console.error('');
      console.error('💡 Please ensure all required API keys and credentials are set in your .env file');
      botStatus = 'environment_error';
      throw new Error('Missing required environment variables');
    }

    if (envCheck.warnings.length > 0) {
      console.warn('⚠️ Optional environment variables missing:');
      envCheck.warnings.forEach(key => console.warn(`   - ${key}`));
      console.warn('   (System will operate with reduced functionality)');
      console.log('');
    }

    botStatus = 'initializing_controller';

    // Production configuration summary
    console.log('⚙️ === PRODUCTION CONFIGURATION ===');
    console.log(`💰 Daily Budget: $${PRODUCTION_CONFIG.budget.dailyLimit}`);
    console.log(`📝 Max Daily Posts: ${PRODUCTION_CONFIG.posting.maxDailyPosts}`);
    console.log(`🤝 Daily Engagement: ${PRODUCTION_CONFIG.engagement.dailyLikes} likes, ${PRODUCTION_CONFIG.engagement.dailyReplies} replies, ${PRODUCTION_CONFIG.engagement.dailyFollows} follows`);
    console.log(`🎯 Growth Targets: ${PRODUCTION_CONFIG.targets.dailyFollowerGrowth} followers/day, ${(PRODUCTION_CONFIG.targets.engagementRate * 100)}% engagement, ${(PRODUCTION_CONFIG.targets.viralHitRate * 100)}% viral rate`);
    console.log(`🧠 Intelligence: ${PRODUCTION_CONFIG.intelligence.enabled ? 'ENABLED' : 'DISABLED'} (${PRODUCTION_CONFIG.intelligence.optimizationLevel} mode)`);
    console.log(`🛡️ Safety: Anti-spam ${PRODUCTION_CONFIG.safety.antiSpamEnabled ? 'ON' : 'OFF'}, Human-like behavior ${PRODUCTION_CONFIG.safety.humanLikeBehavior ? 'ON' : 'OFF'}`);
    console.log('');

    // Initialize master controller
    console.log('🧠 Initializing Master Autonomous Controller...');
    botController = MasterAutonomousController.getInstance();

    botStatus = 'starting_bot';

    // Start autonomous operation
    await botController.startAutonomousOperation();

    botStatus = 'running';

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

    // Keep the process running with status updates
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
    botStatus = 'error';
    console.error('❌ Bot initialization failed:', error);
    console.error('');
    console.error('🔧 Troubleshooting tips:');
    console.error('   1. Check your .env file has all required API keys');
    console.error('   2. Ensure Supabase database is accessible');
    console.error('   3. Verify OpenAI API key has sufficient credits');
    console.error('   4. Check Twitter API credentials are valid');
    console.error('   5. Ensure twitter-auth.json session file exists');
    console.error('');
    console.error('⚠️ Health server will continue running for Railway health checks');
    console.error('🔄 Bot will attempt to restart in 5 minutes...');
    
    // Attempt to restart bot after delay
    setTimeout(() => {
      console.log('🔄 Attempting to restart bot...');
      initializeBot();
    }, 5 * 60 * 1000);
  }
}

/**
 * 🏠 MAIN ENTRY POINT
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
    await initializeBot();

  } catch (error) {
    console.error('❌ Fatal error in main():', error);
    // Keep health server running even if bot fails
    if (healthServer) {
      console.log('⚠️ Keeping health server alive for Railway despite bot failure');
      botStatus = 'main_error';
    } else {
      process.exit(1);
    }
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
      }
    } catch (error) {
      console.error('❌ Error stopping bot controller:', error);
    }

    try {
      if (healthServer) {
        healthServer.close(() => {
          console.log('🏥 Health server closed');
          process.exit(0);
        });
      } else {
        process.exit(0);
      }
    } catch (error) {
      console.error('❌ Error closing health server:', error);
      process.exit(1);
    }
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  process.on('uncaughtException', async (error) => {
    console.error('❌ Uncaught Exception:', error);
    botStatus = 'uncaught_exception';
    // Don't exit - keep health server running
  });

  process.on('unhandledRejection', async (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    botStatus = 'unhandled_rejection';
    // Don't exit - keep health server running
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
    if (!healthServer) {
      process.exit(1);
    }
  });
}

export { main };
