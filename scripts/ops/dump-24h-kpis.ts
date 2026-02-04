#!/usr/bin/env tsx
/**
 * 📊 DUMP 24H KPIs
 * 
 * Prints JSON summary of key performance indicators for last 24 hours:
 * - replies_posted_24h
 * - avg_outcome_score_24h (ignore nulls)
 * - backoff_events_24h
 * - 429_events_24h
 * - skip_rate_24h
 * - top_skip_reasons (top 5)
 * 
 * Usage:
 *   pnpm exec tsx scripts/ops/dump-24h-kpis.ts
 */

import 'dotenv/config';
import { getSupabaseClient } from '../../src/db/index';

interface KPISummary {
  replies_posted_24h: number;
  avg_outcome_score_24h: number | null;
  backoff_events_24h: number;
  _429_events_24h: number;
  skip_rate_24h: number;
  top_skip_reasons: Array<{ reason: string; count: number }>;
  timestamp: string;
}

async function main(): Promise<void> {
  const supabase = getSupabaseClient();
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  
  const kpis: KPISummary = {
    replies_posted_24h: 0,
    avg_outcome_score_24h: null,
    backoff_events_24h: 0,
    _429_events_24h: 0,
    skip_rate_24h: 0,
    top_skip_reasons: [],
    timestamp: new Date().toISOString(),
  };
  
  // 1. Replies posted in last 24h
  const { count: repliesCount } = await supabase
    .from('content_metadata')
    .select('*', { count: 'exact', head: true })
    .eq('decision_type', 'reply')
    .eq('status', 'posted')
    .gte('posted_at', twentyFourHoursAgo.toISOString());
  
  kpis.replies_posted_24h = repliesCount || 0;
  
  // 2. Average outcome score (ignore nulls)
  const { data: repliesWithScores } = await supabase
    .from('content_metadata')
    .select('outcome_score')
    .eq('decision_type', 'reply')
    .eq('status', 'posted')
    .gte('posted_at', twentyFourHoursAgo.toISOString())
    .not('outcome_score', 'is', null);
  
  if (repliesWithScores && repliesWithScores.length > 0) {
    const scores = repliesWithScores
      .map(r => parseFloat(r.outcome_score) || 0)
      .filter(s => s > 0);
    
    if (scores.length > 0) {
      const sum = scores.reduce((a, b) => a + b, 0);
      kpis.avg_outcome_score_24h = sum / scores.length;
    }
  }
  
  // 3. Backoff events (rate_limit_429, backoff_triggered, etc.)
  const { count: backoffCount } = await supabase
    .from('system_events')
    .select('*', { count: 'exact', head: true })
    .in('event_type', ['rate_limit_429', 'backoff_triggered', 'backoff_extended'])
    .gte('created_at', twentyFourHoursAgo.toISOString());
  
  kpis.backoff_events_24h = backoffCount || 0;
  
  // 4. 429 events specifically
  const { count: _429Count } = await supabase
    .from('system_events')
    .select('*', { count: 'exact', head: true })
    .eq('event_type', 'rate_limit_429')
    .gte('created_at', twentyFourHoursAgo.toISOString());
  
  kpis._429_events_24h = _429Count || 0;
  
  // 5. Skip rate (from rate_controller_state)
  const { data: stateRows } = await supabase
    .from('rate_controller_state')
    .select('target_replies_this_hour, executed_replies')
    .gte('hour_start', twentyFourHoursAgo.toISOString());
  
  let totalTargeted = 0;
  let totalExecuted = 0;
  
  (stateRows || []).forEach(row => {
    totalTargeted += row.target_replies_this_hour || 0;
    totalExecuted += row.executed_replies || 0;
  });
  
  if (totalTargeted > 0) {
    kpis.skip_rate_24h = 1 - (totalExecuted / totalTargeted);
  }
  
  // 6. Top skip reasons (from system_events or scheduler logs)
  // Look for REPLY_QUEUE_BLOCKED or scheduler skip events
  const { data: skipEvents } = await supabase
    .from('system_events')
    .select('event_data, message')
    .in('event_type', ['REPLY_QUEUE_BLOCKED', 'scheduler_skip', 'reply_skipped'])
    .gte('created_at', twentyFourHoursAgo.toISOString())
    .limit(100);
  
  const skipReasonCounts: Record<string, number> = {};
  
  (skipEvents || []).forEach(event => {
    let reason = 'unknown';
    
    // Try to extract reason from event_data
    if (event.event_data && typeof event.event_data === 'object') {
      const data = event.event_data as Record<string, any>;
      reason = data.reason || data.skip_reason || data.deny_reason_code || 'unknown';
    } else if (event.message) {
      // Try to extract from message
      const match = event.message.match(/reason[=:]\s*(\S+)/i);
      if (match) {
        reason = match[1];
      } else {
        reason = event.message.substring(0, 50);
      }
    }
    
    skipReasonCounts[reason] = (skipReasonCounts[reason] || 0) + 1;
  });
  
  // Also check reply_decisions for DENY reasons
  const { data: denyDecisions } = await supabase
    .from('reply_decisions')
    .select('deny_reason_code')
    .eq('decision', 'DENY')
    .gte('created_at', twentyFourHoursAgo.toISOString())
    .limit(100);
  
  (denyDecisions || []).forEach(decision => {
    const reason = decision.deny_reason_code || 'unknown';
    skipReasonCounts[reason] = (skipReasonCounts[reason] || 0) + 1;
  });
  
  // Sort and take top 5
  kpis.top_skip_reasons = Object.entries(skipReasonCounts)
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  
  // Print JSON output
  console.log(JSON.stringify(kpis, null, 2));
  
  process.exit(0);
}

main().catch((error) => {
  console.error('[DUMP_KPIS] ❌ Fatal error:', error);
  process.exit(1);
});
