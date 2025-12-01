/**
 * 🔍 SYSTEM STATUS INVESTIGATION
 * Deep dive into actual system state to verify dashboard claims
 */

import { getSupabaseClient } from '../src/db';
import { getHeartbeat } from '../src/jobs/jobHeartbeat';
import { getCircuitBreakerStatus } from '../src/jobs/postingQueue';

async function investigate() {
  const supabase = getSupabaseClient();
  
  console.log('\n🔍 SYSTEM STATUS INVESTIGATION\n');
  console.log('='.repeat(70));
  
  // 1. Check Posting Job Status
  console.log('\n📮 POSTING JOB ANALYSIS:');
  console.log('-'.repeat(70));
  const postingHeartbeat = await getHeartbeat('posting');
  if (postingHeartbeat) {
    console.log('Status:', postingHeartbeat.last_run_status);
    console.log('Last Success:', postingHeartbeat.last_success || 'Never');
    console.log('Last Failure:', postingHeartbeat.last_failure || 'None');
    console.log('Consecutive Failures:', postingHeartbeat.consecutive_failures || 0);
    if (postingHeartbeat.last_error) {
      console.log('Last Error:', postingHeartbeat.last_error.substring(0, 300));
    }
    
    if (postingHeartbeat.last_success) {
      const lastSuccess = new Date(postingHeartbeat.last_success);
      const minutesAgo = Math.floor((Date.now() - lastSuccess.getTime()) / (1000 * 60));
      console.log(`Minutes since last success: ${minutesAgo}`);
    }
  } else {
    console.log('❌ No heartbeat found for posting job');
  }
  
  // 2. Check Posting Attempts Success Rate
  console.log('\n📊 POSTING ATTEMPTS ANALYSIS (Last 24h):');
  console.log('-'.repeat(70));
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: attempts, error: attemptsError } = await supabase
    .from('posting_attempts')
    .select('status, error_message, created_at')
    .gte('created_at', oneDayAgo)
    .order('created_at', { ascending: false });
  
  if (attemptsError) {
    console.log('❌ Error fetching posting attempts:', attemptsError.message);
  } else if (attempts && attempts.length > 0) {
    const success = attempts.filter(a => a.status === 'success').length;
    const failed = attempts.filter(a => a.status === 'failed').length;
    const successRate = (success / attempts.length) * 100;
    
    console.log(`Total Attempts: ${attempts.length}`);
    console.log(`Successful: ${success} (${successRate.toFixed(1)}%)`);
    console.log(`Failed: ${failed} (${(100 - successRate).toFixed(1)}%)`);
    
    if (failed > 0) {
      console.log('\nRecent Failures:');
      attempts.filter(a => a.status === 'failed').slice(0, 5).forEach((attempt: any) => {
        const time = new Date(attempt.created_at).toLocaleString();
        const error = attempt.error_message?.substring(0, 200) || 'No error message';
        console.log(`  - ${time}: ${error}`);
      });
    }
    
    // Check last 10 attempts specifically
    console.log('\nLast 10 Attempts:');
    attempts.slice(0, 10).forEach((attempt: any) => {
      const time = new Date(attempt.created_at).toLocaleString();
      const status = attempt.status === 'success' ? '✅' : '❌';
      console.log(`  ${status} ${time} - ${attempt.status}`);
    });
  } else {
    console.log('⚠️ No posting attempts found in last 24 hours');
  }
  
  // 3. Check Metrics Scraper Status
  console.log('\n📊 METRICS SCRAPER ANALYSIS:');
  console.log('-'.repeat(70));
  const metricsHeartbeat = await getHeartbeat('metrics_scraper') || await getHeartbeat('analytics');
  if (metricsHeartbeat) {
    console.log('Status:', metricsHeartbeat.last_run_status);
    console.log('Last Success:', metricsHeartbeat.last_success || 'Never');
    console.log('Last Failure:', metricsHeartbeat.last_failure || 'None');
    console.log('Consecutive Failures:', metricsHeartbeat.consecutive_failures || 0);
    
    if (metricsHeartbeat.last_success) {
      const lastSuccess = new Date(metricsHeartbeat.last_success);
      const minutesAgo = Math.floor((Date.now() - lastSuccess.getTime()) / (1000 * 60));
      console.log(`Minutes since last success: ${minutesAgo}`);
      console.log(`Is stale (>20 min): ${minutesAgo > 20 ? 'YES ⚠️' : 'NO ✅'}`);
    }
    
    if (metricsHeartbeat.last_error) {
      console.log('Last Error:', metricsHeartbeat.last_error.substring(0, 300));
    }
  } else {
    console.log('❌ No heartbeat found for metrics scraper');
  }
  
  // 4. Check Metrics Coverage
  console.log('\n📈 METRICS COVERAGE ANALYSIS:');
  console.log('-'.repeat(70));
  const { count: totalPosted, error: totalError } = await supabase
    .from('content_metadata')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'posted')
    .not('tweet_id', 'is', null);
  
  const { count: withMetrics, error: metricsError } = await supabase
    .from('content_metadata')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'posted')
    .not('tweet_id', 'is', null)
    .not('actual_impressions', 'is', null);
  
  if (totalError || metricsError) {
    console.log('❌ Error checking metrics coverage');
  } else {
    const coverage = totalPosted && totalPosted > 0 
      ? Math.round((withMetrics || 0) / totalPosted * 100)
      : 100;
    console.log(`Total Posted: ${totalPosted || 0}`);
    console.log(`With Metrics: ${withMetrics || 0}`);
    console.log(`Coverage: ${coverage}%`);
    console.log(`Missing Metrics: ${(totalPosted || 0) - (withMetrics || 0)} posts`);
  }
  
  // 5. Check Recent Posts
  console.log('\n📝 RECENT POSTING ACTIVITY:');
  console.log('-'.repeat(70));
  const { data: recentPosts } = await supabase
    .from('content_metadata')
    .select('decision_id, posted_at, decision_type, status, tweet_id')
    .eq('status', 'posted')
    .order('posted_at', { ascending: false })
    .limit(10);
  
  if (recentPosts && recentPosts.length > 0) {
    console.log(`Last ${recentPosts.length} posts:`);
    recentPosts.forEach((post: any) => {
      const time = post.posted_at ? new Date(post.posted_at).toLocaleString() : 'Unknown';
      const type = post.decision_type || 'unknown';
      const hasTweetId = post.tweet_id ? '✅' : '❌';
      console.log(`  ${hasTweetId} ${time} - ${type}`);
    });
    
    const lastPost = new Date(recentPosts[0].posted_at);
    const minutesSinceLastPost = Math.floor((Date.now() - lastPost.getTime()) / (1000 * 60));
    console.log(`\nMinutes since last post: ${minutesSinceLastPost}`);
    console.log(`Is inactive (>30 min): ${minutesSinceLastPost > 30 ? 'YES ⚠️' : 'NO ✅'}`);
  } else {
    console.log('⚠️ No recent posts found');
  }
  
  // 6. Check Circuit Breaker
  console.log('\n🔌 CIRCUIT BREAKER STATUS:');
  console.log('-'.repeat(70));
  const circuitBreaker = getCircuitBreakerStatus();
  console.log('State:', circuitBreaker.state);
  console.log('Failures:', circuitBreaker.failures);
  console.log('Threshold:', circuitBreaker.threshold);
  if (circuitBreaker.state === 'open') {
    console.log('⚠️ CIRCUIT BREAKER IS OPEN - Posting is blocked!');
    if (circuitBreaker.timeUntilReset) {
      console.log(`Will reset in: ${Math.ceil(circuitBreaker.timeUntilReset / 1000)} seconds`);
    }
  }
  
  // 7. Check Queued Content
  console.log('\n📦 QUEUED CONTENT:');
  console.log('-'.repeat(70));
  const { data: queued } = await supabase
    .from('content_metadata')
    .select('decision_id, created_at, decision_type, status')
    .eq('status', 'queued')
    .order('created_at', { ascending: true });
  
  if (queued && queued.length > 0) {
    console.log(`Total Queued: ${queued.length}`);
    const singles = queued.filter((q: any) => q.decision_type === 'single').length;
    const threads = queued.filter((q: any) => q.decision_type === 'thread').length;
    const replies = queued.filter((q: any) => q.decision_type === 'reply').length;
    console.log(`  Singles: ${singles}, Threads: ${threads}, Replies: ${replies}`);
    
    const oldest = new Date(queued[0].created_at);
    const hoursQueued = (Date.now() - oldest.getTime()) / (1000 * 60 * 60);
    console.log(`Oldest queued: ${hoursQueued.toFixed(1)} hours ago`);
    console.log(`Is stale (>2 hours): ${hoursQueued > 2 ? 'YES ⚠️' : 'NO ✅'}`);
  } else {
    console.log('⚠️ No content in queue');
  }
  
  // 8. Check Plan Job
  console.log('\n📝 PLAN JOB (Content Generation):');
  console.log('-'.repeat(70));
  const planHeartbeat = await getHeartbeat('plan');
  if (planHeartbeat) {
    console.log('Status:', planHeartbeat.last_run_status);
    console.log('Last Success:', planHeartbeat.last_success || 'Never');
    console.log('Consecutive Failures:', planHeartbeat.consecutive_failures || 0);
    if (planHeartbeat.last_error) {
      console.log('Last Error:', planHeartbeat.last_error.substring(0, 300));
    }
  } else {
    console.log('❌ No heartbeat found for plan job');
  }
  
  // 9. Summary
  console.log('\n' + '='.repeat(70));
  console.log('📋 SUMMARY:');
  console.log('-'.repeat(70));
  
  const postingWorking = postingHeartbeat?.last_success && 
    (Date.now() - new Date(postingHeartbeat.last_success).getTime()) < 30 * 60 * 1000;
  const metricsWorking = metricsHeartbeat?.last_success && 
    (Date.now() - new Date(metricsHeartbeat.last_success).getTime()) < 30 * 60 * 1000;
  const successRate = attempts && attempts.length > 0
    ? (attempts.filter(a => a.status === 'success').length / attempts.length) * 100
    : null;
  
  console.log(`Posting Job: ${postingWorking ? '✅ Working' : '❌ Not Working'}`);
  console.log(`Metrics Scraper: ${metricsWorking ? '✅ Working' : '❌ Not Working'}`);
  console.log(`Posting Success Rate: ${successRate !== null ? `${successRate.toFixed(1)}%` : 'N/A'}`);
  console.log(`Circuit Breaker: ${circuitBreaker.state === 'open' ? '❌ OPEN (blocking)' : '✅ Closed'}`);
  
  console.log('\n' + '='.repeat(70));
  console.log('✅ Investigation Complete\n');
  
  process.exit(0);
}

investigate().catch(err => {
  console.error('❌ Investigation failed:', err);
  process.exit(1);
});

