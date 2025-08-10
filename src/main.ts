#!/usr/bin/env node

/**
 * 🚀 MEMORY-EFFICIENT MAIN ENTRY POINT
 * 
 * Optimized for Railway's 512MB memory limit
 * Uses lazy loading and efficient resource management
 */

import dotenv from 'dotenv';
dotenv.config();

// Memory optimization: Set Node.js memory limit
process.env.NODE_OPTIONS = '--max-old-space-size=450'; // 450MB limit (safety buffer)

console.log('🚀 XBOT MEMORY-EFFICIENT STARTUP');
console.log('===================================');

async function main() {
  try {
    // Check memory at startup
    const initialMemory = process.memoryUsage();
    console.log(`🔧 Initial memory: ${Math.round(initialMemory.heapUsed / 1024 / 1024)}MB`);

    // Check environment
    const isRailway = process.env.RAILWAY_ENVIRONMENT_ID || process.env.RAILWAY_PROJECT_ID;
    console.log(`🌍 Environment: ${isRailway ? 'Railway' : 'Local'}`);

    // Initialize memory-efficient controller
    console.log('📦 Loading memory-efficient controller...');
    const { memoryEfficientController } = await import('./core/memoryEfficientController');
    
    // Check memory after loading
    const postLoadMemory = process.memoryUsage();
    console.log(`📊 Memory after loading: ${Math.round(postLoadMemory.heapUsed / 1024 / 1024)}MB`);

    // Start the autonomous system
    await memoryEfficientController.start();

    // Setup graceful shutdown
    process.on('SIGTERM', async () => {
      console.log('🛑 Received SIGTERM, shutting down gracefully...');
      await memoryEfficientController.stop();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      console.log('🛑 Received SIGINT, shutting down gracefully...');
      await memoryEfficientController.stop();
      process.exit(0);
    });

    // Memory monitoring
    setInterval(() => {
      const usage = process.memoryUsage();
      const usageMB = Math.round(usage.heapUsed / 1024 / 1024);
      
      if (usageMB > 400) { // 400MB warning
        console.warn(`⚠️ HIGH MEMORY USAGE: ${usageMB}MB`);
        
        // Force garbage collection
        if (global.gc) {
          global.gc();
          const afterGC = process.memoryUsage();
          const afterMB = Math.round(afterGC.heapUsed / 1024 / 1024);
          console.log(`🧹 After GC: ${afterMB}MB`);
        }
      }
    }, 60000); // Check every minute

    console.log('✅ XBOT Memory-Efficient System Running Successfully');
    console.log('🎯 Target: <400MB memory usage');
    console.log('⚡ Features: Autonomous posting, learning, Redis integration');

  } catch (error: any) {
    console.error('❌ Startup failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error.message);
  console.error(error.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the application
main();