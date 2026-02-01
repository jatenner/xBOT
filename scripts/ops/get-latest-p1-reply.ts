#!/usr/bin/env tsx
/**
 * Get latest P1 reply URL
 */

import 'dotenv/config';
import { getSupabaseClient } from '../../src/db/index';

async function main() {
  const supabase = getSupabaseClient();
  const p1StartDate = '2026-02-01';
  
  const { data } = await supabase
    .from('content_metadata')
    .select('tweet_id, posted_at')
    .eq('decision_type', 'reply')
    .eq('status', 'posted')
    .not('tweet_id', 'is', null)
    .gte('posted_at', p1StartDate)
    .order('posted_at', { ascending: false })
    .limit(1)
    .single();
  
  if (data && data.tweet_id) {
    console.log(`https://x.com/i/web/status/${data.tweet_id}`);
  }
}

main().catch(() => {});
