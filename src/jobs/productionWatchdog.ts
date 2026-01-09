/**
 * 🐕 PRODUCTION WATCHDOG
 * Monitors job health and writes system_events every 5 minutes
 * Self-heals if jobs stall
 */

import { getSupabaseClient } from '../db/index';

interface WatchdogState {
  jobs_enabled: boolean;
  last_fetch_started: string | null;
  last_fetch_completed: string | null;
  last_scheduler_tick: string | null;
  queue_size: number;
  judge_calls_30m: number;
  status: 'OK' | 'STALLED' | 'DEGRADED';
}

export class ProductionWatchdog {
  private interval: NodeJS.Timeout | null = null;
  private isRunning = false;
  private lastFetchStarted: Date | null = null;
  private lastFetchCompleted: Date | null = null;
  private consecutiveStalls = 0;

  async start() {
    if (this.isRunning) {
      console.log('[WATCHDOG] Already running');
      return;
    }

    this.isRunning = true;
    console.log('[WATCHDOG] 🐕 Starting production watchdog (5 min interval)');

    // Immediate boot heartbeat
    await this.writeBootHeartbeat();

    // Initial check
    await this.checkAndReport();

    // Check every 5 minutes
    this.interval = setInterval(async () => {
      try {
        await this.checkAndReport();
        await this.checkAndHeal();
      } catch (error: any) {
        console.error('[WATCHDOG] Error in watchdog cycle:', error.message);
      }
    }, 5 * 60 * 1000);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.isRunning = false;
    console.log('[WATCHDOG] Stopped');
  }

  private async writeBootHeartbeat(): Promise<void> {
    const supabase = getSupabaseClient();
    const now = new Date();
    const gitSha = process.env.RAILWAY_GIT_COMMIT_SHA || process.env.GIT_SHA || 'unknown';
    const railwayEnv = process.env.RAILWAY_ENVIRONMENT_NAME || 'unknown';
    const nodeEnv = process.env.NODE_ENV || 'unknown';
    
    // Compute jobs_enabled
    const jobsEnabled = process.env.JOBS_AUTOSTART === 'false' 
      ? false 
      : (process.env.JOBS_AUTOSTART === 'true' || process.env.RAILWAY_ENVIRONMENT_NAME === 'production');

    const bootState = {
      jobs_enabled: jobsEnabled,
      git_sha: gitSha,
      railway_environment: railwayEnv,
      node_env: nodeEnv,
      jobs_autostart_env: process.env.JOBS_AUTOSTART || 'NOT SET',
      boot_time: now.toISOString(),
      status: 'BOOTING',
    };

    try {
      await supabase.from('system_events').insert({
        event_type: 'production_watchdog_boot',
        severity: 'info',
        message: `Watchdog boot: jobs_enabled=${jobsEnabled} git_sha=${gitSha.substring(0, 8)} env=${railwayEnv}`,
        event_data: bootState,
        created_at: now.toISOString(),
      });
      console.log(`[WATCHDOG] ✅ Boot heartbeat written: jobs_enabled=${jobsEnabled} git=${gitSha.substring(0, 8)}`);
    } catch (error: any) {
      console.error('[WATCHDOG] ❌ Failed to write boot heartbeat:', error.message);
    }
  }

  private async checkAndReport(): Promise<void> {
    const supabase = getSupabaseClient();
    const now = new Date();
    const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);
    const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);

    // Get last fetch started
    const { data: lastStarted } = await supabase
      .from('system_events')
      .select('created_at')
      .eq('event_type', 'reply_v2_fetch_job_started')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // Get last fetch completed
    const { data: lastCompleted } = await supabase
      .from('system_events')
      .select('created_at')
      .like('event_type', '%reply_v2_fetch%completed%')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // Get last scheduler tick
    const { data: lastScheduler } = await supabase
      .from('reply_slo_events')
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // Get queue size
    const { count: queueSize } = await supabase
      .from('reply_candidate_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'queued')
      .gt('expires_at', now.toISOString());

    // Get judge calls in last 30 minutes
    const { count: judgeCalls } = await supabase
      .from('llm_usage_log')
      .select('*', { count: 'exact', head: true })
      .eq('purpose', 'target_judge')
      .gte('timestamp', thirtyMinutesAgo.toISOString());

    // Determine status
    const jobsEnabled = process.env.JOBS_AUTOSTART !== 'false';
    const fetchStalled = !lastStarted || new Date(lastStarted.created_at) < tenMinutesAgo;
    const status: 'OK' | 'STALLED' | 'DEGRADED' = fetchStalled ? 'STALLED' : 'OK';

    const state: WatchdogState = {
      jobs_enabled: jobsEnabled,
      last_fetch_started: lastStarted?.created_at || null,
      last_fetch_completed: lastCompleted?.created_at || null,
      last_scheduler_tick: lastScheduler?.created_at || null,
      queue_size: queueSize || 0,
      judge_calls_30m: judgeCalls || 0,
      status,
    };

    // Write to system_events
    await supabase.from('system_events').insert({
      event_type: 'production_watchdog_report',
      severity: status === 'STALLED' ? 'warning' : 'info',
      message: `Watchdog: status=${status} jobs_enabled=${jobsEnabled} queue=${queueSize} judge_calls_30m=${judgeCalls}`,
      event_data: state,
      created_at: now.toISOString(),
    });

    console.log(`[WATCHDOG] 📊 Status: ${status} | Jobs: ${jobsEnabled} | Queue: ${queueSize} | Judge: ${judgeCalls} | Last fetch: ${lastStarted?.created_at || 'never'}`);

    // Update internal state
    if (lastStarted) {
      this.lastFetchStarted = new Date(lastStarted.created_at);
    }
    if (lastCompleted) {
      this.lastFetchCompleted = new Date(lastCompleted.created_at);
    }

    if (fetchStalled) {
      this.consecutiveStalls++;
    } else {
      this.consecutiveStalls = 0;
    }
  }

  private async checkAndHeal(): Promise<void> {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

    // If no fetch runs for 10 minutes, try to restart timers
    if (this.lastFetchStarted && this.lastFetchStarted < tenMinutesAgo) {
      console.log('[WATCHDOG] ⚠️ Fetch stalled - attempting self-heal...');

      try {
        const { JobManager } = await import('./jobManager');
        const jobManager = JobManager.getInstance();

        // Check if jobs are running
        if (!jobManager['isRunning']) {
          console.log('[WATCHDOG] 🔄 Jobs not running - restarting...');
          await jobManager.startJobs();
        } else {
          console.log('[WATCHDOG] ⚠️ Jobs appear to be running but no fetch events - may be stuck');
        }

        // Escalate if still stalled after heal attempt
        if (this.consecutiveStalls >= 2) {
          console.error('[WATCHDOG] 🚨 STALLED: No fetch runs for 20+ minutes - ESCALATING');
          const supabase = getSupabaseClient();
          await supabase.from('system_events').insert({
            event_type: 'production_watchdog_escalation',
            severity: 'critical',
            message: `Jobs appear stalled: last_fetch=${this.lastFetchStarted?.toISOString() || 'never'} consecutive_stalls=${this.consecutiveStalls}`,
            created_at: new Date().toISOString(),
          });
        }
      } catch (error: any) {
        console.error('[WATCHDOG] ❌ Self-heal failed:', error.message);
      }
    }
  }
}

// Singleton instance
let watchdogInstance: ProductionWatchdog | null = null;

export function getWatchdog(): ProductionWatchdog {
  if (!watchdogInstance) {
    watchdogInstance = new ProductionWatchdog();
  }
  return watchdogInstance;
}

