/**
 * 🎮 ADMIN DASHBOARD ACTION ENDPOINTS
 * 
 * API endpoints for dashboard control buttons:
 * - Force post
 * - Run jobs (scraper, harvester, content, reply)
 * - Browser restart
 * - Queue management
 */

import express from 'express';
import { requireAdminAuth } from './middleware/adminAuth';

const router = express.Router();

// Apply admin authentication to all routes
router.use(requireAdminAuth);

/**
 * 📤 POST /api/admin/force-post
 * Trigger an immediate post from the queue
 */
router.post('/force-post', async (req, res) => {
  try {
    console.log('[ADMIN_ACTION] Force post requested');
    
    const { JobManager } = await import('../jobs/jobManager');
    const jobManager = JobManager.getInstance();
    
    // Trigger posting queue job
    await jobManager.runJobNow('posting');
    
    res.json({
      success: true,
      message: 'Posting queue triggered',
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('[ADMIN_ACTION] Force post error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 🎯 POST /api/admin/run-job
 * Run a specific job manually
 */
router.post('/run-job', async (req, res) => {
  try {
    const { jobName } = req.body;
    
    if (!jobName) {
      return res.status(400).json({
        success: false,
        error: 'Job name is required'
      });
    }
    
    console.log(`[ADMIN_ACTION] Running job: ${jobName}`);
    
    const { JobManager } = await import('../jobs/jobManager');
    const jobManager = JobManager.getInstance();
    
    // Map dashboard job names to actual job names
    // Valid job names: 'plan', 'reply', 'posting', 'outcomes', 'learn', 'account_discovery', 'realOutcomes', 'analyticsCollector', 'trainPredictor'
    const jobMapping: Record<string, string> = {
      'metrics': 'realOutcomes',
      'scraper': 'realOutcomes',
      'harvester': 'account_discovery',
      'plan': 'plan',
      'reply': 'reply',
      'content': 'plan',
      'posting': 'posting'
    };
    
    const actualJobName = jobMapping[jobName] || jobName;
    
    // Run the job
    await jobManager.runJobNow(actualJobName);
    
    res.json({
      success: true,
      message: `Job '${actualJobName}' triggered`,
      jobName: actualJobName,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('[ADMIN_ACTION] Run job error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 🔄 POST /api/admin/restart-browser
 * Restart browser pool (already exists in healthServer.ts, but adding here for consistency)
 */
router.post('/restart-browser', async (req, res) => {
  try {
    console.log('[ADMIN_ACTION] Browser restart requested');
    
    // Use the existing browser restart logic
    const { UnifiedBrowserPool } = await import('../browser/UnifiedBrowserPool');
    const pool = UnifiedBrowserPool.getInstance();
    
    // Shutdown and reinitialize
    await pool.shutdown();
    
    res.json({
      success: true,
      message: 'Browser pool restarted',
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('[ADMIN_ACTION] Browser restart error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 🗑️ POST /api/admin/clear-failed-queue
 * Clear all failed items from the queue
 */
router.post('/clear-failed-queue', async (req, res) => {
  try {
    console.log('[ADMIN_ACTION] Clear failed queue requested');
    
    const { getSupabaseClient } = await import('../db/index');
    const supabase = getSupabaseClient();
    
    // Delete all failed items
    const { data, error } = await supabase
      .from('content_metadata')
      .delete()
      .eq('status', 'failed');
    
    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }
    
    res.json({
      success: true,
      message: 'Failed queue items cleared',
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('[ADMIN_ACTION] Clear failed queue error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 📊 GET /api/admin/system-stats
 * Get real-time system statistics for dashboard
 */
router.get('/system-stats', async (req, res) => {
  try {
    const { getSupabaseClient } = await import('../db/index');
    const { UnifiedBrowserPool } = await import('../browser/UnifiedBrowserPool');
    const { JobManager } = await import('../jobs/jobManager');
    
    const supabase = getSupabaseClient();
    const browserPool = UnifiedBrowserPool.getInstance();
    const jobManager = JobManager.getInstance();
    
    // Get queue counts
    const { count: queuedCount } = await supabase
      .from('content_metadata')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'queued');
    
    const { count: failedCount } = await supabase
      .from('content_metadata')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'failed');
    
    const { count: postedCount } = await supabase
      .from('content_metadata')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'posted')
      .gte('posted_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
    
    // Get browser stats
    const browserMetrics = browserPool.getMetrics();
    
    // Get job stats
    const jobStats = jobManager.getStats();
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      stats: {
        queue: {
          queued: queuedCount || 0,
          failed: failedCount || 0,
          posted24h: postedCount || 0
        },
        browser: {
          successRate: browserMetrics.totalOperations > 0 
            ? Math.round((browserMetrics.successfulOperations / browserMetrics.totalOperations) * 100)
            : 100,
          activeContexts: browserMetrics.activeContexts,
          queueLength: browserMetrics.queueLength
        },
        jobs: {
          planRuns: jobStats.planRuns,
          replyRuns: jobStats.replyRuns,
          postingRuns: jobStats.postingRuns,
          outcomeRuns: jobStats.outcomeRuns,
          learnRuns: jobStats.learnRuns,
          errors: jobStats.errors
        },
        system: {
          uptime: Math.floor(process.uptime()),
          memoryMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024)
        }
      }
    });
  } catch (error: any) {
    console.error('[ADMIN_ACTION] System stats error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 📝 GET /api/admin/recent-logs
 * Get recent system logs for dashboard (future enhancement)
 */
router.get('/recent-logs', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    
    // This is a placeholder - implement log storage if needed
    res.json({
      success: true,
      logs: [],
      message: 'Log streaming not yet implemented',
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('[ADMIN_ACTION] Recent logs error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;

