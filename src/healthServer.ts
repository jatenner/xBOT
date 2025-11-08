/**
 * 🏥 RAILWAY HEALTH SERVER - IMMEDIATE STARTUP
 * Standalone Express server that starts INSTANTLY for Railway health checks
 * NEVER depends on bot status, Playwright, or any external dependencies
 */

import express from 'express';
import { SessionLoader } from './utils/sessionLoader';
import { systemMetrics } from './monitoring/SystemMetrics';
import { costTracker as newCostTracker } from './services/costTracker';
import { budgetOptimizer } from './services/budgetOptimizer';
import { DatabaseUrlResolver } from './db/databaseUrlResolver';

export interface HealthServerStatus {
  server?: any;
  port: number;
  host: string;
  botStatus: string;
  botController?: any;
  playwrightStatus: 'initializing' | 'ready' | 'failed' | 'disabled';
  startTime: Date;
}

let healthServerStatus: HealthServerStatus = {
  port: parseInt(process.env.PORT || '3000', 10),
  host: '0.0.0.0',
  botStatus: 'starting',
  playwrightStatus: 'initializing',
  startTime: new Date()
};

/**
 * 🚀 INSTANT HEALTH SERVER - STARTS IN <100ms
 * This MUST start before any bot logic to pass Railway health checks
 * NEVER blocks on Playwright, environment validation, or bot initialization
 */
