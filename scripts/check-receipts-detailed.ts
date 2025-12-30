/**
 * Check if specific tweets have receipts and metadata
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.DATABASE_URL!.replace('postgresql://', 'https://').replace(':5432', '');
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkReceipts() {
  const tweetIds = ['2005979408272863265', '2005971984409329907'];
  
  console.log('\n📊 DETAILED RECEIPT CHECK\n');
  
  for (const tweetId of tweetIds) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`🔍 Checking tweet ${tweetId}:`);
    console.log(`${'='.repeat(80)}\n`);
    
    // Check post_receipts
    const { data: receipts, error: receiptError } = await supabase
      .from('post_receipts')
      .select('*')
      .contains('tweet_ids', [tweetId]);
    
    console.log(`📝 post_receipts:`);
    if (receiptError) {
      console.log(`   ❌ Error: ${receiptError.message}`);
    } else if (!receipts || receipts.length === 0) {
      console.log(`   ❌ NOT FOUND`);
    } else {
      console.log(`   ✅ FOUND ${receipts.length} receipt(s):`);
      receipts.forEach((receipt: any, i: number) => {
        console.log(`\n   Receipt #${i + 1}:`);
        console.log(`   - receipt_id: ${receipt.receipt_id}`);
        console.log(`   - decision_id: ${receipt.decision_id || 'NULL'}`);
        console.log(`   - root_tweet_id: ${receipt.root_tweet_id}`);
        console.log(`   - post_type: ${receipt.post_type}`);
        console.log(`   - posted_at: ${receipt.posted_at}`);
        console.log(`   - tweet_ids: ${JSON.stringify(receipt.tweet_ids)}`);
      });
    }
    
    // Check content_metadata
    const { data: metadata, error: metadataError } = await supabase
      .from('content_metadata')
      .select('decision_id, status, tweet_id, posted_at, decision_type')
      .eq('tweet_id', tweetId);
    
    console.log(`\n📊 content_metadata:`);
    if (metadataError) {
      console.log(`   ❌ Error: ${metadataError.message}`);
    } else if (!metadata || metadata.length === 0) {
      console.log(`   ❌ NOT FOUND`);
    } else {
      console.log(`   ✅ FOUND ${metadata.length} record(s):`);
      metadata.forEach((record: any, i: number) => {
        console.log(`\n   Record #${i + 1}:`);
        console.log(`   - decision_id: ${record.decision_id}`);
        console.log(`   - status: ${record.status}`);
        console.log(`   - tweet_id: ${record.tweet_id}`);
        console.log(`   - decision_type: ${record.decision_type}`);
        console.log(`   - posted_at: ${record.posted_at}`);
      });
    }
  }
  
  console.log(`\n${'='.repeat(80)}\n`);
}

checkReceipts().catch(console.error);

