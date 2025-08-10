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

async function main(): Promise<void> {
  try {
    console.log('🚀 === AUTONOMOUS TWITTER BOT STARTING ===');
    console.log(`🌟 Node.js version: ${process.version}`);
    console.log(`📦 Memory at startup: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
    
    // Initialize the autonomous controller
    const controller = AutonomousController.getInstance();
    await controller.initialize();
    
    console.log('✅ === AUTONOMOUS TWITTER BOT FULLY OPERATIONAL ===');
    console.log('🔄 Bot will post autonomously every 3 hours');
    console.log('🌐 Health server running for Railway health checks');
    
    // Graceful shutdown handling
    process.on('SIGTERM', async () => {
      console.log('🛑 SIGTERM received, shutting down gracefully...');
      process.exit(0);
    });
    
    process.on('SIGINT', async () => {
      console.log('🛑 SIGINT received, shutting down gracefully...');
      process.exit(0);
    });
    
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