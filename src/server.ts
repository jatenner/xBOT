import express from 'express';
import { ENV } from './config/env';
import { log } from './lib/logger';
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
import { getLearningSystemStatus, getLearningMetrics } from './api/learningStatus';
import { learningSystem } from './learning/learningSystem';
import { requireAdminAuth as legacyAuth, adminJobsHandler, adminJobRunHandler } from './api/adminJobs';
import { requireAdminAuth } from './api/middleware/adminAuth';
import { jobScheduleHandler } from './api/adminJobSchedule';
import adminRouter from './server/routes/admin';
// import lightweightPostingRouter from './api/lightweightPosting'; // REMOVED: Legacy posting API
import bulletproofPostingRouter from './api/bulletproofPosting';
import emergencySystemRouter from './api/emergencySystem';
import playwrightPostingRouter from './api/playwrightPosting';
import ratesRouter from './api/rates';
import resourceMetricsRouter from './api/resourceMetrics';
import adminDashboardActionsRouter from './api/adminDashboardActions';

const app = express();

// Middleware
app.use(express.json());

// Add request logging
app.use((req, res, next) => {
  log({ op: 'http_request', method: req.method, path: req.path });
  next();
});

/**
 * Environment info (redacted)
 */
app.get('/env', (req, res) => {
  const safeEnv = {
    NODE_ENV: ENV.NODE_ENV,
    PORT: ENV.PORT,
    HOST: ENV.HOST,
    MODE: ENV.MODE,
    // Redact sensitive values
    DATABASE_URL: ENV.DATABASE_URL ? '[REDACTED]' : undefined,
    REDIS_URL: ENV.REDIS_URL ? '[REDACTED]' : undefined,
    OPENAI_API_KEY: '[REDACTED]',
    SUPABASE_URL: '[REDACTED]',
    SUPABASE_SERVICE_ROLE_KEY: '[REDACTED]',
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
 * System Health Dashboard - Browser Pool + Job Manager
 */
app.get('/api/system/health', async (req, res) => {
  try {
    const { getBrowserPool } = await import('./browser/UnifiedBrowserPool');
    const browserPool = getBrowserPool();
    const jobManager = JobManager.getInstance();
    
    const health = {
      timestamp: new Date().toISOString(),
      browserPool: browserPool.getHealth(),
      jobManager: {
        stats: jobManager.stats,
        isRunning: jobManager['isRunning'],
        activeTimers: jobManager['timers'].size
      },
      system: {
        uptime: Math.floor(process.uptime()),
        memory: {
          used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
          external: Math.round(process.memoryUsage().external / 1024 / 1024)
        },
        nodeVersion: process.version
      }
    };
    
    res.json(health);
  } catch (error: any) {
    res.status(500).json({ error: 'Health check failed', message: error.message });
  }
});

/**
 * Learning system status
 */
app.get('/learn/status', learnStatusHandler);

/**
 * Enhanced Learning System Status (comprehensive)
 */
app.get('/learning/status', getLearningSystemStatus);

/**
 * Learning System Metrics (for monitoring)
 */
app.get('/learning/metrics', getLearningMetrics);

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
 * 🎮 ADMIN DASHBOARD ACTION ENDPOINTS (protected)
 * Real-time dashboard control actions
 */
app.use('/api/admin', adminDashboardActionsRouter);

/**
 * 🚀 LIGHTWEIGHT POSTING ROUTES - Railway Optimized
 */
// app.use('/api', lightweightPostingRouter); // REMOVED: Legacy posting API

/**
 * 🛡️ BULLETPROOF POSTING ROUTES - Crash Resistant
 */
app.use('/api', bulletproofPostingRouter);

/**
 * 🚨 EMERGENCY SYSTEM ROUTES - Guaranteed Working
 */
app.use('/api', emergencySystemRouter);

/**
 * 🎭 PLAYWRIGHT-ONLY POSTING ROUTES - Browser Only, No API
 */
app.use('/api', playwrightPostingRouter);

/**
 * ⚡ SIMPLIFIED RATES API - Lightweight Dynamic Scaling
 */
app.use('/api/rates', ratesRouter);

/**
 * 📊 RESOURCE METRICS - Container Resource Monitoring
 */
app.use('/api', resourceMetricsRouter);

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
 * 🧠 Visual Intelligence Dashboard
 */
app.get('/visual-intelligence', (req, res) => {
  const path = require('path');
  res.sendFile(path.join(__dirname, '../public/visual-intelligence.html'));
});

// VI Dashboard API - Simple Supabase proxy
app.get('/api/supabase/count', async (req, res) => {
  try {
    const { getSupabaseClient } = await import('./db/index');
    const supabase = getSupabaseClient();
    const table = req.query.table as string;
    const filter = req.query.filter as string;
    
    let query = supabase.from(table).select('*', { count: 'exact', head: true });
    
    if (filter) {
      const [col, op, val] = filter.split('.');
      if (op === 'eq') query = query.eq(col, val);
    }
    
    const { count } = await query;
    res.json({ count: count || 0 });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/supabase/query', async (req, res) => {
  try {
    const { getSupabaseClient } = await import('./db/index');
    const supabase = getSupabaseClient();
    const table = req.query.table as string;
    const limit = parseInt(req.query.limit as string) || 50;
    const order = req.query.order as string;
    
    let query = supabase.from(table).select('*').limit(limit);
    
    if (order) {
      const [col, dir] = order.split('.');
      query = query.order(col, { ascending: dir !== 'desc' });
    }
    
    const { data } = await query;
    res.json({ data: data || [] });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
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
        // COMPREHENSIVE DATA COLLECTION SYSTEMS
        analytics: true, // 30 min - scrapes real Twitter metrics
        attribution: true, // 2h - tracks follower growth
        outcomes_real: true, // 2h - comprehensive engagement
        data_collection: true, // 1h - DataCollectionEngine (40+ metrics)
        ai_orchestration: true, // 6h - AI-driven strategy
        viral_thread: flags.live, // 24h - daily amazing thread
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

// Duplicate /env endpoint removed - see line 41

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
 * 📊 DASHBOARD ENDPOINTS - Multi-page analytics
 */

// Main dashboard redirects to recent activity
app.get('/dashboard', async (req, res) => {
  const token = req.query.token || '';
  res.redirect(`/dashboard/recent?token=${token}`);
});

// Recent posts dashboard (main insight view)
app.get('/dashboard/recent', async (req, res) => {
  try {
    const token = req.query.token || req.headers.authorization?.replace('Bearer ', '');
    const adminToken = process.env.ADMIN_TOKEN || 'xbot-admin-2025';
    
    if (token !== adminToken) {
      return res.status(401).send(`
        <html>
          <body style="font-family: Arial; text-align: center; padding: 50px;">
            <h1>🔒 Authentication Required</h1>
            <p>Add <code>?token=YOUR_TOKEN</code> to the URL</p>
          </body>
        </html>
      `);
    }
    
    console.log('📊 RECENT_DASHBOARD: Serving recent activity...');
    
    const { comprehensiveDashboard } = await import('./dashboard/comprehensiveDashboard');
    const dashboardHTML = await comprehensiveDashboard.generateRecentDashboard();
    
    res.setHeader('Content-Type', 'text/html');
    res.send(dashboardHTML);
    
    console.log('✅ RECENT_DASHBOARD: Delivered');
  } catch (error: any) {
    console.error('❌ RECENT_DASHBOARD_ERROR:', error.message);
    res.status(500).send(`<html><body style="padding: 50px; text-align: center;">
      <h1>🚨 Error</h1><p>${error.message}</p></body></html>`);
  }
});

// Posts dashboard page
app.get('/dashboard/posts', async (req, res) => {
  try {
    const token = req.query.token || req.headers.authorization?.replace('Bearer ', '');
    const adminToken = process.env.ADMIN_TOKEN || 'xbot-admin-2025';
    
    if (token !== adminToken) {
      return res.status(401).send(`
        <html>
          <body style="font-family: Arial; text-align: center; padding: 50px;">
            <h1>🔒 Authentication Required</h1>
            <p>Add <code>?token=YOUR_TOKEN</code> to the URL</p>
          </body>
        </html>
      `);
    }
    
    console.log('📊 POSTS_DASHBOARD: Serving posts analytics...');
    
    const { comprehensiveDashboard } = await import('./dashboard/comprehensiveDashboard');
    const dashboardHTML = await comprehensiveDashboard.generatePostsDashboard();
    
    res.setHeader('Content-Type', 'text/html');
    res.send(dashboardHTML);
    
    console.log('✅ POSTS_DASHBOARD: Delivered');
  } catch (error: any) {
    console.error('❌ POSTS_DASHBOARD_ERROR:', error.message);
    res.status(500).send(`<html><body style="padding: 50px; text-align: center;">
      <h1>🚨 Error</h1><p>${error.message}</p></body></html>`);
  }
});

// Replies dashboard page
app.get('/dashboard/replies', async (req, res) => {
  try {
    const token = req.query.token || req.headers.authorization?.replace('Bearer ', '');
    const adminToken = process.env.ADMIN_TOKEN || 'xbot-admin-2025';
    
    if (token !== adminToken) {
      return res.status(401).send(`
        <html>
          <body style="font-family: Arial; text-align: center; padding: 50px;">
            <h1>🔒 Authentication Required</h1>
            <p>Add <code>?token=YOUR_TOKEN</code> to the URL</p>
          </body>
        </html>
      `);
    }
    
    console.log('📊 REPLIES_DASHBOARD: Serving replies analytics...');
    
    const { comprehensiveDashboard } = await import('./dashboard/comprehensiveDashboard');
    const dashboardHTML = await comprehensiveDashboard.generateRepliesDashboard();
    
    res.setHeader('Content-Type', 'text/html');
    res.send(dashboardHTML);
    
    console.log('✅ REPLIES_DASHBOARD: Delivered');
  } catch (error: any) {
    console.error('❌ REPLIES_DASHBOARD_ERROR:', error.message);
    res.status(500).send(`<html><body style="padding: 50px; text-align: center;">
      <h1>🚨 Error</h1><p>${error.message}</p></body></html>`);
  }
});

// System health dashboard page - Enhanced real-time version
app.get('/dashboard/health', async (req, res) => {
  try {
    const token = req.query.token || req.headers.authorization?.replace('Bearer ', '');
    const adminToken = process.env.ADMIN_TOKEN || 'xbot-admin-2025';
    
    if (token !== adminToken) {
      return res.status(401).send(`
        <html>
          <body style="font-family: Arial; text-align: center; padding: 50px;">
            <h1>🔒 Authentication Required</h1>
            <p>Add <code>?token=YOUR_TOKEN</code> to the URL</p>
          </body>
        </html>
      `);
    }
    
    console.log('🔄 FLOW_DASHBOARD: Serving system flow dashboard...');
    
    const { generateSystemFlowDashboard } = await import('./dashboard/systemFlowDashboard');
    const dashboardHTML = await generateSystemFlowDashboard();
    
    res.setHeader('Content-Type', 'text/html');
    res.send(dashboardHTML);
    
    console.log('✅ FLOW_DASHBOARD: Delivered');
  } catch (error: any) {
    console.error('❌ ENHANCED_DASHBOARD_ERROR:', error.message);
    res.status(500).send(`<html><body style="padding: 50px; text-align: center;">
      <h1>🚨 Error</h1><p>${error.message}</p></body></html>`);
  }
});

// System map dashboard page (visual overview)
app.get('/dashboard/map', async (req, res) => {
  try {
    const token = req.query.token || req.headers.authorization?.replace('Bearer ', '');
    const adminToken = process.env.ADMIN_TOKEN || 'xbot-admin-2025';
    
    if (token !== adminToken) {
      return res.status(401).send(`
        <html>
          <body style="font-family: Arial; text-align: center; padding: 50px;">
            <h1>🔒 Authentication Required</h1>
            <p>Add <code>?token=YOUR_TOKEN</code> to the URL</p>
          </body>
        </html>
      `);
    }
    
    console.log('🗺️ REPLY_MAP: Serving reply system map...');
    
    const { generateReplySystemMap } = await import('./dashboard/replySystemMap');
    const dashboardHTML = await generateReplySystemMap();
    
    res.setHeader('Content-Type', 'text/html');
    res.send(dashboardHTML);
    
    console.log('✅ REPLY_MAP: Delivered');
  } catch (error: any) {
    console.error('❌ REPLY_MAP_ERROR:', error.message);
    res.status(500).send(`<html><body style="padding: 50px; text-align: center;">
      <h1>🚨 Error</h1><p>${error.message}</p></body></html>`);
  }
});

// Temporal intelligence dashboard page
app.get('/dashboard/temporal', async (req, res) => {
  try {
    const token = req.query.token || req.headers.authorization?.replace('Bearer ', '');
    const adminToken = process.env.ADMIN_TOKEN || 'xbot-admin-2025';
    
    if (token !== adminToken) {
      return res.status(401).send(`
        <html>
          <body style="font-family: Arial; text-align: center; padding: 50px;">
            <h1>🔒 Authentication Required</h1>
            <p>Add <code>?token=YOUR_TOKEN</code> to the URL</p>
          </body>
        </html>
      `);
    }
    
    console.log('📊 TEMPORAL_DASHBOARD: Serving temporal intelligence...');
    
    const { comprehensiveDashboard } = await import('./dashboard/comprehensiveDashboard');
    const dashboardHTML = await comprehensiveDashboard.generateTemporalDashboard();
    
    res.setHeader('Content-Type', 'text/html');
    res.send(dashboardHTML);
    
    console.log('✅ TEMPORAL_DASHBOARD: Delivered');
  } catch (error: any) {
    console.error('❌ TEMPORAL_DASHBOARD_ERROR:', error.message);
    res.status(500).send(`<html><body style="padding: 50px; text-align: center;">
      <h1>🚨 Error</h1><p>${error.message}</p></body></html>`);
  }
});

// Follower growth dashboard page
app.get('/dashboard/followers', async (req, res) => {
  try {
    const token = req.query.token || req.headers.authorization?.replace('Bearer ', '');
    const adminToken = process.env.ADMIN_TOKEN || 'xbot-admin-2025';
    
    if (token !== adminToken) {
      return res.status(401).send(`
        <html>
          <body style="font-family: Arial; text-align: center; padding: 50px;">
            <h1>🔒 Authentication Required</h1>
            <p>Add <code>?token=YOUR_TOKEN</code> to the URL</p>
          </body>
        </html>
      `);
    }

    console.log('📈 FOLLOWER_DASHBOARD: Serving follower growth...');
    
    const { generateFollowerGrowthDashboard } = await import('./dashboard/comprehensiveDashboard');
    const html = await generateFollowerGrowthDashboard();
    res.header('Content-Type', 'text/html').send(html);
  } catch (error: any) {
    console.error('[SERVER] Follower dashboard error:', error.message);
    res.status(500).send(`<html><body><h1>Error</h1><pre>${error.message}</pre></body></html>`);
  }
});

// Factor analysis dashboard page
app.get('/dashboard/factors', async (req, res) => {
  try {
    const token = req.query.token || req.headers.authorization?.replace('Bearer ', '');
    const adminToken = process.env.ADMIN_TOKEN || 'xbot-admin-2025';
    
    if (token !== adminToken) {
      return res.status(401).send(`
        <html>
          <body style="font-family: Arial; text-align: center; padding: 50px;">
            <h1>🔒 Authentication Required</h1>
            <p>Add <code>?token=YOUR_TOKEN</code> to the URL</p>
          </body>
        </html>
      `);
    }
    
    console.log('📊 FACTOR_DASHBOARD: Serving factor analysis...');
    
    const { comprehensiveDashboard } = await import('./dashboard/comprehensiveDashboard');
    const dashboardHTML = await comprehensiveDashboard.generateFactorAnalysisDashboard();
    
    res.setHeader('Content-Type', 'text/html');
    res.send(dashboardHTML);
    
    console.log('✅ FACTOR_DASHBOARD: Delivered');
  } catch (error: any) {
    console.error('❌ FACTOR_DASHBOARD_ERROR:', error.message);
    res.status(500).send(`<html><body style="padding: 50px; text-align: center;">
      <h1>🚨 Error</h1><p>${error.message}</p></body></html>`);
  }
});

// Visual Intelligence dashboard page
app.get('/dashboard/formatting', async (req, res) => {
  try {
    const token = req.query.token || req.headers.authorization?.replace('Bearer ', '');
    const adminToken = process.env.ADMIN_TOKEN || 'xbot-admin-2025';
    
    if (token !== adminToken) {
      return res.status(401).send(`
        <html>
          <body style="font-family: Arial; text-align: center; padding: 50px;">
            <h1>🔒 Authentication Required</h1>
            <p>Add <code>?token=YOUR_TOKEN</code> to the URL</p>
          </body>
        </html>
      `);
    }
    
    console.log('🎨 VI_DASHBOARD: Serving visual intelligence...');
    
    const { comprehensiveDashboard } = await import('./dashboard/comprehensiveDashboard');
    const dashboardHTML = await comprehensiveDashboard.generateVisualIntelligenceDashboard();
    
    res.setHeader('Content-Type', 'text/html');
    res.send(dashboardHTML);
    
    console.log('✅ VI_DASHBOARD: Delivered');
  } catch (error: any) {
    console.error('❌ VI_DASHBOARD_ERROR:', error.message);
    res.status(500).send(`<html><body style="padding: 50px; text-align: center;">
      <h1>🚨 Error</h1><p>${error.message}</p></body></html>`);
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
    availableEndpoints: ['/status', '/env', '/canary', '/playwright', '/playwright/ping', '/session', '/posting', '/metrics', '/dashboard', '/dashboard/recent', '/dashboard/posts', '/dashboard/replies']
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
      const port = parseInt(ENV.PORT);
      const host = ENV.HOST;
      const server = app.listen(port, host, () => {
        log({ op: 'server_start', host, port, status: 'listening' });
        log({ op: 'server_endpoints', endpoints: ['status', 'env', 'playwright', 'session', 'learning'] });
        
        // Initialize learning system in background (non-blocking)
        setImmediate(() => {
          learningSystem.initialize()
            .then(() => {
              log({ op: 'learning_system_init', outcome: 'success' });
            })
            .catch((error: any) => {
              log({ op: 'learning_system_init', outcome: 'error', error: error.message });
            });
        });
        
        // 🚨 CRITICAL FIX: Start JobManager to enable posting and replies
        setImmediate(async () => {
          try {
            log({ op: 'job_manager_init', status: 'starting' });
            const jobManager = JobManager.getInstance();
            await jobManager.startJobs();
            log({ op: 'job_manager_init', outcome: 'success' });
            
            // Run plan job immediately to populate queue
            try {
              log({ op: 'startup_plan_job', status: 'running' });
              await jobManager.runJobNow('plan');
              log({ op: 'startup_plan_job', outcome: 'success' });
            } catch (error: any) {
              log({ op: 'startup_plan_job', outcome: 'error', error: error.message });
            }
          } catch (error: any) {
            log({ op: 'job_manager_init', outcome: 'error', error: error.message });
          }
        });
        
        resolve();
      });

      server.on('error', (error) => {
        log({ op: 'server_error', error: error.message });
        reject(error);
      });

      // Graceful shutdown
      process.on('SIGTERM', () => {
        log({ op: 'server_shutdown', status: 'initiated' });
        server.close(() => {
          log({ op: 'server_shutdown', status: 'complete' });
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
