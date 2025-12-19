import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

async function verifyThreadComplete(tweetId: string) {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  
  console.log(`\n🔍 Verifying thread with root ID: ${tweetId}\n`);
  
  // 1. Check content_metadata
  const { data: contentData, error: contentError } = await supabase
    .from('content_metadata')
    .select('*')
    .eq('tweet_id', tweetId)
    .single();
  
  if (!contentData) {
    console.log('❌ FAIL: Tweet not found in content_metadata');
    return false;
  }
  
  console.log('✅ Found in content_metadata:');
  console.log(`   decision_id: ${contentData.decision_id}`);
  console.log(`   decision_type: ${contentData.decision_type}`);
  console.log(`   status: ${contentData.status}`);
  console.log(`   tweet_id: ${contentData.tweet_id}`);
  
  // 2. Parse thread_tweet_ids
  let tweetIds: string[] = [];
  if (contentData.thread_tweet_ids) {
    try {
      tweetIds = JSON.parse(contentData.thread_tweet_ids);
      console.log(`   thread_tweet_ids: [${tweetIds.length} IDs]`);
      tweetIds.forEach((id, i) => {
        console.log(`      ${i+1}. ${id}`);
        console.log(`         URL: https://x.com/SignalAndSynapse/status/${id}`);
      });
    } catch (e) {
      console.log('   thread_tweet_ids: (parse error)');
    }
  } else {
    console.log('   thread_tweet_ids: null');
  }
  
  // 3. Parse thread_parts
  let threadParts: string[] = [];
  if (contentData.thread_parts) {
    try {
      threadParts = JSON.parse(contentData.thread_parts);
      console.log(`\n📝 Thread content (${threadParts.length} parts):`);
      threadParts.forEach((part, i) => {
        console.log(`   ${i+1}. ${part.substring(0, 80)}...`);
      });
    } catch (e) {}
  }
  
  // 4. Timestamps
  console.log(`\n⏰ Timestamps:`);
  const createdDate = new Date(contentData.created_at);
  const postedDate = contentData.posted_at ? new Date(contentData.posted_at) : null;
  console.log(`   created_at: ${createdDate.toLocaleString('en-US', { timeZone: 'America/New_York' })} ET`);
  console.log(`   posted_at: ${postedDate ? postedDate.toLocaleString('en-US', { timeZone: 'America/New_York' }) + ' ET' : 'null'}`);
  
  // 5. Check post_receipts
  console.log(`\n📝 Checking post_receipts...`);
  const { data: receiptData } = await supabase
    .from('post_receipts')
    .select('*')
    .eq('root_tweet_id', tweetId)
    .single();
  
  if (receiptData) {
    console.log('✅ Found in post_receipts:');
    console.log(`   receipt_id: ${receiptData.receipt_id}`);
    console.log(`   post_type: ${receiptData.post_type}`);
    console.log(`   tweet_ids: [${receiptData.tweet_ids?.length || 0} IDs]`);
    receiptData.tweet_ids?.forEach((id: string, i: number) => {
      console.log(`      ${i+1}. ${id}`);
    });
  } else {
    console.log('⚠️  Not found in post_receipts (expected if old code)');
  }
  
  // 6. Verification
  console.log(`\n═══════════════════════════════════════════════════════`);
  console.log('📊 VERIFICATION RESULTS:');
  console.log(`═══════════════════════════════════════════════════════`);
  
  const expectedParts = threadParts.length;
  const capturedIds = tweetIds.length;
  const hasReceipt = !!receiptData;
  
  console.log(`✓ Thread in database: YES`);
  console.log(`✓ Decision type: ${contentData.decision_type}`);
  console.log(`✓ Status: ${contentData.status}`);
  console.log(`✓ Expected parts: ${expectedParts}`);
  console.log(`✓ Captured IDs: ${capturedIds}`);
  console.log(`✓ Has receipt: ${hasReceipt ? 'YES' : 'NO'}`);
  
  if (capturedIds >= expectedParts && capturedIds > 1) {
    console.log(`\n🎉 SUCCESS: All ${expectedParts} tweet IDs captured!`);
    console.log(`\n🔗 Thread URL: https://x.com/SignalAndSynapse/status/${tweetId}`);
    return true;
  } else if (capturedIds > 1) {
    console.log(`\n⚠️  PARTIAL: ${capturedIds}/${expectedParts} IDs captured`);
    return false;
  } else {
    console.log(`\n❌ FAIL: Only ${capturedIds}/${expectedParts} IDs captured`);
    return false;
  }
}

// CLI usage
const tweetId = process.argv[2];
if (!tweetId) {
  console.error('Usage: tsx scripts/verify-thread-complete.ts <tweet_id>');
  process.exit(1);
}

verifyThreadComplete(tweetId).then(success => {
  process.exit(success ? 0 : 1);
});

