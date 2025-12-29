/**
 * Comprehensive System Health Check
 * 
 * Verifies all critical systems for autonomous 24/7 operation:
 * - Target: 2 posts/hour + 4 replies/hour
 * - Must run forever with continuous learning
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db/index';

interface HealthCheckResult {
  component: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  details: string;
  recommendation?: string;
}

const results: HealthCheckResult[] = [];

function logResult(component: string, status: 'PASS' | 'FAIL' | 'WARN', details: string, recommendation?: string) {
  results.push({ component, status, details, recommendation });
  const emoji = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
  console.log(`${emoji} ${component}: ${details}`);
  if (recommendation) console.log(`   💡 ${recommendation}`);
}

async function checkDatabaseConnectivity() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('1️⃣  DATABASE CONNECTIVITY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from('content_metadata').select('decision_id').limit(1);
    
    if (error) {
      logResult('Database', 'FAIL', `Connection failed: ${error.message}`, 'Check DATABASE_URL and network');
    } else {
      logResult('Database', 'PASS', 'Connected and queryable');
    }
  } catch (error: any) {
    logResult('Database', 'FAIL', `Exception: ${error.message}`, 'Check Supabase credentials');
  }
}

async function checkEnvironmentVariables() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('2️⃣  ENVIRONMENT VARIABLES');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const required = [
    'DATABASE_URL',
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'OPENAI_API_KEY',
    'TWITTER_SESSION_B64',
    'TWITTER_USERNAME'
  ];
  
  for (const varName of required) {
    if (process.env[varName]) {
      logResult(`Env: ${varName}`, 'PASS', 'Set');
    } else {
      logResult(`Env: ${varName}`, 'FAIL', 'Missing', 'Set this variable in Railway');
    }
  }
  
  // Check critical job intervals
  const planInterval = process.env.JOBS_PLAN_INTERVAL_MIN || '60';
  if (planInterval === '30') {
    logResult('Posting Rate', 'PASS', `planJob runs every ${planInterval}min = 2 posts/hour ✓`);
  } else {
    logResult('Posting Rate', 'FAIL', `planJob runs every ${planInterval}min = ${60/Number(planInterval)} posts/hour (should be 30min)`, 'Set JOBS_PLAN_INTERVAL_MIN=30');
  }
  
  // Check reconciliation
  const reconcileEnabled = process.env.ENABLE_TRUTH_RECONCILE === 'true';
  if (reconcileEnabled) {
    logResult('Reconciliation', 'PASS', 'Enabled - orphan tweets will auto-save');
  } else {
    logResult('Reconciliation', 'FAIL', 'Disabled - posted tweets may not save to DB', 'Set ENABLE_TRUTH_RECONCILE=true');
  }
}

async function checkRecentActivity() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('3️⃣  RECENT POSTING ACTIVITY (Last 2 Hours)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  try {
    const supabase = getSupabaseClient();
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    
    // Check posts (singles + threads)
    const { data: posts, error: postsError } = await supabase
      .from('content_metadata')
      .select('decision_id, decision_type, status, posted_at, tweet_id')
      .in('decision_type', ['single', 'thread'])
      .eq('status', 'posted')
      .gte('posted_at', twoHoursAgo)
      .order('posted_at', { ascending: false });
    
    if (postsError) {
      logResult('Recent Posts', 'FAIL', `Query failed: ${postsError.message}`);
    } else {
      const postCount = posts?.length || 0;
      const expectedPosts = 4; // 2 hours * 2 posts/hour
      
      if (postCount >= expectedPosts * 0.75) {
        logResult('Recent Posts', 'PASS', `${postCount} posts in last 2h (target: ${expectedPosts})`);
      } else if (postCount > 0) {
        logResult('Recent Posts', 'WARN', `${postCount} posts in last 2h (target: ${expectedPosts})`, 'Check if planJob is running and posting is working');
      } else {
        logResult('Recent Posts', 'FAIL', `0 posts in last 2h (target: ${expectedPosts})`, 'System may be stuck - check Railway logs');
      }
    }
    
    // Check replies
    const { data: replies, error: repliesError } = await supabase
      .from('content_metadata')
      .select('decision_id, status, posted_at, tweet_id, target_username')
      .eq('decision_type', 'reply')
      .eq('status', 'posted')
      .gte('posted_at', twoHoursAgo)
      .order('posted_at', { ascending: false });
    
    if (repliesError) {
      logResult('Recent Replies', 'FAIL', `Query failed: ${repliesError.message}`);
    } else {
      const replyCount = replies?.length || 0;
      const expectedReplies = 8; // 2 hours * 4 replies/hour
      
      if (replyCount >= expectedReplies * 0.75) {
        logResult('Recent Replies', 'PASS', `${replyCount} replies in last 2h (target: ${expectedReplies})`);
      } else if (replyCount > 0) {
        logResult('Recent Replies', 'WARN', `${replyCount} replies in last 2h (target: ${expectedReplies})`, 'Check reply opportunities and filtering');
      } else {
        logResult('Recent Replies', 'FAIL', `0 replies in last 2h (target: ${expectedReplies})`, 'Check harvester and replyJob');
      }
    }
  } catch (error: any) {
    logResult('Recent Activity', 'FAIL', `Exception: ${error.message}`);
  }
}

async function checkQueueHealth() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('4️⃣  QUEUE HEALTH');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  try {
    const supabase = getSupabaseClient();
    
    // Check queued decisions
    const { data: queued, error: queuedError } = await supabase
      .from('content_metadata')
      .select('decision_type, status')
      .in('status', ['queued', 'ready'])
      .order('created_at', { ascending: false });
    
    if (queuedError) {
      logResult('Queue', 'FAIL', `Query failed: ${queuedError.message}`);
    } else {
      const queueSize = queued?.length || 0;
      const posts = queued?.filter(d => d.decision_type !== 'reply').length || 0;
      const replies = queued?.filter(d => d.decision_type === 'reply').length || 0;
      
      if (queueSize > 0 && queueSize < 50) {
        logResult('Queue Size', 'PASS', `${queueSize} items (${posts} posts, ${replies} replies) - healthy`);
      } else if (queueSize >= 50) {
        logResult('Queue Size', 'WARN', `${queueSize} items - may be backing up`, 'Check if postingQueue is processing');
      } else {
        logResult('Queue Size', 'WARN', `0 items - queue empty`, 'planJob should be generating content');
      }
    }
    
    // Check reply opportunities
    const { count: oppCount, error: oppError } = await supabase
      .from('reply_opportunities')
      .select('*', { count: 'exact', head: true })
      .gte('tweet_posted_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
    
    if (oppError) {
      logResult('Reply Opportunities', 'FAIL', `Query failed: ${oppError.message}`);
    } else {
      const poolSize = oppCount || 0;
      
      if (poolSize >= 150) {
        logResult('Reply Opportunities', 'PASS', `${poolSize} opportunities in pool (target: 150+)`);
      } else if (poolSize >= 50) {
        logResult('Reply Opportunities', 'WARN', `${poolSize} opportunities (target: 150+)`, 'Harvester should run more frequently');
      } else {
        logResult('Reply Opportunities', 'FAIL', `${poolSize} opportunities (target: 150+)`, 'Check harvester job');
      }
    }
  } catch (error: any) {
    logResult('Queue Health', 'FAIL', `Exception: ${error.message}`);
  }
}

async function checkLearningSystemsActive() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('5️⃣  LEARNING SYSTEMS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  try {
    const supabase = getSupabaseClient();
    
    // Check if metrics are being scraped
    const { data: recentMetrics, error: metricsError } = await supabase
      .from('scraped_metrics')
      .select('tweet_id, scraped_at')
      .order('scraped_at', { ascending: false })
      .limit(1);
    
    if (metricsError) {
      logResult('Metrics Scraping', 'WARN', `Query failed: ${metricsError.message}`);
    } else if (recentMetrics && recentMetrics.length > 0) {
      const lastScrape = new Date(recentMetrics[0].scraped_at);
      const hoursSince = (Date.now() - lastScrape.getTime()) / (1000 * 60 * 60);
      
      if (hoursSince < 6) {
        logResult('Metrics Scraping', 'PASS', `Last scrape ${hoursSince.toFixed(1)}h ago - active`);
      } else {
        logResult('Metrics Scraping', 'WARN', `Last scrape ${hoursSince.toFixed(1)}h ago`, 'Check metricsScraperJob');
      }
    } else {
      logResult('Metrics Scraping', 'WARN', 'No recent metrics found', 'May be too early or job not running');
    }
    
    // Check if analytics are running
    const { data: analytics, error: analyticsError } = await supabase
      .from('reply_performance_analytics')
      .select('analysis_date')
      .order('analysis_date', { ascending: false })
      .limit(1);
    
    if (analyticsError && !analyticsError.message.includes('does not exist')) {
      logResult('Performance Analytics', 'WARN', `Query failed: ${analyticsError.message}`);
    } else if (analytics && analytics.length > 0) {
      const lastAnalysis = new Date(analytics[0].analysis_date);
      const hoursSince = (Date.now() - lastAnalysis.getTime()) / (1000 * 60 * 60);
      
      if (hoursSince < 12) {
        logResult('Performance Analytics', 'PASS', `Last analysis ${hoursSince.toFixed(1)}h ago - learning active`);
      } else {
        logResult('Performance Analytics', 'WARN', `Last analysis ${hoursSince.toFixed(1)}h ago`, 'Analytics job may not be running');
      }
    } else {
      logResult('Performance Analytics', 'WARN', 'No analytics data yet', 'Table may not exist or job not run');
    }
  } catch (error: any) {
    logResult('Learning Systems', 'FAIL', `Exception: ${error.message}`);
  }
}

async function checkTruthIntegrity() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('6️⃣  TRUTH INTEGRITY (Last 24h)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  try {
    const supabase = getSupabaseClient();
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    // Check for false success (posted status but no tweet_id)
    const { data: falseSuccess, error: falseError } = await supabase
      .from('content_metadata')
      .select('decision_id, decision_type, status')
      .eq('status', 'posted')
      .or('tweet_id.is.null,tweet_id.eq.')
      .gte('posted_at', oneDayAgo);
    
    if (falseError) {
      logResult('False Success', 'WARN', `Query failed: ${falseError.message}`);
    } else {
      const count = falseSuccess?.length || 0;
      if (count === 0) {
        logResult('False Success', 'PASS', '0 posted decisions without tweet_id');
      } else {
        logResult('False Success', 'FAIL', `${count} posted decisions missing tweet_id`, 'Check markDecisionPosted() and reconciliation');
      }
    }
    
    // Check orphan receipts
    const { data: receipts, error: receiptsError } = await supabase
      .from('post_receipts')
      .select('receipt_id, decision_id, root_tweet_id')
      .gte('posted_at', oneDayAgo)
      .order('posted_at', { ascending: false });
    
    if (receiptsError) {
      logResult('Orphan Receipts', 'WARN', `Query failed: ${receiptsError.message}`);
    } else if (receipts && receipts.length > 0) {
      // Check if receipts match DB entries
      const decisionIds = receipts.map(r => r.decision_id).filter(Boolean);
      const { data: dbEntries, error: dbError } = await supabase
        .from('content_metadata')
        .select('decision_id, status, tweet_id')
        .in('decision_id', decisionIds);
      
      const dbMap = new Map(dbEntries?.map(e => [e.decision_id, e]) || []);
      const orphans = receipts.filter(r => {
        const dbEntry = dbMap.get(r.decision_id!);
        return !dbEntry || dbEntry.status !== 'posted' || !dbEntry.tweet_id;
      });
      
      if (orphans.length === 0) {
        logResult('Orphan Receipts', 'PASS', `0 orphans (${receipts.length} receipts, all reconciled)`);
      } else if (orphans.length <= 5) {
        logResult('Orphan Receipts', 'WARN', `${orphans.length} orphans waiting reconciliation`, 'Should auto-fix in <5 min');
      } else {
        logResult('Orphan Receipts', 'FAIL', `${orphans.length} orphans not reconciling`, 'Check if ENABLE_TRUTH_RECONCILE=true');
      }
    }
  } catch (error: any) {
    logResult('Truth Integrity', 'FAIL', `Exception: ${error.message}`);
  }
}

async function checkJobHeartbeats() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('7️⃣  CRITICAL JOB HEARTBEATS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  try {
    const supabase = getSupabaseClient();
    
    const criticalJobs = ['plan', 'posting_queue', 'reply_harvester', 'reply_job'];
    
    for (const jobName of criticalJobs) {
      const { data: heartbeat, error } = await supabase
        .from('job_heartbeats')
        .select('last_heartbeat, status')
        .eq('job_name', jobName)
        .single();
      
      if (error && !error.message.includes('0 rows')) {
        logResult(`Job: ${jobName}`, 'WARN', `Heartbeat query failed: ${error.message}`);
      } else if (heartbeat) {
        const lastBeat = new Date(heartbeat.last_heartbeat);
        const minutesSince = (Date.now() - lastBeat.getTime()) / (1000 * 60);
        
        if (minutesSince < 60) {
          logResult(`Job: ${jobName}`, 'PASS', `Last run ${minutesSince.toFixed(0)}min ago`);
        } else {
          logResult(`Job: ${jobName}`, 'WARN', `Last run ${minutesSince.toFixed(0)}min ago`, 'Job may be stalled');
        }
      } else {
        logResult(`Job: ${jobName}`, 'WARN', 'No heartbeat found', 'Job may not have run yet');
      }
    }
  } catch (error: any) {
    logResult('Job Heartbeats', 'FAIL', `Exception: ${error.message}`);
  }
}

async function printSummary() {
  console.log('\n\n');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('                    📊 HEALTH CHECK SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════');
  
  const passed = results.filter(r => r.status === 'PASS').length;
  const warned = results.filter(r => r.status === 'WARN').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const total = results.length;
  
  console.log(`\n✅ PASSED: ${passed}/${total}`);
  console.log(`⚠️  WARNED: ${warned}/${total}`);
  console.log(`❌ FAILED: ${failed}/${total}`);
  
  if (failed > 0) {
    console.log('\n\n🚨 CRITICAL ISSUES (must fix):');
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`\n   ❌ ${r.component}`);
      console.log(`      Problem: ${r.details}`);
      if (r.recommendation) console.log(`      Fix: ${r.recommendation}`);
    });
  }
  
  if (warned > 0) {
    console.log('\n\n⚠️  WARNINGS (review):');
    results.filter(r => r.status === 'WARN').forEach(r => {
      console.log(`\n   ⚠️  ${r.component}`);
      console.log(`      Issue: ${r.details}`);
      if (r.recommendation) console.log(`      Suggestion: ${r.recommendation}`);
    });
  }
  
  console.log('\n═══════════════════════════════════════════════════════════════');
  
  if (failed === 0 && warned === 0) {
    console.log('\n🎉 SYSTEM HEALTHY - Ready for autonomous 24/7 operation!');
    console.log('   • 2 posts/hour ✓');
    console.log('   • 4 replies/hour ✓');
    console.log('   • Continuous learning ✓');
    console.log('   • All systems operational ✓');
  } else if (failed === 0) {
    console.log('\n✅ SYSTEM OPERATIONAL - Minor warnings present');
    console.log('   System can run autonomously, but review warnings above');
  } else {
    console.log('\n🚨 SYSTEM NEEDS ATTENTION');
    console.log('   Fix critical issues above before autonomous operation');
  }
  
  console.log('\n═══════════════════════════════════════════════════════════════\n');
  
  process.exit(failed > 0 ? 1 : 0);
}

// Run all checks
async function main() {
  console.log('\n');
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║                                                               ║');
  console.log('║         🏥 xBOT COMPREHENSIVE HEALTH CHECK                    ║');
  console.log('║         Target: 2 posts/hour + 4 replies/hour                ║');
  console.log('║         Mode: Autonomous 24/7 operation                       ║');
  console.log('║                                                               ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');
  
  await checkDatabaseConnectivity();
  await checkEnvironmentVariables();
  await checkRecentActivity();
  await checkQueueHealth();
  await checkLearningSystemsActive();
  await checkTruthIntegrity();
  await checkJobHeartbeats();
  await printSummary();
}

main().catch(error => {
  console.error('\n\n❌ HEALTH CHECK CRASHED:', error);
  process.exit(1);
});
