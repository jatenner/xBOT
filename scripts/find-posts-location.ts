import 'dotenv/config';
import { getSupabaseClient } from '../src/db/index';

async function findPostsLocation() {
  const supabase = getSupabaseClient();
  
  console.log('🔍 Finding where posts are actually stored...\n');
  
  // Check all possible tables
  const tables = ['content_metadata', 'posted_decisions', 'posted_tweets', 'tweets'];
  
  for (const table of tables) {
    try {
      const { data, error, count } = await supabase
        .from(table)
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .limit(3);
      
      if (error) {
        console.log(`❌ ${table}: Error - ${error.message}`);
      } else {
        console.log(`✅ ${table}: ${count || 0} total records`);
        if (data && data.length > 0) {
          console.log(`   Latest: ${new Date(data[0].created_at).toLocaleString()}`);
          console.log(`   Fields: ${Object.keys(data[0]).join(', ')}\n`);
        }
      }
    } catch (e: any) {
      console.log(`⚠️  ${table}: ${e.message}\n`);
    }
  }
  
  // Show latest tweet IDs
  console.log('\n📝 Latest content from content_metadata:');
  const { data: latest } = await supabase
    .from('content_metadata')
    .select('decision_id, content, status, posted_at, created_at')
    .order('created_at', { ascending: false })
    .limit(5);
  
  latest?.forEach((post: any, idx: number) => {
    console.log(`${idx + 1}. Status: ${post.status} | Created: ${new Date(post.created_at).toLocaleString()}`);
    console.log(`   Posted at: ${post.posted_at || 'NULL'}`);
    console.log(`   Content: ${post.content?.substring(0, 60)}...\n`);
  });
}

findPostsLocation().catch(console.error);

