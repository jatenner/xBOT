#!/usr/bin/env tsx
/**
 * 🔍 PRODUCTION READINESS AUDIT
 * 
 * Deterministic PASS/FAIL report on xBOT production status.
 */

import 'dotenv/config';
import { getSupabaseClient } from '../../src/db/index';

interface AuditResult {
  config: {
    execution_mode: string;
    dry_run: string;
    max_replies_per_hour: string;
    posts_per_hour: string;
    canary_mode: string;
    replies_enabled: string;
    harvesting_enabled: string;
  };
  sha: {
    boot_logs_found: boolean;
    runtime_sha?: string;
  };
  tick_liveness: {
    ticks_found: number;
    last_ticks: Array<{
      timestamp: string;
      targets: any;
      executed: any;
      stop_reason?: string;
    }>;
  };
  execution: {
    replies_posted_6h: number;
    last_reply_url?: string;
    execution_events_6h: number;
  };
  throughput: {
    expected_6h: number;
    actual_6h: number;
    gap: number;
  };
  limiters: {
    top_skip_reasons: Array<{ reason: string; count: number }>;
    top_infra_blocks: Array<{ reason: string; count: number }>;
    backoff_events: number;
    auth_failures: number;
  };
  verdict: 'PASS' | 'FAIL';
  reason?: string;
  actions?: string[];
}

