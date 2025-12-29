import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function checkReplyMetadata() {
  const decisionId = process.argv[2] || '6ecc9f6c-3606-4b3f-9faf-50c2a6493ab4';

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('           🔍 CHECKING REPLY METADATA\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const { data, error } = await supabase
    .from('content_metadata')
    .select('*')
    .eq('decision_id', decisionId)
    .single();

  if (error) {
    console.log(`❌ Error: ${error.message}`);
  } else {
    console.log('✅ REPLY DETAILS:\n');
    console.log(`   decision_type: ${data.decision_type}`);
    console.log(`   target_tweet_id: ${data.target_tweet_id || 'N/A'}`);
    console.log(`   target_username: ${data.target_username || 'N/A'}`);
    console.log(`   tweet_id (our reply): ${data.tweet_id}`);
    console.log(`   status: ${data.status}`);
    console.log(`   posted_at: ${data.posted_at}`);
    console.log(`   content: ${data.content?.substring(0, 150)}...\n`);
  }

  // Check receipt metadata
  const { data: receipt, error: receiptError } = await supabase
    .from('post_receipts')
    .select('*')
    .eq('decision_id', decisionId)
    .single();

  if (!receiptError && receipt) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('📝 RECEIPT METADATA:\n');
    console.log(`   post_type: ${receipt.post_type}`);
    console.log(`   metadata: ${JSON.stringify(receipt.metadata, null, 2)}`);
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

checkReplyMetadata().catch(console.error);

