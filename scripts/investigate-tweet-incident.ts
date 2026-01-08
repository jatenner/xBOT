/**
 * Investigate tweet incident: 2009117059091984530
 * Check if tweet is a reply and test root resolution
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db/index';
import { resolveRootTweetId } from '../src/utils/resolveRootTweet';

async function main() {
  const tweetId = '2009117059091984530';
  const supabase = getSupabaseClient();
  
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`🔍 INVESTIGATING TWEET INCIDENT: ${tweetId}`);
  console.log('═══════════════════════════════════════════════════════════\n');
  
  // 1A) Check if target tweet exists in DB
  console.log('1A) Checking if target tweet exists in DB...');
  const { data: targetDecision } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('*')
    .eq('tweet_id', tweetId)
    .maybeSingle();
  
  if (targetDecision) {
    console.log('✅ Target tweet FOUND in DB:');
    console.log(`   decision_id: ${targetDecision.decision_id}`);
    console.log(`   decision_type: ${targetDecision.decision_type}`);
    console.log(`   status: ${targetDecision.status}`);
    console.log(`   target_tweet_id: ${targetDecision.target_tweet_id || 'N/A'}`);
    console.log(`   root_tweet_id: ${targetDecision.root_tweet_id || 'N/A'}`);
    console.log(`   target_username: ${targetDecision.target_username || 'N/A'}`);
  } else {
    console.log('❌ Target tweet NOT FOUND in content_generation_metadata_comprehensive');
  }
  
  // Check reply_opportunities
  const { data: opp } = await supabase
    .from('reply_opportunities')
    .select('*')
    .eq('target_tweet_id', tweetId)
    .maybeSingle();
  
  if (opp) {
    console.log('\n✅ Target tweet FOUND in reply_opportunities:');
    console.log(`   id: ${opp.id}`);
    console.log(`   is_reply_tweet: ${opp.is_reply_tweet}`);
    console.log(`   is_root_tweet: ${opp.is_root_tweet}`);
    console.log(`   target_in_reply_to_tweet_id: ${opp.target_in_reply_to_tweet_id || 'NULL'}`);
    console.log(`   root_tweet_id: ${opp.root_tweet_id || 'NULL'}`);
    console.log(`   status: ${opp.status}`);
    console.log(`   selection_reason: ${opp.selection_reason || 'N/A'}`);
  } else {
    console.log('\n❌ Target tweet NOT FOUND in reply_opportunities');
  }
  
  // 1B) Find our bot's reply
  console.log('\n1B) Searching for bot reply...');
  const { data: botReplies } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('*')
    .eq('target_tweet_id', tweetId)
    .eq('decision_type', 'reply')
    .order('created_at', 'desc')
    .limit(5);
  
  if (botReplies && botReplies.length > 0) {
    console.log(`✅ Found ${botReplies.length} bot reply(ies):`);
    for (const reply of botReplies) {
      console.log(`   decision_id: ${reply.decision_id}`);
      console.log(`   tweet_id: ${reply.tweet_id || 'NOT POSTED YET'}`);
      console.log(`   status: ${reply.status}`);
      console.log(`   content preview: ${reply.content?.substring(0, 100) || 'N/A'}...`);
      console.log(`   created_at: ${reply.created_at}`);
      console.log(`   posted_at: ${reply.posted_at || 'N/A'}`);
      console.log(`   pipeline_source: ${reply.pipeline_source || 'N/A'}`);
    }
  } else {
    console.log('❌ Bot reply NOT FOUND in DB');
    console.log('   ⚠️  This suggests Category B: Ghost/bypass posting path');
  }
  
  // 1C) Test root resolution
  console.log('\n1C) Testing root resolution...');
  console.log('   (This will use Playwright to check the actual tweet)');
  
  try {
    const resolution = await resolveRootTweetId(tweetId);
    console.log('\n✅ Root resolution result:');
    console.log(`   originalTweetId: ${resolution.originalTweetId}`);
    console.log(`   rootTweetId: ${resolution.rootTweetId}`);
    console.log(`   isRootTweet: ${resolution.isRootTweet}`);
    console.log(`   rootTweetAuthor: ${resolution.rootTweetAuthor || 'N/A'}`);
    console.log(`   rootTweetContent preview: ${resolution.rootTweetContent?.substring(0, 100) || 'N/A'}...`);
    
    if (resolution.isRootTweet && resolution.rootTweetId === tweetId) {
      console.log('\n   ⚠️  RESOLVER SAYS: This is a ROOT tweet');
      console.log('   ⚠️  If screenshot shows it\'s a reply, resolver has a BUG');
    } else {
      console.log('\n   ✅ RESOLVER SAYS: This is a REPLY tweet');
      console.log(`   ✅ Root tweet ID: ${resolution.rootTweetId}`);
    }
  } catch (error: any) {
    console.error(`\n❌ Root resolution failed: ${error.message}`);
  }
  
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('EVIDENCE SUMMARY:');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`Target tweet in DB: ${targetDecision ? 'YES' : 'NO'}`);
  console.log(`Target tweet in reply_opportunities: ${opp ? 'YES' : 'NO'}`);
  console.log(`Bot reply in DB: ${botReplies && botReplies.length > 0 ? 'YES' : 'NO'}`);
  if (botReplies && botReplies.length === 0) {
    console.log('\n🚨 CATEGORY B SUSPECTED: Bot reply not in DB = ghost/bypass path');
  }
  console.log('\n');
  
  process.exit(0);
}

main().catch(console.error);

