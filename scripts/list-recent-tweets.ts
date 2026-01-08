/**
 * List recent tweets with full details for verification
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db/index';

async function main() {
  const supabase = getSupabaseClient();
  
  console.log('🔍 Querying recent posts/replies from content_generation_metadata_comprehensive...\n');
  
  // Query last 20 posts/replies ordered by posted_at or created_at
  const { data, error } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select(`
      decision_id,
      tweet_id,
      decision_type,
      status,
      content,
      pipeline_source,
      build_sha,
      job_run_id,
      generator_name,
      created_at,
      posted_at,
      actual_likes,
      actual_retweets,
      actual_replies,
      actual_impressions,
      actual_engagement_rate,
      target_tweet_id,
      target_username
    `)
    .in('status', ['posted', 'posting'])
    .order('posted_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(20);
  
  if (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
  
  if (!data || data.length === 0) {
    console.log('⚠️ No posted tweets found');
    process.exit(0);
  }
  
  console.log(`📊 Found ${data.length} recent posts/replies:\n`);
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  
  data.forEach((row: any, idx: number) => {
    const postedAt = row.posted_at || row.created_at;
    const contentSnippet = (row.content || '').substring(0, 80).replace(/\n/g, ' ');
    
    console.log(`\n${idx + 1}. Tweet ID: ${row.tweet_id || 'NULL'}`);
    console.log(`   Type: ${row.decision_type || 'unknown'}`);
    console.log(`   Status: ${row.status}`);
    console.log(`   Posted: ${postedAt || 'NULL'}`);
    console.log(`   Build SHA: ${row.build_sha || 'NULL'}`);
    console.log(`   Pipeline: ${row.pipeline_source || 'NULL'}`);
    console.log(`   Generator: ${row.generator_name || 'NULL'}`);
    console.log(`   Content: ${contentSnippet}...`);
    
    if (row.decision_type === 'reply') {
      console.log(`   Reply to: @${row.target_username || 'unknown'} (${row.target_tweet_id || 'NULL'})`);
    }
    
    // Metrics
    const hasMetrics = row.actual_likes !== null || row.actual_retweets !== null || row.actual_impressions !== null;
    console.log(`   Metrics: ${hasMetrics ? '✅' : '❌'} likes=${row.actual_likes || 'NULL'} retweets=${row.actual_retweets || 'NULL'} replies=${row.actual_replies || 'NULL'} impressions=${row.actual_impressions || 'NULL'}`);
    
    console.log(`   Decision ID: ${row.decision_id}`);
  });
  
  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  
  // Summary
  const withTweetId = data.filter((r: any) => r.tweet_id).length;
  const withMetrics = data.filter((r: any) => r.actual_likes !== null || r.actual_retweets !== null).length;
  const posts = data.filter((r: any) => r.decision_type === 'single' || r.decision_type === 'thread').length;
  const replies = data.filter((r: any) => r.decision_type === 'reply').length;
  
  console.log(`\n📊 Summary:`);
  console.log(`   Total: ${data.length}`);
  console.log(`   With tweet_id: ${withTweetId}`);
  console.log(`   Posts: ${posts}, Replies: ${replies}`);
  console.log(`   With metrics: ${withMetrics}`);
  
  process.exit(0);
}

main().catch(console.error);

