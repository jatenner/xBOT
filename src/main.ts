/**
 * 🚀 AUTONOMOUS TWITTER GROWTH MASTER - MAIN ENTRY POINT
 * Fully autonomous, self-optimizing Twitter bot designed for maximum follower growth
 * Integrates all intelligence systems for strategic posting, engagement, and learning
 */

import { MasterAutonomousController } from './core/masterAutonomousController';
import { validateEnvironment, PRODUCTION_CONFIG } from './config/productionConfig';

async function main(): Promise<void> {
  try {
    console.log('🚀 === AUTONOMOUS TWITTER GROWTH MASTER STARTING ===');
    console.log(`📅 ${new Date().toISOString()}`);
    console.log('🎯 Mission: Achieve 15+ followers/day with 45%+ engagement rate');
    console.log('🧠 Intelligence: AI-powered optimization and learning systems');
    console.log('🤖 Operation: Fully autonomous posting, engagement, and growth');
    console.log('');

    // Environment validation
    console.log('🔧 Validating system configuration...');
    const envCheck = validateEnvironment();
    
    if (!envCheck.valid) {
      console.error('❌ Missing required environment variables:');
      envCheck.missing.forEach(key => console.error(`   - ${key}`));
      console.error('');
      console.error('💡 Please ensure all required API keys and credentials are set in your .env file');
      process.exit(1);
    }

    if (envCheck.warnings.length > 0) {
      console.warn('⚠️ Optional environment variables missing:');
      envCheck.warnings.forEach(key => console.warn(`   - ${key}`));
      console.warn('   (System will operate with reduced functionality)');
      console.log('');
    }

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
    const controller = MasterAutonomousController.getInstance();

    // Graceful shutdown handling
    process.on('SIGINT', async () => {
      console.log('\n🛑 Received SIGINT signal - shutting down gracefully...');
      await controller.stopAutonomousOperation();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('\n🛑 Received SIGTERM signal - shutting down gracefully...');
      await controller.stopAutonomousOperation();
      process.exit(0);
    });

    process.on('uncaughtException', async (error) => {
      console.error('❌ Uncaught Exception:', error);
      await controller.stopAutonomousOperation();
      process.exit(1);
    });

    process.on('unhandledRejection', async (reason, promise) => {
      console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
      await controller.stopAutonomousOperation();
      process.exit(1);
    });

    // Start autonomous operation
    await controller.startAutonomousOperation();

    // Success message
    console.log('');
    console.log('🎉 === AUTONOMOUS TWITTER GROWTH MASTER ONLINE ===');
    console.log('');
    console.log('📊 Dashboard: http://localhost:3002');
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
    console.log('📈 Monitor progress at http://localhost:3002');
    console.log('');

    // Keep the process running
    setInterval(() => {
      // Health check every 5 minutes
      const status = controller.getSystemStatus();
      console.log(`🤖 System Status: ${status.systemHealth.overall.toUpperCase()} | Uptime: ${Math.floor(status.uptime / 1000 / 60)}min | Posts: ${status.operationalMetrics.posting.totalPosts} | Actions: ${status.operationalMetrics.engagement.totalActions}`);
    }, 5 * 60 * 1000); // 5 minutes

  } catch (error) {
    console.error('❌ Fatal error starting Autonomous Twitter Growth Master:', error);
    console.error('');
    console.error('🔧 Troubleshooting tips:');
    console.error('   1. Check your .env file has all required API keys');
    console.error('   2. Ensure Supabase database is accessible');
    console.error('   3. Verify OpenAI API key has sufficient credits');
    console.error('   4. Check Twitter API credentials are valid');
    console.error('   5. Ensure twitter-auth.json session file exists');
    console.error('');
    process.exit(1);
  }
}

// Handle process-level errors
process.on('warning', (warning) => {
  console.warn('⚠️ Process Warning:', warning.name, warning.message);
});

// Start the autonomous Twitter growth system
if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Failed to start autonomous system:', error);
    process.exit(1);
  });
}

export { main };