async function main(): Promise<void> {
  const supabase = getSupabaseClient();
  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
  
  const result: AuditResult = {
    config: {
      execution_mode: process.env.EXECUTION_MODE || 'unknown',
      dry_run: process.env.DRY_RUN || 'unknown',
      max_replies_per_hour: process.env.MAX_REPLIES_PER_HOUR || 'unknown',
      posts_per_hour: process.env.POSTS_PER_HOUR || 'unknown',
      canary_mode: process.env.CANARY_MODE || 'unknown',
      replies_enabled: process.env.REPLIES_ENABLED || 'unknown',
      harvesting_enabled: process.env.HARVESTING_ENABLED || 'unknown',
    },
    sha: {
      boot_logs_found: false,
    },
    tick_liveness: {
      ticks_found: 0,
      last_ticks: [],
    },
    execution: {
      replies_posted_6h: 0,
      execution_events_6h: 0,
    },
    throughput: {
      expected_6h: 0,
      actual_6h: 0,
      gap: 0,
    },
    limiters: {
      top_skip_reasons: [],
      top_infra_blocks: [],
      backoff_events: 0,
      auth_failures: 0,
    },
    verdict: 'FAIL',
  };
  
  // 1. Config audit
  console.log('=== CONFIG AUDIT ===');
  console.log(JSON.stringify(result.config, null, 2));
  console.log('');
  
  // 2. SHA verification (check system_events for BOOT events)
  const { data: bootEvents } = await supabase
    .from('system_events')
    .select('event_data, created_at')
    .eq('event_type', 'EXECUTOR_HEALTH_BOOT')
    .order('created_at', { ascending: false })
    .limit(1);
  
  if (bootEvents && bootEvents.length > 0) {
    result.sha.boot_logs_found = true;
    const bootData = bootEvents[0].event_data as any;
    result.sha.runtime_sha = bootData?.git_sha || 'unknown';
  }
  
  console.log('=== SHA VERIFICATION ===');
  console.log(JSON.stringify(result.sha, null, 2));
  console.log('');
  
  // 3. Hourly tick liveness
  const { data: tickEvents } = await supabase
    .from('system_events')
    .select('created_at, event_data, message')
    .in('event_type', ['HOURLY_TICK', 'RATE_CONTROLLER_TICK'])
    .gte('created_at', sixHoursAgo)
    .order('created_at', { ascending: false })
    .limit(10);
  
  result.tick_liveness.ticks_found = tickEvents?.length || 0;
  
  if (tickEvents && tickEvents.length > 0) {
    result.tick_liveness.last_ticks = tickEvents.map(e => ({
      timestamp: e.created_at,
      targets: (e.event_data as any)?.targets || {},
      executed: (e.event_data as any)?.executed || {},
      stop_reason: (e.event_data as any)?.stop_reason,
    }));
  }
  
  // Also check rate_controller_state
  const { data: stateRows } = await supabase
    .from('rate_controller_state')
    .select('*')
    .gte('hour_start', sixHoursAgo)
    .order('hour_start', { ascending: false })
    .limit(10);
  
  if (stateRows && stateRows.length > 0) {
    result.tick_liveness.ticks_found = Math.max(result.tick_liveness.ticks_found, stateRows.length);
    result.tick_liveness.last_ticks = stateRows.map(row => ({
      timestamp: row.hour_start,
      targets: {
        replies: row.target_replies_this_hour,
        posts: row.target_posts_this_hour,
      },
      executed: {
        replies: row.executed_replies,
        posts: row.executed_posts,
      },
      stop_reason: row.mode === 'COOLDOWN' ? 'COOLDOWN' : undefined,
    }));
  }
  
  console.log('=== TICK LIVENESS ===');
  console.log(`Ticks found: ${result.tick_liveness.ticks_found}`);
  console.log(JSON.stringify(result.tick_liveness.last_ticks.slice(0, 3), null, 2));
  console.log('');
  
  // 4. Execution evidence
  const { count: repliesCount, data: repliesData } = await supabase
    .from('content_metadata')
    .select('tweet_id, posted_at', { count: 'exact' })
    .eq('status', 'posted')
    .eq('decision_type', 'reply')
    .gte('posted_at', sixHoursAgo)
    .order('posted_at', { ascending: false })
    .limit(1);
  
  result.execution.replies_posted_6h = repliesCount || 0;
  if (repliesData && repliesData.length > 0) {
    result.execution.last_reply_url = `https://x.com/i/status/${repliesData[0].tweet_id}`;
  }
  
  const { count: execEventsCount } = await supabase
    .from('system_events')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', sixHoursAgo)
    .in('event_type', [
      'REPLY_POSTED',
      'REPLY_QUEUE_TICK',
      'SAFE_GOTO_ATTEMPT',
      'SAFE_GOTO_OK',
      'CONSENT_WALL_DISMISSED',
      'EXECUTOR_REPLY_POSTED',
    ]);
  
  result.execution.execution_events_6h = execEventsCount || 0;
  
  console.log('=== EXECUTION EVIDENCE ===');
  console.log(`Replies posted (6h): ${result.execution.replies_posted_6h}`);
  console.log(`Last reply URL: ${result.execution.last_reply_url || 'N/A'}`);
  console.log(`Execution events (6h): ${result.execution.execution_events_6h}`);
  console.log('');
  
  // 5. Throughput
  const maxRepliesPerHour = parseInt(result.config.max_replies_per_hour) || 0;
  const hoursObserved = 6;
  result.throughput.expected_6h = maxRepliesPerHour * hoursObserved;
  result.throughput.actual_6h = result.execution.replies_posted_6h;
  result.throughput.gap = result.throughput.expected_6h - result.throughput.actual_6h;
  
  console.log('=== THROUGHPUT ===');
  console.log(`Expected (6h): ${result.throughput.expected_6h}`);
  console.log(`Actual (6h): ${result.throughput.actual_6h}`);
  console.log(`Gap: ${result.throughput.gap}`);
  console.log('');
  
  // 6. Limiters
  const { data: skipEvents } = await supabase
    .from('system_events')
    .select('event_data, event_type')
    .gte('created_at', sixHoursAgo)
    .in('event_type', ['CANDIDATE_SKIPPED', 'REPLY_CANDIDATE_SKIPPED', 'ANCESTRY_SKIP_UNCERTAIN']);
  
  const skipCounts: Record<string, number> = {};
  (skipEvents || []).forEach(e => {
    const reason = (e.event_data as any)?.reason || 'unknown';
    skipCounts[reason] = (skipCounts[reason] || 0) + 1;
  });
  
  result.limiters.top_skip_reasons = Object.entries(skipCounts)
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  
  const { data: infraEvents } = await supabase
    .from('system_events')
    .select('event_data, event_type')
    .gte('created_at', sixHoursAgo)
    .in('event_type', ['INFRA_BLOCK', 'SAFE_GOTO_FAIL', 'CONSENT_WALL_BLOCKED', 'EXECUTOR_AUTH_REQUIRED', 'EXECUTOR_RATE_LIMIT_DETECTED']);
  
  const infraCounts: Record<string, number> = {};
  (infraEvents || []).forEach(e => {
    const reason = (e.event_data as any)?.reason || e.event_type || 'unknown';
    infraCounts[reason] = (infraCounts[reason] || 0) + 1;
  });
  
  result.limiters.top_infra_blocks = Object.entries(infraCounts)
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  
  const { count: backoffCount } = await supabase
    .from('system_events')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', sixHoursAgo)
    .in('event_type', ['backoff_triggered', 'rate_limit_429', 'COOLDOWN']);
  
  result.limiters.backoff_events = backoffCount || 0;
  
  const { count: authCount } = await supabase
    .from('system_events')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', sixHoursAgo)
    .in('event_type', ['auth_freshness_failed', 'EXECUTOR_AUTH_REQUIRED', 'login_wall_detected']);
  
  result.limiters.auth_failures = authCount || 0;
  
  console.log('=== TOP LIMITERS ===');
  console.log('Skip reasons:', JSON.stringify(result.limiters.top_skip_reasons, null, 2));
  console.log('Infra blocks:', JSON.stringify(result.limiters.top_infra_blocks, null, 2));
  console.log(`Backoff events: ${result.limiters.backoff_events}`);
  console.log(`Auth failures: ${result.limiters.auth_failures}`);
  console.log('');
  
  // 7. Verdict
  const actions: string[] = [];
  
  // Check config
  if (result.config.dry_run !== 'false') {
    result.verdict = 'FAIL';
    result.reason = 'DRY_RUN is not false';
    actions.push('Set DRY_RUN=false');
  }
  
  if (result.config.execution_mode !== 'control') {
    result.verdict = 'FAIL';
    result.reason = `EXECUTION_MODE is ${result.config.execution_mode}, expected 'control'`;
    actions.push(`Set EXECUTION_MODE=control`);
  }
  
  // Check tick liveness
  if (result.tick_liveness.ticks_found === 0) {
    result.verdict = 'FAIL';
    result.reason = 'No hourly ticks found in last 6 hours';
    actions.push('Check jobManager scheduling, verify hourly_tick job is active');
  }
  
  // Check execution
  if (result.execution.replies_posted_6h === 0 && result.execution.execution_events_6h === 0) {
    result.verdict = 'FAIL';
    result.reason = 'No execution evidence: no replies posted and no execution events';
    actions.push('Verify executor daemon is running, check executor logs');
  }
  
  // Check throughput
  if (result.throughput.gap > 0 && result.tick_liveness.ticks_found > 0) {
    // Under target but ticks are running - check limiters
    if (result.limiters.top_infra_blocks.length > 0 && result.limiters.top_infra_blocks[0].count > 10) {
      result.reason = `Under target: ${result.limiters.top_infra_blocks[0].reason} blocking ${result.limiters.top_infra_blocks[0].count} attempts`;
      actions.push(`Fix ${result.limiters.top_infra_blocks[0].reason} blocking`);
    } else if (result.limiters.top_skip_reasons.length > 0 && result.limiters.top_skip_reasons[0].count > 20) {
      result.reason = `Under target: ${result.limiters.top_skip_reasons[0].reason} skipping ${result.limiters.top_skip_reasons[0].count} candidates`;
      actions.push(`Address ${result.limiters.top_skip_reasons[0].reason} skip reason`);
    }
  }
  
  // Check auth failures
  if (result.limiters.auth_failures > 0) {
    result.verdict = 'FAIL';
    result.reason = `${result.limiters.auth_failures} auth failures detected`;
    actions.push('Fix executor authentication');
  }
  
  // If we got here and verdict is still FAIL, set reason
  if (result.verdict === 'FAIL' && !result.reason) {
    result.reason = 'Unknown failure - check logs';
  }
  
  // If all checks pass, set PASS
  if (result.verdict !== 'FAIL') {
    result.verdict = 'PASS';
    result.reason = 'All checks passed';
  }
  
  result.actions = actions;
  
  console.log('=== FINAL VERDICT ===');
  console.log(JSON.stringify(result, null, 2));
  
  process.exit(result.verdict === 'PASS' ? 0 : 1);
}

main().catch((error) => {
  console.error('[AUDIT] ❌ Fatal error:', error);
  process.exit(1);
});
