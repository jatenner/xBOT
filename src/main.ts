import { Scheduler } from './agents/scheduler';
import { DynamicPostingController } from './utils/dynamicPostingController';
import * as cron from 'node-cron';
import dotenv from 'dotenv';
import http from 'http';

// 🚨 EMERGENCY STARTUP CONSERVATION MODE
console.log('🚨 EMERGENCY: Activating startup conservation mode');
console.log('⏱️  Startup throttling active for first 10 minutes');

// Global startup throttling flags
global.STARTUP_MODE = true;
global.STARTUP_API_CALLS = 0;
global.MAX_STARTUP_API_CALLS = 5;

// Disable startup mode after 10 minutes
setTimeout(() => {
  global.STARTUP_MODE = false;
  console.log('⚡ Startup conservation mode disabled - full functionality restored');
}, 600000);

// Emergency API call throttler
global.throttleStartupAPI = function(apiName) {
  if (!global.STARTUP_MODE) return true;
  
  global.STARTUP_API_CALLS++;
  if (global.STARTUP_API_CALLS > global.MAX_STARTUP_API_CALLS) {
    console.log(`🚨 STARTUP THROTTLE: Blocking ${apiName} call (${global.STARTUP_API_CALLS}/${global.MAX_STARTUP_API_CALLS})`);
    return false;
  }
  
  console.log(`⚡ STARTUP ALLOW: ${apiName} call (${global.STARTUP_API_CALLS}/${global.MAX_STARTUP_API_CALLS})`);
  return true;
};

// 🚨 CRITICAL EMERGENCY STARTUP THROTTLING
console.log('🚨 CRITICAL: Maximum startup throttling activated');
console.log('⏱️ Delaying all operations for 2 minutes to prevent rate limits');

// More aggressive global flags
global.EMERGENCY_STARTUP_MODE = true;
global.STARTUP_API_CALLS = 0;
global.MAX_STARTUP_API_CALLS = 3; // Reduced from 5 to 3
global.STARTUP_DELAY_MINUTES = 2;

// Disable startup mode after 15 minutes (increased from 10)
setTimeout(() => {
  global.EMERGENCY_STARTUP_MODE = false;
  global.STARTUP_MODE = false;
  console.log('⚡ Emergency startup throttling disabled - full functionality restored');
}, 15 * 60 * 1000);

// More aggressive API call throttler
global.throttleStartupAPI = function(apiName: string) {
  if (!global.EMERGENCY_STARTUP_MODE && !global.STARTUP_MODE) return true;
  
  global.STARTUP_API_CALLS++;
  if (global.STARTUP_API_CALLS > global.MAX_STARTUP_API_CALLS) {
    console.log(`🚨 EMERGENCY THROTTLE: Blocking ${apiName} call (${global.STARTUP_API_CALLS}/${global.MAX_STARTUP_API_CALLS})`);
    return false;
  }
  
  console.log(`⚡ EMERGENCY ALLOW: ${apiName} call (${global.STARTUP_API_CALLS}/${global.MAX_STARTUP_API_CALLS})`);
  return true;
};

// Add startup delay for non-critical operations
global.startupDelay = function(operation: string, delay: number = 2000) {
  return new Promise(resolve => {
    console.log(`⏳ STARTUP DELAY: ${operation} delayed by ${delay/1000}s`);
    setTimeout(resolve, delay);
  });
};



// Load environment variables
dotenv.config();

// Health check endpoint for Render
const server = http.createServer((req, res) => {
  if (req.url === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'healthy', 
      timestamp: new Date().toISOString(),
      service: 'snap2health-xbot',
      ghost_killer_active: process.env.GHOST_ACCOUNT_SYNDROME_FIX === 'true',
      aggressive_mode: process.env.AGGRESSIVE_ENGAGEMENT_MODE === 'true'
    }));
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

// Start health check server with better error handling
const PORT = parseInt(process.env.PORT || '3000', 10);

