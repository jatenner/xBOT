#!/usr/bin/env tsx
/**
 * Checkpoint status monitor for Phase 5A.4 proof
 * Queries HEALTH_OK events, decision status, and error signatures
 */

import 'dotenv/config';
import { getSupabaseClient } from '../../src/db/index';

const PROOF_START_TIME = process.env.PROOF_START_TIME || '';
const PROOF_TAG_PREFIX = 'control-post-5a4-stability-';

async function main() {
  if (!PROOF_START_TIME) {
    console.error('PROOF_START_TIME env var required');
    process.exit(1);
  }

  const supabase = getSupabaseClient();
  const startTime = new Date(PROOF_START_TIME);
  const now = Date.now();
  const elapsedMinutes = Math.floor((now - startTime.getTime()) / 60000);

  // Query HEALTH_OK events
  const { data: healthOkEvents } = await supabase
    .from('system_events')
    .select('id, created_at')
    .eq('event_type', 'EXECUTOR_HEALTH_OK')
    .gte('created_at', startTime.toISOString())
    .order('created_at', { ascending: true });

  let maxGap = 0;
  if (healthOkEvents && healthOkEvents.length > 1) {
    for (let i = 1; i < healthOkEvents.length; i++) {
      const prevTime = new Date(healthOkEvents[i - 1].created_at).getTime();
      const currTime = new Date(healthOkEvents[i].created_at).getTime();
      const gapSeconds = (currTime - prevTime) / 1000;
      if (gapSeconds > maxGap) {
        maxGap = gapSeconds;
      }
    }
  }

  // Query proof-tagged decisions (both post and reply) with full details
  const { data: postDecisions } = await supabase
    .from('content_metadata')
    .select('decision_id, status, features, skip_reason, error_message')
    .like('features->>proof_tag', 'control-post-5a4-stability-%')
    .order('created_at', { ascending: false });

  const { data: replyDecisions } = await supabase
    .from('content_metadata')
    .select('decision_id, status, features, skip_reason, error_message')
    .like('features->>proof_tag', 'control-reply-5a4-stability-%')
    .order('created_at', { ascending: false });

  const decisions = [...(postDecisions || []), ...(replyDecisions || [])];

  const statusBuckets: Record<string, number> = {};
  const decisionIds: string[] = [];
  const blockedDecisions: Array<{ decision_id: string; reason: string }> = [];
  const failedDecisions: Array<{ decision_id: string; proof_tag: string; error: string; flags: Record<string, any> }> = [];
  
  if (decisions) {
    decisions.forEach(d => {
      statusBuckets[d.status] = (statusBuckets[d.status] || 0) + 1;
      decisionIds.push(d.decision_id);
      
      // Collect blocked decisions with reasons
      if (d.status === 'blocked' || d.status === 'skipped') {
        const reason = d.skip_reason || d.error_message || 'unknown';
        blockedDecisions.push({ decision_id: d.decision_id, reason });
      }
      
      // Collect failed_permanent decisions with full details
      if (d.status === 'failed_permanent' || d.status === 'failed') {
        const features = d.features && typeof d.features === 'object' ? d.features as any : {};
        const proofTag = features.proof_tag || 'unknown';
        const error = d.error_message || d.skip_reason || 'unknown';
        const flags: Record<string, any> = {};
        
        // Extract flags from features or error_message
        if (features.target_exists !== undefined) flags.target_exists = features.target_exists;
        if (features.is_root_tweet !== undefined) flags.is_root_tweet = features.is_root_tweet;
        if (features.error_code) flags.error_code = features.error_code;
        
        failedDecisions.push({
          decision_id: d.decision_id,
          proof_tag: proofTag,
          error,
          flags
        });
      }
    });
  }
  
  // Count blocked reasons (top 3)
  const blockedReasonCounts: Record<string, number> = {};
  blockedDecisions.forEach(d => {
    blockedReasonCounts[d.reason] = (blockedReasonCounts[d.reason] || 0) + 1;
  });
  const topBlockedReasons = Object.entries(blockedReasonCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([reason, count]) => `${reason}:${count}`);

  // Query error events since start (for proof-tagged decisions only)
  const { data: errorEvents } = await supabase
    .from('system_events')
    .select('event_type, event_data, created_at, message')
    .in('event_type', ['POST_FAILED', 'REPLY_FAILED', 'EXECUTOR_DAEMON_CRASH', 'EXECUTOR_ERROR'])
    .gte('created_at', startTime.toISOString())
    .order('created_at', { ascending: false })
    .limit(50);

  // Filter errors for proof-tagged decisions and extract details
  const proofErrors: Array<{ decision_id: string; proof_tag: string; error_reason: string }> = [];
  if (errorEvents) {
    for (const e of errorEvents) {
      const eventData = typeof e.event_data === 'string' ? JSON.parse(e.event_data) : e.event_data;
      const decisionId = eventData?.decision_id;
      if (decisionId) {
        // Check if this decision has a proof tag
        const decision = decisions.find(d => d.decision_id === decisionId);
        if (decision && decision.features && typeof decision.features === 'object' && 'proof_tag' in decision.features) {
          const proofTag = (decision.features as any).proof_tag;
          if (proofTag && (proofTag.startsWith('control-post-5a4-stability-') || proofTag.startsWith('control-reply-5a4-stability-'))) {
            const errorReason = eventData?.error_message || eventData?.error_code || eventData?.error_name || e.message || 'unknown';
            proofErrors.push({
              decision_id: decisionId,
              proof_tag: proofTag,
              error_reason: errorReason
            });
          }
        }
      }
    }
  }

  // Output checkpoint summary
  const statusStr = Object.entries(statusBuckets).map(([s, c]) => `${s}=${c}`).join(', ') || 'none';
  const errorStr = proofErrors.length > 0 
    ? proofErrors.slice(0, 2).map(e => `${e.decision_id.substring(0, 8)}... (${e.proof_tag.split('-').pop()?.substring(0, 10)}): ${e.error_reason.substring(0, 40)}`).join('; ')
    : 'none';
  
  // Build output lines
  const lines: string[] = [];
  lines.push(`T+${elapsedMinutes}m: HEALTH_OK=${healthOkEvents?.length || 0}, max_gap=${maxGap.toFixed(1)}s | Proof decisions: ${statusStr}${proofErrors.length > 0 ? ` | Errors: ${errorStr}` : ''}`);
  
  // Add blocked reasons (for T+60m and T+90m)
  if (elapsedMinutes >= 60 && topBlockedReasons.length > 0) {
    lines.push(`  Blocked reasons: ${topBlockedReasons.join(', ')}`);
  }
  
  // Add failed_permanent details (for T+60m and T+90m)
  if (elapsedMinutes >= 60 && failedDecisions.length > 0) {
    failedDecisions.forEach(f => {
      const flagsStr = Object.entries(f.flags).map(([k, v]) => `${k}=${v}`).join(',');
      lines.push(`  Failed: ${f.decision_id.substring(0, 8)}... (${f.proof_tag.split('-').pop()?.substring(0, 10)}): ${f.error}${flagsStr ? ` [${flagsStr}]` : ''}`);
    });
  }
  
  console.log(lines.join('\n'));
}

main().catch(console.error);
