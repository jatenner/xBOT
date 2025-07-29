/**
 * 🏥 RAILWAY HEALTH SERVER
 * Standalone Express server for Railway health checks
 * Starts immediately and stays alive regardless of bot status
 */

import express from 'express';

export interface HealthServerStatus {
  server?: any;
  port: number;
  host: string;
  botStatus: string;
  botController?: any;
}

let healthServerStatus: HealthServerStatus = {
  port: parseInt(process.env.PORT || '3000', 10),
  host: '0.0.0.0',
  botStatus: 'starting'
};

/**
 * Start the health server immediately for Railway
 * This MUST start before any bot logic to pass health checks
 */
export function startHealthServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    const app = express();
    
    // Basic middleware
    app.use(express.json());
    app.use(express.text());

    // CRITICAL: Health endpoint for Railway - ALWAYS returns 200 "ok"
    app.get('/health', (_req, res) => {
      console.log('🏥 Railway health check requested');
      res.status(200).send('ok');
    });

    // Status endpoint for debugging
    app.get('/status', (_req, res) => {
      res.json({
        status: healthServerStatus.botStatus,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        bot_running: healthServerStatus.botController?.getSystemStatus ? true : false,
        port: healthServerStatus.port,
        host: healthServerStatus.host
      });
    });

    // Environment check endpoint for debugging Railway deployment
    app.get('/env', (_req, res) => {
      try {
        // Import here to avoid circular dependencies
        const { validateEnvironment } = require('./config/productionConfig');
        const envCheck = validateEnvironment();
        res.json({
          valid: envCheck.valid,
          missing_required: envCheck.missing,
          missing_optional: envCheck.warnings,
          status: healthServerStatus.botStatus,
          message: envCheck.valid ? 'Environment configured correctly' : 'Missing required environment variables'
        });
      } catch (error) {
        res.json({
          error: 'Unable to validate environment',
          status: healthServerStatus.botStatus,
          message: 'Environment validation failed'
        });
      }
    });

    // Basic info endpoint
    app.get('/', (_req, res) => {
      res.json({
        name: 'xBOT - Autonomous Twitter Growth Master',
        status: healthServerStatus.botStatus,
        timestamp: new Date().toISOString(),
        endpoints: {
          health: '/health',
          status: '/status',
          environment: '/env'
        }
      });
    });

    // Catch-all error handler
    app.use((error: any, _req: any, res: any, _next: any) => {
      console.error('❌ Health server error:', error);
      if (!res.headersSent) {
        res.status(500).send('Internal Server Error');
      }
    });

    // Start server on all interfaces for Railway
    healthServerStatus.server = app.listen(healthServerStatus.port, healthServerStatus.host, () => {
      console.log(`✅ Health server running on http://${healthServerStatus.host}:${healthServerStatus.port}`);
      console.log(`🚄 Railway health check: http://${healthServerStatus.host}:${healthServerStatus.port}/health`);
      console.log(`📊 Status endpoint: http://${healthServerStatus.host}:${healthServerStatus.port}/status`);
      console.log(`🔍 Environment check: http://${healthServerStatus.host}:${healthServerStatus.port}/env`);
      resolve();
    });

    healthServerStatus.server.on('error', (error: any) => {
      console.error('❌ Health server failed to start:', error);
      reject(error);
    });

    // Handle server shutdown gracefully
    process.on('SIGINT', () => gracefulShutdown());
    process.on('SIGTERM', () => gracefulShutdown());
  });
}

/**
 * Update the bot status (called from main bot)
 */
export function updateBotStatus(status: string, controller?: any): void {
  healthServerStatus.botStatus = status;
  healthServerStatus.botController = controller;
  console.log(`🤖 Bot status updated: ${status}`);
}

/**
 * Get current health server status
 */
export function getHealthServerStatus(): HealthServerStatus {
  return { ...healthServerStatus };
}

/**
 * Graceful shutdown
 */
function gracefulShutdown(): void {
  console.log('🛑 Shutting down health server...');
  if (healthServerStatus.server) {
    healthServerStatus.server.close(() => {
      console.log('🏥 Health server closed');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
}