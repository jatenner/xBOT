import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkTweetSaved() {
  const tweetId = process.argv[2] || '2005701289976426759';

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  console.log(`           🔍 SEARCHING FOR TWEET ID: ${tweetId}\n`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  // Check content_metadata
  console.log(`📊 CHECKING content_metadata...\n`);
  const { data: contentData, error: contentError } = await supabase
    .from('content_metadata')
    .select('*')
    .eq('tweet_id', tweetId);

  if (contentError) {
    console.log(`❌ Error querying content_metadata: ${contentError.message}\n`);
  } else if (!contentData || contentData.length === 0) {
    console.log(`❌ NOT FOUND in content_metadata\n`);
  } else {
    console.log(`✅ FOUND in content_metadata:\n`);
    for (const row of contentData) {
      console.log(`   decision_id: ${row.decision_id}`);
      console.log(`   status: ${row.status}`);
      console.log(`   decision_type: ${row.decision_type}`);
      console.log(`   tweet_id: ${row.tweet_id}`);
      console.log(`   content: ${row.content?.substring(0, 150)}...`);
      console.log(`   posted_at: ${row.posted_at}`);
      console.log(`   created_at: ${row.created_at}\n`);
    }
  }

  // Check post_receipts
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  console.log(`📝 CHECKING post_receipts...\n`);
  const { data: receiptData, error: receiptError } = await supabase
    .from('post_receipts')
    .select('*')
    .eq('root_tweet_id', tweetId);

  if (receiptError) {
    console.log(`❌ Error querying post_receipts: ${receiptError.message}\n`);
  } else if (!receiptData || receiptData.length === 0) {
    console.log(`❌ NOT FOUND in post_receipts\n`);
  } else {
    console.log(`✅ FOUND in post_receipts:\n`);
    for (const row of receiptData) {
      console.log(`   receipt_id: ${row.receipt_id}`);
      console.log(`   decision_id: ${row.decision_id}`);
      console.log(`   root_tweet_id: ${row.root_tweet_id}`);
      console.log(`   post_type: ${row.post_type}`);
      console.log(`   posted_at: ${row.posted_at}`);
      console.log(`   reconciled_at: ${row.reconciled_at}\n`);
    }
  }

  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
}

checkTweetSaved().catch(console.error);
