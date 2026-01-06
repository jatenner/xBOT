/**
 * Reconcile the 3 tweets that posted but DB update failed due to tweet_url column issue
 */

import { getSupabaseClient } from '../src/db/index';
import { getConfig } from '../src/config/config';

async function reconcile() {
  getConfig();
  const supabase = getSupabaseClient();

  const decisionIds = [
    '463ddebc-c918-409a-8565-f7836e16ac6f',
    '9de20008-fae4-4ff4-9ea8-76f1e78a52fd',
    '7ecc2e99-9c42-4d27-9b4c-4bf4f7aeed6a'
  ];

  const tweetIds = [
    '2007761042856869889',
    '2008246909786284032',
    '2004879729447350272'
  ];

  console.log('🔄 Reconciling 3 failed DB updates...\n');

  for (let i = 0; i < decisionIds.length; i++) {
    const decisionId = decisionIds[i];
    const tweetId = tweetIds[i];

    console.log(`\n${i+1}. decision_id=${decisionId.substring(0, 12)}... tweet_id=${tweetId}`);

    // Check current status
    const { data: current } = await supabase
      .from('content_generation_metadata_comprehensive')
      .select('status, tweet_id')
      .eq('decision_id', decisionId)
      .single();

    console.log(`   Current: status=${current?.status} tweet_id=${current?.tweet_id || 'NULL'}`);

    if (current?.status === 'posted' && current?.tweet_id === tweetId) {
      console.log('   ✅ Already reconciled');
      continue;
    }

    // Update to posted with tweet_id
    const { error } = await supabase
      .from('content_generation_metadata_comprehensive')
      .update({
        status: 'posted',
        tweet_id: tweetId,
        posted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('decision_id', decisionId);

    if (error) {
      console.error(`   ❌ Update failed: ${error.message}`);
    } else {
      console.log('   ✅ Updated to status=posted with tweet_id');

      // Log reconciliation event
      await supabase.from('system_events').insert({
        event_type: 'posting_attempt_reconciled',
        severity: 'info',
        message: `Reconciled failed DB update: tweet was posted but DB update failed due to tweet_url column issue`,
        event_data: {
          decision_id: decisionId,
          tweet_id: tweetId,
          reason: 'tweet_url_column_fix',
        },
        created_at: new Date().toISOString(),
      });
    }
  }

  console.log('\n✅ Reconciliation complete\n');
}

reconcile().catch(console.error);

