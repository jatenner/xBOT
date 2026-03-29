/**
 * Seed ONE queued single-post decision for controlled live test.
 * Minimal columns only (no format_strategy etc.) so it works with current schema.
 */

import 'dotenv/config';
import { getSupabaseClient } from '../../src/db/index';
import { v4 as uuidv4 } from 'uuid';

const CONTENT =
  'Research shows combining strength training with zone 2 cardio improves metabolic health. Sequence matters: strength first, then 20–30 min cardio.';

async function main() {
  const supabase = getSupabaseClient();
  const decisionId = uuidv4();
  const now = new Date().toISOString();

  const { error } = await supabase.from('content_metadata').insert({
    decision_id: decisionId,
    decision_type: 'single',
    content: CONTENT,
    status: 'queued',
    scheduled_at: now,
    generation_source: 'real',
    features: { seeded_for_controlled_test: true, created_at: now },
  } as any);

  if (error) {
    console.error('[SEED_TIMELINE] Insert failed:', error.message);
    process.exit(1);
  }

  console.log('[SEED_TIMELINE] decision_id=' + decisionId);
  console.log('[SEED_TIMELINE] content_preview=' + CONTENT.slice(0, 100) + '…');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
