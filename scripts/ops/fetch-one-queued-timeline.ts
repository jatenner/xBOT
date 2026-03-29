/**
 * Fetch one queued timeline (single/thread) decision for controlled live test.
 * Prints decision_id and content preview; exits 1 if none found.
 */

import 'dotenv/config';
import { getSupabaseClient } from '../../src/db/index';

async function main() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('content_metadata')
    .select('decision_id, decision_type, status, content, created_at')
    .eq('status', 'queued')
    .in('decision_type', ['single', 'thread'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[FETCH_QUEUED] DB error:', error.message);
    process.exit(1);
  }
  if (!data) {
    console.log('[FETCH_QUEUED] NO_QUEUED_DECISION');
    process.exit(1);
  }

  const ok =
    data.status === 'queued' &&
    data.decision_type !== 'reply' &&
    typeof data.content === 'string' &&
    data.content.trim().length > 0;

  if (!ok) {
    console.error('[FETCH_QUEUED] Validation failed: status=%s decision_type=%s content_empty=%s', data.status, data.decision_type, !(data.content?.trim?.()));
    process.exit(1);
  }

  const preview = (data.content || '').trim().slice(0, 100);
  console.log('[FETCH_QUEUED] decision_id=' + data.decision_id);
  console.log('[FETCH_QUEUED] decision_type=' + data.decision_type);
  console.log('[FETCH_QUEUED] status=' + data.status);
  console.log('[FETCH_QUEUED] content_preview=' + preview + (data.content.length > 100 ? '…' : ''));
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
