import { getSupabaseClient } from '../src/db/index';

async function verifyAtomicPosts() {
  const supabase = getSupabaseClient();
  
  console.log('🔍 Checking recent posts in content_generation_metadata_comprehensive...\n');
  
  const { data, error } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('decision_id, status, tweet_id, decision_type, pipeline_source, build_sha, job_run_id, posted_at, created_at')
    .gte('created_at', new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString())
    .order('created_at', { ascending: false })
    .limit(10);
  
  if (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
  
  if (!data || data.length === 0) {
    console.log('⚠️ No posts found in last 2 hours');
    process.exit(0);
  }
  
  console.log(`Found ${data.length} rows:\n`);
  data.forEach((row: any, idx: number) => {
    console.log(`${idx + 1}. decision_id: ${row.decision_id}`);
    console.log(`   status: ${row.status}`);
    console.log(`   tweet_id: ${row.tweet_id || 'NULL'}`);
    console.log(`   decision_type: ${row.decision_type}`);
    console.log(`   pipeline_source: ${row.pipeline_source || 'NULL'}`);
    console.log(`   build_sha: ${row.build_sha || 'NULL'}`);
    console.log(`   job_run_id: ${row.job_run_id || 'NULL'}`);
    console.log(`   posted_at: ${row.posted_at || 'NULL'}`);
    console.log(`   created_at: ${row.created_at}`);
    console.log('');
  });
  
  // Check for atomic flow evidence
  const postedRows = data.filter((r: any) => r.status === 'posted' && r.tweet_id);
  const atomicRows = postedRows.filter((r: any) => 
    r.pipeline_source && (r.pipeline_source.includes('postingQueue') || r.pipeline_source.includes('simpleThreadPoster'))
  );
  
  console.log(`\n📊 Summary:`);
  console.log(`   Total rows: ${data.length}`);
  console.log(`   Posted with tweet_id: ${postedRows.length}`);
  console.log(`   Atomic flow (postingQueue/simpleThreadPoster): ${atomicRows.length}`);
  
  if (atomicRows.length > 0) {
    console.log(`\n✅ PASS: Found ${atomicRows.length} posts via atomic flow`);
    atomicRows.forEach((r: any) => {
      console.log(`   - ${r.decision_id}: ${r.tweet_id} (${r.pipeline_source})`);
    });
  } else {
    console.log(`\n⚠️ No atomic flow posts found in last 2 hours`);
  }
}

verifyAtomicPosts().catch(console.error);

