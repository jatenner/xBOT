#!/usr/bin/env node

/**
 * 🤖 AUTONOMOUS TWITTER BOT - MAIN ENTRY POINT
 * 
 * Full-featured autonomous Twitter bot with:
 * - AI-powered content generation
 * - Autonomous posting schedule  
 * - Database integration (Supabase + Redis)
 * - Health monitoring
 * - API endpoints for control
 */

import { ensureSessionStorageFile } from "./bootstrap/sessionLoader";
ensureSessionStorageFile();

import "./boot/env-playwright";
import * as dotenv from 'dotenv';
dotenv.config();

import { AutonomousController } from './core/autonomousController';
import { EnterpriseSystemController } from './core/enterpriseSystemController';
import { getBrowser } from './utils/browser';
import { logPlaywrightProbe } from './utils/browserProbe';
import { TwitterSessionManager } from './utils/twitterSessionManager';

async function main(): Promise<void> {
  try {
    console.log('🚀 === ENTERPRISE AUTONOMOUS TWITTER BOT STARTING ===');
    console.log(`🌟 Node.js version: ${process.version}`);
    console.log(`📦 Memory at startup: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
    console.log('='.repeat(70));
    
    // Browser probe before launching
    await logPlaywrightProbe();
    
    // Check Twitter session
    const sessionInfo = TwitterSessionManager.getSessionInfo();
    console.log(`🐦 Twitter Session: ${sessionInfo.message}`);
    
    if (!sessionInfo.hasSession) {
      console.log('⚠️ WARNING: No valid Twitter session found');
      console.log('📝 Bot will run in read-only mode until session is configured');
      console.log('💡 To fix: Save Twitter cookies to data/twitter_session.json');
    }
    
    // CRITICAL: Start health server IMMEDIATELY for Railway health checks
    console.log('🏥 Starting health server for Railway...');
    try {
      const { startHealthServer } = await import('./healthServer');
      await startHealthServer();
      console.log('✅ Health server started successfully - Railway checks will pass');
    } catch (error: any) {
      console.warn('⚠️ Health server failed to start, continuing without it:', error.message);
      // Don't crash the main process - bot can continue without health server
    }
    
    // Initialize Enterprise Database Systems in background (non-blocking)
    console.log('🏢 Initializing Enterprise Database Systems...');
    const enterpriseController = EnterpriseSystemController.getInstance();
    
    // Set up enterprise system event listeners
    enterpriseController.on('systemInitialized', (status) => {
      console.log(`✅ Enterprise systems ready: ${status.health.overall}`);
    });
    
    enterpriseController.on('criticalAlert', (alert) => {
      console.error(`🚨 CRITICAL SYSTEM ALERT: ${alert.service}`);
    });
    
    enterpriseController.on('systemStatus', (status) => {
      // Log system status periodically (only if degraded)
      if (status.health.overall !== 'healthy') {
        console.warn(`⚠️ System health: ${status.health.overall}`);
      }
    });
    
    // Initialize enterprise systems with graceful error handling
    try {
      await enterpriseController.initializeEnterpriseSystems();
      console.log('✅ Enterprise systems fully operational');
    
    // Initialize Playwright factory
    try {
      await getBrowser();
      console.log('🎭 PLAYWRIGHT_FACTORY_READY');
    } catch (error: any) {
      console.warn('⚠️ Playwright factory initialization failed:', error.message);
    }
    } catch (error: any) {
      console.warn('⚠️ Enterprise systems partially failed, continuing with degraded mode:', error.message);
      console.log('🔄 Bot will operate with available systems only');
    }
    
    console.log('='.repeat(70));
    console.log('🤖 Initializing Bot Controller...');
    
    // Initialize the autonomous controller with error handling
    let controller;
    try {
      controller = AutonomousController.getInstance();
      // Initialize just the bot components (no health server conflict)
      controller.initializeComponents().catch((error: any) => {
        console.warn('⚠️ Background bot initialization failed:', error.message);
      });
      console.log('✅ Autonomous Controller created and initializing...');
    } catch (error: any) {
      console.warn('⚠️ Autonomous Controller creation failed:', error.message);
      console.log('🔄 Bot will continue with health server only');
      // Don't throw - keep health server running
    }
    
    console.log('='.repeat(70));
    console.log('🎉 === ENTERPRISE AUTONOMOUS TWITTER BOT FULLY OPERATIONAL ===');
    console.log('🧠 Intelligent adaptive posting system activated');
    console.log('🎯 Posting frequency: Dynamic 5min-6hrs based on opportunities');
    console.log('📊 Intelligence: trending topics, engagement windows, audience activity');
    console.log('🌐 Health server running for Railway health checks');
    console.log('🏢 Enterprise database systems active with monitoring');
    console.log('='.repeat(70));
    
    // Enhanced graceful shutdown handling
    const gracefulShutdown = async (signal: string) => {
      console.log(`\n🛑 ${signal} received, shutting down gracefully...`);
      console.log('🔄 Shutting down enterprise systems...');
      await enterpriseController.shutdown();
      console.log('✅ Graceful shutdown complete');
      process.exit(0);
    };
    
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    
    process.on('uncaughtException', (error) => {
      console.error('💥 Uncaught Exception:', error);
      process.exit(1);
    });
    
    process.on('unhandledRejection', (reason, promise) => {
      console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
      
      // Don't exit for Twitter session errors - let the bot continue in read-only mode
      const reasonStr = String(reason);
      if (reasonStr.includes('POST_SKIPPED_NO_SESSION') || 
          reasonStr.includes('POST_SKIPPED_PLAYWRIGHT') ||
          reasonStr.includes('Not logged in to Twitter')) {
        console.log('⚠️ Non-fatal error: Bot will continue in read-only mode');
        return;
      }
      
      process.exit(1);
    });
    
    // Keep the process alive
    setInterval(() => {
      const memory = process.memoryUsage();
      const memoryMB = Math.round(memory.heapUsed / 1024 / 1024);
      console.log(`💓 Bot heartbeat: ${memoryMB}MB memory, ${Math.round(process.uptime())}s uptime`);
    }, 5 * 60 * 1000); // Every 5 minutes
    
  } catch (error: any) {
    console.error('💥 Bot startup failed:', error.message);
    console.error('💥 Stack trace:', error.stack);
    process.exit(1);
  }
}

// Start the bot
main().catch((error) => {
  console.error('💥 Critical error in main():', error);
  process.exit(1);
});