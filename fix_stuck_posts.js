require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixStuckPosts() {
  console.log('🔧 Fixing stuck posts...\n');
  
  // Get all posts from posted_decisions that don't match content_metadata
  const { data: postedDecisions } = await supabase
    .from('posted_decisions')
    .select('*')
    .order('posted_at', { ascending: false })
    .limit(10);
  
  let fixed = 0;
  
  for (const pd of postedDecisions || []) {
    // Check if content_metadata needs updating
    const { data: metadata } = await supabase
      .from('content_metadata')
      .select('*')
      .eq('decision_id', pd.decision_id)
      .single();
    
    if (metadata && (metadata.status !== 'posted' || metadata.tweet_id !== pd.tweet_id)) {
      console.log(`\n🔧 Fixing decision ${pd.decision_id}:`);
      console.log(`   Current status: ${metadata.status} → posted`);
      console.log(`   Current tweet_id: ${metadata.tweet_id} → ${pd.tweet_id}`);
      
      const { error } = await supabase
        .from('content_metadata')
        .update({
          status: 'posted',
          tweet_id: pd.tweet_id,
          posted_at: pd.posted_at,
          tweet_url: `https://x.com/SignalAndSynapse/status/${pd.tweet_id}`,
          updated_at: new Date().toISOString()
        })
        .eq('decision_id', pd.decision_id);
      
      if (error) {
        console.log(`   ❌ Error: ${error.message}`);
      } else {
        console.log(`   ✅ Fixed!`);
        fixed++;
      }
    }
  }
  
  console.log(`\n✅ Fixed ${fixed} posts\n`);
  
  // Now show the updated status
  const { data: updatedPosts } = await supabase
    .from('content_metadata')
    .select('*')
    .eq('status', 'posted')
    .order('posted_at', { ascending: false})
    .limit(5);
  
  console.log('📊 Recent posted content (after fix):');
  for (const post of updatedPosts || []) {
    console.log(`\n   📝 "${post.content.substring(0, 60)}..."`);
    console.log(`   🆔 Tweet ID: ${post.tweet_id}`);
    console.log(`   🔗 URL: ${post.tweet_url || 'N/A'}`);
    console.log(`   ⏰ Posted: ${new Date(post.posted_at).toLocaleString()}`);
  }
}

fixStuckPosts().catch(console.error);
