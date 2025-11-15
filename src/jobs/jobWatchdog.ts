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

    if (record?.last_run_status === 'running' && lastUpdate && now - lastUpdate >= job.thresholdMinutes * 60_000) {
      log({
        op: 'job_watchdog_stuck',
        job: job.jobName,
        minutes_running: Math.floor((now - lastUpdate) / 60000),
        description: 'Job stuck in running state beyond threshold'
      });
      await logSystemEvent('job_watchdog_stuck', {
        job: job.jobName,
        minutes_running: Math.floor((now - lastUpdate) / 60000),
        description: 'Job stuck in running state beyond threshold'
      });
      if (job.recoverTarget) {
        await recordJobFailure(job.jobName, 'stuck_running_timeout');
        await runJobNow(job.recoverTarget);
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

