/**
 * 🔍 QUICK SYSTEM STATUS CHECK
 * Run this to quickly verify system is working
 */

import { getSupabaseClient } from '../src/db';
import { getHeartbeat } from '../src/jobs/jobHeartbeat';
import { getCircuitBreakerStatus } from '../src/jobs/postingQueue';

async function checkStatus() {
  console.log('\n🔍 QUICK SYSTEM STATUS CHECK\n');
  console.log('='.repeat(70));
  
  const supabase = getSupabaseClient();
  
  // 1. Check Posting Attempts Table
  console.log('\n📊 POSTING ATTEMPTS TABLE:');
  console.log('-'.repeat(70));
  const { data: attempts, error: attemptsError } = await supabase
    .from('posting_attempts')
    .select('status, created_at, error_message')
    .order('created_at', { ascending: false })
    .limit(5);
  
  if (attemptsError) {
    console.log('❌ Error:', attemptsError.message);
    console.log('⚠️  Table might not exist or have wrong schema');
  } else if (attempts && attempts.length > 0) {
    console.log(`✅ Found ${attempts.length} recent attempts:`);
    attempts.forEach((a: any) => {
      const time = new Date(a.created_at).toLocaleString();
      const status = a.status === 'success' ? '✅' : '❌';
      console.log(`  ${status} ${time} - ${a.status}${a.error_message ? ` (${a.error_message.substring(0, 50)})` : ''}`);
    });
  } else {
    console.log('⚠️  No posting attempts found in database');
    console.log('   This could mean:');
    console.log('   - Posting job hasn\'t run yet');
    console.log('   - Table schema is wrong');
    console.log('   - Logging isn\'t working');
  }
  
  // 2. Check Posting Job Heartbeat
  console.log('\n📮 POSTING JOB STATUS:');
  console.log('-'.repeat(70));
  const postingHeartbeat = await getHeartbeat('posting');
  if (postingHeartbeat) {
    const lastSuccess = postingHeartbeat.last_success 
      ? new Date(postingHeartbeat.last_success).toLocaleString()
      : 'Never';
    const minutesAgo = postingHeartbeat.last_success
      ? Math.floor((Date.now() - new Date(postingHeartbeat.last_success).getTime()) / (1000 * 60))
      : null;
    
    console.log(`Status: ${postingHeartbeat.last_run_status}`);
    console.log(`Last Success: ${lastSuccess}${minutesAgo !== null ? ` (${minutesAgo} min ago)` : ''}`);
    console.log(`Consecutive Failures: ${postingHeartbeat.consecutive_failures || 0}`);
    
    if (minutesAgo !== null && minutesAgo < 10) {
      console.log('✅ Posting job is running normally');
    } else if (minutesAgo !== null && minutesAgo < 30) {
      console.log('⚠️  Posting job ran recently but may be slow');
    } else {
      console.log('❌ Posting job is NOT running or failing');
    }
  } else {
    console.log('❌ No heartbeat found - posting job may not be scheduled');
  }
  
  // 3. Check Metrics Scraper
  console.log('\n📊 METRICS SCRAPER STATUS:');
  console.log('-'.repeat(70));
  const metricsHeartbeat = await getHeartbeat('metrics_scraper') || await getHeartbeat('analytics');
  if (metricsHeartbeat) {
    const lastSuccess = metricsHeartbeat.last_success
      ? new Date(metricsHeartbeat.last_success).toLocaleString()
      : 'Never';
    const minutesAgo = metricsHeartbeat.last_success
      ? Math.floor((Date.now() - new Date(metricsHeartbeat.last_success).getTime()) / (1000 * 60))
      : null;
    
    console.log(`Status: ${metricsHeartbeat.last_run_status}`);
    console.log(`Last Success: ${lastSuccess}${minutesAgo !== null ? ` (${minutesAgo} min ago)` : ''}`);
    
    if (minutesAgo !== null && minutesAgo < 30) {
      console.log('✅ Metrics scraper is running normally');
    } else {
      console.log('⚠️  Metrics scraper may be stale or not running');
    }
  } else {
    console.log('⚠️  No heartbeat found for metrics scraper');
  }
  
  // 4. Check Circuit Breaker
  console.log('\n🔌 CIRCUIT BREAKER:');
  console.log('-'.repeat(70));
  const circuitBreaker = getCircuitBreakerStatus();
  console.log(`State: ${circuitBreaker.state.toUpperCase()}`);
  console.log(`Failures: ${circuitBreaker.failures}/${circuitBreaker.threshold}`);
  
  if (circuitBreaker.state === 'open') {
    console.log('❌ CIRCUIT BREAKER IS OPEN - All posting is BLOCKED!');
    if (circuitBreaker.timeUntilReset) {
      console.log(`   Will reset in: ${Math.ceil(circuitBreaker.timeUntilReset / 1000)} seconds`);
    }
  } else {
    console.log('✅ Circuit breaker is closed - posting allowed');
  }
  
  // 5. Check Recent Posts
  console.log('\n📝 RECENT POSTS:');
  console.log('-'.repeat(70));
  const { data: recentPosts } = await supabase
    .from('content_metadata')
    .select('decision_id, posted_at, decision_type, status, tweet_id')
    .eq('status', 'posted')
    .order('posted_at', { ascending: false })
    .limit(5);
  
  if (recentPosts && recentPosts.length > 0) {
    console.log(`✅ Found ${recentPosts.length} recent posts:`);
    recentPosts.forEach((p: any) => {
      const time = p.posted_at ? new Date(p.posted_at).toLocaleString() : 'Unknown';
      const hasId = p.tweet_id ? '✅' : '❌';
      console.log(`  ${hasId} ${time} - ${p.decision_type}`);
    });
    
    const lastPost = new Date(recentPosts[0].posted_at);
    const minutesSince = Math.floor((Date.now() - lastPost.getTime()) / (1000 * 60));
    console.log(`\nLast post: ${minutesSince} minutes ago`);
  } else {
    console.log('⚠️  No recent posts found');
  }
  
  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('📋 SUMMARY:');
  console.log('-'.repeat(70));
  
  const postingWorking = postingHeartbeat?.last_success && 
    (Date.now() - new Date(postingHeartbeat.last_success).getTime()) < 10 * 60 * 1000;
  const metricsWorking = metricsHeartbeat?.last_success &&
    (Date.now() - new Date(metricsHeartbeat.last_success).getTime()) < 30 * 60 * 1000;
  const hasAttempts = attempts && attempts.length > 0;
  const circuitOpen = circuitBreaker.state === 'open';
  
  console.log(`Posting Job: ${postingWorking ? '✅ Working' : '❌ Not Working'}`);
  console.log(`Metrics Scraper: ${metricsWorking ? '✅ Working' : '❌ Not Working'}`);
  console.log(`Posting Attempts Logged: ${hasAttempts ? '✅ Yes' : '❌ No'}`);
  console.log(`Circuit Breaker: ${circuitOpen ? '❌ OPEN (blocking)' : '✅ Closed'}`);
  
  if (postingWorking && metricsWorking && hasAttempts && !circuitOpen) {
    console.log('\n✅ System appears to be working normally!');
  } else {
    console.log('\n⚠️  System has issues - check details above');
  }
  
  console.log('\n' + '='.repeat(70));
  
  process.exit(0);
}

checkStatus().catch(err => {
  console.error('❌ Check failed:', err);
  process.exit(1);
});

