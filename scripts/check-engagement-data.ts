/**
 * Quick diagnostic: Check if we're collecting real engagement data
 */

import { getSupabaseClient } from '../src/db/index';

async function checkEngagementData() {
  const supabase = getSupabaseClient();
  
  console.log('🔍 Checking engagement data collection...\n');
  
  // Check outcomes table
  const { data: outcomes, error: outcomesError } = await supabase
    .from('outcomes')
    .select('tweet_id, content, likes, retweets, replies, created_at')
    .order('created_at', { ascending: false })
    .limit(10);
  
  if (outcomesError) {
    console.error('❌ Error fetching outcomes:', outcomesError);
  } else if (!outcomes || outcomes.length === 0) {
    console.log('⚠️ NO OUTCOMES DATA FOUND');
    console.log('   This means no engagement is being tracked!');
  } else {
    console.log(`✅ Found ${outcomes.length} recent outcomes:\n`);
    outcomes.forEach((o, idx) => {
      console.log(`${idx + 1}. Tweet ID: ${o.tweet_id}`);
      console.log(`   Content: "${(o.content || '').substring(0, 60)}..."`);
      console.log(`   📊 ${o.likes || 0} likes, ${o.retweets || 0} RTs, ${o.replies || 0} replies`);
      console.log(`   📅 ${new Date(o.created_at).toLocaleString()}\n`);
    });
  }
  
  // Check content_metadata table
  const { data: metadata, error: metadataError } = await supabase
    .from('content_metadata')
    .select('decision_id, content, decision_type, created_at')
    .order('created_at', { ascending: false })
    .limit(5);
  
  if (metadataError) {
    console.error('❌ Error fetching content_metadata:', metadataError);
  } else if (!metadata || metadata.length === 0) {
    console.log('⚠️ NO CONTENT METADATA FOUND');
    console.log('   This means no content is being generated/stored!');
  } else {
    console.log(`✅ Found ${metadata.length} recent content items:\n`);
    metadata.forEach((m, idx) => {
      console.log(`${idx + 1}. Type: ${m.decision_type}`);
      console.log(`   Content: "${(m.content || '').substring(0, 60)}..."`);
      console.log(`   📅 ${new Date(m.created_at).toLocaleString()}\n`);
    });
  }
  
  // Summary
  console.log('═══════════════════════════════════════');
  console.log('DIAGNOSTIC SUMMARY:');
  console.log(`Outcomes tracked: ${outcomes?.length || 0}`);
  console.log(`Content generated: ${metadata?.length || 0}`);
  
  if ((outcomes?.length || 0) === 0) {
    console.log('\n🚨 CRITICAL ISSUE: No engagement data!');
    console.log('   - The scraper might not be storing data correctly');
    console.log('   - Tweet IDs might be wrong');
    console.log('   - Database writes might be failing');
  } else {
    console.log('\n✅ System IS collecting engagement data');
    console.log('   - Dynamic few-shot learning will work');
    console.log('   - System can learn from YOUR data');
  }
}

checkEngagementData().then(() => process.exit(0)).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

