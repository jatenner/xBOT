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
    
    // Get next ready count
    const { getSupabaseClient } = await import('../../db/index');
    const supabase = getSupabaseClient();
    const GRACE_MINUTES = parseInt(process.env.GRACE_MINUTES || '5', 10);
    const graceWindow = new Date(Date.now() + GRACE_MINUTES * 60 * 1000).toISOString();
    
    const { count: nextReadyCount } = await supabase
      .from('content_metadata')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'queued')
      .lte('scheduled_at', graceWindow);
    
    const status = {
      ok: true,
      mode: flags.mode,
      postingEnabled: flags.postingEnabled,
      scheduling: {
        timezone: process.env.SCHED_TZ || 'UTC',
        grace_minutes: GRACE_MINUTES,
        next_ready_count: nextReadyCount || 0,
        min_minutes_until_slot: parseInt(process.env.MIN_MINUTES_UNTIL_SLOT || '0', 10),
        post_now_on_cold_start: process.env.POST_NOW_ON_COLD_START !== 'false'
      },
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

