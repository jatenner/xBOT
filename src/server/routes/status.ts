/**
 * 🩺 STATUS ROUTE - System health and job timer status
 */

import express from 'express';
import fs from 'node:fs';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { flags } = await import('../../config/featureFlags');
    const { JobManager } = await import('../../jobs/jobManager');
    const { SESSION_PATH } = await import('../../infra/session/xSession');
    
    const jobManager = JobManager.getInstance();
    const stats = jobManager.getStats();
    
    const status = {
      ok: true,
      mode: flags.mode,
      postingEnabled: flags.postingEnabled,
      timers: {
        plan: stats.planRuns > 0 || flags.plannerEnabled,
        reply: stats.replyRuns > 0 || flags.replyEnabled,
        posting: stats.postingRuns > 0 || flags.postingEnabled,
        learn: stats.learnRuns > 0 || flags.learnEnabled,
      },
      browserProfileDirExists: fs.existsSync('/tmp/xbot-profile'),
      sessionFileExists: fs.existsSync(SESSION_PATH),
      lastLoginAt: (globalThis as any).__x_last_login_at || null,
      lastAuthCheck: (globalThis as any).__x_last_auth_check || null,
      jobStats: {
        planRuns: stats.planRuns,
        replyRuns: stats.replyRuns,
        postingRuns: stats.postingRuns,
        learnRuns: stats.learnRuns,
        errors: stats.errors,
        lastPostingTime: stats.lastPostingTime?.toISOString() || null,
      },
      lastPostAttemptAt: (globalThis as any).__xbotLastPostAttemptAt || null,
      lastPostResult: (globalThis as any).__xbotLastPostResult || null,
      uptime_seconds: process.uptime(),
      timestamp: new Date().toISOString()
    };
    
    res.json(status);
  } catch (error: any) {
    res.status(500).json({
      ok: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

export default router;

