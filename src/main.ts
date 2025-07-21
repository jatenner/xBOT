#!/usr/bin/env node

import express from 'express';
import cors from 'cors';
import { legendaryAICoordinator } from './utils/legendaryAICoordinator';
import { bulletproofManager } from './utils/bulletproofOperationManager';
import { autonomousIntelligenceCore } from './agents/autonomousIntelligenceCore';
import { ensureRuntimeConfig } from './utils/supabaseConfig';
import { Scheduler } from './agents/scheduler';
import { emergencyBudgetLockdown } from './utils/emergencyBudgetLockdown';
import { systemMonitor } from './utils/systemMonitor';
import { circuitBreakerManager } from './utils/circuitBreaker';
import { CacheManager } from './utils/intelligentCache';

// ADDICTION VIRAL SYSTEM IMPORTS
import { addictionViralEngine } from './agents/addictionViralEngine';
import { addictionIntegrationAgent } from './agents/addictionIntegrationAgent';
import { viralThemeEngine } from './agents/viralThemeEngine';

// EMERGENCY IMPORTS
import { startServerSingleton, getServerInstance, closeServer } from './utils/serverSingleton';
import { isEmergencyMode, EMERGENCY_BOT_CONFIG } from './config/emergencyConfig';
import { emergencyLearningLimiter } from './utils/emergencyLearningLimiter';

// Create Express app
const app = express();

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

