/**
 * Verify Recent Posts - Check if all visible tweets are tracked in database
 */

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const tweetIds = [
  '2002932801801486383', // Intermittent fasting 9:42 PM
  '2002931765539922331', // Foods that hinder recovery 9:38 PM
  '2002916425816797631', // Struggling with cravings 8:37 PM
  '2002915185091330157', // Smaller plates 8:32 PM
  '2002899608817770514', // Daily walks 7:30 PM
  '2002881468377518400', // Bone broth (thread) 6:18 PM
  '2002829741519421854', // 5-minute walk (thread) 2:53 PM
  '2002882275126792617', // Grounding/nature 6:22 PM
];

async function verifyRecentPosts() {
  console.log('🔍 Checking database for visible tweets from Dec 21...\n');
  console.log('📊 Expected: 8 tweets visible on X');
  console.log('📊 Checking: content_metadata + post_receipts\n');

  const results = [];

  for (const tweetId of tweetIds) {
    // Check content_metadata
    const { data: content } = await supabase
      .from('content_metadata')
      .select('decision_id, tweet_id, decision_type, status, posted_at, thread_tweet_ids')
      .or(`tweet_id.eq.${tweetId},thread_tweet_ids.cs.{${tweetId}}`)
      .maybeSingle();
    
    // Check post_receipts
    const { data: receipt } = await supabase
      .from('post_receipts')
      .select('receipt_id, root_tweet_id, post_type, posted_at')
      .eq('root_tweet_id', tweetId)
      .maybeSingle();
    
    results.push({
      tweet_id: tweetId,
      in_content_metadata: !!content,
      in_post_receipts: !!receipt,
      decision_id: content?.decision_id || 'MISSING',
      status: content?.status || 'MISSING',
      type: content?.decision_type || receipt?.post_type || 'UNKNOWN',
      posted_at: content?.posted_at || receipt?.posted_at || 'MISSING'
    });
  }

  console.log('═══════════════════════════════════════════════════════════');
  console.log('TWEET VERIFICATION RESULTS:');
  console.log('═══════════════════════════════════════════════════════════\n');

  let inDB = 0;
  let inReceipts = 0;
  let missing = 0;

  results.forEach((r, i) => {
    const time = r.posted_at !== 'MISSING' 
      ? new Date(r.posted_at).toLocaleTimeString('en-US', { 
          timeZone: 'America/New_York', 
          hour: 'numeric', 
          minute: '2-digit' 
        }) 
      : 'N/A';
    
    console.log(`${i+1}. Tweet ID: ${r.tweet_id.substring(0, 10)}...`);
    console.log(`   Posted: ${time} ET`);
    console.log(`   Type: ${r.type}`);
    console.log(`   Status: ${r.status}`);
    console.log(`   In content_metadata: ${r.in_content_metadata ? '✅' : '❌'}`);
    console.log(`   In post_receipts: ${r.in_post_receipts ? '✅' : '❌'}`);
    
    if (r.in_content_metadata && r.in_post_receipts) {
      console.log(`   🎯 PERFECT: Both systems recorded`);
      inDB++;
      inReceipts++;
    } else if (r.in_content_metadata && !r.in_post_receipts) {
      console.log(`   ⚠️ WARNING: In DB but no receipt (posted before fix)`);
      inDB++;
    } else if (!r.in_content_metadata && r.in_post_receipts) {
      console.log(`   🚨 CRITICAL: Receipt exists but not in DB (truth gap!)`);
      inReceipts++;
      missing++;
    } else {
      console.log(`   🚨 CRITICAL: Posted to X but NOWHERE in system!`);
      missing++;
    }
    console.log();
  });

  console.log('═══════════════════════════════════════════════════════════');
  console.log('SUMMARY:');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`Visible on X: 8 tweets`);
  console.log(`In content_metadata: ${inDB}/8 (${Math.round(inDB/8*100)}%)`);
  console.log(`In post_receipts: ${inReceipts}/8 (${Math.round(inReceipts/8*100)}%)`);
  console.log(`Missing from system: ${missing}/8 (${Math.round(missing/8*100)}%)`);
  console.log();

  if (missing === 0 && inDB === 8 && inReceipts === 8) {
    console.log('✅ VERDICT: PERFECT - All posts tracked by both systems');
    console.log('✅ Fix is working - new posts have receipts');
  } else if (missing === 0 && inDB === 8) {
    console.log('⚠️ VERDICT: GOOD - All in DB, some receipts missing');
    console.log('⚠️ Receipts missing = posts from BEFORE fix was deployed');
    console.log('⚠️ Monitor new posts (after 9:52 PM) for receipts');
  } else if (missing > 0) {
    console.log(`🚨 VERDICT: CRITICAL - ${missing} tweets posted but not tracked!`);
    console.log('🚨 Truth gap still exists - fix not working');
  } else {
    console.log('⚠️ VERDICT: PARTIAL - Some tracking issues remain');
  }
  
  process.exit(missing > 0 ? 1 : 0);
}

verifyRecentPosts().catch((err) => {
  console.error('❌ Verification failed:', err.message);
  process.exit(1);
});

