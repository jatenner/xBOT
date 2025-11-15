import { getSupabaseClient } from '../db';
import { log } from '../lib/logger';

type JobStatus = 'running' | 'success' | 'failure' | 'skipped';

const TABLE_NAME = 'job_heartbeats';

const nowIso = () => new Date().toISOString();

async function upsertHeartbeat(payload: Record<string, unknown>) {
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from(TABLE_NAME).upsert(payload, { onConflict: 'job_name' });
    if (error) {
      console.error(`[JOB_HEARTBEAT] ❌ Failed to upsert heartbeat`, error.message);
    }
  } catch (error: any) {
    console.error('[JOB_HEARTBEAT] ❌ Unexpected error while upserting heartbeat:', error.message || error);
  }
}

export async function recordJobStart(jobName: string): Promise<void> {
  await upsertHeartbeat({
    job_name: jobName,
    last_run_status: 'running' as JobStatus,
    updated_at: nowIso()
  });
}

export async function recordJobSuccess(jobName: string): Promise<void> {
  await upsertHeartbeat({
    job_name: jobName,
    last_success: nowIso(),
    last_run_status: 'success' as JobStatus,
    last_error: null,
    consecutive_failures: 0,
    updated_at: nowIso()
  });
}

export async function recordJobFailure(jobName: string, errorMessage: string): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from(TABLE_NAME)
      .select('consecutive_failures')
      .eq('job_name', jobName)
      .maybeSingle();

    const consecutiveFailures = (data?.consecutive_failures ?? 0) + 1;

    await upsertHeartbeat({
      job_name: jobName,
      last_failure: nowIso(),
      last_run_status: 'failure' as JobStatus,
      last_error: errorMessage?.slice(0, 500) ?? null,
      consecutive_failures: consecutiveFailures,
      updated_at: nowIso()
    });
  } catch (error: any) {
    console.error('[JOB_HEARTBEAT] ❌ Failed to record job failure:', error.message || error);
  }
}

export async function recordJobSkip(jobName: string, reason: string): Promise<void> {
  await upsertHeartbeat({
    job_name: jobName,
    last_run_status: 'skipped' as JobStatus,
    last_error: reason,
    updated_at: nowIso()
  });
}

export async function getHeartbeat(jobName: string) {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('*')
      .eq('job_name', jobName)
      .maybeSingle();

    if (error) {
      log({ op: 'job_heartbeat_fetch_error', job: jobName, error: error.message });
      return null;
    }

    return data;
  } catch (error: any) {
    log({ op: 'job_heartbeat_fetch_error', job: jobName, error: error.message });
    return null;
  }
}

