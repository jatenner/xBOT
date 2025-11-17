/**
 * Fix posts that are marked as "failed" but are actually posted on Twitter
 * This happens when posting succeeds but database update fails or retry logic marks them as failed
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function fixFailedPosts() {
  console.log('🔧 FIXING FAILED POSTS THAT ARE ACTUALLY POSTED...\n');
  
  // Find posts marked as "failed" that match Twitter content
  const twitterPosts = [
    {
      content: 'Peptide therapy isn\'t a miracle cure',
      postedTime: '2025-11-17T16:46:31' // Created time from DB
    },
    {
      content: 'Neuroprotective peptides can boost brain function',
      postedTime: '2025-11-17T16:46:20'
    },
    {
      content: 'To combat the effects of SENESCENT CELLS',
      postedTime: '2025-11-17T08:02:01'
    },
    {
      content: 'To enhance skin health through gut microbiome',
      postedTime: '2025-11-17T07:02:53'
    }
  ];

  for (const twitterPost of twitterPosts) {
    const { data, error } = await supabase
      .from('content_metadata')
      .select('decision_id, content, status, created_at')
      .ilike('content', `%${twitterPost.content.substring(0, 30)}%`)
      .eq('status', 'failed')
      .order('created_at', { ascending: false })
      .limit(1);

    if (data && data.length > 0) {
      const post = data[0];
      console.log(`📝 Found failed post: "${post.content.substring(0, 60)}..."`);
      console.log(`   Decision ID: ${post.decision_id}`);
      console.log(`   Created: ${post.created_at}`);
      
      // Update to posted status
      // Use created_at as posted_at since we don't have the actual posted time
      const { error: updateError } = await supabase
        .from('content_metadata')
        .update({
          status: 'posted',
          posted_at: post.created_at, // Use created time as posted time
          updated_at: new Date().toISOString()
        })
        .eq('decision_id', post.decision_id);

      if (updateError) {
        console.error(`   ❌ Failed to update: ${updateError.message}`);
      } else {
        console.log(`   ✅ Fixed! Status changed from 'failed' to 'posted'`);
      }
      console.log('');
    }
  }

  console.log('✅ Done fixing posts!');
}

fixFailedPosts().catch(console.error);
