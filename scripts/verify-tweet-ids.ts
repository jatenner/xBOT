/**
 * Verify specific tweet IDs are in DB and have metrics/learning fields
 * Usage: tsx scripts/verify-tweet-ids.ts <tweet_id1> <tweet_id2> ...
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db/index';

async function verifyTweetIds(tweetIds: string[]) {
  const supabase = getSupabaseClient();
  
  console.log(`🔍 Verifying ${tweetIds.length} tweet IDs...\n`);
  
  const results: Array<{
    tweet_id: string;
    in_db: boolean;
    type: string;
    build_sha: string | null;
    job_source: string | null;
    posted_at: string | null;
    metrics_present: boolean;
    learning_present: boolean;
    verdict: string;
    details: any;
  }> = [];
  
  for (const tweetId of tweetIds) {
    console.log(`\n📋 Checking tweet_id: ${tweetId}`);
    
    // Check in content_generation_metadata_comprehensive
    const { data: decision, error: decisionError } = await supabase
      .from('content_generation_metadata_comprehensive')
      .select(`
        decision_id,
        tweet_id,
        decision_type,
        status,
        build_sha,
        pipeline_source,
        job_run_id,
        generator_name,
        posted_at,
        created_at,
        actual_likes,
        actual_retweets,
        actual_replies,
        actual_impressions,
        actual_engagement_rate,
        target_tweet_id,
        target_username
      `)
      .eq('tweet_id', tweetId)
      .single();
    
    if (decisionError || !decision) {
      results.push({
        tweet_id: tweetId,
        in_db: false,
        type: 'unknown',
        build_sha: null,
        job_source: null,
        posted_at: null,
        metrics_present: false,
        learning_present: false,
        verdict: 'FAIL - Not in DB',
        details: { error: decisionError?.message || 'Not found' }
      });
      console.log(`   ❌ NOT IN DB`);
      continue;
    }
    
    console.log(`   ✅ IN DB`);
    console.log(`   Type: ${decision.decision_type}`);
    console.log(`   Status: ${decision.status}`);
    console.log(`   Build SHA: ${decision.build_sha || 'NULL'}`);
    console.log(`   Pipeline: ${decision.pipeline_source || 'NULL'}`);
    console.log(`   Posted: ${decision.posted_at || 'NULL'}`);
    
    // Check metrics
    const hasMetrics = decision.actual_likes !== null || 
                       decision.actual_retweets !== null || 
                       decision.actual_impressions !== null;
    
    console.log(`   Metrics: ${hasMetrics ? '✅' : '❌'} likes=${decision.actual_likes || 'NULL'} retweets=${decision.actual_retweets || 'NULL'} replies=${decision.actual_replies || 'NULL'} impressions=${decision.actual_impressions || 'NULL'}`);
    
    // Check learning_posts table
    const { data: learningPost } = await supabase
      .from('learning_posts')
      .select('tweet_id, likes_count, retweets_count, replies_count, impressions_count, updated_at')
      .eq('tweet_id', tweetId)
      .single();
    
    const hasLearning = !!learningPost;
    console.log(`   Learning: ${hasLearning ? '✅' : '❌'} ${hasLearning ? `(updated: ${learningPost?.updated_at || 'NULL'})` : '(not in learning_posts)'}`);
    
    // Check outcomes table
    const { data: outcome } = await supabase
      .from('outcomes')
      .select('decision_id, tweet_id, likes, retweets, replies, views, collected_at')
      .eq('tweet_id', tweetId)
      .single();
    
    const hasOutcome = !!outcome;
    console.log(`   Outcome: ${hasOutcome ? '✅' : '❌'} ${hasOutcome ? `(collected: ${outcome?.collected_at || 'NULL'})` : '(not in outcomes)'}`);
    
    const learningPresent = hasLearning || hasOutcome;
    
    // Determine verdict
    let verdict = 'PASS';
    const issues: string[] = [];
    
    if (!decision.build_sha || decision.build_sha === 'dev' || decision.build_sha === 'unknown') {
      issues.push('Invalid build_sha');
      verdict = 'WARN';
    }
    
    if (!hasMetrics) {
      issues.push('No metrics');
      verdict = 'FAIL';
    }
    
    if (!learningPresent) {
      issues.push('No learning data');
      verdict = verdict === 'FAIL' ? 'FAIL' : 'WARN';
    }
    
    if (issues.length > 0) {
      verdict = `${verdict} - ${issues.join(', ')}`;
    }
    
    results.push({
      tweet_id: tweetId,
      in_db: true,
      type: decision.decision_type || 'unknown',
      build_sha: decision.build_sha,
      job_source: decision.pipeline_source || decision.job_run_id || null,
      posted_at: decision.posted_at,
      metrics_present: hasMetrics,
      learning_present: learningPresent,
      verdict,
      details: {
        decision_id: decision.decision_id,
        status: decision.status,
        metrics: {
          likes: decision.actual_likes,
          retweets: decision.actual_retweets,
          replies: decision.actual_replies,
          impressions: decision.actual_impressions,
          engagement_rate: decision.actual_engagement_rate
        },
        learning_post: learningPost,
        outcome: outcome
      }
    });
  }
  
  // Print summary table
  console.log('\n\n═══════════════════════════════════════════════════════════════════════════════');
  console.log('📊 VERIFICATION SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');
  
  console.log('tweet_id           | type    | in_db | build_sha (short) | job_source      | metrics | learning | verdict');
  console.log('───────────────────┼─────────┼───────┼──────────────────┼─────────────────┼─────────┼──────────┼─────────');
  
  results.forEach(r => {
    const buildShaShort = r.build_sha ? r.build_sha.substring(0, 8) : 'NULL';
    const jobSourceShort = r.job_source ? (r.job_source.length > 15 ? r.job_source.substring(0, 12) + '...' : r.job_source) : 'NULL';
    const inDb = r.in_db ? '✅' : '❌';
    const metrics = r.metrics_present ? '✅' : '❌';
    const learning = r.learning_present ? '✅' : '❌';
    
    console.log(`${r.tweet_id.padEnd(19)} | ${r.type.padEnd(7)} | ${inDb.padEnd(5)} | ${buildShaShort.padEnd(16)} | ${jobSourceShort.padEnd(15)} | ${metrics.padEnd(7)} | ${learning.padEnd(8)} | ${r.verdict}`);
  });
  
  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  
  // Check current build SHA from Railway logs
  console.log('\n🔍 Checking current production build SHA...');
  const { data: recentBuild } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('build_sha')
    .not('build_sha', 'is', null)
    .neq('build_sha', 'dev')
    .neq('build_sha', 'unknown')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  
  if (recentBuild?.build_sha) {
    console.log(`   Current build SHA: ${recentBuild.build_sha}`);
    
    const fromCurrentBuild = results.filter(r => r.build_sha === recentBuild.build_sha);
    const fromOldBuild = results.filter(r => r.build_sha && r.build_sha !== recentBuild.build_sha);
    
    console.log(`\n📊 Build Analysis:`);
    console.log(`   From current build: ${fromCurrentBuild.length}/${results.length}`);
    console.log(`   From older build: ${fromOldBuild.length}/${results.length}`);
    
    if (fromOldBuild.length > 0) {
      console.log(`\n   ⚠️ Older build tweets:`);
      fromOldBuild.forEach(r => {
        console.log(`      ${r.tweet_id}: ${r.build_sha}`);
      });
    }
  }
  
  process.exit(0);
}

// Parse tweet IDs from command line
const tweetIds = process.argv.slice(2).filter(arg => !arg.startsWith('--'));

if (tweetIds.length === 0) {
  console.error('❌ Usage: tsx scripts/verify-tweet-ids.ts <tweet_id1> <tweet_id2> ...');
  console.error('   Example: tsx scripts/verify-tweet-ids.ts 2009059568677212524 2009053275002425623');
  process.exit(1);
}

verifyTweetIds(tweetIds).catch(console.error);

