#!/usr/bin/env tsx
/**
 * 🌱 SEED REPLY OPPORTUNITIES
 * 
 * Manually seed reply_opportunities table from tweet URLs or IDs.
 * Reuses the same insertion pattern as the harvester.
 * 
 * Usage:
 *   SEED_TWEET_URLS="https://x.com/user/status/123...,https://x.com/other/status/456..." pnpm run ops:seed:reply-opportunities
 *   SEED_TWEET_IDS="1234567890,9876543210" pnpm run ops:seed:reply-opportunities
 */

import { getSupabaseClient } from '../../src/db/index';

interface SeedResult {
  attempted: number;
  inserted: number;
  already_exists: number;
  invalid: number;
}

function parseTweetId(input: string): { tweetId: string; username: string | null } | null {
  // Try parsing as URL first
  if (input.includes('x.com/') || input.includes('twitter.com/')) {
    // Extract tweet ID from URL: https://x.com/username/status/1234567890
    const statusMatch = input.match(/\/(?:status|i\/web\/status)\/(\d+)/);
    if (statusMatch && statusMatch[1]) {
      const usernameMatch = input.match(/(?:x\.com|twitter\.com)\/([^\/]+)/);
      const username = usernameMatch ? usernameMatch[1] : null;
      return { tweetId: statusMatch[1], username };
    }
    return null;
  }
  
  // Try parsing as numeric ID
  const numericId = input.trim();
  if (/^\d+$/.test(numericId) && numericId.length >= 15) {
    return { tweetId: numericId, username: null };
  }
  
  return null;
}

async function main(): Promise<void> {
  const tweetUrls = process.env.SEED_TWEET_URLS || '';
  const tweetIds = process.env.SEED_TWEET_IDS || '';
  
  if (!tweetUrls && !tweetIds) {
    console.error('[SEED] ERROR: Must provide SEED_TWEET_URLS or SEED_TWEET_IDS');
    process.exit(1);
  }
  
  // Parse inputs
  const urlList = tweetUrls ? tweetUrls.split(',').map(s => s.trim()).filter(Boolean) : [];
  const idList = tweetIds ? tweetIds.split(',').map(s => s.trim()).filter(Boolean) : [];
  const allInputs = [...urlList, ...idList];
  
  if (allInputs.length === 0) {
    console.error('[SEED] ERROR: No valid inputs provided');
    process.exit(1);
  }
  
  console.log(`[SEED] Parsing ${allInputs.length} input(s)...`);
  
  const parsed: Array<{ tweetId: string; username: string | null }> = [];
  const invalid: string[] = [];
  
  for (const input of allInputs) {
    const result = parseTweetId(input);
    if (result) {
      parsed.push(result);
    } else {
      invalid.push(input);
      console.log(`[SEED] ⚠️ Invalid input: ${input}`);
    }
  }
  
  if (parsed.length === 0) {
    console.error('[SEED] ERROR: No valid tweet IDs found');
    process.exit(1);
  }
  
  console.log(`[SEED] Parsed ${parsed.length} valid tweet ID(s), ${invalid.length} invalid`);
  
  const supabase = getSupabaseClient();
  const result: SeedResult = {
    attempted: parsed.length,
    inserted: 0,
    already_exists: 0,
    invalid: invalid.length,
  };
  
  // Check which ones already exist
  const tweetIdsToCheck = parsed.map(p => p.tweetId);
  const { data: existing } = await supabase
    .from('reply_opportunities')
    .select('target_tweet_id')
    .in('target_tweet_id', tweetIdsToCheck);
  
  const existingIds = new Set((existing || []).map((r: any) => String(r.target_tweet_id)));
  
  // Insert each opportunity
  for (const { tweetId, username } of parsed) {
    if (existingIds.has(tweetId)) {
      console.log(`[SEED] already_exists tweet_id=${tweetId}`);
      result.already_exists++;
      continue;
    }
    
    try {
      // Use minimal required fields matching harvester pattern
      const now = new Date();
      const { error } = await supabase
        .from('reply_opportunities')
        .insert({
          target_tweet_id: tweetId,
          target_username: username || null,
          target_tweet_url: `https://x.com/i/status/${tweetId}`,
          target_tweet_content: '', // Empty - will be filled by executor verification
          discovery_source: 'public_search_manual',
          status: 'pending',
          replied_to: false,
          is_root_tweet: true,
          is_reply_tweet: false,
          root_tweet_id: tweetId,
          opportunity_score: 50.0, // Default score
          tweet_posted_at: now.toISOString(),
          created_at: now.toISOString(),
          accessibility_status: 'unknown', // Will be probed by executor
        });
      
      if (error) {
        if (error.message.includes('duplicate') || error.message.includes('unique')) {
          console.log(`[SEED] already_exists tweet_id=${tweetId} (duplicate key)`);
          result.already_exists++;
        } else {
          console.error(`[SEED] ERROR inserting tweet_id=${tweetId}: ${error.message}`);
          result.invalid++;
        }
      } else {
        console.log(`[SEED] ✅ inserted tweet_id=${tweetId} username=${username || 'null'}`);
        result.inserted++;
      }
    } catch (err: any) {
      console.error(`[SEED] ERROR inserting tweet_id=${tweetId}: ${err.message}`);
      result.invalid++;
    }
  }
  
  // Print summary
  console.log('');
  console.log(`[SEED] Summary:`);
  console.log(`  attempted=${result.attempted}`);
  console.log(`  inserted=${result.inserted}`);
  console.log(`  already_exists=${result.already_exists}`);
  console.log(`  invalid=${result.invalid}`);
  
  // Exit non-zero if inserted=0 AND all inputs were valid
  if (result.inserted === 0 && result.invalid === invalid.length) {
    console.error('[SEED] ERROR: No opportunities inserted (all were duplicates or invalid)');
    process.exit(1);
  }
  
  if (result.inserted > 0) {
    console.log(`[SEED] ✅ Successfully inserted ${result.inserted} opportunity/opportunities`);
  }
  
  process.exit(0);
}

main().catch(err => {
  console.error('[SEED] FATAL:', err);
  process.exit(1);
});
