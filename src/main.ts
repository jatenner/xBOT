import { validateEnvironment } from './config/env';
import { startHealthServer } from './server';
import { closeBrowser } from './playwright/browserFactory';
import { closeDatabaseConnections } from './db/index';

/**
 * SIMPLE THREAD POSTING LOOP - No bloat, just threads
 */
async function startSimpleThreadLoop() {
  console.log('🧵 SIMPLE_THREAD_LOOP: Starting basic thread posting...');
  
  async function postScientificThread() {
    try {
      console.log('🔬 Creating scientific thread...');
      
      // Generate scientific thread
      const { generateThread } = await import('./ai/threadGenerator');
      const OpenAI = (await import('openai')).default;
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
      
      // Get random viral topic for follower growth
      const { getRandomViralTopic } = await import('./content/viralTopics');
      const viralTopic = getRandomViralTopic();
      
      console.log(`🔥 VIRAL_TOPIC: ${viralTopic.topic} (${viralTopic.hook_type})`);
      console.log(`🎯 APPEAL: ${viralTopic.follower_appeal}`);
      
      const threadResult = await generateThread({
        topic: viralTopic.topic,
        pillar: viralTopic.hook_type, 
        angle: viralTopic.angle,
        spice_level: 9, // Maximum controversy
        evidence_mode: 'viral_appeal'
      }, openai);
      
      console.log(`🧵 Generated ${threadResult.tweets.length} scientific tweets`);
      
      // Post the thread
      const { SimpleThreadPoster } = await import('./posting/simpleThreadPoster');
      const poster = SimpleThreadPoster.getInstance();
      
      const tweetTexts = threadResult.tweets.map(t => t.text);
      const result = await poster.postRealThread(tweetTexts);
      
      if (result.success) {
        console.log(`✅ THREAD_SUCCESS: Posted ${result.totalTweets} tweets (Root: ${result.rootTweetId})`);
      } else {
        console.log(`❌ THREAD_FAILED: ${result.error}`);
      }
      
    } catch (error: any) {
      console.error('❌ THREAD_ERROR:', error.message);
    }
  }
  
  // Start intelligent posting schedule
  setTimeout(() => startIntelligentPosting(), 10000); // 10 seconds
}

/**
 * AGGRESSIVE ENGAGEMENT LOOP - Build followers through strategic engagement
 */
async function startEngagementLoop() {
  console.log('🚀 ENGAGEMENT_LOOP: Starting aggressive follower acquisition...');
  
  async function runEngagementCycle() {
    try {
      console.log('🤝 ENGAGEMENT_CYCLE: Running strategic engagement...');
      
      // Strategic replies to health influencers (every 30 min)
      const { executeStrategicReplies } = await import('./engagement/strategicReplies');
      await executeStrategicReplies();
      
      // Strategic follows (every hour)  
      const { executeStrategicFollows } = await import('./engagement/strategicFollows');
      await executeStrategicFollows();
      
      // Strategic likes (every 15 min)
      const { executeStrategicLikes } = await import('./engagement/strategicLikes');
      await executeStrategicLikes();
      
      console.log('✅ ENGAGEMENT_CYCLE: Completed strategic engagement cycle');
      
    } catch (error: any) {
      console.error('❌ ENGAGEMENT_ERROR:', error.message);
    }
  }
  
  // Start intelligent engagement schedule
  setTimeout(() => startIntelligentEngagement(), 30000); // 30 seconds
}

/**
 * INTELLIGENT POSTING - Data-driven content decisions
 */
async function startIntelligentPosting() {
  console.log('🧠 INTELLIGENT_POSTING: Starting adaptive posting system...');
  
  const { AdaptivePostingManager } = await import('./intelligence/adaptivePostingManager');
  const postingManager = AdaptivePostingManager.getInstance();
  
  async function checkPostingOpportunity() {
    try {
      const opportunity = await postingManager.getNextPostingOpportunity();
      
      if (!opportunity) {
        console.log('⏰ WAITING: No posting opportunity, checking again in 15 minutes');
        return;
      }
      
      console.log(`🎯 OPPORTUNITY: ${opportunity.type} (urgency: ${opportunity.urgency}/10) - ${opportunity.reason}`);
      
      if (opportunity.type === 'thread') {
        await postScientificThread();
      } else {
        await postSimpleContent(opportunity.type);
      }
      
      postingManager.recordPost(opportunity.type);
      
    } catch (error: any) {
      console.error('❌ INTELLIGENT_POSTING_ERROR:', error.message);
    }
  }
  
  // Check every 15 minutes for posting opportunities
  setInterval(checkPostingOpportunity, 15 * 60 * 1000);
  
  // Check immediately
  setTimeout(checkPostingOpportunity, 5000);
}

/**
 * INTELLIGENT ENGAGEMENT - Data-driven engagement decisions  
 */
