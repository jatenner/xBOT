#!/usr/bin/env node

import express from 'express';
import cors from 'cors';
import { bulletproofManager } from './utils/bulletproofOperationManager';
import { autonomousIntelligenceCore } from './agents/autonomousIntelligenceCore';
import { DynamicPostingController } from './utils/dynamicPostingController';
import { ensureRuntimeConfig } from './utils/supabaseConfig';

// EMERGENCY IMPORTS
import { startServerSingleton, getServerInstance, closeServer } from './utils/serverSingleton';
import { isEmergencyMode, EMERGENCY_BOT_CONFIG } from './config/emergencyConfig';
import { emergencyLearningLimiter } from './utils/emergencyLearningLimiter';

// Create Express app
const app = express();

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    // 🚨 EMERGENCY MODE CHECK
    if (isEmergencyMode()) {
      res.json({
        status: 'EMERGENCY_MODE',
        timestamp: new Date().toISOString(),
        emergency_mode: true,
        learning_disabled: true,
        cost_protection: true,
        message: 'Bot running in emergency mode with cost protection'
      });
      return;
    }

    const health = await bulletproofManager.getSystemHealth();
    res.json({
      status: health.is_healthy ? 'healthy' : 'degraded',
      ...health,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Dashboard endpoint
app.get('/dashboard', (req, res) => {
  res.send(`
    <h1>🧠 Bot Intelligence Dashboard</h1>
    <p><strong>Emergency Mode:</strong> ${isEmergencyMode() ? 'ACTIVE' : 'INACTIVE'}</p>
    <p><strong>Cost Protection:</strong> ${process.env.EMERGENCY_COST_MODE === 'true' ? 'ENABLED' : 'DISABLED'}</p>
    <p><strong>Learning:</strong> ${process.env.DISABLE_LEARNING_AGENTS === 'true' ? 'DISABLED' : 'ENABLED'}</p>
    <p><a href="/health">Health Check</a></p>
    <p><a href="/force-post">Emergency Post</a></p>
  `);
});

// Emergency post endpoint
app.post('/force-post', async (req, res) => {
  try {
    console.log('🚨 Emergency post triggered via API');
    const result = await bulletproofManager.guaranteedPost();
    res.json({
      success: true,
      result,
      emergency_mode: isEmergencyMode(),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Catch-all for other routes
app.use((req, res) => {
  if (req.url === '/') {
    res.json({
      status: 'Bot is running',
      emergency_mode: isEmergencyMode(),
      endpoints: ['/health', '/dashboard', '/force-post'],
      timestamp: new Date().toISOString()
    });
  } else {
    res.status(404).json({
      error: 'Not Found',
      emergency_mode: isEmergencyMode(),
      timestamp: new Date().toISOString()
    });
  }
});

// 🚨 EMERGENCY SERVER STARTUP - SINGLETON ONLY
const PORT = parseInt(process.env.PORT || '3000', 10);

console.log('🛡️ Starting Bulletproof AI Bot with Guaranteed Operation...');
console.log('👑 All posting decisions made by AI - no hardcoded limits!');
console.log('🚨 GUARANTEE: Bot will NEVER stop working due to API limit confusion!');

// 🚨 EMERGENCY MODE CHECK
if (isEmergencyMode()) {
  console.log('🚨 ==========================================');
  console.log('🚨 EMERGENCY MODE ACTIVATED');
  console.log('🚨 ==========================================');
  console.log('💰 Cost protection: ENABLED');
  console.log('🧠 Learning loops: DISABLED');
  console.log('🔒 Server singleton: ENABLED');
  console.log('⚡ Simple mode: ENABLED');
  console.log('🚨 ==========================================');
}

/**
 * 🧠 SUPREME AI SYSTEM WITH AUTONOMOUS INTELLIGENCE (EMERGENCY SAFE)
 */
async function runSupremeAISystem() {
  console.log('🚀 === SUPREME AI SYSTEM STARTING ===');
  
  // 🚨 EMERGENCY MODE OVERRIDES
  if (isEmergencyMode()) {
    console.log('🚨 EMERGENCY MODE: Simplified operation only');
    console.log('🛡️ Basic posting enabled, advanced features disabled');
    console.log('');
    
    // Simple emergency posting loop with heavy rate limiting
    while (true) {
      try {
        console.log('🚨 Emergency cycle starting...');
        
        // Very conservative posting with long intervals
        const result = await bulletproofManager.guaranteedPost();
        
        if (result.success) {
          console.log(`✅ Emergency post successful: ${result.posted_content?.substring(0, 100)}...`);
        } else {
          console.log(`❌ Emergency post failed: ${result.warnings.join(', ')}`);
        }
        
        // Long sleep in emergency mode (2 hours)
        console.log('😴 Emergency mode: Sleeping for 2 hours...');
        await new Promise(resolve => setTimeout(resolve, 2 * 60 * 60 * 1000));
        
      } catch (error) {
        console.error('❌ Emergency cycle error:', error);
        await new Promise(resolve => setTimeout(resolve, 30 * 60 * 1000)); // 30 min on error
      }
    }
  }

  // Normal operation (only if not in emergency mode)
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
      // 🚨 LEARNING RATE LIMIT CHECK
      if (!emergencyLearningLimiter.canPerformLearning()) {
        console.log('🚨 Learning rate limit reached, skipping AI decision cycle');
        await new Promise(resolve => setTimeout(resolve, 60 * 60 * 1000)); // 1 hour
        continue;
      }

      console.log('🧠 === AUTONOMOUS AI DECISION CYCLE ===');
      
      // Record learning call
      emergencyLearningLimiter.recordLearningCall();
      
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
        
      } else {
        console.log('⏳ AI DECISION: Waiting for optimal conditions...');
      }
      
      // 3. Bulletproof health monitoring (every cycle)
      const healthStatus = await bulletproofManager.getSystemHealth();
      console.log(`🛡️ System Health: ${healthStatus.is_healthy ? 'HEALTHY' : 'NEEDS ATTENTION'}`);
      
      // 4. Sleep with intelligent timing (EMERGENCY EXTENDED)
      const sleepDuration = emergencyLearningLimiter.isEmergencyMode() ? 
        60 * 60 * 1000 : // 1 hour in emergency mode
        consciousnessLevel > 50 ? 
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
    
    // 🚨 EMERGENCY: Use singleton server to prevent conflicts
    console.log('🔧 Starting server with singleton pattern...');
    await startServerSingleton(app, PORT);
    
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

// 🚨 SINGLE ENTRY POINT - NO DUPLICATE SERVER STARTS
main().catch((error) => {
  console.error('❌ Failed to start application:', error);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught exception:', error);
  closeServer(); // Clean shutdown
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled rejection at:', promise, 'reason:', reason);
  closeServer(); // Clean shutdown
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully...');
  closeServer();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully...');
  closeServer();
  process.exit(0);
}); 