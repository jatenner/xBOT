#!/usr/bin/env tsx
/**
 * Pick one reply target for controlled reply proof: recent, non-org, not the same as prior 226 target.
 * Outputs: target_tweet_id, target_username, target_tweet_content (for REPLY_CONTENT crafting).
 */

import 'dotenv/config';
import { getSupabaseClient } from '../../src/db/index';

async function main() {
  const supabase = getSupabaseClient();
  const ourHandle = (process.env.TWITTER_USERNAME || 'thehealthnote99').toLowerCase();
  const excludeHandles = [ourHandle, 'american_heart', 'americanheart', 'only1magician', 'energy_fuels', 'ewnsafrica'];

  const { data: rows, error } = await supabase
    .from('reply_opportunities')
    .select('target_tweet_id, target_username, target_tweet_content, like_count, tweet_posted_at')
    .eq('is_root_tweet', true)
    .order('tweet_posted_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error('[PICK_TARGET]', error.message);
    process.exit(1);
  }
  if (!rows?.length) {
    console.error('[PICK_TARGET] No opportunities');
    process.exit(1);
  }

  const row = rows.find(
    (r) => r.target_username && !excludeHandles.includes(String(r.target_username).toLowerCase())
  );
  if (!row) {
    console.error('[PICK_TARGET] No opportunity excluding American_Heart etc.');
    process.exit(1);
  }

  const content = String(row.target_tweet_content || '').trim();
  const ageHours = row.tweet_posted_at
    ? ((Date.now() - new Date(row.tweet_posted_at).getTime()) / 3600000).toFixed(1)
    : '?';

  console.log('[PICK_TARGET] target_tweet_id=' + row.target_tweet_id);
  console.log('[PICK_TARGET] target_username=' + row.target_username);
  console.log('[PICK_TARGET] age_hours=' + ageHours);
  console.log('[PICK_TARGET] content_preview=' + content.slice(0, 80));
  console.log('[PICK_TARGET] full_content=' + content);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
