/**
 * Print top opportunities for debugging
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db/index';

const minutesArg = process.argv.find(arg => arg.startsWith('--minutes='))?.replace('--minutes=', '') || process.argv[2] || '120';
const minutes = parseInt(minutesArg, 10);
const cutoffTime = new Date(Date.now() - minutes * 60 * 1000);

async function main() {
  console.log(`🔍 Top Opportunities (last ${minutes} minutes)`);
  console.log(`   Cutoff: ${cutoffTime.toISOString()}\n`);
  
  const supabase = getSupabaseClient();
  
  // Get top 10 opportunities ordered by opportunity_score
  const { data: opportunities, error } = await supabase
    .from('reply_opportunities')
    .select('target_tweet_id, target_username, tweet_posted_at, like_count, reply_count, retweet_count, view_count, opportunity_score, is_root_tweet, is_reply_tweet, posted_minutes_ago, tier, created_at')
    .eq('replied_to', false)
    .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
    .gte('tweet_posted_at', cutoffTime.toISOString())
    .order('opportunity_score', { ascending: false })
    .limit(10);
  
  if (error) {
    console.error(`❌ Error querying opportunities: ${error.message}`);
    process.exit(1);
  }
  
  if (!opportunities || opportunities.length === 0) {
    console.log(`⚠️  No opportunities found in last ${minutes} minutes`);
    process.exit(0);
  }
  
  console.log(`📊 Top ${opportunities.length} Opportunities:\n`);
  
  opportunities.forEach((opp, i) => {
    const age = opp.posted_minutes_ago || (opp.tweet_posted_at ? Math.round((Date.now() - new Date(opp.tweet_posted_at).getTime()) / (1000 * 60)) : 'unknown');
    // Calculate likes_per_min on the fly (column may not exist yet)
    const likesPerMin = opp.like_count && age && typeof age === 'number' && age > 0 ? (opp.like_count / age).toFixed(2) : 'N/A';
    const repliesPerMin = opp.reply_count && age && typeof age === 'number' && age > 0 ? (opp.reply_count / age).toFixed(2) : 'N/A';
    const repostsPerMin = opp.retweet_count && age && typeof age === 'number' && age > 0 ? (opp.retweet_count / age).toFixed(2) : 'N/A';
    const classification = opp.is_root_tweet ? 'ROOT' : opp.is_reply_tweet ? 'REPLY' : 'UNKNOWN';
    
    console.log(`${i + 1}. Tweet ID: ${opp.target_tweet_id}`);
    console.log(`   Author: @${opp.target_username}`);
    console.log(`   Tier: ${opp.tier || 'B'}`);
    console.log(`   Age: ${age} minutes`);
    console.log(`   Engagement: ${opp.like_count || 0} likes, ${opp.reply_count || 0} replies, ${opp.retweet_count || 0} reposts`);
    console.log(`   Likes/min: ${likesPerMin}`);
    console.log(`   Replies/min: ${repliesPerMin}`);
    console.log(`   Reposts/min: ${repostsPerMin}`);
    console.log(`   Views: ${opp.view_count || 'N/A'}`);
    console.log(`   Score: ${opp.opportunity_score || 0}`);
    console.log(`   Classification: ${classification}`);
    console.log(`   URL: https://x.com/i/web/status/${opp.target_tweet_id}`);
    console.log('');
  });
  
  process.exit(0);
}

main().catch(console.error);

