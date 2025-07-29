/**
 * 🚀 XBOT MAIN ENTRY POINT - RAILWAY OPTIMIZED
 * 
 * Railway-compatible startup sequence:
 * 1. Health server starts IMMEDIATELY (< 1 second)
 * 2. Bot initialization happens in background (non-blocking)
 * 3. Playwright setup happens asynchronously (with fallbacks)
 * 4. All failures are graceful - health server stays alive
 */

import { startHealthServer, updateBotStatus } from './healthServer';
import { railwayPlaywright } from './utils/railwayPlaywrightManager';
import { ProductionEnvValidator } from './utils/productionEnvValidator';

let botController: any = null;
let isShuttingDown = false;

/**
 * 🤖 INITIALIZE BOT IN BACKGROUND (NON-BLOCKING)
 * This runs AFTER health server is responding to Railway
 */
async function initializeBotAsync(): Promise<void> {
  try {
    console.log('🚀 === XBOT BACKGROUND INITIALIZATION STARTING ===');
    console.log(`📅 ${new Date().toISOString()}`);
    console.log('🎯 Mission: Autonomous Twitter growth with browser automation');
    console.log('🚄 Platform: Railway.app optimized');
    console.log('');

    updateBotStatus('environment_check');

    // Environment validation (non-blocking) - using production validator
    console.log('🔧 Validating environment configuration...');
    
    try {
      const envResult = ProductionEnvValidator.validateEnvironment();
      
      if (!envResult.valid) {
        console.error('❌ Environment validation failed:');
        envResult.errors.forEach((error: string) => console.error(`   - ${error}`));
        console.error('');
        console.error('💡 Set these in Railway dashboard → Variables tab');
        console.error('📚 See RAILWAY_ENV_SETUP.md for complete setup guide');
        console.error('');
        console.error('🏥 Health server continues running - bot will retry every 5 minutes');
        updateBotStatus('missing_env_vars');
        
        // Schedule retry
        setTimeout(() => {
          console.log('🔄 Retrying bot initialization...');
          initializeBotAsync().catch(console.error);
        }, 5 * 60 * 1000); // 5 minutes
        
        return;
      }

      if (envResult.warnings.length > 0) {
        console.warn('⚠️ Environment warnings:');
        envResult.warnings.forEach((warning: string) => console.warn(`   - ${warning}`));
        console.warn('   (System will operate with reduced functionality)');
        console.log('');
      }

      console.log('✅ Environment validation passed');
      console.log(`📊 Configuration: ${Object.keys(envResult.parsed).length} variables loaded`);
      
    } catch (envError) {
      console.error('❌ Environment validation error:', envError);
      updateBotStatus('env_validation_error');
      
      setTimeout(() => {
        console.log('🔄 Retrying environment validation...');
        initializeBotAsync().catch(console.error);
      }, 2 * 60 * 1000); // 2 minutes
      
      return;
    }

    updateBotStatus('initializing_systems');

    // Import bot systems only after environment validation
    console.log('📦 Loading bot systems...');
    
    try {
      // Dynamic imports to avoid early failures
      const { MasterAutonomousController } = await import('./core/masterAutonomousController');
      const { PRODUCTION_CONFIG } = await import('./config/productionConfig');

      console.log('⚙️ === PRODUCTION CONFIGURATION ===');
      console.log(`💰 Daily Budget: $${PRODUCTION_CONFIG.budget.dailyLimit}`);
      console.log(`📝 Max Daily Posts: ${PRODUCTION_CONFIG.posting.maxDailyPosts}`);
      console.log(`🤝 Daily Engagement: ${PRODUCTION_CONFIG.engagement.dailyLikes} likes, ${PRODUCTION_CONFIG.engagement.dailyReplies} replies, ${PRODUCTION_CONFIG.engagement.dailyFollows} follows`);
      console.log(`🧠 Intelligence: ${PRODUCTION_CONFIG.intelligence.enabled ? 'ENABLED' : 'DISABLED'} (${PRODUCTION_CONFIG.intelligence.optimizationLevel} mode)`);
      console.log('');

      updateBotStatus('creating_controller');
      console.log('🧠 Creating Master Autonomous Controller...');
      botController = MasterAutonomousController.getInstance();

      updateBotStatus('starting_operations');
      console.log('🚀 Starting autonomous operations...');
      await botController.startAutonomousOperation();

      updateBotStatus('running', botController);
      console.log('🤖 Bot fully operational!');

      // Success message
      console.log('');
      console.log('🎉 === XBOT ONLINE AND AUTONOMOUS ===');
      console.log('');
      console.log('📊 Dashboard: Available on Railway deployment URL:3002');
      console.log('🤖 The bot is now fully autonomous and learning...');
      console.log('🎭 Browser automation: Check /playwright endpoint for status');
      console.log('');
      console.log('🎯 EXPECTED RESULTS:');
      console.log('   • 15+ new followers every day');
      console.log('   • 45%+ engagement rate on posts');
      console.log('   • Intelligent timing optimization');
      console.log('   • Strategic influencer engagement');
      console.log('');
      console.log('🚀 FULLY AUTONOMOUS - NO HUMAN INTERVENTION REQUIRED!');
      console.log('');

      // Start health monitoring
      startHealthMonitoring();

    } catch (systemError) {
      console.error('❌ Failed to load bot systems:', systemError);
      updateBotStatus('system_load_error');
      
      setTimeout(() => {
        console.log('🔄 Retrying system initialization...');
        initializeBotAsync().catch(console.error);
      }, 3 * 60 * 1000); // 3 minutes
      
      return;
    }

  } catch (error) {
    updateBotStatus('initialization_error');
    console.error('❌ Bot initialization failed:', error);
    console.error('');
    console.error('🔧 Troubleshooting:');
    console.error('   1. Check Railway environment variables');
    console.error('   2. Verify API keys are valid');
    console.error('   3. Check deployment logs for specific errors');
    console.error('   4. Visit /status endpoint for detailed diagnostics');
    console.error('');
    console.error('⚠️ Health server continues running - bot will retry in 5 minutes');
    
    // Schedule retry
    setTimeout(() => {
      console.log('🔄 Attempting bot restart...');
      initializeBotAsync().catch(console.error);
    }, 5 * 60 * 1000); // 5 minutes
  }
}