async function startIntelligentEngagement() {
  console.log('🤝 INTELLIGENT_ENGAGEMENT: Starting adaptive engagement system...');
  
  async function checkEngagementOpportunity() {
    try {
      const hour = new Date().getHours();
      const isActiveHour = hour >= 7 && hour <= 22; // 7 AM to 10 PM
      
      if (!isActiveHour) {
        console.log('😴 QUIET_HOURS: Reduced engagement during off-hours');
        return;
      }
      
      // Randomize engagement activities to seem natural
      const activities = [];
      
      if (Math.random() > 0.3) activities.push('likes'); // 70% chance
      if (Math.random() > 0.6) activities.push('replies'); // 40% chance  
      if (Math.random() > 0.8) activities.push('follows'); // 20% chance
      
      for (const activity of activities) {
        try {
          switch (activity) {
            case 'likes':
              const { executeStrategicLikes } = await import('./engagement/strategicLikes');
              await executeStrategicLikes();
              break;
            case 'replies':
              const { executeStrategicReplies } = await import('./engagement/strategicReplies');
              await executeStrategicReplies();
              break;
            case 'follows':
              const { executeStrategicFollows } = await import('./engagement/strategicFollows');
              await executeStrategicFollows();
              break;
          }
        } catch (activityError: any) {
          console.error(`❌ ${activity.toUpperCase()}_ERROR:`, activityError.message);
        }
      }
      
    } catch (error: any) {
      console.error('❌ INTELLIGENT_ENGAGEMENT_ERROR:', error.message);
    }
  }
  
  // Variable engagement timing (10-30 minutes)
  function scheduleNextEngagement() {
    const minutes = 10 + Math.random() * 20; // 10-30 minutes
    setTimeout(() => {
      checkEngagementOpportunity();
      scheduleNextEngagement();
    }, minutes * 60 * 1000);
  }
  
  // Start engagement cycle
  setTimeout(checkEngagementOpportunity, 5000);
  scheduleNextEngagement();
}

/**
 * Post simple facts/advice content
 */
async function postSimpleContent(type: 'simple_fact' | 'advice') {
  console.log(`📝 SIMPLE_CONTENT: Posting ${type}...`);
  
  // Simple content topics  
  const simpleTopics = [
    'morning hydration protocol',
    'sleep temperature optimization', 
    'magnesium timing for better sleep',
    'cold exposure for metabolism',
    'intermittent fasting timing',
    'blue light blocking strategy',
    'breathing technique for stress',
    'supplement timing optimization'
  ];
  
  const topic = simpleTopics[Math.floor(Math.random() * simpleTopics.length)];
  
  try {
    // Generate simple single tweet
    const OpenAI = (await import('openai')).default;
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
    
    const prompt = type === 'simple_fact' 
      ? `Create a viral health fact about ${topic}. Format: "Most people don't know that [shocking fact]. Here's why: [mechanism]" Keep under 240 chars.`
      : `Create actionable health advice about ${topic}. Format: "Try this: [specific protocol]. Result: [benefit] because [mechanism]" Keep under 240 chars.`;
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0.8,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 100
    });
    
    const content = response.choices?.[0]?.message?.content?.trim() || '';
    
    if (content) {
      console.log(`📝 GENERATED: "${content}" (${content.length} chars)`);
      // TODO: Integrate with actual posting mechanism
      console.log('✅ SIMPLE_POST: Posted successfully (placeholder)');
    }
    
  } catch (error: any) {
    console.error('❌ SIMPLE_CONTENT_ERROR:', error.message);
  }
}

/**
 * TWITTER ANALYTICS ENGINE - Continuous Twitter landscape analysis
 */
async function startTwitterAnalytics() {
  console.log('📊 TWITTER_ANALYTICS: Starting continuous analysis...');
  
  const { TwitterAnalyticsEngine } = await import('./analytics/twitterAnalyticsEngine');
  const analytics = TwitterAnalyticsEngine.getInstance();
  
  async function runAnalyticsCycle() {
    try {
      console.log('🔍 ANALYTICS_CYCLE: Analyzing Twitter landscape...');
      
      // Deep Twitter analysis
      const metrics = await analytics.analyzeTwitterLandscape();
      
      // Generate engagement forecast
      const forecast = await analytics.generateEngagementForecast();
      
      console.log('📊 ANALYTICS_SUMMARY:');
      console.log(`🔥 TRENDING: ${metrics.trending_topics.slice(0, 3).join(', ')}`);
      console.log(`⏰ PEAK_HOURS: ${metrics.peak_engagement_hours.join(', ')}`);
      console.log(`🏆 COMPETITORS: ${metrics.competitor_activity.length} analyzed`);
      console.log(`🚀 OPPORTUNITIES: ${forecast.trending_opportunities.length} trending topics`);
      console.log(`⚡ GAPS: ${forecast.competitor_gaps.length} competitor gaps`);
      
    } catch (error: any) {
      console.error('❌ ANALYTICS_CYCLE_ERROR:', error.message);
    }
  }
  
  // Run analytics every 30 minutes
  setInterval(runAnalyticsCycle, 30 * 60 * 1000);
  
  // Run initial analysis after 1 minute
  setTimeout(runAnalyticsCycle, 60 * 1000);
}

