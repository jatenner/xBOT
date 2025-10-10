import express from 'express';
import { HOST, PORT, getSafeEnvironment } from './config/env';
import { getBrowserStatus } from './playwright/browserFactory';
import { checkDatabaseHealth } from './db/index';
import { CadenceGuard } from './posting/cadenceGuard';
import { TweetMetricsTracker } from './metrics/trackTweet';
import { getConfig, printConfigSummary, printDeprecationWarnings } from './config/config';
import { JobManager } from './jobs/jobManager';
import { metricsHandler } from './api/metrics';
import { learnStatusHandler } from './api/learnStatus';
import { configHandler } from './api/configEndpoint';
import { auditProfileHandler } from './api/auditProfile';
import { requireAdminAuth as legacyAuth, adminJobsHandler, adminJobRunHandler } from './api/adminJobs';
import { requireAdminAuth } from './api/middleware/adminAuth';
import { jobScheduleHandler } from './api/adminJobSchedule';
import adminRouter from './server/routes/admin';
import lightweightPostingRouter from './api/lightweightPosting';
import ratesRouter from './api/rates';

const app = express();

// Middleware
app.use(express.json());

// Add request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

/**
 * Environment info (redacted)
 */
app.get('/env', (req, res) => {
  const safeEnv = {
    NODE_ENV: process.env.NODE_ENV,
    PORT: process.env.PORT,
    POSTING_DISABLED: process.env.POSTING_DISABLED,
    DRY_RUN: process.env.DRY_RUN,
    LOG_LEVEL: process.env.LOG_LEVEL,
    STARTUP_ACCEPTANCE_ENABLED: process.env.STARTUP_ACCEPTANCE_ENABLED,
    ENABLE_BANDIT_LEARNING: process.env.ENABLE_BANDIT_LEARNING,
    REPLY_MAX_PER_DAY: process.env.REPLY_MAX_PER_DAY,
    // Redact sensitive values
    DATABASE_URL: process.env.DATABASE_URL ? '[REDACTED]' : undefined,
    REDIS_URL: process.env.REDIS_URL ? '[REDACTED]' : undefined,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY ? '[REDACTED]' : undefined,
    SUPABASE_URL: process.env.SUPABASE_URL ? '[REDACTED]' : undefined,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY ? '[REDACTED]' : undefined,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? '[REDACTED]' : undefined,
  };
  
  res.json({
    environment: safeEnv,
    timestamp: new Date().toISOString(),
    node_version: process.version,
    uptime_seconds: process.uptime()
  });
});

/**
 * Unified configuration endpoint (requires authentication)
 */
app.get('/config', configHandler);

/**
 * Learning system status
 */
app.get('/learn/status', learnStatusHandler);

/**
 * Profile audit endpoint
 */
app.get('/audit/profile', auditProfileHandler);

/**
 * Admin job management routes (protected)
 */
app.get('/admin/jobs', requireAdminAuth, adminJobsHandler);
app.post('/admin/jobs/run', requireAdminAuth, adminJobRunHandler);
app.get('/admin/jobs/schedule', requireAdminAuth, jobScheduleHandler);

/**
 * Admin smoke test routes (protected)
 */
app.use('/admin', adminRouter);

/**
 * 🚀 LIGHTWEIGHT POSTING ROUTES - Railway Optimized
 */
app.use('/api', lightweightPostingRouter);

/**
 * ⚡ SIMPLIFIED RATES API - Lightweight Dynamic Scaling
 */
app.use('/api/rates', ratesRouter);

/**
 * 📤 POST /post - Direct posting endpoint for remote browser
 */
