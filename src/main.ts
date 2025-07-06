// Force early .env loading before any other imports
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { Scheduler } from './agents/scheduler';
import { DynamicPostingController } from './utils/dynamicPostingController';
import { bulletproofManager } from './utils/bulletproofOperationManager';
import { metricsExporter } from './metrics/exporter';
import { ensureRuntimeConfig } from './utils/supabaseConfig';
import * as cron from 'node-cron';
import http from 'http';

// 🚀 NUCLEAR MODE: Remove all artificial throttling
console.log('🚀 NUCLEAR INTELLIGENCE MODE: Unleashing the full bot potential');
console.log('🛡️ BULLETPROOF OPERATION: System NEVER stops working');
console.log('🛡️ SAFETY: Maximum 3 posts per hour to prevent insanity');
console.log('🧠 AI INTELLIGENCE: All advanced features ENABLED');

// Remove all artificial startup throttling
// The bot is now free to work at its full potential within the 3/hour safety limit

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
    const systemHealth = await bulletproofManager.getSystemHealth();
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'healthy', 
      timestamp: new Date().toISOString(),
      service: 'snap2health-xbot',
      bulletproof_status: {
        is_healthy: systemHealth.is_healthy,
        hours_since_last_post: systemHealth.hours_since_last_post,
        confidence_level: systemHealth.confidence_level,
        in_panic_mode: systemHealth.in_panic_mode
      },
      ghost_killer_active: process.env.GHOST_ACCOUNT_SYNDROME_FIX === 'true',
      aggressive_mode: process.env.AGGRESSIVE_ENGAGEMENT_MODE === 'true',
      growth_loop_enabled: process.env.GROWTH_LOOP_ENABLED === 'true',
      node_env: process.env.NODE_ENV || 'development'
    }));
  } else if (req.url === '/metrics' && req.method === 'GET') {
    // Prometheus metrics endpoint
    await metricsExporter.handleMetricsRequest(req as any, res as any);
  } else if (req.url === '/dashboard' && req.method === 'GET') {
    const systemHealth = await bulletproofManager.getSystemHealth();
    
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
        .healthy { color: #4CAF50; }
        .warning { color: #ff9800; }
        .critical { color: #f44336; }
    </style>
</head>
<body>
    <div class="header">🛡️ Bulletproof X-Bot Dashboard</div>
    <div class="metric">
        <div class="label">System Health</div>
        <div class="value ${systemHealth.is_healthy ? 'healthy' : 'critical'}">
          ${systemHealth.is_healthy ? '🟢 HEALTHY' : '🔴 NEEDS ATTENTION'}
        </div>
    </div>
    <div class="metric">
        <div class="label">Hours Since Last Post</div>
        <div class="value ${systemHealth.hours_since_last_post < 2 ? 'healthy' : systemHealth.hours_since_last_post < 6 ? 'warning' : 'critical'}">
          ${systemHealth.hours_since_last_post.toFixed(1)}h
        </div>
    </div>
    <div class="metric">
        <div class="label">Confidence Level</div>
        <div class="value ${systemHealth.confidence_level > 80 ? 'healthy' : systemHealth.confidence_level > 50 ? 'warning' : 'critical'}">
          ${systemHealth.confidence_level}%
        </div>
    </div>
    <div class="metric">
        <div class="label">Panic Mode</div>
        <div class="value ${systemHealth.in_panic_mode ? 'critical' : 'healthy'}">
          ${systemHealth.in_panic_mode ? '😱 ACTIVE' : '✅ NORMAL'}
        </div>
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
  } else if (req.url === '/force-post' && req.method === 'GET') {
    // Emergency force post endpoint
    try {
      const result = await bulletproofManager.forcePost();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        success: result,
        message: result ? 'Emergency post successful' : 'Emergency post failed',
        timestamp: new Date().toISOString()
      }));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        success: false, 
        error: error.message,
        timestamp: new Date().toISOString()
      }));
    }
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
        console.log(`🛡️ Bulletproof status: /health`);
        console.log(`📊 Dashboard: /dashboard`);
        console.log(`🚨 Emergency post: /force-post`);
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

