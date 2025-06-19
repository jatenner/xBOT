import { Scheduler } from './agents/scheduler';
import dotenv from 'dotenv';
import http from 'http';

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

async function main() {
  try {
    console.log('🚀 Snap2Health Autonomous X-Bot Starting...');
    console.log('=====================================');

    // Check for Ghost Killer mode
    if (process.env.GHOST_ACCOUNT_SYNDROME_FIX === 'true') {
      console.log('👻 === GHOST ACCOUNT SYNDROME KILLER ACTIVATED ===');
      console.log('🔥 Mission: Maximum algorithmic domination mode');
      console.log('⚡ Strategy: Aggressive engagement to destroy ghost syndrome');
      console.log(`🔄 Engagement Frequency: ${process.env.COMMUNITY_ENGAGEMENT_FREQUENCY || 'every_30_minutes'}`);
      console.log(`📝 Post Frequency: Every ${process.env.POST_FREQUENCY_MINUTES || 25} minutes`);
      console.log(`🎯 Daily Target: ${process.env.ENGAGEMENT_TARGET_DAILY || 200} interactions`);
      console.log('💥 Boost Level: EXTREME\n');
    }

    // Start server with retry logic
    await startServer(PORT);

    // Create and start scheduler with error handling
    const scheduler = new Scheduler();
    
    // Add global error handlers before starting scheduler
    process.on('uncaughtException', (error) => {
      console.error('❌ Uncaught Exception:', error);
      // Log but don't crash in production
      if (process.env.NODE_ENV === 'production') {
        console.log('🔄 Continuing operation in production mode...');
      } else {
        setTimeout(() => process.exit(1), 5000);
      }
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
      // Check if it's an API limit error
      if (reason && typeof reason === 'object' && 'code' in reason) {
        if (reason.code === 429) {
          console.log('⏰ API rate limit hit - continuing in graceful mode...');
          return;
        }
        if (reason.code === 'UsageCapExceeded') {
          console.log('💰 Monthly API cap exceeded - switching to simulation mode...');
          return;
        }
      }
      
      // Log but don't crash in production
      if (process.env.NODE_ENV === 'production') {
        console.log('🔄 Continuing operation in production mode...');
      } else {
        setTimeout(() => process.exit(1), 5000);
      }
    });

    await scheduler.start();

    console.log('🧠 AUTONOMOUS INTELLIGENCE ACTIVATED:');
    console.log('   - System continuously learns and improves');
    console.log('   - Content strategies evolve in real-time');
    console.log('   - Competitive intelligence gathering');
    console.log('   - Predictive trend analysis');
    console.log('   - Creative capability enhancement');
    
    if (process.env.GHOST_ACCOUNT_SYNDROME_FIX === 'true') {
      console.log('   - 🔧 AUTONOMOUS QUALITY CONTROL: Tweet auditing and fixing');
    }

    // Run initial cycle with error protection
    console.log('🚀 Running initial strategist cycle...');
    
    // Handle graceful shutdown
    const shutdown = async () => {
      console.log('🛑 Received SIGTERM, shutting down gracefully...');
      try {
        await scheduler.stop();
        server.close(() => {
          console.log('🔍 Health check server stopped');
          process.exit(0);
        });
      } catch (error) {
        console.error('❌ Error during shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

    // Keep alive with periodic health checks
    setInterval(() => {
      const status = scheduler.isSchedulerRunning() ? 'running' : 'stopped';
      console.log(`💓 Health check: Scheduler ${status} at ${new Date().toISOString()}`);
    }, 300000); // Every 5 minutes

  } catch (error) {
    console.error('❌ Failed to start X-Bot:', error);
    
    // Don't crash immediately in production, give it a chance to recover
    if (process.env.NODE_ENV === 'production') {
      console.log('🔄 Attempting to restart in 30 seconds...');
      setTimeout(() => {
        main().catch(() => process.exit(1));
      }, 30000);
    } else {
      process.exit(1);
    }
  }
}

// Run the application
if (require.main === module) {
  main();
} 