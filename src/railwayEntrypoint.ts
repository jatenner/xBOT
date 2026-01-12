/**
 * 🚀 RAILWAY UNIFIED ENTRYPOINT
 * Single entrypoint for both worker and main services
 * MUST start health server IMMEDIATELY before any other initialization
 */

import 'dotenv/config';
import { createServer, Server } from 'http';
import { randomUUID } from 'crypto';
import * as os from 'os';

// 🏥 STEP 0: Start health server IMMEDIATELY (before anything else)
let healthServer: Server | null = null;

// Generate boot_id once at process start (anti-lie field)
const bootId = randomUUID();
const bootTime = new Date().toISOString();
const hostname = os.hostname();
const pid = process.pid;

function startHealthServer(): void {
  if (healthServer) {
    console.log('[HEALTH] Server already running');
    return;
  }

  const port = Number(process.env.PORT ?? 8080);
  const host = '0.0.0.0';
  // Prefer APP_VERSION (set at build time) over Railway's env vars for deterministic versioning
  const gitSha = process.env.APP_VERSION || process.env.RAILWAY_GIT_COMMIT_SHA || process.env.GIT_SHA || 'unknown';
  const serviceName = process.env.RAILWAY_SERVICE_NAME || process.env.SERVICE_NAME || 'unknown';

  console.log(`[HEALTH] Starting health server on ${host}:${port}...`);
  console.log(`[HEALTH] Boot ID: ${bootId}`);
  console.log(`[HEALTH] Boot time: ${bootTime}`);
  console.log(`[HEALTH] Hostname: ${hostname}`);
  console.log(`[HEALTH] PID: ${pid}`);
  console.log(`[HEALTH] APP_VERSION: ${process.env.APP_VERSION || 'NOT SET'}`);
  console.log(`[HEALTH] RAILWAY_GIT_COMMIT_SHA: ${process.env.RAILWAY_GIT_COMMIT_SHA || 'NOT SET'}`);

  healthServer = createServer(async (req, res) => {
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
        app_version: process.env.APP_VERSION || 'unknown',
        service_name: serviceName,
        timestamp: new Date().toISOString(),
        // Anti-lie fields
        boot_id: bootId,
        boot_time: bootTime,
        hostname: hostname,
        pid: pid,
        git_sha_env: process.env.RAILWAY_GIT_COMMIT_SHA || process.env.GIT_SHA || 'missing',
        railway_git_commit_sha: process.env.RAILWAY_GIT_COMMIT_SHA || 'missing',
        railway_git_author: process.env.RAILWAY_GIT_AUTHOR || 'missing',
        railway_git_branch: process.env.RAILWAY_GIT_BRANCH || 'missing',
        railway_git_commit_message: process.env.RAILWAY_GIT_COMMIT_MESSAGE || 'missing',
        railway_service_name: process.env.RAILWAY_SERVICE_NAME || 'missing',
        railway_environment: process.env.RAILWAY_ENVIRONMENT || 'missing'
      }));
    } else if (req.url === '/metrics/replies') {
      // Reply decisions metrics endpoint
      try {
        const { getSupabaseClient } = await import('./db');
        const supabase = getSupabaseClient();
        
        const now = new Date();
        const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
        const last1h = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
        
        // 🔒 TRUTHFUL: Compute from columns, not reason parsing
        const { data: last24hData } = await supabase
          .from('reply_decisions')
          .select('decision, status, method, cache_hit')
          .gte('created_at', last24h);
        
        const { data: last1hData } = await supabase
          .from('reply_decisions')
          .select('decision, status, method, cache_hit')
          .gte('created_at', last1h);
        
        const total24h = last24hData?.length || 0;
        const allow24h = last24hData?.filter(r => r.decision === 'ALLOW').length || 0;
        const deny24h = last24hData?.filter(r => r.decision === 'DENY').length || 0;
        const uncertain24h = last24hData?.filter(r => r.status === 'UNCERTAIN').length || 0;
        const error24h = last24hData?.filter(r => r.status === 'ERROR').length || 0;
        const ok24h = last24hData?.filter(r => r.status === 'OK').length || 0;
        const cacheHits24h = last24hData?.filter(r => r.cache_hit === true).length || 0;
        
        // Method breakdown
        const methodBreakdown24h = (last24hData || []).reduce((acc: Record<string, { allow: number; deny: number }>, r) => {
          const method = r.method || 'unknown';
          if (!acc[method]) acc[method] = { allow: 0, deny: 0 };
          if (r.decision === 'ALLOW') acc[method].allow++;
          else acc[method].deny++;
          return acc;
        }, {});
        
        const total1h = last1hData?.length || 0;
        const allow1h = last1hData?.filter(r => r.decision === 'ALLOW').length || 0;
        const deny1h = last1hData?.filter(r => r.decision === 'DENY').length || 0;
        const uncertain1h = last1hData?.filter(r => r.status === 'UNCERTAIN').length || 0;
        const error1h = last1hData?.filter(r => r.status === 'ERROR').length || 0;
        const ok1h = last1hData?.filter(r => r.status === 'OK').length || 0;
        const cacheHits1h = last1hData?.filter(r => r.cache_hit === true).length || 0;
        
        res.writeHead(200, { 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        });
        res.end(JSON.stringify({
          last_24h: {
            total: total24h,
            allow: allow24h,
            deny: deny24h,
            uncertain: uncertain24h,
            error: error24h,
            ok: ok24h,
            cache_hits: cacheHits24h,
            cache_hit_rate: total24h > 0 ? ((cacheHits24h / total24h) * 100).toFixed(1) + '%' : '0%',
            method_breakdown: methodBreakdown24h,
          },
          last_1h: {
            total: total1h,
            allow: allow1h,
            deny: deny1h,
            uncertain: uncertain1h,
            error: error1h,
            ok: ok1h,
            cache_hits: cacheHits1h,
            cache_hit_rate: total1h > 0 ? ((cacheHits1h / total1h) * 100).toFixed(1) + '%' : '0%',
          },
          timestamp: new Date().toISOString(),
        }));
      } catch (error: any) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message }));
      }
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('not found');
    }
  });

  healthServer.listen(port, host, () => {
    console.log(`[HEALTH] Starting health server on ${host}:${port}...`);
    console.log(`[HEALTH] ✅ Listening on ${host}:${port}`);
    console.log(`[HEALTH] Git SHA: ${gitSha.substring(0, 8)}`);
    console.log(`[HEALTH] Git SHA (full): ${gitSha}`);
    console.log(`[HEALTH] APP_VERSION: ${process.env.APP_VERSION || 'NOT SET'}`);
    console.log(`[HEALTH] RAILWAY_GIT_COMMIT_SHA: ${process.env.RAILWAY_GIT_COMMIT_SHA || 'NOT SET'}`);
    console.log(`[HEALTH] Boot ID: ${bootId}`);
    console.log(`[HEALTH] Service: ${serviceName}`);
    console.log(`[HEALTH] Boot time: ${bootTime}`);
    console.log(`[HEALTH] Hostname: ${hostname}`);
    console.log(`[HEALTH] PID: ${pid}`);
    console.log(`[HEALTH] Healthcheck endpoint: http://${host}:${port}/status`);
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
