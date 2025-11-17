import { getSupabaseClient } from '../db';
import { log } from '../lib/logger';
import { recordJobFailure } from './jobHeartbeat';

export type WatchdogRecoverableJob =
  | 'plan'
  | 'posting'
  | 'reply'
  | 'reply_posting'
  | 'metrics_scraper'
  | 'mega_viral_harvester'
  | 'reply_metrics_scraper';

interface CriticalJobConfig {
  jobName: string;
  thresholdMinutes: number;
  recoverTarget?: WatchdogRecoverableJob;
  description: string;
}

const CRITICAL_JOBS: CriticalJobConfig[] = [
  { jobName: 'posting', thresholdMinutes: 10, recoverTarget: 'posting', description: 'Posting queue stalled' },
  { jobName: 'plan', thresholdMinutes: 130, recoverTarget: 'plan', description: 'Content planner idle' },
  { jobName: 'reply_posting', thresholdMinutes: 35, recoverTarget: 'reply_posting', description: 'Reply posting stalled' },
  { jobName: 'metrics_scraper', thresholdMinutes: 30, recoverTarget: 'metrics_scraper', description: 'Metrics scraper idle' },
  { jobName: 'mega_viral_harvester', thresholdMinutes: 150, recoverTarget: 'mega_viral_harvester', description: 'Reply harvester idle' }
];

// 🔥 HUNG JOB DETECTION: Detect jobs stuck in "running" state for too long
const HUNG_JOB_THRESHOLD_MINUTES = 15; // 15 minutes max runtime

async function logSystemEvent(eventType: string, data: Record<string, unknown>) {
  try {
    const supabase = getSupabaseClient();
    await supabase.from('system_events').insert({
      event_type: eventType,
      severity: 'warning',
      event_data: data,
      created_at: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('[JOB_WATCHDOG] ❌ Failed to log system event:', error.message || error);
  }
}

export async function runJobWatchdog(runJobNow: (jobName: WatchdogRecoverableJob) => Promise<void>): Promise<void> {
  const supabase = getSupabaseClient();
  const jobNames = CRITICAL_JOBS.map(job => job.jobName);

  const { data, error } = await supabase
    .from('job_heartbeats')
    .select('job_name,last_success,last_run_status,updated_at')
    .in('job_name', jobNames);

  if (error) {
    console.error('[JOB_WATCHDOG] ❌ Failed to fetch heartbeats:', error.message);
    return;
  }

  const heartbeatMap = new Map<string, any>((data || []).map(row => [row.job_name, row]));
  const now = Date.now();

  for (const job of CRITICAL_JOBS) {
    const record = heartbeatMap.get(job.jobName);
    const lastSuccess = record?.last_success ? new Date(record.last_success).getTime() : null;
    const lastUpdate = record?.updated_at ? new Date(record.updated_at).getTime() : null;
    const isRunning = record?.last_run_status === 'running' && lastUpdate && now - lastUpdate < job.thresholdMinutes * 60_000;

    // 🔥 ENHANCED: Check for hung jobs (stuck in "running" for >15 minutes)
    if (record?.last_run_status === 'running' && lastUpdate) {
      const runTimeMinutes = (now - lastUpdate) / 60000;
      
      // If job has been running for longer than HUNG threshold, it's definitely hung
      if (runTimeMinutes > HUNG_JOB_THRESHOLD_MINUTES) {
        const minutesRunning = Math.floor(runTimeMinutes);
        console.error(`🚨 [JOB_WATCHDOG] HUNG JOB DETECTED: ${job.jobName} running for ${minutesRunning} minutes`);
        
        log({
          op: 'job_watchdog_hung',
          job: job.jobName,
          minutes_running: minutesRunning,
          description: `Job hung in running state for ${minutesRunning} minutes`
        });
        
        await logSystemEvent('job_watchdog_hung', {
          job: job.jobName,
          minutes_running: minutesRunning,
          hung_threshold_minutes: HUNG_JOB_THRESHOLD_MINUTES,
          description: 'Job hung - stuck in running state beyond 15 minute threshold'
        });
        
        if (job.recoverTarget) {
          await recordJobFailure(job.jobName, `hung_${minutesRunning}_minutes`);
          console.log(`🔄 [JOB_WATCHDOG] Attempting recovery for hung job: ${job.recoverTarget}`);
          try {
            await runJobNow(job.recoverTarget);
            log({
              op: 'job_watchdog_hung_recovery_attempted',
              job: job.jobName,
              recover_target: job.recoverTarget
            });
          } catch (recoveryError: any) {
            console.error(`❌ [JOB_WATCHDOG] Recovery failed for ${job.recoverTarget}:`, recoveryError.message);
            await logSystemEvent('job_watchdog_hung_recovery_failed', {
              job: job.jobName,
              recover_target: job.recoverTarget,
              error: recoveryError?.message || String(recoveryError)
            });
          }
        }
        continue;
      }
      
      // If job has been running longer than job-specific threshold, also treat as stuck
      if (runTimeMinutes > job.thresholdMinutes) {
        const minutesRunning = Math.floor(runTimeMinutes);
        log({
          op: 'job_watchdog_stuck',
          job: job.jobName,
          minutes_running: minutesRunning,
          description: 'Job stuck in running state beyond threshold'
        });
        await logSystemEvent('job_watchdog_stuck', {
          job: job.jobName,
          minutes_running: minutesRunning,
          threshold_minutes: job.thresholdMinutes,
          description: 'Job stuck in running state beyond threshold'
        });
        if (job.recoverTarget) {
          await recordJobFailure(job.jobName, 'stuck_running_timeout');
          await runJobNow(job.recoverTarget);
        }
        continue;
      }
    }

    if (isRunning) {
      continue;
    }

    const diffMs = lastSuccess ? now - lastSuccess : Infinity;
    if (diffMs <= job.thresholdMinutes * 60_000) {
      continue;
    }

    const minutesLate = Math.floor(diffMs / 60000);
    log({
      op: 'job_watchdog_alert',
      job: job.jobName,
      minutes_late: minutesLate,
      description: job.description
    });

    await logSystemEvent('job_watchdog_alert', {
      job: job.jobName,
      minutes_late: minutesLate,
      description: job.description
    });

    if (job.recoverTarget) {
      try {
        await runJobNow(job.recoverTarget);
        log({
          op: 'job_watchdog_recovery_success',
          job: job.jobName,
          action: job.recoverTarget
        });
      } catch (recoveryError: any) {
        log({
          op: 'job_watchdog_recovery_failed',
          job: job.jobName,
          error: recoveryError?.message || String(recoveryError)
        });
        await logSystemEvent('job_watchdog_recovery_failed', {
          job: job.jobName,
          error: recoveryError?.message || String(recoveryError)
        });
      }
    }
  }
}

