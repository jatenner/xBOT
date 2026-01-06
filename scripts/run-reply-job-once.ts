/**
 * Run reply job once (for ramp mode testing)
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db/index';

async function main() {
  console.log('🚀 Running reply job once...\n');
  
  // Import the reply job function
  const replyJobModule = await import('../src/jobs/replyJob');
  
  // Use generateReplies which is the exported function
  if (typeof replyJobModule.generateReplies === 'function') {
    try {
      await replyJobModule.generateReplies();
      console.log('\n✅ Reply job cycle complete');
    } catch (error: any) {
      console.error(`\n❌ Error: ${error.message}`);
      if (error.stack) {
        console.error(error.stack);
      }
      process.exit(1);
      return;
    }
  } else {
    console.error('❌ Could not find generateReplies function');
    console.error('Available exports:', Object.keys(replyJobModule));
    process.exit(1);
    return;
  }
  
  // Check for new reply decisions created
  const supabase = getSupabaseClient();
  const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();
  
  const { data: newReplies, error } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('decision_id, status, target_tweet_content_snapshot, target_tweet_content_hash, semantic_similarity, created_at')
    .eq('decision_type', 'reply')
    .gte('created_at', oneMinuteAgo)
    .order('created_at', { ascending: false });
  
  if (error) {
    console.warn(`⚠️  Could not check new replies: ${error.message}`);
  } else if (newReplies && newReplies.length > 0) {
    console.log(`\n📊 New reply decisions created: ${newReplies.length}`);
    const withSnapshot = newReplies.filter(r => r.target_tweet_content_snapshot && r.target_tweet_content_snapshot.length >= 20);
    const withHash = newReplies.filter(r => r.target_tweet_content_hash);
    console.log(`   ✅ With snapshot: ${withSnapshot.length}/${newReplies.length}`);
    console.log(`   ✅ With hash: ${withHash.length}/${newReplies.length}`);
  } else {
    console.log(`\n📊 No new reply decisions created in last minute`);
  }
  
  process.exit(0);
}

main().catch(console.error);

