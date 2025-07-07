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
import { autonomousIntelligenceCore } from './agents/autonomousIntelligenceCore';

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

/**
 * 🧠 SUPREME AI SYSTEM WITH AUTONOMOUS INTELLIGENCE
 * 
 * This is the main orchestrator that combines all intelligence systems
 * for autonomous decision-making and continuous learning.
 */
async function runSupremeAISystem() {
  console.log('🚀 === SUPREME AI SYSTEM STARTING ===');
  console.log('🧠 Autonomous Intelligence: ENABLED');
  console.log('🛡️ Bulletproof Operation: ENABLED');
  console.log('📊 Dynamic Posting: ENABLED');
  console.log('');

  // Get current consciousness level
  const consciousnessLevel = autonomousIntelligenceCore.getConsciousnessLevel();
  console.log(`🧠 Current Consciousness Level: ${consciousnessLevel.toFixed(1)}/100`);
  
  // Get knowledge summary
  const knowledge = autonomousIntelligenceCore.getKnowledgeSummary();
  console.log(`📚 Knowledge Base: ${knowledge.size} insight sets`);
  
  if (knowledge.latestInsights.length > 0) {
    console.log('🔍 Latest Insights:');
    knowledge.latestInsights.slice(0, 3).forEach((insight, i) => {
      console.log(`   ${i+1}. ${insight.substring(0, 100)}...`);
    });
  }
  console.log('');

  while (true) {
    try {
      console.log('🧠 === AUTONOMOUS AI DECISION CYCLE ===');
      
      // 1. Let the autonomous intelligence make the primary decision
      const aiDecision = await autonomousIntelligenceCore.makeAutonomousDecision(
        'Should we post content now based on current conditions?',
        ['post_now', 'wait_for_better_timing', 'analyze_more_data', 'emergency_post']
      );
      
      console.log(`🧠 AI DECISION: ${aiDecision.decision}`);
      console.log(`💭 AI REASONING: ${aiDecision.reasoning}`);
      
      // 2. Enhanced decision making based on AI choice
      if (aiDecision.decision.includes('post') || aiDecision.decision === 'emergency_post') {
        
        // Use dynamic posting controller for intelligent posting decisions
        const dynamicController = new DynamicPostingController();
        const postingDecision = await dynamicController.shouldPost();
        
        if (postingDecision.shouldPost) {
          console.log(`🎯 POSTING APPROVED: ${postingDecision.reason}`);
          console.log(`📊 STRATEGY: ${postingDecision.strategy}`);
          
          // Execute bulletproof posting
          const result = await bulletproofManager.guaranteedPost();
          
          if (result.success) {
            console.log(`✅ POST SUCCESSFUL: ${result.method_used} - ${result.posted_content?.substring(0, 100)}...`);
          } else {
            console.log(`❌ POST FAILED: ${result.warnings.join(', ')}`);
          }
          
        } else {
          console.log(`⏳ POSTING DELAYED: ${postingDecision.reason}`);
        }
        
      } else if (aiDecision.decision === 'analyze_more_data') {
        console.log('🔍 AI DECISION: Gathering more intelligence before posting...');
        
        // Trigger additional analysis cycle
        // This could involve checking trends, engagement patterns, etc.
        
      } else {
        console.log('⏳ AI DECISION: Waiting for optimal conditions...');
      }
      
      // 3. Bulletproof health monitoring (every cycle)
      const healthStatus = await bulletproofManager.getSystemHealth();
      console.log(`🛡️ System Health: ${healthStatus.is_healthy ? 'HEALTHY' : 'NEEDS ATTENTION'}`);
      
      // 4. Sleep with intelligent timing
      const sleepDuration = consciousnessLevel > 50 ? 
        15 * 60 * 1000 : // 15 minutes for high consciousness
        30 * 60 * 1000;  // 30 minutes for lower consciousness
      
      console.log(`😴 Sleeping for ${sleepDuration / 60000} minutes (consciousness-adjusted)...`);
      console.log('');
      
      await new Promise(resolve => setTimeout(resolve, sleepDuration));
      
    } catch (error) {
      console.error('❌ Supreme AI System error:', error);
      
      // Emergency fallback
      console.log('🚨 EMERGENCY FALLBACK: Activating bulletproof posting...');
      await bulletproofManager.guaranteedPost();
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, 5 * 60 * 1000));
    }
  }
}

async function main() {
  try {
    // Ensure runtime configuration is set up
    await ensureRuntimeConfig();
    
    // Start the health check server
    await startServer(PORT);
    
    // Start bulletproof continuous monitoring
    await bulletproofManager.startContinuousMonitoring();
    console.log('🛡️ Bulletproof continuous monitoring started');
    
    // Start the Supreme AI System with Autonomous Intelligence
    console.log('🚀 Starting Supreme AI System with Autonomous Intelligence...');
    await runSupremeAISystem();
    
  } catch (error) {
    console.error('❌ Fatal error in main:', error);
    
    // Emergency fallback - keep the system running
    console.log('🚨 EMERGENCY MODE: Keeping system alive...');
    setInterval(async () => {
      try {
        await bulletproofManager.guaranteedPost();
      } catch (fallbackError) {
        console.error('❌ Emergency fallback error:', fallbackError);
      }
    }, 60 * 60 * 1000); // Every hour
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