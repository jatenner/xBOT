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

import * as dotenv from 'dotenv';
dotenv.config();

import { AutonomousController } from './core/autonomousController';
import { EnterpriseSystemController } from './core/enterpriseSystemController';

async function main(): Promise<void> {
  try {
    console.log('🚀 === ENTERPRISE AUTONOMOUS TWITTER BOT STARTING ===');
    console.log(`🌟 Node.js version: ${process.version}`);
    console.log(`📦 Memory at startup: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
    console.log('='.repeat(70));
    
    // Initialize Enterprise Database Systems first
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
    
    // Initialize all enterprise systems
    await enterpriseController.initializeEnterpriseSystems();
    
    console.log('='.repeat(70));
    console.log('🤖 Initializing Bot Controller...');
    
    // Initialize the autonomous controller
    const controller = AutonomousController.getInstance();
    await controller.initialize();
    
    console.log('='.repeat(70));
    console.log('🎉 === ENTERPRISE AUTONOMOUS TWITTER BOT FULLY OPERATIONAL ===');
    console.log('🔄 Bot will post autonomously every 3 hours');
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