// Force early .env loading before any other imports
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { Scheduler } from './agents/scheduler';
import { DynamicPostingController } from './utils/dynamicPostingController';
import { metricsExporter } from './metrics/exporter';
import { initializeRuntimeConfig } from './utils/supabaseConfig';
import * as cron from 'node-cron';
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

// Environment variables already loaded at top of file

// Health check endpoint for Render
const server = http.createServer(async (req, res) => {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.url === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'healthy', 
      timestamp: new Date().toISOString(),
      service: 'snap2health-xbot',
      ghost_killer_active: process.env.GHOST_ACCOUNT_SYNDROME_FIX === 'true',
      aggressive_mode: process.env.AGGRESSIVE_ENGAGEMENT_MODE === 'true',
      growth_loop_enabled: process.env.GROWTH_LOOP_ENABLED === 'true',
      node_env: process.env.NODE_ENV || 'development'
    }));
  } else if (req.url === '/metrics' && req.method === 'GET') {
    // Prometheus metrics endpoint
    await metricsExporter.handleMetricsRequest(req as any, res as any);
  } else if (req.url === '/dashboard' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
<!DOCTYPE html>
<html>
<head>
    <title>Snap2Health X-Bot Growth Dashboard</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; background: #1a1a1a; color: #fff; }
        .metric { background: #2d2d2d; padding: 20px; margin: 10px 0; border-radius: 8px; }
        .header { color: #4CAF50; font-size: 24px; margin-bottom: 20px; }
        .value { font-size: 32px; font-weight: bold; color: #2196F3; }
        .label { font-size: 14px; color: #aaa; }
    </style>
</head>
<body>
    <div class="header">🚀 Autonomous Growth Loop Dashboard</div>
    <div class="metric">
        <div class="label">System Status</div>
        <div class="value">🟢 ACTIVE</div>
    </div>
    <div class="metric">
        <div class="label">Growth Loop</div>
        <div class="value">${process.env.GROWTH_LOOP_ENABLED === 'true' ? '✅ ENABLED' : '❌ DISABLED'}</div>
    </div>
    <div class="metric">
        <div class="label">Environment</div>
        <div class="value">${process.env.NODE_ENV || 'development'}</div>
    </div>
    <div class="metric">
        <div class="label">Metrics Endpoint</div>
        <div class="value"><a href="/metrics" style="color: #2196F3;">/metrics</a></div>
    </div>
    <div class="metric">
        <div class="label">Last Updated</div>
        <div class="value">${new Date().toISOString()}</div>
    </div>
</body>
</html>
    `);
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
    // Initialize runtime configuration from Supabase first
    console.log('⚙️ Initializing runtime configuration...');
    await initializeRuntimeConfig();
    
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
    console.log('🚀 Ready to post 30-75 times per day based on AI decisions!');
    
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