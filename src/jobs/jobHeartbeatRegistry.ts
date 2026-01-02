/**
 * 🩺 JOB HEARTBEAT REGISTRY
 * Tracks when each job last ran and any errors
 */

export interface JobHeartbeat {
  lastRunAt: number | null;
  lastError: string | null;
  lastErrorStack: string | null;
  runCount: number;
  errorCount: number;
}

export const jobHeartbeats: Record<string, JobHeartbeat> = {
  posting: { lastRunAt: null, lastError: null, lastErrorStack: null, runCount: 0, errorCount: 0 },
  plan: { lastRunAt: null, lastError: null, lastErrorStack: null, runCount: 0, errorCount: 0 },
  reply_posting: { lastRunAt: null, lastError: null, lastErrorStack: null, runCount: 0, errorCount: 0 },
  analytics: { lastRunAt: null, lastError: null, lastErrorStack: null, runCount: 0, errorCount: 0 },
  metrics_scraper: { lastRunAt: null, lastError: null, lastErrorStack: null, runCount: 0, errorCount: 0 },
  learn: { lastRunAt: null, lastError: null, lastErrorStack: null, runCount: 0, errorCount: 0 },
};

export function recordJobRun(jobName: string): void {
  if (!jobHeartbeats[jobName]) {
    jobHeartbeats[jobName] = { lastRunAt: null, lastError: null, lastErrorStack: null, runCount: 0, errorCount: 0 };
  }
  jobHeartbeats[jobName].lastRunAt = Date.now();
  jobHeartbeats[jobName].runCount++;
}

export function recordJobError(jobName: string, error: Error | string): void {
  if (!jobHeartbeats[jobName]) {
    jobHeartbeats[jobName] = { lastRunAt: null, lastError: null, lastErrorStack: null, runCount: 0, errorCount: 0 };
  }
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack || null : null;
  
  jobHeartbeats[jobName].lastError = errorMessage;
  jobHeartbeats[jobName].lastErrorStack = errorStack;
  jobHeartbeats[jobName].errorCount++;
  
  console.error(`[JOB_HEARTBEAT] ❌ ${jobName} error:`, errorMessage);
  if (errorStack) {
    console.error(`[JOB_HEARTBEAT] Stack:`, errorStack);
  }
}

export function getJobHeartbeats(): Record<string, JobHeartbeat> {
  return jobHeartbeats;
}

export function getJobStatus(jobName: string): {
  isHealthy: boolean;
  minutesSinceLastRun: number | null;
  hasError: boolean;
  isStalled: boolean;
} {
  const heartbeat = jobHeartbeats[jobName];
  if (!heartbeat) {
    return { isHealthy: false, minutesSinceLastRun: null, hasError: false, isStalled: false };
  }
  
  const minutesSinceLastRun = heartbeat.lastRunAt 
    ? (Date.now() - heartbeat.lastRunAt) / 60000 
    : null;
  
  // Critical jobs: posting, reply_posting
  const isCritical = ['posting', 'reply_posting'].includes(jobName);
  const isStalled = isCritical && minutesSinceLastRun !== null && minutesSinceLastRun > 15;
  
  return {
    isHealthy: heartbeat.lastError === null && minutesSinceLastRun !== null && minutesSinceLastRun < 15,
    minutesSinceLastRun,
    hasError: heartbeat.lastError !== null,
    isStalled,
  };
}

export function detectSystemStalls(): { isStalled: boolean; stalledJobs: string[] } {
  const criticalJobs = ['posting', 'reply_posting'];
  const stalledJobs: string[] = [];
  
  for (const jobName of criticalJobs) {
    const status = getJobStatus(jobName);
    if (status.isStalled) {
      stalledJobs.push(jobName);
    }
  }
  
  return {
    isStalled: stalledJobs.length > 0,
    stalledJobs,
  };
}