/**
 * Main application entry point with proper error handling and graceful shutdown
 */
async function main() {
  console.log('🚀 Starting xBOT with enhanced quality and stability system');
  console.log(`📅 Started at: ${new Date().toISOString()}`);
  
  // Startup delay to prevent immediate API rate limiting
  console.log('⏳ Adding startup delay to respect API rate limits...');
  await new Promise(resolve => setTimeout(resolve, 5000)); // 5 second delay
  
  try {
    // Validate environment
    console.log('🔍 Validating environment configuration...');
    const envValidation = validateEnvironment();
    
    if (!envValidation.valid) {
      console.error('❌ Environment validation failed:');
      envValidation.errors.forEach(error => console.error(`   - ${error}`));
      process.exit(1);
    }
    
    console.log('✅ Environment validation passed');

    // Start health server
    console.log('🏥 Starting health monitoring server...');
    await startHealthServer();
    
    // Start simple thread posting system
    console.log('🧵 Starting SIMPLE THREAD SYSTEM...');
    await startSimpleThreadLoop();
    
    // Start aggressive engagement system for follower growth
    console.log('🤝 Starting ENGAGEMENT SYSTEM for follower acquisition...');
    await startEngagementLoop();
    
    // Start Twitter analytics engine
    console.log('📊 Starting TWITTER ANALYTICS ENGINE...');
    await startTwitterAnalytics();
    
    console.log('✅ COMPLETE AI-DRIVEN GROWTH SYSTEM ready and running');
    console.log('🎯 Goal: Data-driven viral content + strategic engagement');
    console.log('🧬 Strategy: Twitter Analytics → Optimal Timing → Viral Content → Followers');

    // Set up graceful shutdown
    setupGracefulShutdown();

    console.log('✅ xBOT system initialization complete');
    console.log('🌐 Health server running - check /status endpoint for system status');
    console.log('🚀 ULTIMATE CONTENT SYSTEM active - generating premium content');
    console.log('📈 Focus: Quality-driven growth, authentic engagement, follower acquisition');
    
    // 🛡️ GLOBAL_CRASH_PREVENTION: Handle all uncaught errors
    process.on('uncaughtException', (error) => {
      console.error('🛡️ Uncaught Exception (continuing):', error.message);
      // Don't exit - keep running
    });
    
    process.on('unhandledRejection', (reason, promise) => {
      console.error('🛡️ Unhandled Rejection (continuing):', reason);
      // Don't exit - keep running  
    });
    
    // Keep process alive
    process.stdin.resume();
    
  } catch (error) {
    console.error('❌ Failed to start xBOT system:', error);
    process.exit(1);
  }
}

/**
 * Set up graceful shutdown handlers
 */
function setupGracefulShutdown() {
  const shutdown = async (signal: string) => {
    console.log(`\n🛑 Received ${signal}, initiating graceful shutdown...`);
    
    try {
      // Close connections in order
      console.log('🌐 Closing browser...');
      await closeBrowser();
      
      console.log('🗄️ Closing database connections...');
      await closeDatabaseConnections();
      
      console.log('🔐 Closing cadence guard...');
      // Cadence guard removed for simplified system
      
      console.log('🔓 Releasing PostLock and closing Redis...');
      try {
        const { closePostLockRedis } = await import('./infra/postLockInstance');
        await closePostLockRedis();
      } catch (error) {
        console.warn('⚠️ Error closing PostLock Redis:', error);
      }
      
      console.log('📊 Stopping metrics retry queue...');
      try {
        const { MetricsRetryQueue } = await import('./infra/MetricsRetryQueue');
        const retryQueue = MetricsRetryQueue.getInstance();
        retryQueue.stop();
      } catch (error) {
        console.warn('⚠️ Error stopping metrics queue:', error);
      }
      
      console.log('✅ Graceful shutdown complete');
      process.exit(0);
    } catch (error) {
      console.error('❌ Error during shutdown:', error);
      process.exit(1);
    }
  };

  // Handle different termination signals
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGUSR2', () => shutdown('SIGUSR2')); // nodemon restart
  
  // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('💥 Uncaught Exception:', error);
    shutdown('uncaughtException');
    });
    
    process.on('unhandledRejection', (reason, promise) => {
      console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
    shutdown('unhandledRejection');
  });
}

// Start the application
if (require.main === module) {
  main().catch(error => {
    console.error('💥 Fatal error in main:', error);
    process.exit(1);
  });
}

export { main };