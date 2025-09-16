import express from 'express';
import { HOST, PORT, getSafeEnvironment } from './config/env';
import { getBrowserStatus } from './playwright/browserFactory';
import { checkDatabaseHealth } from './db/index';
import { CadenceGuard } from './posting/cadenceGuard';
import { TweetMetricsTracker } from './metrics/trackTweet';

const app = express();

// Middleware
app.use(express.json());

// Add request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

/**
 * Health and readiness check
 */
app.get('/status', async (req, res) => {
  try {
    console.log('🩺 Performing health check...');
    
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
    const status = getBrowserStatus();
    res.json({
      browser: status,
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
 * Metrics tracking status
 */
app.get('/metrics', async (req, res) => {
  try {
    const health = await TweetMetricsTracker.getInstance().healthCheck();
    res.json({
      metrics: health,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to get metrics status'
    });
  }
});

/**
 * Learning system status endpoint
 */
app.get('/learn/status', async (req, res) => {
  try {
    const { handleLearningStatusRequest } = await import('./api/learningStatus');
    await handleLearningStatusRequest(req, res);
  } catch (error) {
    console.error('Learning status error:', error);
    res.status(500).json({ 
      error: 'Failed to get learning status',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

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
 * 404 handler
 */
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.path,
    timestamp: new Date().toISOString(),
    availableEndpoints: ['/status', '/env', '/playwright', '/session', '/posting', '/metrics']
  });
});

/**
 * Start the health server
 */
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