// Emergency budget status endpoint
app.get('/budget-status', async (req, res) => {
  try {
    const budgetStatus = await emergencyBudgetLockdown.getStatusReport();
    const lockdownStatus = await emergencyBudgetLockdown.isLockedDown();
    
    res.json({
      status: lockdownStatus.lockdownActive ? 'LOCKDOWN_ACTIVE' : 'OPERATIONAL',
      budget_report: budgetStatus,
      lockdown_details: lockdownStatus,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Addiction system status endpoint
app.get('/addiction-status', async (req, res) => {
  try {
    const addictionStatus = await addictionIntegrationAgent.getStatus();
    const viralEngine = await addictionViralEngine.getDynamicPostingFrequency();
    const currentTheme = viralThemeEngine.getCurrentTheme();
    const dailyPlan = viralThemeEngine.getDailyPlan();
    const themePerformance = await viralThemeEngine.getThemePerformance();
    
    res.json({
      addiction_system: {
        active: addictionStatus.active,
        next_posting: addictionStatus.nextPosting,
        today_target: addictionStatus.todayTarget,
        momentum_detected: addictionStatus.momentumDetected,
        dynamic_frequency: viralEngine
      },
      viral_themes: {
        current_theme: currentTheme?.name || 'Not set',
        daily_plan_posts: dailyPlan.length,
        themes_today: [...new Set(dailyPlan.map(p => p.theme))],
        theme_performance: themePerformance
      },
      content_strategy: {
        viral_hooks: '70%',
        controversial: '30%', 
        academic: '5%',
        themes_active: viralThemeEngine.getCurrentTheme() !== null
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    // 🔥 ADDICTION SYSTEM CHECK FIRST
    const addictionStatus = await addictionIntegrationAgent.getStatus();
    
    if (addictionStatus.active) {
      res.json({
        status: '🔥 ADDICTION VIRAL MODE ACTIVE',
        addiction_system: addictionStatus,
        emergency_mode: false, // Overridden by addiction system
        posting_frequency: `${addictionStatus.todayTarget} posts/day (dynamic)`,
        content_strategy: '70% viral hooks, 30% controversial, 5% academic',
        learning_active: true,
        system_mode: 'VIRAL_OPTIMIZATION',
        timestamp: new Date().toISOString()
      });
      return;
    }
    
    // 🚨 EMERGENCY MODE CHECK (fallback)
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
    const legendaryStatus = legendaryAICoordinator.getSystemStatus();
    
    res.json({
      status: health.is_healthy ? 'healthy' : 'degraded',
      ...health,
      legendary_ai: legendaryStatus,
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
  const legendaryStatus = legendaryAICoordinator.getSystemStatus();
  
  res.send(`
    <h1>🏆 Legendary AI Coordination System Dashboard</h1>
    <p><strong>Emergency Mode:</strong> ${isEmergencyMode() ? 'ACTIVE' : 'INACTIVE'}</p>
    <p><strong>Legendary AI:</strong> ${legendaryStatus.isRunning ? 'ACTIVE' : 'INACTIVE'}</p>
    <p><strong>Posts Today:</strong> ${legendaryStatus.coordinationState.postsToday}/6</p>
    <p><strong>Budget Remaining:</strong> $${legendaryStatus.coordinationState.budgetRemaining?.toFixed(2) || '0.00'}</p>
    <p><strong>Burst Protection:</strong> ${legendaryStatus.coordinationState.burstProtectionActive ? 'ACTIVE' : 'INACTIVE'}</p>
    <p><strong>Active AI Agent:</strong> ${legendaryStatus.coordinationState.activeAIAgent || 'None'}</p>
    <p><strong>Current Strategy:</strong> ${legendaryStatus.coordinationState.currentStrategy || 'None'}</p>
    <hr>
    <h3>🧠 AI Agents Status</h3>
    <ul>
      <li>Supreme AI Orchestrator: ${legendaryStatus.aiAgents.supremeOrchestrator}</li>
      <li>Intelligent Decision Agent: ${legendaryStatus.aiAgents.intelligentDecisionAgent}</li>
      <li>Strategic Scheduler: ${legendaryStatus.aiAgents.strategicScheduler}</li>
      <li>Timing Agent: ${legendaryStatus.aiAgents.timingAgent}</li>
      <li>Limits Agent: ${legendaryStatus.aiAgents.limitsAgent}</li>
      <li>Autonomous Core: ${legendaryStatus.aiAgents.autonomousCore}</li>
    </ul>
    <hr>
    <p><a href="/health">Health Check</a></p>
    <p><a href="/force-post">Manual Post</a></p>
  `);
});

// Manual post endpoint with addiction system
app.post('/force-post', async (req, res) => {
  try {
    console.log('🔧 Manual post triggered via API');
    
    // Check if addiction system should handle this
    const addictionStatus = await addictionIntegrationAgent.getStatus();
    if (addictionStatus.active) {
      const shouldPost = await addictionIntegrationAgent.shouldPostNow();
      if (shouldPost) {
        const addictiveContent = await addictionIntegrationAgent.generateContent();
        console.log('🔥 Addiction system generating viral content');
        
        res.json({
          success: true,
          system: 'ADDICTION_VIRAL',
          content_preview: addictiveContent.substring(0, 100) + '...',
          addiction_status: addictionStatus,
          timestamp: new Date().toISOString()
        });
        return;
      }
    }
    
    // Fallback to original system
    const result = await legendaryAICoordinator.manualPost('API trigger');
    res.json({
      success: result.success,
      system: 'LEGACY',
      emergency_mode: isEmergencyMode(),
      result: result,
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

// Force addiction system activation endpoint
app.post('/activate-addiction', async (req, res) => {
  try {
    console.log('🔥 Force activating addiction viral system');
    await addictionIntegrationAgent.forceActivation();
    
    res.json({
      success: true,
      message: 'Addiction viral system force activated',
      status: await addictionIntegrationAgent.getStatus(),
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
    const legendaryStatus = legendaryAICoordinator.getSystemStatus();
    res.json({
      status: 'Legendary AI Coordination System running',
      legendary_ai_active: legendaryStatus.isRunning,
      burst_protection: true,
      ai_agents_count: 6,
      posts_today: legendaryStatus.coordinationState.postsToday,
      max_posts: legendaryStatus.burstProtection.maxPostsPerDay,
      endpoints: ['/health', '/dashboard', '/force-post'],
      timestamp: new Date().toISOString()
    });
  } else {
    res.status(404).json({
      error: 'Not Found',
      timestamp: new Date().toISOString()
    });
  }
});

// 🚨 EMERGENCY SERVER STARTUP - SINGLETON ONLY
const PORT = parseInt(process.env.PORT || '3000', 10);

console.log('🏆 Starting Legendary AI Coordination System...');
console.log('👑 SUPREME AI ORCHESTRATOR: Coordinating all decisions');
console.log('🧠 INTELLIGENT AGENTS: Strategic timing and content optimization');
console.log('🛡️ BURST PROTECTION: 2-hour minimum spacing, 6 posts maximum per day');
console.log('🎯 STRATEGIC OPPORTUNITIES: Real-time trend and news detection');
console.log('⏰ TIMING OPTIMIZATION: AI-powered optimal posting windows');
console.log('💰 BUDGET AWARENESS: Integrated cost management across all agents');
console.log('🚀 REAL-TIME LIMITS: Live API status monitoring');

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
 * 🏆 LEGENDARY AI COORDINATION SYSTEM
 * 
 * This system coordinates all your sophisticated AI agents:
 * - SupremeAIOrchestrator: Master strategic intelligence
 * - IntelligentPostingDecisionAgent: Smart timing decisions
 * - StrategicOpportunityScheduler: Trend and news detection
 * - TimingOptimizationAgent: Optimal posting windows
 * - RealTimeLimitsIntelligenceAgent: Live API monitoring
 * - AutonomousIntelligenceCore: Learning and adaptation
 * 
 * With legendary burst protection:
 * - 2-hour minimum spacing between posts
 * - Maximum 6 posts per day (professional limit)
 * - Budget awareness across all decisions
 * - Real-time burst pattern detection
 */
async function runLegendaryAISystem() {
  console.log('🔥 === ADDICTION VIRAL SYSTEM INITIALIZING ===');
  
  try {
    // 🔥 FIRST PRIORITY: Initialize Addiction System
    console.log('🔥 Addiction Viral Engine: INITIALIZING');
    console.log('🎯 Addiction Integration Agent: INITIALIZING');
    
    // Check and activate addiction system
    const addictionStatus = await addictionIntegrationAgent.getStatus();
    if (addictionStatus.active) {
      console.log('✅ ADDICTION VIRAL SYSTEM: ACTIVE');
      console.log(`📊 Dynamic posting: ${addictionStatus.todayTarget} posts/day`);
      console.log(`⚡ Momentum detected: ${addictionStatus.momentumDetected ? 'YES' : 'NO'}`);
      console.log(`🎪 Next posting: ${addictionStatus.nextPosting.toLocaleTimeString()}`);
      console.log('🎯 Content strategy: 70% viral hooks, 30% controversial, 5% academic');
      console.log('🧠 Learning system: Active (30min intervals)');
      console.log('🚨 Emergency modes: OVERRIDDEN');
    } else {
      console.log('⚠️ Addiction system inactive - activating...');
      await addictionIntegrationAgent.forceActivation();
      console.log('✅ ADDICTION VIRAL SYSTEM: FORCE ACTIVATED');
    }
    
    // Trigger learning update
    await addictionViralEngine.performLearningUpdate();
    console.log('🧠 Addiction learning system: UPDATED');
    
  } catch (addictionError) {
    console.error('❌ Addiction system initialization failed:', addictionError);
    console.log('⚠️ Falling back to legacy system');
  }
  
  console.log('\n🏆 === LEGACY AI COORDINATION SYSTEM (FALLBACK) ===');
  console.log('👑 Supreme AI Orchestrator: LOADING');
  console.log('🧠 Intelligent Decision Agent: LOADING');
  console.log('🎯 Strategic Opportunity Scheduler: LOADING');
  console.log('⏰ Timing Optimization Agent: LOADING');
  console.log('🚀 Real-Time Limits Intelligence: LOADING');
  console.log('🤖 Autonomous Intelligence Core: LOADING');
  console.log('🛡️ Legendary Burst Protection: ACTIVATING');
  
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

  // Start the Legendary AI Coordination System
  console.log('🏆 Initializing Legendary AI Coordination System...');
  console.log('👑 All AI agents will be coordinated under supreme intelligence');
  console.log('🛡️ Burst protection will prevent 16-tweet disasters');
  console.log('🎯 Strategic opportunities will be detected in real-time');
  console.log('⏰ Optimal timing will be calculated dynamically');
  console.log('💰 Budget management integrated across all decisions');
  console.log('');

  // Start the Legendary AI Coordinator
  try {
    await legendaryAICoordinator.start();
    console.log('✅ Legendary AI Coordination System started successfully');
  } catch (error) {
    console.error('❌ Failed to start Legendary AI Coordination System:', error);
    throw error;
  }
  
  // 🚨 DISABLED: Background scheduler (caused burst posting conflicts)
  console.log('🚨 BACKGROUND SCHEDULER: DISABLED');
  console.log('❌ REASON: Multiple cron jobs causing burst posting');  
  console.log('✅ REPLACEMENT: Master Posting Gate handles all scheduling');
  // try {
  //   const scheduler = new Scheduler();
  //   await scheduler.start();
  //   console.log('✅ Background AI scheduler started successfully');
  // } catch (error) {
  //   console.warn('⚠️ Background scheduler had issues:', error);
  // }
  console.log('');

  // Legendary monitoring loop - let the coordinator handle everything
  while (true) {
    try {
      console.log('🏆 === LEGENDARY AI SYSTEM HEALTH CHECK ===');
      
      // Check legendary coordinator status
      const coordinatorStatus = legendaryAICoordinator.getSystemStatus();
      console.log(`👑 Legendary AI: ${coordinatorStatus.isRunning ? 'ACTIVE' : 'INACTIVE'}`);
      console.log(`📊 Posts today: ${coordinatorStatus.coordinationState.postsToday}/6`);
      console.log(`💰 Budget remaining: $${coordinatorStatus.coordinationState.budgetRemaining?.toFixed(2) || '0.00'}`);
      console.log(`🛡️ Burst protection: ${coordinatorStatus.coordinationState.burstProtectionActive ? 'ACTIVE' : 'INACTIVE'}`);
      
      // Check bulletproof system health as backup
      const healthStatus = await bulletproofManager.getSystemHealth();
      console.log(`🛡️ Bulletproof backup: ${healthStatus.is_healthy ? 'HEALTHY' : 'NEEDS ATTENTION'}`);
      
      if (!coordinatorStatus.isRunning) {
        console.log('⚠️ Legendary coordinator is not running - restarting...');
        await legendaryAICoordinator.start();
      }
      
      // The legendary coordinator handles all AI decisions automatically
      // We just need to monitor and ensure it stays healthy
      
      console.log('😴 Legendary monitoring sleep for 30 minutes...');
      console.log('🏆 All AI agents continue coordinated operation in background');
      console.log('');
      
      await new Promise(resolve => setTimeout(resolve, 30 * 60 * 1000)); // 30 minutes
      
    } catch (error) {
      console.error('❌ Legendary monitoring loop error:', error);
      
      // Emergency fallback
      console.log('🚨 EMERGENCY FALLBACK: Activating bulletproof posting...');
      await bulletproofManager.guaranteedPost();
      
      // Try to restart legendary coordinator
      try {
        await legendaryAICoordinator.start();
      } catch (restartError) {
        console.error('❌ Could not restart legendary coordinator:', restartError);
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, 5 * 60 * 1000));
    }
  }
}

async function main() {
  console.log('🚀 === SNAP2HEALTH X-BOT MAIN STARTING ===');
  
  // 🚨 EMERGENCY BUDGET CHECK AT STARTUP
  console.log('💰 === CHECKING EMERGENCY BUDGET STATUS ===');
  try {
    const budgetStatus = await emergencyBudgetLockdown.getStatusReport();
    console.log(budgetStatus);
    
    const lockdownStatus = await emergencyBudgetLockdown.isLockedDown();
    if (lockdownStatus.lockdownActive) {
      console.error('🚨 CRITICAL: BUDGET LOCKDOWN ACTIVE - NO AI OPERATIONS WILL RUN');
      console.error('🚨 System will only provide basic health checks until tomorrow');
    } else {
      console.log('✅ Budget system operational - AI operations allowed');
    }
  } catch (error) {
    console.error('❌ Budget status check failed:', error);
  }
  console.log('');

  try {
    // Ensure runtime configuration is set up
    await ensureRuntimeConfig();
    
    // 🚀 Initialize improved system components
    console.log('🧠 Initializing system monitoring and optimization...');
    await CacheManager.initialize();
    await systemMonitor.startMonitoring(60000); // 1 minute intervals
    circuitBreakerManager.startMonitoring();
    console.log('✅ System monitoring and optimization initialized');
    
    // 🛡️ Initialize enhanced rate limit management
    console.log('🛡️ Initializing enhanced rate limit management...');
    const { rateLimitHandler } = await import('./utils/enhancedRateLimitHandler');
    const { smartPostingManager } = await import('./utils/smartPostingManager');
    
    // Log current rate limit status
    await rateLimitHandler.logStatus();
    console.log('✅ Enhanced rate limit management initialized');
    
    // 🚨 EMERGENCY: Use singleton server to prevent conflicts
    console.log('🔧 Starting server with singleton pattern...');
    await startServerSingleton(app, PORT);
    
    // Start bulletproof continuous monitoring as backup
    await bulletproofManager.startContinuousMonitoring();
    console.log('🛡️ Bulletproof continuous monitoring started as backup');
    
    // 🚨 CRITICAL FIX: Replace all conflicting systems with Master Posting Gate
    console.log('🚨 === REPLACING BROKEN SYSTEMS ===');
    console.log('❌ PROBLEM: Multiple systems causing 17+ burst posts');
    console.log('✅ SOLUTION: Single coordinated posting gate');
    console.log('');
    
    const { masterPostingGate } = await import('./utils/masterPostingGate');
    await masterPostingGate.start();
    
  } catch (error) {
    console.error('❌ Fatal error in main:', error);
    
    // Emergency fallback - keep the system running
    console.log('🚨 EMERGENCY MODE: Keeping system alive with bulletproof posting...');
    setInterval(async () => {
      try {
        await bulletproofManager.guaranteedPost();
      } catch (fallbackError) {
        console.error('❌ Emergency fallback error:', fallbackError);
      }
    }, 2 * 60 * 60 * 1000); // Every 2 hours - respecting burst protection
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
  legendaryAICoordinator.stop(); // Clean shutdown
  closeServer(); // Clean shutdown
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled rejection at:', promise, 'reason:', reason);
  legendaryAICoordinator.stop(); // Clean shutdown
  closeServer(); // Clean shutdown
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully...');
  legendaryAICoordinator.stop();
  closeServer();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully...');
  systemMonitor.stopMonitoring();
  CacheManager.shutdown();
  legendaryAICoordinator.stop();
  closeServer();
  process.exit(0);
}); 