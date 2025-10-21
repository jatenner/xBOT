require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixStuckPosts() {
  console.log('🔧 Fixing stuck posts (without tweet_url column)...\n');
  
  const { data: postedDecisions } = await supabase
    .from('posted_decisions')
    .select('*')
    .order('posted_at', { ascending: false })
    .limit(10);
  
  let fixed = 0;
  
  for (const pd of postedDecisions || []) {
    const { data: metadata } = await supabase
      .from('content_metadata')
      .select('*')
      .eq('decision_id', pd.decision_id)
      .single();
    
    if (metadata && (metadata.status !== 'posted' || metadata.tweet_id !== pd.tweet_id)) {
      console.log(`\n🔧 Fixing: "${metadata.content.substring(0, 50)}..."`);
      console.log(`   Tweet ID: ${pd.tweet_id}`);
      
      const { error } = await supabase
        .from('content_metadata')
        .update({
          status: 'posted',
          tweet_id: pd.tweet_id,
          posted_at: pd.posted_at,
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
}

fixStuckPosts().catch(console.error);
