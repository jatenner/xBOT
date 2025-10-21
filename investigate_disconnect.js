require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function investigate() {
  console.log('🔍 Investigating table disconnect...\n');
  
  // Get recent posted_decisions
  const { data: postedDecisions } = await supabase
    .from('posted_decisions')
    .select('*')
    .order('posted_at', { ascending: false })
    .limit(5);
  
  console.log('📋 Checking if posted_decisions exist in content_metadata:\n');
  
  for (const pd of postedDecisions || []) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`🆔 Decision ID: ${pd.decision_id}`);
    console.log(`🐦 Tweet ID: ${pd.tweet_id}`);
    console.log(`📅 Posted: ${new Date(pd.posted_at).toLocaleString()}`);
    
    // Check if this decision_id exists in content_metadata
    const { data: metadata, error } = await supabase
      .from('content_metadata')
      .select('*')
      .eq('decision_id', pd.decision_id)
      .single();
    
    if (error || !metadata) {
      console.log(`❌ NOT FOUND in content_metadata! (error: ${error?.message || 'no match'})`);
    } else {
      console.log(`✅ Found in content_metadata:`);
      console.log(`   📝 Content: "${metadata.content.substring(0, 80)}..."`);
      console.log(`   📊 Status: ${metadata.status}`);
      console.log(`   🆔 Tweet ID in metadata: ${metadata.tweet_id || '❌ MISSING'}`);
      console.log(`   🔗 Tweet URL in metadata: ${metadata.tweet_url || '❌ MISSING'}`);
      
      // Check if tweet IDs match
      if (metadata.tweet_id !== pd.tweet_id) {
        console.log(`   ⚠️  MISMATCH! posted_decisions has ${pd.tweet_id}, metadata has ${metadata.tweet_id}`);
      }
    }
  }
  
  console.log(`\n${'='.repeat(80)}\n`);
  
  // Now check: how many decisions in content_metadata are in 'scheduled' or 'queued' status?
  const { data: queuedCount } = await supabase
    .from('content_metadata')
    .select('*', { count: 'exact', head: false })
    .in('status', ['scheduled', 'queued']);
  
  console.log(`\n📊 Content Metadata Status Breakdown:`);
  console.log(`   🕐 Queued/Scheduled: ${queuedCount?.length || 0}`);
  
  const { data: postedCount } = await supabase
    .from('content_metadata')
    .select('*', { count: 'exact', head: false })
    .eq('status', 'posted');
  
  console.log(`   ✅ Posted: ${postedCount?.length || 0}`);
  
  const { data: failedCount } = await supabase
    .from('content_metadata')
    .select('*', { count: 'exact', head: false })
    .eq('status', 'failed');
  
  console.log(`   ❌ Failed: ${failedCount?.length || 0}`);
}

investigate().catch(console.error);
