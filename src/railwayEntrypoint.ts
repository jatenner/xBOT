/**
 * 🚀 RAILWAY UNIFIED ENTRYPOINT
 * Single entrypoint for both worker and main services
 * MUST start health server IMMEDIATELY before any other initialization
 */

import 'dotenv/config';
import { createServer, Server } from 'http';

// 🏥 STEP 0: Start health server IMMEDIATELY (before anything else)
let healthServer: Server | null = null;

function startHealthServer(): void {
  if (healthServer) {
    console.log('[HEALTH] Server already running');
    return;
  }

  const port = Number(process.env.PORT ?? 3000);
  const host = '0.0.0.0';
  const gitSha = process.env.RAILWAY_GIT_COMMIT_SHA || process.env.GIT_SHA || 'unknown';
  const serviceName = process.env.RAILWAY_SERVICE_NAME || process.env.SERVICE_NAME || 'unknown';

  console.log(`[HEALTH] Starting health server on ${host}:${port}...`);

  healthServer = createServer((req, res) => {
    // Respond to healthcheck endpoints
    if (req.url === '/status' || req.url === '/health' || req.url === '/healthz') {
      res.writeHead(200, { 
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      });
      res.end(JSON.stringify({
        ok: true,
        status: 'healthy',
        git_sha: gitSha,
        service_name: serviceName,
        timestamp: new Date().toISOString()
      }));
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('not found');
    }
  });

  healthServer.listen(port, host, () => {
    console.log(`[HEALTH] listening on ${host}:${port}`);
    console.log(`[HEALTH] Git SHA: ${gitSha.substring(0, 8)}`);
    console.log(`[HEALTH] Service: ${serviceName}`);
  });

  healthServer.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`[HEALTH] ❌ Port ${port} already in use`);
    } else {
      console.error(`[HEALTH] ❌ Server error: ${error.message}`);
    }
  });
}

// Start health server IMMEDIATELY
startHealthServer();

// Minimal boot logging (health server already started)

// Background initialization (NON-BLOCKING - health server already running)
setImmediate(async () => {
  try {
    // Determine service type using role resolver (single source of truth)
    const { resolveServiceRole } = await import('./utils/serviceRoleResolver');
    const roleInfo = resolveServiceRole();
    const isWorkerService = roleInfo.role === 'worker';

    console.log(`[BOOT] Service type: ${isWorkerService ? 'WORKER' : 'MAIN'}`);
    console.log(`[BOOT] Resolved role: ${roleInfo.role} (source: ${roleInfo.source})`);
    console.log(`[BOOT] SERVICE_ROLE: ${roleInfo.raw.SERVICE_ROLE || 'NOT SET'}`);
    console.log(`[BOOT] RAILWAY_SERVICE_NAME: ${roleInfo.raw.RAILWAY_SERVICE_NAME || 'NOT SET'}`);
    console.log(`[BOOT] Service name: ${process.env.RAILWAY_SERVICE_NAME || 'unknown'}`);

    if (isWorkerService) {
      // WORKER SERVICE: Start job manager
      console.log('[BOOT] Starting worker jobs AFTER health is up...');
      
      // Import and start worker
      const { startWorker } = await import('./jobs/jobManagerWorker');
      await startWorker();
      
      console.log('[BOOT] Worker service started successfully');
    } else {
      // MAIN SERVICE: Just keep alive (health server handles healthchecks)
      console.log('[BOOT] Main service - jobs disabled (worker-only architecture)');
      console.log('[BOOT] Health server running - service will remain alive');
      
      // Optionally start Express server for admin endpoints (non-blocking)
      try {
        const express = require('express');
        const app = express();
        const PORT = Number(process.env.PORT ?? 3000);
        const HOST = '0.0.0.0';
        
        app.use(express.json());
        
        // Admin endpoints (if needed)
        app.get('/admin/status', (req, res) => {
          res.json({
            ok: true,
            service: 'main',
            jobs_enabled: false,
            git_sha: process.env.RAILWAY_GIT_COMMIT_SHA || 'unknown',
          });
        });
        
        // Note: We already have health server on same port, so Express will fail
        // But that's OK - health server is what Railway checks
        console.log('[BOOT] Express server not started (health server already on PORT)');
      } catch (expressError: any) {
        // Ignore - health server is what matters
        console.log('[BOOT] Express server skipped (health server handles healthchecks)');
      }
    }
  } catch (error: any) {
    console.error('[BOOT] ❌ Background init error:', error.message);
    console.error('[BOOT] Stack:', error.stack);
    // Don't exit - health server keeps process alive
  }
});

// Keep process alive
process.on('SIGTERM', () => {
  console.log('[PROCESS] SIGTERM received, shutting down gracefully...');
  if (healthServer) {
    healthServer.close(() => {
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
});

process.on('SIGINT', () => {
  console.log('[PROCESS] SIGINT received, shutting down gracefully...');
  if (healthServer) {
    healthServer.close(() => {
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
});

// Handle uncaught errors (don't crash - health server must stay up)
process.on('uncaughtException', (error) => {
  console.error('[PROCESS] uncaughtException:', error.message);
  console.error('[PROCESS] Stack:', error.stack);
  // Don't exit - keep health server running
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[PROCESS] unhandledRejection:', reason);
  // Don't exit - keep health server running
});
