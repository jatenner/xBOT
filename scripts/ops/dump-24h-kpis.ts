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
  total_navigations_24h: number;
  consent_detected_24h: number;
  consent_detect_rate_24h: number;
  infra_blocks_24h: number;
  infra_block_rate_24h: number;
  consent_block_rate_given_detect_24h: number;
  candidate_skip_rate_24h: number;
  top_candidate_skip_reasons: Array<{ reason: string; count: number }>;
  top_infra_block_reasons: Array<{ reason: string; count: number }>;
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
    total_navigations_24h: 0,
    consent_detected_24h: 0,
    consent_detect_rate_24h: 0,
    infra_blocks_24h: 0,
    infra_block_rate_24h: 0,
    consent_block_rate_given_detect_24h: 0,
    candidate_skip_rate_24h: 0,
    top_candidate_skip_reasons: [],
    top_infra_block_reasons: [],
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
  
  // 5. Skip rates (from rate_controller_state)
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
    const totalSkipped = totalTargeted - totalExecuted;
    // Will be split into candidate vs infra below
  }
  
  // 6. Split skip reasons into candidate skips vs infra blocks
  const INFRA_BLOCK_REASONS = [
    'INFRA_BLOCK_CONSENT_WALL', // Primary taxonomy (CONSENT_WALL maps to this)
    'LOGIN_REDIRECT',
    'INTERSTITIAL_LOGIN',
    'INTERSTITIAL_CONSENT',
    'CHALLENGE',
    'TIMEOUT',
    'NAV_ERROR',
    'ANCESTRY_NAV_TIMEOUT',
    'ANCESTRY_ACQUIRE_CONTEXT_TIMEOUT',
  ];
  
  const candidateSkipCounts: Record<string, number> = {};
  const infraBlockCounts: Record<string, number> = {};
  
  // Count total navigations (from SAFE_GOTO_ATTEMPT events - each attempt = one navigation)
  const { count: navigationCount } = await supabase
    .from('system_events')
    .select('*', { count: 'exact', head: true })
    .eq('event_type', 'SAFE_GOTO_ATTEMPT')
    .gte('created_at', twentyFourHoursAgo.toISOString());
  
  kpis.total_navigations_24h = navigationCount || 0;
  
  // Count consent detections
  const { count: consentDetectedCount } = await supabase
    .from('system_events')
    .select('*', { count: 'exact', head: true })
    .eq('event_type', 'CONSENT_WALL_DETECTED')
    .gte('created_at', twentyFourHoursAgo.toISOString());
  
  kpis.consent_detected_24h = consentDetectedCount || 0;
  
  // Calculate consent detect rate
  if (kpis.total_navigations_24h > 0) {
    kpis.consent_detect_rate_24h = kpis.consent_detected_24h / kpis.total_navigations_24h;
  }
  
  // If no SAFE_GOTO_ATTEMPT events (legacy data), estimate from reply decisions + system events
  if (kpis.total_navigations_24h === 0) {
    // Estimate: each reply attempt = one navigation, each scrape = one navigation
    const { count: replyAttempts } = await supabase
      .from('reply_decisions')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', twentyFourHoursAgo.toISOString());
    
    const { count: scrapeEvents } = await supabase
      .from('system_events')
      .select('*', { count: 'exact', head: true })
      .in('event_type', ['scraper_start', 'scraper_complete'])
      .gte('created_at', twentyFourHoursAgo.toISOString());
    
    kpis.total_navigations_24h = (replyAttempts || 0) + Math.floor((scrapeEvents || 0) / 2); // Each scrape has start+complete
  }
  
  // Check reply_decisions for DENY reasons
  const { data: denyDecisions } = await supabase
    .from('reply_decisions')
    .select('deny_reason_code')
    .eq('decision', 'DENY')
    .gte('created_at', twentyFourHoursAgo.toISOString())
    .limit(200);
  
  (denyDecisions || []).forEach(decision => {
    let reason = decision.deny_reason_code || 'unknown';
    // Map CONSENT_WALL to INFRA_BLOCK_CONSENT_WALL for consistency
    if (reason === 'CONSENT_WALL') {
      reason = 'INFRA_BLOCK_CONSENT_WALL';
    }
    
    if (INFRA_BLOCK_REASONS.includes(reason)) {
      infraBlockCounts[reason] = (infraBlockCounts[reason] || 0) + 1;
    } else {
      candidateSkipCounts[reason] = (candidateSkipCounts[reason] || 0) + 1;
    }
  });
  
  // Check system_events for skip events and consent wall blocks
  const { data: skipEvents } = await supabase
    .from('system_events')
    .select('event_data, message, event_type')
    .in('event_type', [
      'REPLY_QUEUE_BLOCKED',
      'scheduler_skip',
      'reply_skipped',
      'CONSENT_WALL_BLOCKED',
      'INFRA_BLOCK_CONSENT_WALL',
    ])
    .gte('created_at', twentyFourHoursAgo.toISOString())
    .limit(200);
  
  (skipEvents || []).forEach(event => {
    let reason = 'unknown';
    
    // CONSENT_WALL_BLOCKED event type maps to INFRA_BLOCK_CONSENT_WALL
    if (event.event_type === 'CONSENT_WALL_BLOCKED') {
      reason = 'INFRA_BLOCK_CONSENT_WALL';
    } else {
      // Try to extract reason from event_data
      if (event.event_data && typeof event.event_data === 'object') {
        const data = event.event_data as Record<string, any>;
        reason = data.reason || data.skip_reason || data.deny_reason_code || event.event_type || 'unknown';
      } else if (event.message) {
        const match = event.message.match(/reason[=:]\s*(\S+)/i);
        if (match) {
          reason = match[1];
        } else {
          reason = event.event_type || 'unknown';
        }
      } else {
        reason = event.event_type || 'unknown';
      }
      
      // Map CONSENT_WALL to INFRA_BLOCK_CONSENT_WALL
      if (reason === 'CONSENT_WALL') {
        reason = 'INFRA_BLOCK_CONSENT_WALL';
      }
    }
    
    if (INFRA_BLOCK_REASONS.includes(reason)) {
      infraBlockCounts[reason] = (infraBlockCounts[reason] || 0) + 1;
    } else {
      candidateSkipCounts[reason] = (candidateSkipCounts[reason] || 0) + 1;
    }
  });
  
  // Count total infra blocks
  kpis.infra_blocks_24h = Object.values(infraBlockCounts).reduce((a, b) => a + b, 0);
  
  // Calculate rates with explicit denominators
  if (totalTargeted > 0) {
    const totalCandidateSkips = Object.values(candidateSkipCounts).reduce((a, b) => a + b, 0);
    
    kpis.candidate_skip_rate_24h = totalCandidateSkips / totalTargeted;
  }
  
  // Use navigations as denominator for infra block rate (more accurate)
  if (kpis.total_navigations_24h > 0) {
    kpis.infra_block_rate_24h = kpis.infra_blocks_24h / kpis.total_navigations_24h;
  } else if (totalTargeted > 0) {
    // Fallback to targeted if navigations not available
    kpis.infra_block_rate_24h = kpis.infra_blocks_24h / totalTargeted;
  }
  
  // Calculate consent block rate given detection (conditional probability)
  if (kpis.consent_detected_24h > 0) {
    kpis.consent_block_rate_given_detect_24h = kpis.infra_blocks_24h / kpis.consent_detected_24h;
  }
  
  // Sort and take top 5 for each category
  kpis.top_candidate_skip_reasons = Object.entries(candidateSkipCounts)
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  
  kpis.top_infra_block_reasons = Object.entries(infraBlockCounts)
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
