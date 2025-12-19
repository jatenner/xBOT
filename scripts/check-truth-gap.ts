import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  // Get all receipts from last 2 hours
  const { data: receipts } = await supabase
    .from('post_receipts')
    .select('receipt_id, decision_id, root_tweet_id, post_type, posted_at')
    .gte('posted_at', new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString())
    .order('posted_at', { ascending: false });

  console.log(`\n🔍 TRUTH GAP ANALYSIS (Last 2 Hours)\n`);
  console.log(`Total receipts: ${receipts?.length || 0}\n`);

  if (!receipts || receipts.length === 0) {
    console.log('No receipts found.');
    return;
  }

  // Check which receipts have corresponding content_metadata rows
  const orphans: any[] = [];
  const reconciled: any[] = [];

  for (const receipt of receipts) {
    if (!receipt.decision_id) {
      orphans.push({ ...receipt, reason: 'No decision_id' });
      continue;
    }

    const { data: cm } = await supabase
      .from('content_metadata')
      .select('decision_id, status, tweet_id')
      .eq('decision_id', receipt.decision_id)
      .single();

    if (!cm) {
      orphans.push({ ...receipt, reason: 'No content_metadata row' });
    } else if (cm.status !== 'posted') {
      orphans.push({ ...receipt, reason: `Status: ${cm.status}` });
    } else if (!cm.tweet_id) {
      orphans.push({ ...receipt, reason: 'content_metadata has no tweet_id' });
    } else {
      reconciled.push(receipt);
    }
  }

  console.log(`✅ Reconciled: ${reconciled.length}`);
  console.log(`🚨 Orphaned: ${orphans.length}\n`);

  if (orphans.length > 0) {
    console.log(`ORPHAN RECEIPTS (posted to X but NOT saved in DB):\n`);
    orphans.forEach((r, i) => {
      const ago = Math.round((Date.now() - new Date(r.posted_at).getTime()) / 60000);
      console.log(`${i+1}. ${r.post_type.toUpperCase()} - ${ago}m ago`);
      console.log(`   Tweet: ${r.root_tweet_id}`);
      console.log(`   Decision: ${r.decision_id?.substring(0, 8) || 'NULL'}...`);
      console.log(`   Reason: ${r.reason}`);
      console.log(`   URL: https://x.com/SignalAndSynapse/status/${r.root_tweet_id}\n`);
    });

    console.log(`\n🚨 DIAGNOSIS: Receipt system working, but markDecisionPosted() failing`);
    console.log(`   - Receipts are being written immediately after posting`);
    console.log(`   - BUT content_metadata is not being updated`);
    console.log(`   - This causes duplicate posts (system thinks it hasn't posted)`);
  }
}

main();