app.post('/post', async (req, res) => {
  try {
    const { text } = req.body;
    
    if (!text || typeof text !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Missing or invalid text parameter'
      });
    }
    
    console.log(`[POST_ENDPOINT] 📝 Posting: "${text.substring(0, 50)}..."`);
    
    const { postNow } = await import('./posting/postNow');
    const result = await postNow({ text });
    
    if (result.success) {
      console.log(`[POST_ENDPOINT] ✅ Posted successfully: ${result.id}`);
      res.json({
        success: true,
        tweetId: result.id
      });
    } else {
      console.error(`[POST_ENDPOINT] ❌ Failed: ${result.error}`);
      res.status(500).json({
        success: false,
        error: result.error || 'Posting failed'
      });
    }
  } catch (error: any) {
    console.error(`[POST_ENDPOINT] ❌ Exception:`, error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Health and readiness check (use dedicated status route)
 */
app.use('/status', async (req, res, next) => {
  const statusRoute = await import('./server/routes/status');
  statusRoute.default(req, res, next);
});

// Legacy /status endpoint (redirects to new handler)
app.get('/health', async (req, res) => {
  try {
    console.log('🩺 Performing health check...');
    
    const { flags } = await import('./config/featureFlags');
    const { JobManager } = await import('./jobs/jobManager');
    const jobManager = JobManager.getInstance();
    const stats = jobManager.getStats();
    const fs = require('fs');
    
    // Enhanced health with job timer status
    const health = {
      mode: flags.mode,
      postingEnabled: flags.postingEnabled,
      postingDisabledEnv: process.env.POSTING_DISABLED,
      dryRunEnv: process.env.DRY_RUN,
      node_env: process.env.NODE_ENV,
      uptime_seconds: process.uptime(),
      memory_usage: process.memoryUsage(),
      timestamp: new Date().toISOString(),
      timers: {
        plan: stats.planRuns > 0 || flags.plannerEnabled,
        reply: stats.replyRuns > 0 || flags.replyEnabled,
        posting: stats.postingRuns > 0 || flags.postingEnabled,
        learn: stats.learnRuns > 0 || flags.learnEnabled,
      },
      browserProfileDirExists: fs.existsSync('/tmp/xbot-profile'),
      lastPostAttemptAt: (globalThis as any).__xbotLastPostAttemptAt || null,
      lastPostResult: (globalThis as any).__xbotLastPostResult || null,
    };
    
    res.json({
      ok: true,
      status: 'healthy',
      ...health
    });
    
    /*
    // Complex health checks (disabled for minimal build)
    const [browserStatus, dbHealth, cadenceStatus, metricsHealth] = await Promise.all([
      getBrowserStatus(),
      checkDatabaseHealth(), 
      CadenceGuard.getStatus(),
      TweetMetricsTracker.getInstance().healthCheck()
    ]);

    const status = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {
        browser: {
          connected: browserStatus.connected,
          initializing: browserStatus.isInitializing
        },
        database: {
          supabase: dbHealth.supabase,
          postgres: dbHealth.postgres,
          errors: dbHealth.errors
        },
        posting: {
          locked: cadenceStatus.isLocked,
          lastPostTime: cadenceStatus.lastPostTime,
          nextAllowedAt: cadenceStatus.nextAllowedAt,
          minIntervalMinutes: cadenceStatus.minIntervalMinutes
        },
        metrics: {
          enabled: metricsHealth.enabled,
          browserOk: metricsHealth.browserOk,
          lastError: metricsHealth.lastError
        }
      },
      overall: {
        healthy: browserStatus.connected && (dbHealth.supabase || dbHealth.postgres),
        readyToPost: !cadenceStatus.isLocked && browserStatus.connected
      }
    };

    const httpStatus = status.overall.healthy ? 200 : 503;
    res.status(httpStatus).json(status);
    */
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown health check error'
    });
  }
});

/**
 * Environment and configuration info (safe subset)
 */
app.get('/env', (req, res) => {
  try {
    const safeEnv = getSafeEnvironment();
    res.json({
      environment: safeEnv,
      timestamp: new Date().toISOString(),
      nodeVersion: process.version,
      platform: process.platform,
      uptime: process.uptime()
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to get environment info'
    });
  }
});

/**
 * Playwright browser status
 */
app.get('/playwright', (req, res) => {
  try {
    const fs = require('fs');
    const status = getBrowserStatus();
    res.json({
      browserHealthy: status.connected && !status.isInitializing,
      profileDirExists: fs.existsSync('/tmp/xbot-profile'),
      connected: status.connected,
      isInitializing: status.isInitializing,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to get browser status'
    });
  }
});

/**
 * Session and authentication status (no secrets)
 */
app.get('/session', (req, res) => {
  try {
    // Basic session info without exposing actual cookies
    const sessionInfo = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      // Could add more session status checks here
      status: 'Session endpoint active'
    };
    
    res.json(sessionInfo);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to get session info'
    });
  }
});

/**
 * Posting cadence status and controls
 */
app.get('/posting', async (req, res) => {
  try {
    const status = await CadenceGuard.getStatus();
    res.json({
      posting: status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to get posting status'
    });
  }
});

/**
 * Force release posting lock (emergency use)
 */
app.post('/posting/unlock', async (req, res) => {
  try {
    await CadenceGuard.forceReleaseLock();
    res.json({
      success: true,
      message: 'Posting lock force-released',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to release lock'
    });
  }
});

/**
 * Unified metrics endpoint
 */
app.get('/metrics', metricsHandler);

// Learning status endpoint already defined above

/**
 * Manual metrics tracking for a tweet
 */
app.post('/metrics/track/:tweetId', async (req, res) => {
  try {
    const { tweetId } = req.params;
    
    if (!/^\d+$/.test(tweetId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid tweet ID format'
      });
    }

    const tracker = TweetMetricsTracker.getInstance();
    const result = await tracker.trackTweet(tweetId);
    
    res.json({
      success: result.success,
      tweetId,
      metrics: result.metrics,
      error: result.error,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to track metrics'
    });
  }
});

/**
 * Root endpoint with API documentation
 */
