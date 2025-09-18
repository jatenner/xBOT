/**
 * 🔐 ADMIN JOB MANAGEMENT
 * Protected routes for job monitoring and manual execution
 */

import { Request, Response } from 'express';
import { getConfig } from '../config/config';
import { JobManager } from '../jobs/jobManager';

/**
 * Middleware to verify admin token
 */
export function requireAdminAuth(req: Request, res: Response, next: Function): void {
  const authHeader = req.headers.authorization;
  const config = getConfig();
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      error: 'Authorization header required. Use: Authorization: Bearer <ADMIN_TOKEN>',
      timestamp: new Date().toISOString()
    });
    return;
  }
  
  const token = authHeader.slice(7);
  
  if (token !== config.ADMIN_TOKEN) {
    res.status(403).json({
      success: false,
      error: 'Invalid admin token',
      timestamp: new Date().toISOString()
    });
    return;
  }
  
  next();
}

/**
 * GET /admin/jobs - List all jobs with status and next run times
 */
export function adminJobsHandler(req: Request, res: Response): void {
  try {
    const config = getConfig();
    const jobManager = JobManager.getInstance();
    const stats = jobManager.getStats();
    
    const now = new Date();
    const jobs = [
      {
        name: 'plan',
        interval: `${config.JOBS_PLAN_INTERVAL_MIN}min`,
        lastRun: stats.lastPlanTime,
        nextRun: stats.lastPlanTime ? 
          new Date(stats.lastPlanTime.getTime() + config.JOBS_PLAN_INTERVAL_MIN * 60 * 1000) : 
          new Date(now.getTime() + config.JOBS_PLAN_INTERVAL_MIN * 60 * 1000),
        runCount: stats.planRuns,
        enabled: config.JOBS_AUTOSTART
      },
      {
        name: 'reply',
        interval: `${config.JOBS_REPLY_INTERVAL_MIN}min`,
        lastRun: stats.lastReplyTime,
        nextRun: stats.lastReplyTime ? 
          new Date(stats.lastReplyTime.getTime() + config.JOBS_REPLY_INTERVAL_MIN * 60 * 1000) : 
          new Date(now.getTime() + config.JOBS_REPLY_INTERVAL_MIN * 60 * 1000),
        runCount: stats.replyRuns,
        enabled: config.JOBS_AUTOSTART
      },
      {
        name: 'shadowOutcomes',
        interval: `${config.JOBS_LEARN_INTERVAL_MIN}min`,
        lastRun: stats.lastOutcomeTime,
        nextRun: stats.lastOutcomeTime ? 
          new Date(stats.lastOutcomeTime.getTime() + config.JOBS_LEARN_INTERVAL_MIN * 60 * 1000) : 
          new Date(now.getTime() + config.JOBS_LEARN_INTERVAL_MIN * 60 * 1000),
        runCount: stats.outcomeRuns,
        enabled: config.JOBS_AUTOSTART && config.MODE === 'shadow'
      },
      {
        name: 'learn',
        interval: `${config.JOBS_LEARN_INTERVAL_MIN}min`,
        lastRun: stats.lastLearnTime,
        nextRun: stats.lastLearnTime ? 
          new Date(stats.lastLearnTime.getTime() + config.JOBS_LEARN_INTERVAL_MIN * 60 * 1000) : 
          new Date(now.getTime() + config.JOBS_LEARN_INTERVAL_MIN * 60 * 1000),
        runCount: stats.learnRuns,
        enabled: config.JOBS_AUTOSTART
      }
    ];

    res.json({
      success: true,
      jobs,
      totalErrors: stats.errors,
      mode: config.MODE,
      autostart: config.JOBS_AUTOSTART,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ ADMIN_JOBS: Error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to get job status',
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * POST /admin/jobs/run?name=<job> - Manually trigger a specific job
 */
export async function adminJobRunHandler(req: Request, res: Response): Promise<void> {
  try {
    const { name } = req.query;
    
    if (!name || typeof name !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Job name required. Valid options: plan, reply, outcomes, realOutcomes, analyticsCollector, learn',
        timestamp: new Date().toISOString()
      });
      return;
    }

    const validJobs = ['plan', 'reply', 'posting', 'outcomes', 'realOutcomes', 'analyticsCollector', 'learn', 'trainPredictor'];
    if (!validJobs.includes(name)) {
      res.status(400).json({
        success: false,
        error: `Invalid job name. Valid options: ${validJobs.join(', ')}`,
        timestamp: new Date().toISOString()
      });
      return;
    }

    const config = getConfig();
    
    // Check if outcomes job is requested in live mode  
    if (name === 'outcomes' && config.MODE === 'live') {
      res.status(400).json({
        success: false,
        error: 'outcomes job only available in shadow mode',
        timestamp: new Date().toISOString()
      });
      return;
    }

    console.log(`[ADMIN_JOBS] 🚀 Manual trigger: ${name} job`);
    
    const jobManager = JobManager.getInstance();
    await jobManager.runJobNow(name as 'plan' | 'reply' | 'outcomes' | 'realOutcomes' | 'analyticsCollector' | 'learn');

    res.json({
      success: true,
      message: `Job '${name}' executed successfully`,
      jobName: name,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error(`❌ ADMIN_JOB_RUN: Error running job:`, error.message);
    res.status(500).json({
      success: false,
      error: `Failed to run job: ${error.message}`,
      timestamp: new Date().toISOString()
    });
  }
}
