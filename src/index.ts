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
      service: 'snap2health-xbot'
    }));
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

// Start health check server on port provided by Render or default to 3000
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🔍 Health check server running on port ${PORT}`);
});

async function main() {
  try {
    console.log('🚀 Snap2Health Autonomous X-Bot Starting...');
    console.log('=====================================');

    // Create and start scheduler
    const scheduler = new Scheduler();
    await scheduler.start();

    console.log('🧠 AUTONOMOUS INTELLIGENCE ACTIVATED:');
    console.log('   - System continuously learns and improves');
    console.log('   - Content strategies evolve in real-time');
    console.log('   - Competitive intelligence gathering');
    console.log('   - Predictive trend analysis');
    console.log('   - Creative capability enhancement');

    // Run initial cycle
    console.log('🚀 Running initial strategist cycle...');
    
    // Handle graceful shutdown
    const shutdown = async () => {
      console.log('🛑 Received SIGTERM, shutting down gracefully...');
      await scheduler.stop();
      server.close(() => {
        console.log('🔍 Health check server stopped');
        process.exit(0);
      });
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

    // Keep alive
    process.on('uncaughtException', (error) => {
      console.error('❌ Uncaught Exception:', error);
      // Don't exit in production, just log the error
      if (process.env.NODE_ENV !== 'production') {
        process.exit(1);
      }
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
      // Don't exit in production, just log the error
      if (process.env.NODE_ENV !== 'production') {
        process.exit(1);
      }
    });

  } catch (error) {
    console.error('❌ Failed to start X-Bot:', error);
    process.exit(1);
  }
}

// Run the application
if (require.main === module) {
  main();
} 