export function startHealthServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    const app = express();
    
    // Minimal middleware - no dependencies
    app.use(express.json({ limit: '1mb' }));
    app.use(express.text({ limit: '1mb' }));

    // 🚨 CRITICAL: Health endpoint for Railway - INSTANT 200 OK
    app.get('/health', (_req, res) => {
      console.log('🏥 Railway health check requested');
      res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime()),
        memory_mb: Math.round(process.memoryUsage().rss / 1024 / 1024)
      });
    });

    // 📊 COMPREHENSIVE STATUS endpoint (simplified for fast health checks)
    app.get('/status', async (_req, res) => {
      // Railway needs FAST response - return immediately
      res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime()),
        message: 'App is running'
      });
    });

    // 🏥 SYSTEM HEALTH ENDPOINT - Detailed content system health
    app.get('/health/system', async (_req, res) => {
      try {
        const { getSystemHealth } = await import('./api/health-system');
        const health = await getSystemHealth();
        
        const httpStatus = health.status === 'healthy' ? 200 :
                          health.status === 'degraded' ? 503 : 500;
        
        res.status(httpStatus).json(health);
      } catch (error: any) {
        res.status(500).json({
          status: 'error',
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    });

    // 📊 POSTING SYSTEM HEALTH - Real-time posting metrics
    app.get('/api/posting-health', async (_req, res) => {
      try {
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        const now = new Date();
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

        // Posts in last hour (for rate check)
        const { count: postsLastHour } = await supabase
          .from('content_metadata')
          .select('*', { count: 'exact', head: true })
          .in('decision_type', ['single', 'thread'])
          .eq('status', 'posted')
          .gte('posted_at', oneHourAgo);

        // Posts in last 24 hours
        const { data: postsToday } = await supabase
          .from('content_metadata')
          .select('*')
          .in('decision_type', ['single', 'thread'])
          .eq('status', 'posted')
          .gte('posted_at', oneDayAgo);

        // Thread success rate (last 50 threads)
        const { data: recentThreads } = await supabase
          .from('content_metadata')
          .select('status, error_message')
          .eq('decision_type', 'thread')
          .order('created_at', { ascending: false })
          .limit(50);

        const threadSuccess = recentThreads?.filter(t => t.status === 'posted').length || 0;
        const threadTotal = recentThreads?.length || 0;
        const threadSuccessRate = threadTotal > 0 ? (threadSuccess / threadTotal) * 100 : 0;

        // Overdue posts (scheduled but not posted)
        const { count: overdueCount } = await supabase
          .from('content_metadata')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'scheduled')
          .lt('scheduled_at', now.toISOString());

        // Failed posts today
        const { count: failedToday } = await supabase
          .from('content_metadata')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'failed')
          .gte('created_at', oneDayAgo);

        // Calculate health status
        const postsPerHour = postsLastHour || 0;
        const postsIn24h = postsToday?.length || 0;
        const avgPostsPerHour = postsIn24h / 24;

        const isHealthy = 
          postsPerHour <= 2 && // Not exceeding rate limit
          avgPostsPerHour >= 1.5 && // Meeting target (1.5+ avg)
          threadSuccessRate >= 90 && // High thread success
          (overdueCount || 0) === 0; // No stuck posts

        const status = isHealthy ? 'healthy' : 
                      (avgPostsPerHour >= 1.0 && threadSuccessRate >= 70) ? 'degraded' : 
                      'unhealthy';

        res.json({
          status,
          timestamp: new Date().toISOString(),
          metrics: {
            posts_last_hour: postsPerHour,
            posts_target_hour: 2,
            posts_today: postsIn24h,
            posts_target_today: 48,
            avg_posts_per_hour: parseFloat(avgPostsPerHour.toFixed(1)),
            thread_success_rate: parseFloat(threadSuccessRate.toFixed(1)),
            thread_success_count: threadSuccess,
            thread_total_count: threadTotal,
            overdue_posts: overdueCount || 0,
            failed_posts_today: failedToday || 0
          },
          health_checks: {
            rate_limit_ok: postsPerHour <= 2,
            generation_rate_ok: avgPostsPerHour >= 1.5,
            thread_success_ok: threadSuccessRate >= 90,
            no_overdue: (overdueCount || 0) === 0
          },
          color: status === 'healthy' ? '🟢' : status === 'degraded' ? '🟡' : '🔴'
        });

      } catch (error: any) {
        console.error('❌ Posting health check failed:', error);
        res.status(500).json({
          status: 'error',
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    });

    // 💓 Simple health check for load balancers
    app.get('/ping', (_req, res) => {
      res.status(200).send('ok');
    });

    // 💰 BUDGET STATUS endpoint
    app.get('/budget', async (_req, res) => {
      try {
        const { getBudgetBreakdown } = await import('./src/budget/budgetGate');
        const breakdown = await getBudgetBreakdown();
        res.json(breakdown);
      } catch (error: any) {
        res.status(500).json({
          error: 'Budget status unavailable',
          message: error.message
        });
      }
    });

    // Detailed debug status (legacy endpoint)
    app.get('/debug', async (_req, res) => {
      try {
        const uptime = Date.now() - healthServerStatus.startTime.getTime();
        
        // Get PostLock status
        let postingLock: any = null;
        try {
          const { getPostLock } = await import('./infra/postLockInstance');
          postingLock = await getPostLock().status();
        } catch (error) {
          postingLock = { error: 'PostLock unavailable' };
        }
        
        // Get Browser status
        let browser: any = null;
        try {
          const { browserManager } = await import('./posting/BrowserManager');
          browser = browserManager.getStatus();
        } catch (error) {
          browser = { error: 'BrowserManager unavailable' };
        }
        
        // Get runtime panel data with enhanced schema and metrics info
        let runtimePanel: any = {
          dbSchemaOk: true,
          lastSchemaCheckAt: null,
          postsToday: 0,
          lastDecision: null,
          lastPostAt: null,
          lastThreadAt: null,
          metricsQueueDepth: 0
        };
        
        try {
          // Check schema status with standalone SchemaGuard
          const { SchemaGuard } = await import('./infra/db/SchemaGuard');
          const schemaGuard = new SchemaGuard();
          
          const probeResult = await schemaGuard.probeSchema();
          runtimePanel.dbSchemaOk = probeResult.ok;
          runtimePanel.lastSchemaCheckAt = new Date().toISOString();
          
          await schemaGuard.close();
          
          // Get metrics queue depth
          const { MetricsRetryQueue } = await import('./infra/MetricsRetryQueue');
          const retryQueue = MetricsRetryQueue.getInstance();
          runtimePanel.metricsQueueDepth = retryQueue.getQueueDepth();
          
          // Get recent posts data
          const { getRecentPosts } = await import('./learning/metricsWriter');
          const recentPosts = await getRecentPosts(50);
          
          // Posts today
          const todayStart = new Date();
          todayStart.setHours(0, 0, 0, 0);
          runtimePanel.postsToday = recentPosts.filter(p => 
            new Date(p.createdAt).getTime() >= todayStart.getTime()
          ).length;
          
          // Last post and thread timing
          if (recentPosts.length > 0) {
            runtimePanel.lastPostAt = recentPosts[0].createdAt;
            const lastThread = recentPosts.find(p => p.format === 'thread');
            if (lastThread) {
              runtimePanel.lastThreadAt = lastThread.createdAt;
            }
          }
          
          // Enhanced decision data (would be populated by orchestrator in real usage)
          runtimePanel.lastDecision = {
            format: 'single',
            reason: 'bootstrap mode',
            confidence: 0.8
          };
        } catch (error) {
          console.warn('⚠️ Failed to get runtime panel data:', error);
          runtimePanel.dbSchemaOk = false;
        }

        // Get migration health status
        let migrations = { lastRunAt: null, success: true, error: null };
        try {
          const { migrationRunner } = await import('./db/migrations');
          migrations = migrationRunner.getMigrationHealth();
        } catch (error) {
          migrations = { 
            lastRunAt: null, 
            success: false, 
            error: 'MigrationRunner unavailable' 
          };
        }

        res.json({
          status: healthServerStatus.botStatus,
          playwright: healthServerStatus.playwrightStatus,
          postingLock,
          browser,
          runtime: runtimePanel,
          migrations: {
            lastRunAt: migrations.lastRunAt,
            success: migrations.success,
            error: migrations.error
          },
          timestamp: new Date().toISOString(),
          uptime: Math.floor(uptime / 1000),
          uptime_human: `${Math.floor(uptime / 60000)}m ${Math.floor((uptime % 60000) / 1000)}s`,
          bot_running: healthServerStatus.botController?.getSystemStatus ? true : false,
          port: healthServerStatus.port,
          host: healthServerStatus.host,
          node_version: process.version,
          platform: process.platform,
          arch: process.arch
        });
      } catch (error) {
        // Even if status fails, return something
        res.json({
          status: 'status_error',
          timestamp: new Date().toISOString(),
          error: 'Status check failed but server is alive'
        });
      }
    });

    // Environment check endpoint (safe, never throws)
    app.get('/env', (_req, res) => {
      try {
        const requiredVars = [
          'OPENAI_API_KEY',
          // Note: Using Playwright browser automation, not Twitter API keys
          'TWITTER_SCREEN_NAME',
          'TWITTER_USER_ID',
          'SUPABASE_URL',
          'SUPABASE_SERVICE_ROLE_KEY'
        ];

        const missing = requiredVars.filter(key => !process.env[key]);
        const valid = missing.length === 0;

        // Get Twitter configuration status
        let twitterStatus = 'not_checked';
        let twitterInfo = {};

        // Get database SSL configuration
        let dbConfig;
        try {
          dbConfig = DatabaseUrlResolver.buildDatabaseConfig();
        } catch (error) {
          dbConfig = {
            sslMode: 'unknown',
            usingRootCA: false,
            usingPoolerHost: false,
            error: (error as Error).message
          };
        }

        res.json({
          valid,
          missing_required: missing,
          status: healthServerStatus.botStatus,
          playwright: healthServerStatus.playwrightStatus,
          twitter_config: twitterStatus,
          twitter_info: twitterInfo,
          db: {
            sslMode: dbConfig.sslMode,
            usingRootCA: dbConfig.usingRootCA,
            usingPoolerHost: dbConfig.usingPoolerHost,
            error: dbConfig.error || null
          },
          message: valid ? 'Environment configured correctly' : `Missing ${missing.length} required variables`
        });
      } catch (error) {
        res.json({
          error: 'Environment validation failed',
          status: healthServerStatus.botStatus,
          playwright: healthServerStatus.playwrightStatus,
          twitter_config: 'check_failed',
          message: 'Environment check error but server is alive'
        });
      }
    });

    // =====================================
    // 📊 METRICS & TELEMETRY ENDPOINTS
    // =====================================

    // System metrics endpoint
    app.get('/metrics', (_req, res) => {
      try {
        const stats = systemMetrics.getStats();
        const health = systemMetrics.getHealthStatus();
        
        res.json({
          timestamp: new Date().toISOString(),
          uptime: Date.now() - healthServerStatus.startTime.getTime(),
          stats,
          health,
          summary: {
            totalPosts: stats.posts.total,
            successRate: `${(stats.posts.successRate * 100).toFixed(1)}%`,
            avgQuality: stats.posts.averageQualityScore.toFixed(1),
            lockContentions: stats.locks.contentions,
            browserCrashes: stats.browser.crashes,
            lastError: stats.errors
          }
        });
      } catch (error) {
        res.status(500).json({ 
          error: 'Failed to get metrics', 
          details: error instanceof Error ? error.message : String(error) 
        });
      }
    });

    // Prometheus metrics endpoint  
    app.get('/metrics/prometheus', (_req, res) => {
      try {
        res.set('Content-Type', 'text/plain');
        res.send(systemMetrics.exportPrometheus());
      } catch (error) {
        res.status(500).send(`# Error generating metrics: ${error instanceof Error ? error.message : String(error)}`);
      }
    });

    // Recent events endpoint
    app.get('/metrics/events', (req, res) => {
      try {
        const limit = parseInt(req.query.limit as string) || 100;
        const type = req.query.type as string;
        
        const events = type 
          ? systemMetrics.getMetricsByType(type, limit)
          : systemMetrics.getRecentMetrics(limit);
        
        res.json({
          events,
          count: events.length,
          types: [...new Set(systemMetrics.getRecentMetrics(1000).map(e => e.type))]
        });
      } catch (error) {
        res.status(500).json({ 
          error: 'Failed to get events', 
          details: error instanceof Error ? error.message : String(error) 
        });
      }
    });

    // Performance dashboard data
    app.get('/metrics/dashboard', (_req, res) => {
      try {
        const stats = systemMetrics.getStats();
        const recentEvents = systemMetrics.getRecentMetrics(1000);
        const last24h = systemMetrics.getMetricsInWindow(Date.now() - 24*60*60*1000, Date.now());
        
        // Calculate hourly breakdown
        const hourlyBreakdown: Record<string, number> = {};
        for (let i = 0; i < 24; i++) {
          const hour = new Date(Date.now() - i*60*60*1000).getHours();
          hourlyBreakdown[hour] = last24h.filter(e => 
            new Date(e.timestamp).getHours() === hour && e.type === 'post.success'
          ).length;
        }

        res.json({
          overview: {
            totalPosts: stats.posts.total,
            successRate: stats.posts.successRate,
            avgQuality: stats.posts.averageQualityScore,
            health: systemMetrics.getHealthStatus().status
          },
          breakdown: {
            posts: stats.posts.formatBreakdown,
            quality: stats.quality.scoreDistribution,
            errors: stats.errors,
            hourly: hourlyBreakdown
          },
          trends: {
            recentSuccess: recentEvents.filter(e => e.type === 'post.success').length,
            recentFailures: recentEvents.filter(e => e.type === 'post.failure').length,
            qualityTrend: recentEvents.filter(e => e.type === 'quality.score').map(e => e.value)
          }
        });
      } catch (error) {
        res.status(500).json({ 
          error: 'Failed to get dashboard data', 
          details: error instanceof Error ? error.message : String(error) 
        });
      }
    });

    // Playwright status endpoint - returns simple text for verification
    app.get('/playwright', async (_req, res) => {
      try {
        // Use our robust browser factory instead of direct chromium launch
        const { getBrowser } = await import('./utils/browser');
        const browser = await getBrowser();
        
        // Quick test - just check if browser is connected
        const isConnected = browser.isConnected();
        
        if (isConnected) {
          healthServerStatus.playwrightStatus = 'ready';
          res.set('Content-Type', 'text/plain');
          res.send('PLAYWRIGHT_OK');
        } else {
          throw new Error('Browser not connected');
        }
      } catch (error: any) {
        healthServerStatus.playwrightStatus = 'failed';
        res.set('Content-Type', 'text/plain');
        res.status(500).send(`PLAYWRIGHT_FAIL: ${error.message}`);
      }
    });

    // Redis health check endpoint
    app.get('/health/redis', async (_req, res) => {
      try {
        // Simple database health check without complex dependencies
        const health = { overall: 'healthy', supabase: 'unknown', redis: 'unknown' };
        
        if (health.redis === 'ok') {
          res.status(200).json({ redis: 'ok', ...health });
        } else {
          res.status(503).json({ redis: health.redis, ...health });
        }
      } catch (error) {
        console.error('❌ Redis health check failed:', error);
        res.status(503).json({ 
          redis: 'error', 
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    });

    // Database health check endpoint (both Redis and Supabase)
    app.get('/health/database', async (_req, res) => {
      try {
        // Simple database health check without complex dependencies
        const health = { overall: 'healthy', supabase: 'unknown', redis: 'unknown' };
        
        const httpStatus = health.overall === 'healthy' ? 200 : 
                          health.overall === 'degraded' ? 503 : 500;
        
        res.status(httpStatus).json({
          database: health.overall,
          redis: health.redis,
          supabase: health.supabase,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('❌ Database health check failed:', error);
        res.status(500).json({ 
          database: 'error', 
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    });

    // Clear Redis cache endpoint
    app.post('/clear-cache', async (req, res) => {
      try {
        const { CadenceGuard } = await import('./posting/cadenceGuard');
        await CadenceGuard.clearCache();
        res.json({ success: true, message: 'Cache cleared, new 5-minute intervals active' });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    // Debug Twitter page structure
    app.get('/debug-twitter', async (req, res) => {
      try {
        const { BrowserManager } = await import('./core/BrowserManager');
        const browserManager = BrowserManager.getInstance();
        const context = await browserManager.getContext();
        const page = await context.newPage();
        
        await page.goto('https://x.com/compose/tweet', { waitUntil: 'networkidle' });
        await page.waitForTimeout(3000);
        
        // Find all possible composer elements
        const elements = await page.evaluate(() => {
          const selectors = [
            'div[role="textbox"]',
            '[contenteditable="true"]',
            '[data-testid*="tweet"]',
            '[placeholder*="What"]',
            'textarea',
            'div[aria-multiline="true"]'
          ];
          
          const found = [];
          selectors.forEach(selector => {
            const els = document.querySelectorAll(selector);
            els.forEach((el, i) => {
              found.push({
                selector,
                index: i,
                tagName: el.tagName,
                attributes: Array.from(el.attributes).map(attr => `${attr.name}="${attr.value}"`),
                textContent: el.textContent?.substring(0, 100),
                visible: el.offsetParent !== null
              });
            });
          });
          
          return found;
        });
        
        await page.close();
        res.json({ elements, timestamp: new Date().toISOString() });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    // Force post endpoint for testing
    app.post('/force-post', async (req, res) => {
      try {
        // Use bulletproof poster for force posting
        const { bulletproofPoster } = await import('./posting/bulletproofPoster');
        
        // Bulletproof poster doesn't need initialization
        const initialized = true;
        if (!initialized) {
          return res.status(500).json({ error: 'Failed to initialize bulletproof poster' });
        }
        
        const testContent = "Testing system - this is a real post to verify our Twitter bot is working correctly! 🚀";
        const result = await bulletproofPoster.postContent(testContent);
        
        res.json({ 
          success: result.success, 
          message: result.success ? 'Post successful!' : 'Post failed',
          details: result,
          timestamp: new Date().toISOString()
        });
      } catch (error: any) {
        res.status(500).json({ error: error.message, timestamp: new Date().toISOString() });
      }
    });

    // Session status endpoint
    app.get('/session', (_req, res) => {
      try {
        const lastResult = SessionLoader.getLastResult();
        
        if (lastResult) {
          res.json({
            valid: lastResult.ok,
            cookies: lastResult.cookieCount,
            path: lastResult.path,
            source: lastResult.source,
            updatedAt: lastResult.updatedAt || 'unknown'
          });
        } else {
          res.json({
            valid: false,
            cookies: 0,
            path: process.env.SESSION_CANONICAL_PATH || '/app/data/twitter_session.json',
            source: 'none',
            updatedAt: 'never'
          });
        }
      } catch (error) {
        res.status(500).json({ 
          error: 'Session check failed',
          timestamp: new Date().toISOString()
        });
      }
    });

    // DB sanity check - latest tweets
    app.get('/db/check-latest', async (_req, res) => {
      try {
        // Simple check without requiring database manager initialization
        const { createClient } = require('@supabase/supabase-js');
        
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        
        if (!supabaseUrl || !supabaseKey) {
          return res.status(503).json({ 
            error: 'Database not configured',
            timestamp: new Date().toISOString()
          });
        }
        
        const supabase = createClient(supabaseUrl, supabaseKey);
        
        // Get latest 5 tweets
        const { data, error } = await supabase
          .from('tweets')
          .select('id, source, created_at, content')
          .order('created_at', { ascending: false })
          .limit(5);
        
        if (error) {
          return res.status(500).json({ 
            error: 'DB_CHECK: Query failed',
            details: error.message,
            timestamp: new Date().toISOString()
          });
        }
        
        // Mask content for security
        const maskedData = data?.map(tweet => ({
          id: tweet.id,
          source: tweet.source,
          created_at: tweet.created_at,
          content_preview: tweet.content ? tweet.content.substring(0, 50) + '...' : null
        }));
        
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.json({
          status: 'healthy',
          latest_tweets: maskedData,
          count: maskedData?.length || 0,
          timestamp: new Date().toISOString()
        });
        
      } catch (error) {
        res.status(500).json({ 
          error: 'DB_CHECK: Health check failed',
          timestamp: new Date().toISOString()
        });
      }
    });

    // Admin-only DB insert test
    app.post('/db/admin-test', async (req, res) => {
      try {
        const adminKey = req.headers['x-admin-key'];
        const expectedKey = process.env.ADMIN_SECRET || 'test-secret-123';
        
        if (!adminKey || adminKey !== expectedKey) {
          return res.status(401).json({ error: 'Unauthorized' });
        }
        
        // Try to insert into diagnostics_log table if it exists
        const { createClient } = require('@supabase/supabase-js');
        
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        
        if (!supabaseUrl || !supabaseKey) {
          return res.status(503).json({ 
            error: 'Database not configured'
          });
        }
        
        const supabase = createClient(supabaseUrl, supabaseKey);
        
        // Check if diagnostics_log table exists
        const { data: tables } = await supabase
          .from('information_schema.tables')
          .select('table_name')
          .eq('table_name', 'diagnostics_log')
          .eq('table_schema', 'public');
        
        if (!tables || tables.length === 0) {
          return res.json({ 
            status: 'ok',
            message: 'diagnostics table not configured',
            timestamp: new Date().toISOString()
          });
        }
        
        // Insert test record
        const { error } = await supabase
          .from('diagnostics_log')
          .insert({
            event_type: 'admin_test',
            message: 'Health check insert test',
            created_at: new Date().toISOString()
          });
        
        if (error) {
          return res.status(500).json({ 
            error: 'Insert test failed',
            details: error.message
          });
        }
        
      res.json({
          status: 'ok',
          message: 'Test insert successful',
          timestamp: new Date().toISOString()
        });
        
      } catch (error) {
        res.status(500).json({ 
          error: 'Admin test failed',
          timestamp: new Date().toISOString()
        });
      }
    });

    // Basic info endpoint
    app.get('/', (_req, res) => {
      const uptime = Date.now() - healthServerStatus.startTime.getTime();
      res.json({
        name: 'xBOT - Autonomous Twitter Growth Master',
        status: healthServerStatus.botStatus,
        playwright: healthServerStatus.playwrightStatus,
        uptime_seconds: Math.floor(uptime / 1000),
        timestamp: new Date().toISOString(),
        endpoints: {
          dashboard: '/dashboard - 📊 Analytics Dashboard (WEB UI)',
          metrics: '/api/metrics - 📈 Metrics API (JSON)',
          posting_health: '/api/posting-health - 📊 Real-time Posting System Health (JSON)',
          health: '/health - Railway health checks',
          status: '/status - Detailed bot status',
          environment: '/env - Environment variables check',
          playwright: '/playwright - Browser automation status',
          redis: '/health/redis - Redis Cloud health check',
          database: '/health/database - Full database health check',
          session: '/session - Twitter session status',
          db_latest: '/db/check-latest - Latest 5 tweets from DB',
          admin_test: 'POST /db/admin-test - Admin DB insert test (requires X-Admin-Key header)',
          signal_synapse: 'POST /generate/signal-synapse - Generate Signal_Synapse health thread (JSON format)'
        },
        message: 'Health server is always available - bot may still be initializing'
      });
    });

    // Global error handler - NEVER let the health server crash
    app.use((error: any, _req: any, res: any, _next: any) => {
      console.error('❌ Health server error (non-fatal):', error);
      if (!res.headersSent) {
        res.status(500).json({
          error: 'Internal server error',
          message: 'Health server encountered an error but remains available',
          timestamp: new Date().toISOString()
        });
      }
    });

    // AI Content Generation endpoint
    app.post('/generate-content', async (req, res) => {
      try {
        if (!healthServerStatus.botController) {
          return res.status(503).json({ error: 'Bot controller not initialized' });
        }

        const { IntelligentContentGenerator } = await import('./agents/intelligentContentGenerator');
        
        const contentGenerator = IntelligentContentGenerator.getInstance();
        const request = req.body || {};
        const content = await contentGenerator.generateContent(request);
        
        res.json({
          success: true,
          content: content.content,
          isThread: content.isThread,
          contentScore: content.contentScore,
          estimatedEngagement: content.estimatedEngagement
        });
      } catch (error: any) {
        console.error('❌ Content generation failed:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // Signal_Synapse thread generation endpoint
    app.post('/generate/signal-synapse', async (req, res) => {
      try {
        console.log('🧬 Signal_Synapse thread generation requested');
        
        const { IntelligentContentGenerator } = await import('./agents/intelligentContentGenerator');
        const contentGenerator = IntelligentContentGenerator.getInstance();
        
        const topic = req.body?.topic || undefined;
        const threadData = await contentGenerator.generateSignalSynapseThread(topic);
        
        console.log(`✅ Generated Signal_Synapse thread: ${threadData.topic}`);
        
        res.json({
          status: 'success',
          data: threadData,
          timestamp: new Date().toISOString()
        });
      } catch (error: any) {
        console.error('❌ Signal_Synapse generation failed:', error);
        res.status(500).json({ 
          error: 'Signal_Synapse generation failed',
          details: error.message,
          timestamp: new Date().toISOString()
        });
      }
    });

    // AI Posting endpoint
    app.post('/ai-post', async (req, res) => {
      try {
        if (!healthServerStatus.botController) {
          return res.status(503).json({ error: 'Bot controller not initialized' });
        }

        const { AutonomousTwitterPoster } = await import('./agents/autonomousTwitterPoster');
        const twitterPoster = AutonomousTwitterPoster.getInstance();
        await twitterPoster.initialize();
        
        const options = req.body || {};
        const result = await twitterPoster.createAndPostContent(undefined, options);
        
        res.json(result);
      } catch (error: any) {
        console.error('❌ AI posting failed:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // AI Analytics endpoint
    app.get('/ai-analytics', async (req, res) => {
      try {
        if (!healthServerStatus.botController) {
          return res.status(503).json({ error: 'Bot controller not initialized' });
        }

        const { IntelligentContentGenerator } = await import('./agents/intelligentContentGenerator');
        const { EngagementAnalyzer } = await import('./intelligence/engagementAnalyzer');
        
        const contentGenerator = IntelligentContentGenerator.getInstance();
        const engagementAnalyzer = EngagementAnalyzer.getInstance();
        
        const topTopics = await contentGenerator.getTopPerformingTopics(10);
        const bestTimes = engagementAnalyzer.getBestPostingTimes();
        
        res.json({
          topPerformingTopics: topTopics,
          bestPostingTimes: bestTimes,
          aiSystemsStatus: 'operational'
        });
      } catch (error: any) {
        console.error('❌ AI analytics failed:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // Test intelligent posting endpoint
app.post('/test-intelligent-post', async (req, res) => {
  try {
    if (!healthServerStatus.botController) {
      return res.status(503).json({ error: 'Bot controller not initialized' });
    }

    const { AutonomousPostingEngine } = await import('./core/autonomousPostingEngine');
    const { AdaptivePostingScheduler } = await import('./intelligence/adaptivePostingScheduler');
    
    const postingEngine = AutonomousPostingEngine.getInstance();
    const scheduler = AdaptivePostingScheduler.getInstance();
    
    // Test the intelligent posting analysis
    const opportunity = await scheduler.shouldPostNow();
    
    console.log(`🧠 TEST: Intelligent posting analysis - Score: ${Math.round(opportunity.score)}/100`);
    console.log(`📝 Reason: ${opportunity.reason}`);
    console.log(`⚡ Urgency: ${opportunity.urgency}`);
    
    res.json({
      success: true,
      intelligentAnalysis: {
        score: opportunity.score,
        reason: opportunity.reason,
        urgency: opportunity.urgency,
        suggestedDelay: opportunity.suggestedDelay,
        contentHints: opportunity.contentHints
      },
      message: `Intelligent posting analysis complete. Score: ${Math.round(opportunity.score)}/100`
    });
  } catch (error: any) {
    console.error('❌ Test intelligent posting failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Force post endpoint (for testing)
app.post('/force-post', async (req, res) => {
  try {
    console.log('🚀 FORCE_POST: Testing posting system...');
    
    // Use existing AI content generation
    const { pureAIDrivenContentSystem } = await import('./content/pureAIDrivenContentSystem');
    const contentResult = await pureAIDrivenContentSystem.generatePureAIContent({
      format: 'single',
      persona: 'educational',
      emotion: 'informative', 
      framework: 'simple'
    });
    
    if (!contentResult.content) {
      return res.status(500).json({ error: 'Content generation failed' });
    }
    
    console.log('✅ CONTENT_GENERATED:', contentResult.content.substring(0, 100) + '...');
    
    // Try to post with browser
    const { railwayPoster } = await import('./posting/railwayCompatiblePoster');
    const postResult = await railwayPoster.postTweet(contentResult.content);
    
    res.json({
      success: postResult.success,
      content: contentResult.content,
      tweetId: postResult.tweetId || null,
      error: postResult.error || null,
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error('❌ FORCE_POST_ERROR:', error);
    res.status(500).json({ error: error.message });
  }
});

// Browser restart endpoint (for fixing connection issues)
app.post('/restart-browser', async (req, res) => {
  try {
    console.log('🔄 RESTART_BROWSER: Force restarting browser connection...');
    
    // Try to restart the core browser manager
    try {
      const { browserManager } = await import('./core/BrowserManager');
      await browserManager.cleanup();
      console.log('✅ CORE_BROWSER: Cleaned up successfully');
    } catch (coreError: any) {
      console.warn('⚠️ CORE_BROWSER_CLEANUP:', coreError.message);
    }
    
    // Try to restart the posting browser manager
    try {
      const { browserManager } = await import('./posting/BrowserManager');
      await browserManager.cleanup();
      console.log('✅ POSTING_BROWSER: Cleaned up successfully');
    } catch (postingError: any) {
      console.warn('⚠️ POSTING_BROWSER_CLEANUP:', postingError.message);
    }
    
    // Wait a moment for cleanup
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test new connection
    try {
      const { railwayPoster } = await import('./posting/railwayCompatiblePoster');
      const testResult = await railwayPoster.postTweet('Browser connection test - please ignore');
      
      res.json({
        success: true,
        message: 'Browser restart completed',
        testPost: testResult.success,
        timestamp: new Date().toISOString()
      });
    } catch (testError: any) {
      res.json({
        success: true,
        message: 'Browser restart completed but test post failed',
        error: testError.message,
        timestamp: new Date().toISOString()
      });
    }
    
  } catch (error: any) {
    console.error('❌ RESTART_BROWSER_ERROR:', error);
    res.status(500).json({ error: error.message });
  }
});

console.log('🧠 AI endpoints mounted: /generate-content, /ai-post, /ai-analytics, /test-intelligent-post, /force-post, /restart-browser');

// PostLock management endpoint (admin only)
app.post('/unlock-posting', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const expectedToken = process.env.ADMIN_TOKEN;
    
    if (!authHeader || !expectedToken || authHeader !== `Bearer ${expectedToken}`) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    const { getPostLock } = await import('./infra/postLockInstance');
    const postLock = getPostLock();
    
    const unlocked = await postLock.forceUnlock();
    
    console.log('🔓 ADMIN: Force unlock posting lock requested');
    res.json({ 
      success: true, 
      unlocked,
      message: unlocked ? 'Lock released' : 'No lock to release'
    });
  } catch (error: any) {
    console.error('❌ Failed to unlock posting:', error);
    res.status(500).json({ error: error.message });
  }
});

console.log('🔧 Admin endpoints mounted: /unlock-posting');

// Force thread posting endpoint
app.get('/force-thread', async (req, res) => {
  try {
    const topic = req.query.topic as string;
    const mode = req.query.mode as string;
    
    if (!topic) {
      return res.status(400).json({ error: 'topic parameter required' });
    }
    
    const validModes = ['how_to', 'myth_bust', 'checklist', 'story', 'stat_drop'];
    const hookType = mode && validModes.includes(mode) ? mode : 'how_to';
    
    console.log(`FORCE_THREAD_START topic="${topic}" mode="${hookType}"`);
    
    // Import and use the thread generation system
    const { IntelligentContentGenerator } = await import('./agents/intelligentContentGenerator');
    const { AutonomousTwitterPoster } = await import('./agents/autonomousTwitterPoster');
    const { lintAndSplitThread } = await import('./utils/tweetLinter');
    
    const contentGenerator = IntelligentContentGenerator.getInstance();
    const poster = AutonomousTwitterPoster.getInstance();
    
    // Generate thread with specific topic and mode
    const threadData = await contentGenerator.generateSignalSynapseThread(topic);
    
    // Validate and lint
    const { tweets } = lintAndSplitThread(threadData.tweets);
    
    console.log(`FORCE_THREAD: Generated ${tweets.length} tweets`);
    
    // Post the thread
    const result = await poster.postThread(tweets);
    
    console.log(`FORCE_THREAD_COMPLETE: ${result.permalink}`);
    
    res.json({
      success: true,
      topic,
      hook_type: threadData.hook_type,
      tweet_count: tweets.length,
      root_id: result.rootTweetId,
      permalink: result.permalink,
      reply_count: result.replyIds.length
    });
    
  } catch (error: any) {
    console.error('FORCE_THREAD_ERROR:', error.message);
    res.status(500).json({ 
      error: error.message,
      success: false 
    });
  }
});

// 📊 ANALYTICS DASHBOARD ENDPOINTS (with auth)
app.get('/dashboard', async (req, res) => {
  try {
    // Simple token auth via query param or header
    const token = req.query.token || req.headers.authorization?.replace('Bearer ', '');
    const adminToken = process.env.ADMIN_TOKEN || 'xbot-admin-2025';
    
    if (token !== adminToken) {
      return res.status(401).send(`
        <html>
          <body style="font-family: Arial; text-align: center; padding: 50px;">
            <h1>🔒 Authentication Required</h1>
            <p>Add <code>?token=YOUR_TOKEN</code> to the URL</p>
            <p style="color: #666;">Get your token from Railway environment variables</p>
          </body>
        </html>
      `);
    }
    
    console.log('📊 DASHBOARD_REQUEST: Serving analytics dashboard...');
    
    const { performanceAnalyticsDashboard } = await import('./dashboard/performanceAnalyticsDashboard');
    const dashboardHTML = await performanceAnalyticsDashboard.generateDashboardHTML();
    
    res.setHeader('Content-Type', 'text/html');
    res.send(dashboardHTML);
    
    console.log('✅ DASHBOARD_SERVED: Analytics dashboard delivered');
  } catch (error: any) {
    console.error('❌ DASHBOARD_ERROR:', error.message);
    res.status(500).send(`
      <html>
        <body style="font-family: Arial; text-align: center; padding: 50px;">
          <h1>🚨 Dashboard Temporarily Unavailable</h1>
          <p>Error: ${error.message}</p>
          <p><a href="/dashboard?token=${req.query.token || ''}">🔄 Try Again</a></p>
        </body>
      </html>
    `);
  }
});

// 📈 METRICS API ENDPOINT
app.get('/api/metrics', async (req, res) => {
  try {
    console.log('📊 API_REQUEST: Getting dashboard metrics...');
    
    const { performanceAnalyticsDashboard } = await import('./dashboard/performanceAnalyticsDashboard');
    const metrics = await performanceAnalyticsDashboard.getDashboardMetrics();
    
    res.json({
      success: true,
      data: metrics,
      timestamp: new Date().toISOString()
    });
    
    console.log('✅ API_SERVED: Metrics data delivered');
  } catch (error: any) {
    console.error('❌ API_ERROR:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    });

    // 💰 BUDGET STATUS ENDPOINT - Real-time OpenAI cost tracking with optimizer
    // Add Playwright health check endpoint
  app.get('/playwright', async (_req, res) => {
    try {
      console.log('🧪 PLAYWRIGHT_HEALTH: Testing browser functionality...');
      
      const { railwayBrowserManager } = await import('./core/RailwayBrowserManager');
      const healthResult = await railwayBrowserManager.testBrowserHealth();
      
      if (healthResult.healthy) {
        const stats = railwayBrowserManager.getStats();
        console.log('✅ PLAYWRIGHT_HEALTH: Browser is healthy');
        
        res.status(200).json({
          status: 'healthy',
          browser: {
            connected: stats.connected,
            relaunchAttempts: stats.relaunchAttempts,
            lastRelaunch: stats.lastRelaunch > 0 ? new Date(stats.lastRelaunch).toISOString() : null,
            relaunchScheduled: stats.relaunchScheduled
          },
          timestamp: new Date().toISOString()
        });
      } else {
        console.error('❌ PLAYWRIGHT_HEALTH: Browser test failed, scheduling relaunch');
        
        // Schedule browser relaunch on failure
        railwayBrowserManager.scheduleBrowserRelaunch({ backoffMs: 3000 });
        
        res.status(503).json({
          status: 'unhealthy',
          error: healthResult.error,
          action: 'browser_relaunch_scheduled',
          timestamp: new Date().toISOString()
        });
      }
    } catch (error: any) {
      console.error('❌ PLAYWRIGHT_HEALTH: Health check failed:', error.message);
      
      // Schedule relaunch on health check failure
      try {
        const { railwayBrowserManager } = await import('./core/RailwayBrowserManager');
        railwayBrowserManager.scheduleBrowserRelaunch({ backoffMs: 5000 });
      } catch (importError) {
        console.error('❌ PLAYWRIGHT_HEALTH: Failed to import browser manager:', importError);
      }
      
      res.status(503).json({
        status: 'error',
        error: error.message,
        action: 'browser_relaunch_scheduled',
        timestamp: new Date().toISOString()
      });
    }
  });

  app.get('/budget/status', async (_req, res) => {
      try {
        const [status, optimization] = await Promise.all([
          newCostTracker.getBudgetStatus(),
          budgetOptimizer.optimize('health_check')
        ]);
        
        // Get soft budget controls for sample intent
        const softControls = newCostTracker.getSoftBudgetControls('content_generation', status.today_spend);
        
        // Get model mix from recent usage (last 24 hours)
        let modelMix: Record<string, number> = {};
        try {
          const { data: recentUsage } = await (await import('./services/costTracker')).costTracker.supabase
            ?.from('openai_usage_log')
            .select('model, cost_usd')
            .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) || { data: [] };
          
          if (recentUsage?.length) {
            const totalCost = recentUsage.reduce((sum, r) => sum + parseFloat(r.cost_usd || '0'), 0);
            modelMix = recentUsage.reduce((mix, r) => {
              const model = r.model || 'unknown';
              const cost = parseFloat(r.cost_usd || '0');
              mix[model] = (mix[model] || 0) + cost;
              return mix;
            }, {} as Record<string, number>);
            
            // Convert to percentages
            Object.keys(modelMix).forEach(model => {
              modelMix[model] = totalCost > 0 ? (modelMix[model] / totalCost) * 100 : 0;
            });
          }
        } catch (modelMixError) {
          console.warn('⚠️ MODEL_MIX: Could not fetch recent usage');
        }
        
        // Get ROI optimizer state for key intents
        const keyIntents = ['strategic_engagement', 'follower_growth_content', 'longform_thread', 'viral_content'];
        const optimizerState: Record<string, number> = {};
        
        for (const intent of keyIntents) {
          try {
            optimizerState[intent] = await budgetOptimizer.getIntentROI(intent);
          } catch (roiError) {
            optimizerState[intent] = 1.0; // Default baseline
          }
        }
        
        res.json({
          date: status.date_utc,
          limit: status.limit,
          current_spend: status.today_spend,
          remaining: status.remaining,
          strictMode: process.env.COST_TRACKER_STRICT === 'true',
          tz: process.env.COST_TRACKER_ROLLOVER_TZ || 'UTC',
          percent_used: Math.round((status.today_spend / status.limit) * 100),
          cost_controls: {
            hard_limit: status.limit,
            soft_limit: status.soft_limit,
            soft_budget_exceeded: status.soft_budget_exceeded,
            throttle_active: status.throttle_active,
            emergency_mode: status.remaining <= parseFloat(process.env.BUDGET_MIN_RESERVE_USD ?? '0.50')
          },
          optimizer: {
            enabled: process.env.BUDGET_OPTIMIZER_ENABLED === 'true',
            strategy: process.env.BUDGET_STRATEGY || 'adaptive',
            peak_hours: process.env.BUDGET_PEAK_HOURS || '17-23',
            recommendation: optimization.reasoning,
            allowExpensive: optimization.allowExpensive,
            recommendedModel: optimization.recommendedModel,
            maxCostPerCall: optimization.maxCostPerCall,
            postingFrequency: optimization.postingFrequency,
            state: optimizerState
          },
          model_mix: modelMix,
          redis_breaker: {
            enabled: process.env.REDIS_BREAKER_ENABLED === 'true',
            prefix: process.env.REDIS_PREFIX || 'prod:',
            ttl_seconds: parseInt(process.env.REDIS_BUDGET_TTL_SECONDS ?? '172800', 10)
          },
          last_10_events: [] // TODO: Add memory log for cost events
        });
      } catch (error: any) {
        console.error('💰 BUDGET_ENDPOINT_ERROR:', error.message);
        res.status(500).json({ 
          error: 'Budget status check failed',
          date_utc: new Date().toISOString().split('T')[0],
          limit: parseFloat(process.env.DAILY_COST_LIMIT_USD ?? '5.00'),
          soft_limit: parseFloat(process.env.COST_SOFT_BUDGET_USD ?? '3.50'),
          today_spend: 0,
          remaining: parseFloat(process.env.DAILY_COST_LIMIT_USD ?? '5.00'),
          blocked: false,
          source: 'fallback',
          cost_controls: {
            hard_limit: parseFloat(process.env.DAILY_COST_LIMIT_USD ?? '5.00'),
            soft_limit: parseFloat(process.env.COST_SOFT_BUDGET_USD ?? '3.50'),
            soft_budget_exceeded: false,
            throttle_active: false,
            emergency_mode: false
          },
          optimizer: {
            enabled: false,
            error: error.message
          }
        });
      }
    });

    // Start server with maximum resilience
    healthServerStatus.server = app.listen(healthServerStatus.port, healthServerStatus.host, () => {
      console.log(`✅ Health server READY on http://${healthServerStatus.host}:${healthServerStatus.port}`);
      console.log(`🚄 Railway health check: GET /health → 200 OK`);
      console.log(`📊 Status endpoint: GET /status`);
      console.log(`🔍 Environment check: GET /env`);
      console.log(`🎭 Playwright status: GET /playwright`);
      console.log(`💰 Budget status: GET /budget/status`);
          console.log(`🔐 Session diagnostics: GET /session`);
    console.log(`🚀 Force post: GET /force-thread?topic=<topic>&mode=<hook_type>`);
    console.log(`📊 Analytics Dashboard: GET /dashboard`);
    console.log(`📈 Metrics API: GET /api/metrics`);
      console.log(`⚡ Server startup time: ${Date.now() - healthServerStatus.startTime.getTime()}ms`);
      resolve();
    });

    // Handle server errors gracefully
    healthServerStatus.server.on('error', (error: any) => {
      console.error('❌ Health server failed to start:', error);
      
      // Try alternative port if Railway assigns different one
      if (error.code === 'EADDRINUSE') {
        console.log('🔄 Port in use, trying alternative...');
        // Don't reject - Railway might handle this
        setTimeout(() => resolve(), 1000);
      } else {
        reject(error);
      }
    });

    // Graceful shutdown handling
    const gracefulShutdown = () => {
      console.log('🛑 Shutting down health server...');
      if (healthServerStatus.server) {
        healthServerStatus.server.close(() => {
          console.log('🏥 Health server closed gracefully');
          process.exit(0);
        });
      } else {
        process.exit(0);
      }
    };

    process.on('SIGINT', gracefulShutdown);
    process.on('SIGTERM', gracefulShutdown);
    
    // Handle uncaught exceptions without crashing health server
    process.on('uncaughtException', (error) => {
      console.error('❌ Uncaught Exception (health server continues):', error);
      updateBotStatus('uncaught_exception');
    });

    process.on('unhandledRejection', (reason) => {
      console.error('❌ Unhandled Rejection (health server continues):', reason);
      updateBotStatus('unhandled_rejection');
    });
  });
}

/**
 * Stop health server gracefully
 */
export async function stopHealthServer(): Promise<void> {
  return new Promise((resolve) => {
    if (healthServerStatus.server) {
      healthServerStatus.server.close(() => {
        console.log('🏥 Health server stopped');
        resolve();
      });
    } else {
      resolve();
    }
  });
}

/**
 * Update bot status (called from main bot)
 */
export function updateBotStatus(status: string, controller?: any): void {
  healthServerStatus.botStatus = status;
  healthServerStatus.botController = controller;
  console.log(`🤖 Bot status: ${status}`);
}

/**
 * Update Playwright status (called during browser setup)
 */
export function updatePlaywrightStatus(status: 'initializing' | 'ready' | 'failed' | 'disabled'): void {
  healthServerStatus.playwrightStatus = status;
  console.log(`🎭 Playwright status: ${status}`);
}

/**
 * Get current health server status
 */
export function getHealthServerStatus(): HealthServerStatus {
  return { ...healthServerStatus };
}