console.log('🛡️ Starting Bulletproof AI Bot with Guaranteed Operation...');
console.log('👑 All posting decisions made by AI - no hardcoded limits!');
console.log('🚨 GUARANTEE: Bot will NEVER stop working due to API limit confusion!');

async function main() {
  try {
    // Initialize runtime configuration from Supabase first
    console.log('⚙️ Initializing runtime configuration...');
    await ensureRuntimeConfig();
    
    // 🛡️ START BULLETPROOF MONITORING FIRST
    console.log('🛡️ Activating bulletproof operation monitoring...');
    await bulletproofManager.startContinuousMonitoring();
    
    // Initialize the Supreme AI Dynamic Controller
    const dynamicController = new DynamicPostingController();
    
    console.log('🧠 === SUPREME AI DYNAMIC POSTING SYSTEM ===');
    console.log('👑 AI has full authority over posting decisions');
    console.log('🛡️ BULLETPROOF: System guaranteed to never stop working');
    console.log('📊 Dynamic response to breaking news and opportunities');
    console.log('🚀 Starting intelligent posting cycle...');
    
    // Set up the Supreme AI decision cycle - every 30 minutes
    cron.schedule('*/30 * * * *', async () => {
      console.log('\n🧠 === SUPREME AI DECISION CYCLE ===');
      console.log('👑 AI analyzing world state and making posting decisions...');
      
      try {
        // 🛡️ BULLETPROOF CHECK: Ensure system is healthy
        const isHealthy = await bulletproofManager.isSystemHealthy();
        if (!isHealthy) {
          console.log('🛡️ BULLETPROOF: System unhealthy, forcing recovery post...');
          const recovered = await bulletproofManager.forcePost();
          if (recovered) {
            console.log('✅ BULLETPROOF: Recovery successful, continuing with normal operation');
          } else {
            console.log('🚨 BULLETPROOF: Recovery failed, logging for intervention');
          }
        }
        
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
          
          // 🛡️ BULLETPROOF EXECUTION: Use guaranteed posting if needed
          try {
            const result = await dynamicController.executeSupremeDecision(decision);
            
            if (result.success && result.executedPosts > 0) {
              console.log(`✅ Supreme AI executed ${result.executedPosts} posts successfully!`);
            } else if (result.success && result.executedPosts === 0) {
              console.log('🤔 Supreme AI decided to wait for better opportunity');
            } else {
              console.log('🛡️ BULLETPROOF: Normal execution failed, using guaranteed posting...');
              const guaranteed = await bulletproofManager.guaranteedPost();
              if (guaranteed.success) {
                console.log(`✅ BULLETPROOF: Guaranteed posting successful via ${guaranteed.method_used}`);
              } else {
                console.log('🚨 BULLETPROOF: Even guaranteed posting failed - critical issue');
              }
            }
          } catch (executionError) {
            console.log('🛡️ BULLETPROOF: Execution error, using guaranteed posting...');
            const guaranteed = await bulletproofManager.guaranteedPost();
            if (guaranteed.success) {
              console.log(`✅ BULLETPROOF: Recovered via ${guaranteed.method_used}`);
            }
          }
        } else {
          console.log('🤔 Supreme AI decided not to post right now');
          console.log(`   ⏰ Will check again in ${decision.timeSpacing} minutes`);
        }
        
      } catch (error) {
        console.error('❌ Supreme AI decision cycle failed:', error);
        console.log('🛡️ BULLETPROOF: Decision cycle error, attempting emergency post...');
        
        // Emergency posting when everything fails
        const emergency = await bulletproofManager.guaranteedPost();
        if (emergency.success) {
          console.log(`✅ BULLETPROOF: Emergency posting successful via ${emergency.method_used}`);
        } else {
          console.log('🚨 BULLETPROOF: Even emergency posting failed - system needs intervention');
        }
      }
      
    }, { scheduled: true });

    // 🛡️ BULLETPROOF RECOVERY CYCLE - Every 2 hours
    cron.schedule('0 */2 * * *', async () => {
      console.log('\n🛡️ === BULLETPROOF RECOVERY CHECK ===');
      
      const systemHealth = await bulletproofManager.getSystemHealth();
      console.log(`🔍 System health: ${systemHealth.is_healthy ? 'HEALTHY' : 'UNHEALTHY'}`);
      console.log(`⏰ Hours since last post: ${systemHealth.hours_since_last_post.toFixed(1)}`);
      console.log(`💪 Confidence level: ${systemHealth.confidence_level}%`);
      
      if (!systemHealth.is_healthy || systemHealth.hours_since_last_post > 3) {
        console.log('🚨 BULLETPROOF: Triggering recovery posting...');
        const recovery = await bulletproofManager.guaranteedPost();
        
        if (recovery.success) {
          console.log(`✅ BULLETPROOF: Recovery successful via ${recovery.method_used}`);
          console.log(`📝 Posted: ${recovery.posted_content.substring(0, 50)}...`);
        } else {
          console.log('🚨 BULLETPROOF: Recovery failed - needs manual intervention');
        }
      } else {
        console.log('✅ BULLETPROOF: System healthy, no recovery needed');
      }
    }, { scheduled: true });

    // Also start the traditional scheduler for engagement activities
    console.log('🔄 Starting traditional scheduler for engagement activities...');
    const scheduler = new Scheduler();
    await scheduler.start();
    
    // Keep the process alive
    console.log('✅ Bulletproof AI Bot is now running!');
    console.log('👑 AI has full control over posting frequency and timing');
    console.log('🛡️ GUARANTEED: System will NEVER stop working due to API issues');
    console.log('📡 Monitoring world events for dynamic response...');
    console.log('🚀 Ready to post up to 17 times per day (Twitter Free Tier limit)!');
    
    // 🛡️ BULLETPROOF PANIC MODE - Every hour check for critical issues
    cron.schedule('0 * * * *', async () => {
      const timeSinceLastPost = await bulletproofManager.getSystemHealth();
      
      if (timeSinceLastPost.hours_since_last_post > 6) {
        console.log('😱 PANIC MODE: No posts for 6+ hours - emergency intervention');
        const panic = await bulletproofManager.guaranteedPost();
        
        if (panic.success) {
          console.log('✅ PANIC MODE: Successfully recovered system');
        } else {
          console.log('🚨 PANIC MODE: Even panic mode failed - CRITICAL ALERT');
        }
      }
    }, { scheduled: true });
    
    // Graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n🛑 Shutting down Bulletproof AI Bot gracefully...');
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      console.log('\n🛑 Shutting down Bulletproof AI Bot gracefully...');
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Failed to start Bulletproof AI Bot:', error);
    
    // 🛡️ BULLETPROOF: Even if startup fails, try to post
    console.log('🛡️ BULLETPROOF: Startup failed, attempting emergency posting...');
    try {
      const emergency = await bulletproofManager.guaranteedPost('System startup encountered issues but bot is still operational. Monitoring for resolution.');
      if (emergency.success) {
        console.log('✅ BULLETPROOF: Emergency startup post successful');
      }
    } catch (emergencyError) {
      console.error('🚨 BULLETPROOF: Even emergency posting failed during startup');
    }
    
    process.exit(1);
  }
}

// Start the health check server first
startServer(PORT)
  .then(() => {
    // Then start the main application
    return main();
  })
  .catch((error) => {
    console.error('❌ Failed to start server or application:', error);
    process.exit(1);
  });

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run the application
if (require.main === module) {
  main();
} 