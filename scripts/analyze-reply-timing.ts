#!/usr/bin/env tsx
/**
 * Analyze reply timing to understand visibility issues
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function analyze() {
  console.log('🔍 REPLY TIMING & VISIBILITY ANALYSIS\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Get recent replies
  const { data: replies } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('*')
    .eq('decision_type', 'reply')
    .eq('status', 'posted')
    .gte('posted_at', new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString())
    .order('posted_at', { ascending: false });

  if (!replies || replies.length === 0) {
    console.log('❌ No recent replies found\n');
    return;
  }

  console.log(`Found ${replies.length} replies in last 5 hours\n`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  for (const reply of replies) {
    const minutesAgo = Math.round((Date.now() - new Date(reply.posted_at).getTime()) / 1000 / 60);
    
    console.log(`Reply to @${reply.target_username}:`);
    console.log(`   Posted: ${Math.floor(minutesAgo / 60)}h ${minutesAgo % 60}m ago`);
    console.log(`   URL: https://x.com/SignalAndSynapse/status/${reply.tweet_id}`);
    
    // Get opportunity data
    if (reply.target_tweet_id) {
      const { data: opp } = await supabase
        .from('reply_opportunities')
        .select('*')
        .eq('target_tweet_id', reply.target_tweet_id)
        .single();

      if (opp) {
        const harvestedAt = new Date(opp.created_at);
        const replyPostedAt = new Date(reply.posted_at);
        const minutesBetweenHarvestAndReply = Math.round((replyPostedAt.getTime() - harvestedAt.getTime()) / 1000 / 60);
        
        console.log(`\n   Target Tweet Metrics:`);
        console.log(`      Likes: ${opp.like_count?.toLocaleString() || 'N/A'}`);
        console.log(`      Views: ${opp.view_count?.toLocaleString() || 'N/A'}`);
        console.log(`      Replies: ${opp.reply_count || 'N/A'}`);
        
        console.log(`\n   Timing:`);
        console.log(`      Harvested: ${Math.round((Date.now() - harvestedAt.getTime()) / 1000 / 60 / 60)} hours ago`);
        console.log(`      Delay from harvest to reply: ${Math.floor(minutesBetweenHarvestAndReply / 60)}h ${minutesBetweenHarvestAndReply % 60}m`);
        
        // Estimate tweet age when replied
        const tweetAgeWhenHarvested = opp.posted_minutes_ago || 0;
        const estimatedTweetAgeWhenReplied = tweetAgeWhenHarvested + minutesBetweenHarvestAndReply;
        
        console.log(`      Tweet age when harvested: ${Math.floor(tweetAgeWhenHarvested / 60)}h ${tweetAgeWhenHarvested % 60}m`);
        console.log(`      Estimated tweet age when replied: ~${Math.floor(estimatedTweetAgeWhenReplied / 60)}h ${estimatedTweetAgeWhenReplied % 60}m`);
        
        console.log(`\n   Visibility Assessment:`);
        if (estimatedTweetAgeWhenReplied < 30) {
          console.log(`      ✅ EXCELLENT - Fresh tweet, high visibility`);
        } else if (estimatedTweetAgeWhenReplied < 120) {
          console.log(`      ⚠️  GOOD - Still active, decent visibility`);
        } else if (estimatedTweetAgeWhenReplied < 360) {
          console.log(`      ❌ POOR - Tweet aging, low visibility`);
        } else if (estimatedTweetAgeWhenReplied < 1440) {
          console.log(`      ❌ VERY POOR - Tweet cold, minimal visibility`);
        } else {
          console.log(`      ❌ DEAD - Tweet buried, zero visibility`);
        }
        
        if (estimatedTweetAgeWhenReplied > 120) {
          console.log(`\n   Why no views:`);
          console.log(`      • Tweet out of active feeds`);
          console.log(`      • Engagement window closed`);
          console.log(`      • Reply won't trigger notifications`);
          console.log(`      • Original audience moved on`);
        }
      }
    }
    
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  }
  
  console.log('\n🎯 X ALGORITHM VISIBILITY WINDOWS:\n');
  console.log('   0-30 min:    Peak visibility (100%)');
  console.log('   30-120 min:  Good visibility (50%)');
  console.log('   2-6 hours:   Low visibility (10%)');
  console.log('   6-24 hours:  Very low (1-2%)');
  console.log('   24+ hours:   Dead (< 0.1%)\n');
  
  console.log('🔧 REQUIRED FIXES:\n');
  console.log('   1. Harvester must only collect FRESH tweets (< 30 min old)');
  console.log('   2. Reply within 5-10 minutes of harvest');
  console.log('   3. Clear stale opportunities from queue');
  console.log('   4. Prioritize fresh over old opportunities\n');
}

analyze();

