/**
 * Check opportunities in database
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db/index';

const minutesArg = process.argv.find(arg => arg.startsWith('--minutes='))?.replace('--minutes=', '') || process.argv[2] || '240';
const minutes = parseInt(minutesArg, 10);
const cutoffTime = new Date(Date.now() - minutes * 60 * 1000);

async function main() {
  console.log(`🔍 Checking opportunities in database (last ${minutes} minutes)`);
  console.log(`   Cutoff: ${cutoffTime.toISOString()}\n`);
  
  const supabase = getSupabaseClient();
  
  // Check reply_opportunities table
  console.log('=== Table: reply_opportunities ===');
  const { count: totalCount, error: countError } = await supabase
    .from('reply_opportunities')
    .select('*', { count: 'exact', head: true });
  
  if (countError) {
    console.error(`❌ Error counting opportunities: ${countError.message}`);
  } else {
    console.log(`Total rows in table: ${totalCount || 0}`);
  }
  
  // Count in time window
  const { count: recentCount, error: recentError } = await supabase
    .from('reply_opportunities')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', cutoffTime.toISOString());
  
  if (recentError) {
    console.error(`❌ Error counting recent opportunities: ${recentError.message}`);
  } else {
    console.log(`Rows in last ${minutes} minutes: ${recentCount || 0}`);
  }
  
  // Get 10 most recent opportunities
  const { data: opportunities, error: oppError } = await supabase
    .from('reply_opportunities')
    .select('target_tweet_id, target_username, created_at, opportunity_score, like_count, reply_count, view_count, posted_minutes_ago, is_root_tweet, replied_to, tweet_posted_at')
    .order('created_at', { ascending: false })
    .limit(10);
  
  if (oppError) {
    console.error(`❌ Error querying opportunities: ${oppError.message}`);
  } else if (!opportunities || opportunities.length === 0) {
    console.log(`⚠️  No opportunities found in table`);
  } else {
    console.log(`\n📊 10 Most Recent Opportunities:\n`);
    opportunities.forEach((opp, i) => {
      const age = opp.created_at ? Math.round((Date.now() - new Date(opp.created_at).getTime()) / (1000 * 60)) : 'unknown';
      const tweetAge = opp.posted_minutes_ago || (opp.tweet_posted_at ? Math.round((Date.now() - new Date(opp.tweet_posted_at).getTime()) / (1000 * 60)) : 'unknown');
      console.log(`${i + 1}. Tweet ID: ${opp.target_tweet_id}`);
      console.log(`   Author: @${opp.target_username}`);
      console.log(`   Created at: ${opp.created_at} (${age} min ago)`);
      console.log(`   Tweet age: ${tweetAge} min`);
      console.log(`   Score: ${opp.opportunity_score || 'N/A'}`);
      console.log(`   Engagement: ${opp.like_count || 0} likes, ${opp.reply_count || 0} replies`);
      console.log(`   Views: ${opp.view_count || 'N/A'}`);
      console.log(`   Root: ${opp.is_root_tweet ? 'YES' : 'NO'}`);
      console.log(`   Replied: ${opp.replied_to ? 'YES' : 'NO'}`);
      console.log('');
    });
  }
  
  // Check if there are any opportunities that are not replied_to
  const { count: availableCount, error: availableError } = await supabase
    .from('reply_opportunities')
    .select('*', { count: 'exact', head: true })
    .eq('replied_to', false)
    .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString());
  
  if (!availableError) {
    console.log(`\n📊 Available opportunities (not replied, not expired): ${availableCount || 0}`);
  }
  
  process.exit(0);
}

main().catch(console.error);

