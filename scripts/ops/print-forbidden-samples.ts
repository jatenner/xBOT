#!/usr/bin/env tsx
/**
 * Print Forbidden Samples
 * 
 * Prints last 10 probed candidates with:
 * tweet_id, discovery_source, accessibility_status, last_probe_reason, url
 */

import 'dotenv/config';
import { getSupabaseClient } from '../../src/db/index';

async function main() {
  const supabase = getSupabaseClient();
  
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔍 Last 10 Probed Candidates');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  // Get last 10 probed candidates (have accessibility_status set)
  const { data: candidates, error } = await supabase
    .from('reply_opportunities')
    .select('target_tweet_id, discovery_source, accessibility_status, accessibility_reason, target_tweet_url, target_username')
    .not('accessibility_status', 'is', null)
    .order('accessibility_checked_at', { ascending: false, nullsFirst: false })
    .limit(10);
  
  if (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
  
  if (!candidates || candidates.length === 0) {
    console.log('⚠️  No probed candidates found');
    process.exit(0);
  }
  
  console.log('Format: tweet_id | discovery_source | accessibility_status | reason | url\n');
  
  candidates.forEach((cand, idx) => {
    const tweetId = cand.target_tweet_id || 'unknown';
    const discoverySource = cand.discovery_source || 'unknown';
    const accessibilityStatus = cand.accessibility_status || 'unknown';
    const reason = cand.accessibility_reason || 'no_reason';
    const url = cand.target_tweet_url || `https://x.com/i/web/status/${tweetId}`;
    const username = cand.target_username || 'unknown';
    
    const statusEmoji = accessibilityStatus === 'forbidden' ? '🚫' : 
                        accessibilityStatus === 'ok' ? '✅' : 
                        accessibilityStatus === 'login_wall' ? '🔐' : '❓';
    
    console.log(`${idx + 1}. ${statusEmoji} tweet_id=${tweetId}`);
    console.log(`   discovery_source="${discoverySource}"`);
    console.log(`   accessibility_status="${accessibilityStatus}"`);
    console.log(`   reason="${reason}"`);
    console.log(`   url=${url}`);
    console.log(`   author=@${username}`);
    console.log('');
  });
  
  // Also print forbidden ones specifically
  const forbiddenCount = candidates.filter(c => c.accessibility_status === 'forbidden').length;
  console.log(`\n📊 Summary: ${forbiddenCount}/${candidates.length} are forbidden`);
  
  if (forbiddenCount > 0) {
    console.log('\n🔍 Forbidden tweet URLs (for manual verification):');
    candidates
      .filter(c => c.accessibility_status === 'forbidden')
      .slice(0, 3)
      .forEach((cand, idx) => {
        const tweetId = cand.target_tweet_id || 'unknown';
        const url = cand.target_tweet_url || `https://x.com/i/web/status/${tweetId}`;
        console.log(`${idx + 1}. ${url}`);
      });
  }
}

main().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
