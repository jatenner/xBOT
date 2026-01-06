/**
 * List posts created/posted since specified minutes ago
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db/index';

const minutesArg = process.argv.find(arg => arg.startsWith('--minutes='));
const minutes = minutesArg ? parseInt(minutesArg.split('=')[1], 10) : 15;

async function main() {
  const supabase = getSupabaseClient();
  const since = new Date(Date.now() - minutes * 60 * 1000).toISOString();
  
  console.log(`🔍 Listing posts since ${since} (${minutes} minutes ago)\n`);
  
  // Get all posts created or posted in the window
  const { data: posts, error } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('decision_id, decision_type, status, tweet_id, posted_at, created_at, pipeline_source, build_sha')
    .or(`created_at.gte.${since},posted_at.gte.${since}`)
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
  
  const posted = (posts || []).filter(p => p.status === 'posted' && p.tweet_id);
  const created = (posts || []).filter(p => p.status !== 'posted');
  
  console.log(`📊 Summary:`);
  console.log(`   Total posts in window: ${posts?.length || 0}`);
  console.log(`   Posted: ${posted.length}`);
  console.log(`   Created (not posted): ${created.length}\n`);
  
  if (posted.length > 0) {
    console.log(`✅ Posted tweets:`);
    posted.forEach((post, idx) => {
      console.log(`   ${idx + 1}. ${post.decision_id.substring(0, 8)}...`);
      console.log(`      tweet_id: ${post.tweet_id}`);
      console.log(`      posted_at: ${post.posted_at}`);
      console.log(`      pipeline_source: ${post.pipeline_source || 'NULL'}`);
      console.log(`      build_sha: ${post.build_sha || 'NULL'}`);
      console.log('');
    });
  }
  
  if (created.length > 0) {
    console.log(`📝 Created (not posted):`);
    created.slice(0, 5).forEach((post, idx) => {
      console.log(`   ${idx + 1}. ${post.decision_id.substring(0, 8)}... (${post.status})`);
    });
  }
  
  process.exit(0);
}

main().catch(console.error);

