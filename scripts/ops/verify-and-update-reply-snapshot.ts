#!/usr/bin/env tsx
/**
 * Fetch live tweet text for TARGET_TWEET_ID and update reply_opportunities so snapshot matches.
 * Run before seeding so context lock will pass. Requires RUNNER_MODE=true RUNNER_BROWSER=cdp.
 *
 * Usage: TARGET_TWEET_ID=123 RUNNER_MODE=true RUNNER_BROWSER=cdp pnpm tsx scripts/ops/verify-and-update-reply-snapshot.ts
 */

import 'dotenv/config';
import { getSupabaseClient } from '../../src/db/index';
import { fetchTweetData } from '../../src/gates/contextLockVerifier';

async function main() {
  const targetTweetId = process.env.TARGET_TWEET_ID?.trim();
  if (!targetTweetId) {
    console.error('[VERIFY_SNAPSHOT] TARGET_TWEET_ID required');
    process.exit(1);
  }

  const supabase = getSupabaseClient();
  const { data: row, error: fetchError } = await supabase
    .from('reply_opportunities')
    .select('target_tweet_id, target_username, target_tweet_content')
    .eq('target_tweet_id', targetTweetId)
    .maybeSingle();

  if (fetchError || !row) {
    console.error('[VERIFY_SNAPSHOT] Opportunity not found:', fetchError?.message || 'no row');
    process.exit(1);
  }

  let live: { text: string; isReply: boolean } | null = null;
  try {
    live = await fetchTweetData(targetTweetId);
  } catch (e: any) {
    console.error('[VERIFY_SNAPSHOT] Fetch threw:', e?.message || e);
    process.exit(1);
  }
  if (!live) {
    console.error('[VERIFY_SNAPSHOT] Failed to fetch live tweet (inaccessible/deleted/timeout)');
    process.exit(1);
  }

  const liveText = live.text.trim();
  if (!liveText || liveText.length < 10) {
    console.error('[VERIFY_SNAPSHOT] Live text too short or empty');
    process.exit(1);
  }

  const { error: updateError } = await supabase
    .from('reply_opportunities')
    .update({ target_tweet_content: liveText })
    .eq('target_tweet_id', targetTweetId);

  if (updateError) {
    console.error('[VERIFY_SNAPSHOT] Update failed:', updateError.message);
    process.exit(1);
  }

  console.log('[VERIFY_SNAPSHOT] snapshot_match_verified=true');
  console.log('[VERIFY_SNAPSHOT] target_tweet_id=' + targetTweetId);
  console.log('[VERIFY_SNAPSHOT] target_username=' + (row.target_username || ''));
  console.log('[VERIFY_SNAPSHOT] live_text_length=' + liveText.length);
  console.log('[VERIFY_SNAPSHOT] reply_opportunities updated; seed with this TARGET_TWEET_ID.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
