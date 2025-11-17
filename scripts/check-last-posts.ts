require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getLast2Posts() {
  const { data, error } = await supabase
    .from('content_metadata')
    .select('content, posted_at, generator_name, decision_type, topic_cluster')
    .eq('status', 'posted')
    .in('decision_type', ['single', 'thread'])
    .order('posted_at', { ascending: false })
    .limit(2);

  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }

  if (!data || data.length === 0) {
    console.log('⚠️  No posted content found');
    return;
  }

  console.log('\n📋 LAST 2 POSTS:\n');
  console.log('═'.repeat(80));
  
  data.forEach((post: any, i: number) => {
    console.log(`\n${i + 1}. Posted: ${post.posted_at || 'N/A'}`);
    console.log(`   Generator: ${post.generator_name || 'N/A'}`);
    console.log(`   Type: ${post.decision_type || 'N/A'}`);
    console.log(`   Topic: ${post.topic_cluster || 'N/A'}`);
    console.log(`\n   Content:`);
    console.log(`   ${post.content || 'N/A'}`);
    console.log('\n' + '─'.repeat(80));
  });
}

getLast2Posts().catch(console.error);

