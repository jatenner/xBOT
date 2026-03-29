#!/usr/bin/env tsx
/**
 * Reset retry deferral for one reply decision so it becomes eligible on the next
 * posting-queue-once run (scheduled_at = now). Use for controlled live reply tests
 * when the decision was moved to retry deferral.
 *
 * Usage:
 *   pnpm exec tsx scripts/ops/reset-reply-deferral-once.ts <decision_id>
 *
 * Example:
 *   pnpm exec tsx scripts/ops/reset-reply-deferral-once.ts aaca2464-2c20-48ff-bdb0-705e7238efe6
 */

import 'dotenv/config';
import { getSupabaseClient } from '../../src/db/index';

async function main() {
  const decisionId = process.argv[2]?.trim();
  if (!decisionId) {
    console.error('Usage: pnpm exec tsx scripts/ops/reset-reply-deferral-once.ts <decision_id>');
    process.exit(1);
  }

  const supabase = getSupabaseClient();
  const now = new Date().toISOString();

  const { data: row } = await supabase
    .from('content_metadata')
    .select('features')
    .eq('decision_id', decisionId)
    .eq('decision_type', 'reply')
    .eq('status', 'queued')
    .single();

  if (!row) {
    console.error('[RESET_DEFERRAL] No queued reply found for decision_id=', decisionId);
    process.exit(1);
  }

  const features = (row.features || {}) as Record<string, unknown>;
  const { data, error } = await supabase
    .from('content_metadata')
    .update({
      scheduled_at: now,
      updated_at: now,
      features: { ...features, retry_count: 0, deferral_cleared_at: now },
    })
    .eq('decision_id', decisionId)
    .eq('decision_type', 'reply')
    .eq('status', 'queued')
    .select('decision_id, scheduled_at');

  if (error) {
    console.error('[RESET_DEFERRAL] Error:', error.message);
    process.exit(1);
  }
  if (!data || data.length === 0) {
    console.error('[RESET_DEFERRAL] No queued reply found for decision_id=', decisionId);
    process.exit(1);
  }
  console.log('[RESET_DEFERRAL] OK: scheduled_at set to now for decision_id=', decisionId);
  console.log('[RESET_DEFERRAL] Run: EXECUTION_MODE=executor SHADOW_MODE=false X_ACTIONS_ENABLED=true POSTING_ENABLED=true pnpm run runner:posting-queue-once');
}

main();