// Add retry logic for port binding
function startServer(port: number, retries = 3): Promise<void> {
  return new Promise((resolve, reject) => {
    const tryStart = (currentPort: number, attemptsLeft: number) => {
      const currentServer = server.listen(currentPort, () => {
        console.log(`🔍 Health check server running on port ${currentPort}`);
        resolve();
      });

      currentServer.on('error', (error: any) => {
        if (error.code === 'EADDRINUSE' && attemptsLeft > 0) {
          console.log(`⚠️ Port ${currentPort} in use, trying ${currentPort + 1}...`);
          setTimeout(() => tryStart(currentPort + 1, attemptsLeft - 1), 1000);
        } else {
          console.error(`❌ Server error on port ${currentPort}:`, error);
          reject(error);
        }
      });
    };

    tryStart(port, retries);
  });
}

console.log('🤖 Starting Supreme AI Bot with Dynamic Posting Control...');
console.log('👑 All posting decisions made by AI - no hardcoded limits!');

async function main() {
  try {
    // Initialize the Supreme AI Dynamic Controller
    const dynamicController = new DynamicPostingController();
    
    console.log('🧠 === SUPREME AI DYNAMIC POSTING SYSTEM ===');
    console.log('👑 AI has full authority over posting decisions');
    console.log('📊 Dynamic response to breaking news and opportunities');
    console.log('🚀 Starting intelligent posting cycle...');
    
    // Set up the Supreme AI decision cycle - every 30 minutes
    cron.schedule('*/30 * * * *', async () => {
      console.log('\n🧠 === SUPREME AI DECISION CYCLE ===');
      console.log('👑 AI analyzing world state and making posting decisions...');
      
      try {
        // Let AI make the decision
        const decision = await dynamicController.makePostingDecision();
        
        console.log('🎯 SUPREME AI DECISION MADE:');
        console.log(`   📝 Should post: ${decision.shouldPost}`);
        console.log(`   🔢 Post count: ${decision.postCount}`);
        console.log(`   ⚡ Urgency: ${(decision.urgency * 100).toFixed(0)}%`);
        console.log(`   🧠 Strategy: ${decision.strategy}`);
        console.log(`   💭 Reasoning: ${decision.reasoning}`);
        
        if (decision.shouldPost && decision.postCount > 0) {
          console.log('🚀 EXECUTING SUPREME AI DECISION...');
          
          const result = await dynamicController.executeSupremeDecision(decision);
          
          if (result.success && result.executedPosts > 0) {
            console.log(`✅ Supreme AI executed ${result.executedPosts} posts successfully!`);
          } else if (result.success && result.executedPosts === 0) {
            console.log('🤔 Supreme AI decided to wait for better opportunity');
          } else {
            console.log('❌ Supreme AI execution encountered issues');
          }
        } else {
          console.log('🤔 Supreme AI decided not to post right now');
          console.log(`   ⏰ Will check again in ${decision.timeSpacing} minutes`);
        }
        
      } catch (error) {
        console.error('❌ Supreme AI decision cycle failed:', error);
      }
      
    }, { scheduled: true });

    // Also start the traditional scheduler for engagement activities
    console.log('🔄 Starting traditional scheduler for engagement activities...');
    const scheduler = new Scheduler();
    await scheduler.start();
    
    // Keep the process alive
    console.log('✅ Supreme AI Bot is now running!');
    console.log('👑 AI has full control over posting frequency and timing');
    console.log('📡 Monitoring world events for dynamic response...');
    console.log('🚀 Ready to post 1-15 times per day based on AI decisions!');
    
    // Graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n🛑 Shutting down Supreme AI Bot gracefully...');
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      console.log('\n🛑 Shutting down Supreme AI Bot gracefully...');
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Failed to start Supreme AI Bot:', error);
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

main().catch(console.error);

// Run the application
if (require.main === module) {
  main();
} 