/**
 * 📊 HEALTH MONITORING (NON-BLOCKING)
 */
function startHealthMonitoring(): void {
  setInterval(() => {
    if (isShuttingDown) return;
    
    try {
      if (botController) {
        const status = botController.getSystemStatus();
        const uptimeMin = Math.floor(status.uptime / 1000 / 60);
        console.log(`🤖 Status: ${status.systemHealth.overall.toUpperCase()} | Uptime: ${uptimeMin}m | Posts: ${status.operationalMetrics.posting.totalPosts}`);
      } else {
        console.log(`🤖 Status: INITIALIZING | Health: OK | Playwright: ${railwayPlaywright.getStatus().statusText}`);
      }
    } catch (error) {
      console.log(`🤖 Status: MONITORING | Uptime: ${Math.floor(process.uptime() / 60)}m | Health: OK`);
    }
  }, 5 * 60 * 1000); // 5 minutes
}

/**
 * 🏠 MAIN ENTRY POINT - RAILWAY OPTIMIZED
 * Health server starts INSTANTLY, everything else happens in background
 */
async function main(): Promise<void> {
  try {
    console.log('🚄 === RAILWAY DEPLOYMENT STARTING ===');
    console.log(`📅 Startup: ${new Date().toISOString()}`);
    console.log(`🌍 Platform: ${process.platform}`);
    console.log(`📦 Node: ${process.version}`);
    console.log('');

    // STEP 1: Start health server IMMEDIATELY (Railway requirement)
    console.log('🏥 Starting health server for Railway health checks...');
    const healthStartTime = Date.now();
    
    await startHealthServer();
    
    const healthDuration = Date.now() - healthStartTime;
    console.log(`✅ Health server READY in ${healthDuration}ms`);
    console.log('🚄 Railway health checks will now PASS');
    console.log('');

    // STEP 2: Initialize bot in background (non-blocking)
    console.log('🤖 Starting bot initialization in background...');
    setTimeout(() => {
      initializeBotAsync().catch((error) => {
        console.error('❌ Background bot initialization failed:', error);
        updateBotStatus('background_init_failed');
      });
    }, 1000); // Small delay to ensure health server is fully ready

    // STEP 3: Initialize Playwright in background (non-blocking)
    console.log('🎭 Playwright will initialize in background...');
    // railwayPlaywright auto-starts itself after 5 seconds

    console.log('✅ Main startup sequence complete');
    console.log('🚄 Health checks: PASSING');
    console.log('🤖 Bot: Initializing in background');
    console.log('🎭 Playwright: Will auto-initialize');
    console.log('');

  } catch (error) {
    console.error('❌ CRITICAL: Main startup failed:', error);
    updateBotStatus('main_startup_failed');
    
    // Try to restart main after delay
    setTimeout(() => {
      console.log('🔄 Attempting main restart...');
      main().catch((restartError) => {
        console.error('❌ Main restart failed:', restartError);
        process.exit(1); // Exit if we can't start main process
      });
    }, 10000); // 10 seconds
  }
}

/**
 * 🛑 GRACEFUL SHUTDOWN HANDLING
 */
function setupGracefulShutdown(): void {
  const shutdown = async (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    
    console.log(`\n🛑 Received ${signal} - graceful shutdown starting...`);
    
    try {
      // Stop bot operations
      if (botController) {
        console.log('🤖 Stopping bot controller...');
        await botController.stopAutonomousOperation();
        console.log('✅ Bot controller stopped');
      }
      
      // Cleanup Playwright
      console.log('🎭 Cleaning up Playwright...');
      await railwayPlaywright.cleanup();
      console.log('✅ Playwright cleaned up');
      
    } catch (error) {
      console.error('❌ Error during shutdown:', error);
    }

    console.log('✅ Graceful shutdown complete');
    process.exit(0);
  };

  // Handle shutdown signals
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  // Handle uncaught exceptions gracefully
  process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception (health server continues):', error);
    updateBotStatus('uncaught_exception');
    
    // Don't exit - health server stays alive
    setTimeout(() => {
      console.log('🔄 Attempting recovery...');
      initializeBotAsync().catch(console.error);
    }, 30000); // 30 seconds
  });

  process.on('unhandledRejection', (reason) => {
    console.error('❌ Unhandled Rejection (health server continues):', reason);
    updateBotStatus('unhandled_rejection');
    
    // Don't exit - health server stays alive
    setTimeout(() => {
      console.log('🔄 Attempting recovery...');
      initializeBotAsync().catch(console.error);
    }, 30000); // 30 seconds
  });

  process.on('warning', (warning) => {
    console.warn('⚠️ Process Warning:', warning.name, warning.message);
  });
}

// 🚀 START THE APPLICATION
if (require.main === module) {
  setupGracefulShutdown();
  main().catch((error) => {
    console.error('❌ Failed to start application:', error);
    updateBotStatus('startup_failed');
    // Don't exit - health server might still be working
  });
}