app.get('/', (req, res) => {
  res.json({
    name: 'xBOT Health Server',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    endpoints: {
      'GET /status': 'Overall health and readiness check',
      'GET /env': 'Environment configuration (safe subset)',
      'GET /playwright': 'Browser connection status',
      'GET /session': 'Session information (no secrets)',
      'GET /posting': 'Posting cadence and lock status',
      'POST /posting/unlock': 'Force release posting lock (emergency)',
      'GET /metrics': 'Metrics tracking system status',
      'POST /metrics/track/:tweetId': 'Manually track metrics for a tweet'
    },
    usage: {
      healthCheck: `curl ${req.protocol}://${req.get('host')}/status`,
      environment: `curl ${req.protocol}://${req.get('host')}/env`,
      unlockPosting: `curl -X POST ${req.protocol}://${req.get('host')}/posting/unlock`
    }
  });
});

/**
 * Error handling middleware
 */
app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Express error:', error);
  res.status(500).json({
    error: 'Internal server error',
    timestamp: new Date().toISOString()
  });
});

/**
 * Canary endpoint - System-wide health check with LLM test
 */
app.get('/canary', async (req, res) => {
  try {
    const { getEnvConfig, isPostingAllowed } = await import('./config/envFlags');
    const config = getEnvConfig();
    const postingAllowed = isPostingAllowed();
    
    const results: any = {
      ok: true,
      mode: config.MODE,
      llm_ok: false,
      db_ok: false,
      queue_ok: false,
      playwright_ok: false,
      timestamp: new Date().toISOString()
    };
    
    // Test LLM (small call)
    try {
      const { createBudgetedChatCompletion } = await import('./services/openaiBudgetedClient');
      await createBudgetedChatCompletion(
        {
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: 'ping' }],
          max_tokens: 5
        },
        { purpose: 'canary_health_check' }
      );
      results.llm_ok = true;
    } catch (error: any) {
      results.llm_error = error.message;
    }
    
    // Test DB
    try {
      const dbHealth = await checkDatabaseHealth();
      results.db_ok = dbHealth.supabase && dbHealth.postgres;
      if (dbHealth.errors.length > 0) {
        results.db_error = dbHealth.errors.join(', ');
      }
    } catch (error: any) {
      results.db_error = error.message;
    }
    
    // Test Queue (count queued items)
    try {
      const { getSupabaseClient } = await import('./db/index');
      const supabase = getSupabaseClient();
      const { count, error } = await supabase
        .from('content_metadata')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'queued');
      
      results.queue_ok = !error;
      results.queue_count = count || 0;
      if (error) results.queue_error = error.message;
    } catch (error: any) {
      results.queue_error = error.message;
    }
    
    // Test Playwright
    try {
      const playwrightStatus = getBrowserStatus();
      results.playwright_ok = playwrightStatus.connected && !playwrightStatus.isInitializing;
      results.playwright_session = playwrightStatus.connected ? 'connected' : 'disconnected';
    } catch (error: any) {
      results.playwright_error = error.message;
    }
    
    // Overall health
    results.ok = results.llm_ok && results.db_ok && results.queue_ok;
    
    res.json(results);
  } catch (error: any) {
    res.status(500).json({
      ok: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Playwright session ping
 */
app.get('/playwright/ping', async (req, res) => {
  try {
    const status = getBrowserStatus();
    const { BrowserManager } = await import('./browser/browserManager');
    const browserManager = BrowserManager.getInstance();
    const sessionState = await browserManager.getSessionState();
    
    res.json({
      ok: status.connected && !status.isInitializing,
      connected: status.connected,
      isInitializing: status.isInitializing,
      sessionValid: sessionState.isValid,
      lastLoginTime: sessionState.lastLoginTime,
      sessionAge: sessionState.lastLoginTime 
        ? Date.now() - new Date(sessionState.lastLoginTime).getTime() 
        : null,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({
      ok: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * 404 handler
 */
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.path,
    timestamp: new Date().toISOString(),
    availableEndpoints: ['/status', '/env', '/canary', '/playwright', '/playwright/ping', '/session', '/posting', '/metrics']
  });
});

/**
 * Start the health server
 */
export function start(port?: number): Promise<void> {
  return startHealthServer();
}

export function startHealthServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const server = app.listen(PORT, HOST, () => {
        console.log(`🏥 Health server listening on ${HOST}:${PORT}`);
        console.log(`📊 Status endpoint: http://${HOST}:${PORT}/status`);
        console.log(`🔧 Environment: http://${HOST}:${PORT}/env`);
        console.log(`🌐 Browser status: http://${HOST}:${PORT}/playwright`);
        console.log(`📝 Session info: http://${HOST}:${PORT}/session`);
        resolve();
      });

      server.on('error', (error) => {
        console.error('Health server error:', error);
        reject(error);
      });

      // Graceful shutdown
      process.on('SIGTERM', () => {
        console.log('🛑 Shutting down health server...');
        server.close(() => {
          console.log('✅ Health server shut down complete');
        });
      });

    } catch (error) {
      console.error('Failed to start health server:', error);
      reject(error);
    }
  });
}

// Auto-start if this file is run directly
if (require.main === module) {
  startHealthServer().catch(error => {
    console.error('Failed to start health server:', error);
    process.exit(1);
  });
}

export default app;
