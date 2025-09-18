/**
 * 📅 ADMIN JOB SCHEDULE
 * Show next-run ETAs for all scheduled jobs
 */

import { Request, Response } from 'express';
import { JobManager } from '../jobs/jobManager';

export interface JobScheduleInfo {
  name: string;
  nextRun: string | null;
  lastRun: string | null;
  intervalMinutes: number;
  enabled: boolean;
}

export interface ScheduleResponse {
  success: boolean;
  schedule: JobScheduleInfo[];
  timestamp: string;
}

/**
 * GET /admin/jobs/schedule - Show job schedule and next run times
 */
export async function jobScheduleHandler(req: Request, res: Response): Promise<void> {
  try {
    const jobManager = JobManager.getInstance();
    const stats = jobManager.getStats();
    
    // Calculate next run times based on current stats and intervals
    const now = new Date();
    
    const schedule: JobScheduleInfo[] = [
      {
        name: 'plan',
        nextRun: calculateNextRun(stats.lastPlanTime, 15), // 15 min interval
        lastRun: stats.lastPlanTime?.toISOString() || null,
        intervalMinutes: 15,
        enabled: true
      },
      {
        name: 'reply', 
        nextRun: calculateNextRun(stats.lastReplyTime, 15), // 15 min interval
        lastRun: stats.lastReplyTime?.toISOString() || null,
        intervalMinutes: 15,
        enabled: true
      },
      {
        name: 'analyticsCollector',
        nextRun: calculateNextRun(new Date(Date.now() - 20 * 60 * 1000), 30), // 30 min interval
        lastRun: null, // Not tracked yet
        intervalMinutes: 30,
        enabled: process.env.MODE === 'live' // Only enabled in live mode
      },
      {
        name: 'outcomes',
        nextRun: calculateNextRun(stats.lastOutcomeTime, 30), // 30 min interval
        lastRun: stats.lastOutcomeTime?.toISOString() || null,
        intervalMinutes: 30,
        enabled: true
      },
      {
        name: 'realOutcomes',
        nextRun: calculateNextRun(new Date(Date.now() - 25 * 60 * 1000), 30), // 30 min interval
        lastRun: null, // Not tracked yet
        intervalMinutes: 30,
        enabled: process.env.MODE === 'live' // Only enabled in live mode
      },
      {
        name: 'learn',
        nextRun: calculateNextRun(stats.lastLearnTime, 60), // 60 min interval
        lastRun: stats.lastLearnTime?.toISOString() || null,
        intervalMinutes: 60,
        enabled: true
      }
    ];

    const response: ScheduleResponse = {
      success: true,
      schedule,
      timestamp: new Date().toISOString()
    };

    res.json(response);

  } catch (error) {
    console.error('[ADMIN_SCHEDULE] ❌ Schedule query failed:', error.message);
    
    res.status(500).json({
      success: false,
      error: 'Failed to get job schedule',
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Calculate next run time based on last run and interval
 */
function calculateNextRun(lastRun: Date | null, intervalMinutes: number): string | null {
  if (!lastRun) {
    return new Date(Date.now() + intervalMinutes * 60 * 1000).toISOString();
  }

  const nextRunTime = new Date(lastRun.getTime() + intervalMinutes * 60 * 1000);
  const now = new Date();

  // If next run is in the past, schedule for next interval from now
  if (nextRunTime <= now) {
    return new Date(now.getTime() + intervalMinutes * 60 * 1000).toISOString();
  }

  return nextRunTime.toISOString();
}
