#!/usr/bin/env node
/**
 * 🔍 PHASE 1: DATABASE FAKE DATA AUDIT
 * 
 * Scans all metrics tables for fake data patterns
 * Generates comprehensive report
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const report = {
  timestamp: new Date().toISOString(),
  scope: {},
  findings: {},
  patterns: {},
  actionItems: []
};

async function runAudit() {
  console.log('════════════════════════════════════════════════════════════');
  console.log('🔍 FAKE DATA AUDIT - PHASE 1: QUICK SCAN');
  console.log('════════════════════════════════════════════════════════════\n');
  
  // ═══════════════════════════════════════════════════════════
  // CHECK 1: OUTCOMES TABLE (Primary metrics storage)
  // ═══════════════════════════════════════════════════════════
  console.log('📊 CHECK 1: Auditing outcomes table...\n');
  
  try {
    // Total rows
    const { count: totalOutcomes } = await supabase
      .from('outcomes')
      .select('*', { count: 'exact', head: true });
    
    console.log(`   Total records: ${totalOutcomes || 0}`);
    report.scope.outcomes_total = totalOutcomes || 0;
    
    // Pattern 1: All-zero metrics (HIGHLY SUSPICIOUS)
    const { data: allZeros } = await supabase
      .from('outcomes')
      .select('decision_id, tweet_id, collected_at')
      .eq('likes', 0)
      .eq('retweets', 0)
      .eq('replies', 0)
      .not('collected_at', 'is', null);
    
    console.log(`   ⚠️ All-zero metrics: ${allZeros?.length || 0}`);
    report.patterns.all_zeros = allZeros?.length || 0;
    
    // Pattern 2: Metrics without collection time (IMPOSSIBLE)
    const { data: noCollectionTime } = await supabase
      .from('outcomes')
      .select('decision_id, likes, retweets')
      .or('likes.gt.0,retweets.gt.0')
      .is('collected_at', null);
    
    console.log(`   ❌ Metrics without collection time: ${noCollectionTime?.length || 0}`);
    report.patterns.no_collection_time = noCollectionTime?.length || 0;
    
    // Pattern 3: Recent outcomes (last 24h)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recentOutcomes } = await supabase
      .from('outcomes')
      .select('decision_id, likes, retweets, replies, views, collected_at')
      .gte('collected_at', oneDayAgo)
      .order('collected_at', { ascending: false });
    
    console.log(`   📅 Recent outcomes (24h): ${recentOutcomes?.length || 0}`);
    
    if (recentOutcomes && recentOutcomes.length > 0) {
      console.log('\n   Recent metrics sample:');
      recentOutcomes.slice(0, 5).forEach(o => {
        const hasNulls = o.likes === null && o.retweets === null;
        const allZero = o.likes === 0 && o.retweets === 0 && o.replies === 0;
        const status = hasNulls ? '✅ NULL' : allZero ? '⚠️ ALL_ZERO' : '✅ HAS_DATA';
        console.log(`      ${o.decision_id}: likes=${o.likes} retweets=${o.retweets} ${status}`);
      });
    }
    
  } catch (error) {
    console.error('   ❌ Error auditing outcomes:', error.message);
  }
  
  console.log('');
  
  // ═══════════════════════════════════════════════════════════
  // CHECK 2: POSTED_DECISIONS (Tweet ID validation)
  // ═══════════════════════════════════════════════════════════
  console.log('📊 CHECK 2: Auditing posted_decisions table...\n');
  
  try {
    // Total decisions
    const { count: totalDecisions } = await supabase
      .from('posted_decisions')
      .select('*', { count: 'exact', head: true });
    
    console.log(`   Total posted: ${totalDecisions || 0}`);
    report.scope.posted_decisions_total = totalDecisions || 0;
    
    // Get all tweet IDs for analysis
    const { data: allDecisions } = await supabase
      .from('posted_decisions')
      .select('decision_id, tweet_id, posted_at')
      .order('posted_at', { ascending: false })
      .limit(100);
    
    if (allDecisions) {
      // Analyze tweet ID formats
      const invalid = allDecisions.filter(d => {
        const id = String(d.tweet_id);
        return (
          id.startsWith('verified_') ||
          id.startsWith('optimistic_') ||
          id.startsWith('posted_') ||
          id.startsWith('FALLBACK_') ||
          id.length < 19 ||
          id.includes('_')
        );
      });
      
      const valid = allDecisions.filter(d => {
        const id = String(d.tweet_id);
        return id.length === 19 && !id.includes('_') && !isNaN(Number(id));
      });
      
      console.log(`   ✅ Valid tweet IDs: ${valid.length}/${allDecisions.length}`);
      console.log(`   ❌ Invalid tweet IDs: ${invalid.length}/${allDecisions.length}`);
      report.patterns.invalid_tweet_ids = invalid.length;
      report.patterns.valid_tweet_ids = valid.length;
      
      if (invalid.length > 0) {
        console.log('\n   Invalid ID examples:');
        invalid.slice(0, 5).forEach(d => {
          console.log(`      ${d.tweet_id} (${d.posted_at})`);
        });
      }
    }
    
  } catch (error) {
    console.error('   ❌ Error auditing posted_decisions:', error.message);
  }
  
  console.log('');
  
  // ═══════════════════════════════════════════════════════════
  // CHECK 3: COMPREHENSIVE_METRICS (Detailed metrics)
  // ═══════════════════════════════════════════════════════════
  console.log('📊 CHECK 3: Auditing comprehensive_metrics table...\n');
  
  try {
    const { count: totalComprehensive } = await supabase
      .from('comprehensive_metrics')
      .select('*', { count: 'exact', head: true });
    
    console.log(`   Total records: ${totalComprehensive || 0}`);
    report.scope.comprehensive_metrics_total = totalComprehensive || 0;
    
    // Check for Math.random() pattern (0 or 1 followers attributed)
    const { data: suspiciousFollowers } = await supabase
      .from('comprehensive_metrics')
      .select('post_id, followers_attributed')
      .in('followers_attributed', [0, 1])
      .limit(100);
    
    if (suspiciousFollowers) {
      const zeros = suspiciousFollowers.filter(f => f.followers_attributed === 0).length;
      const ones = suspiciousFollowers.filter(f => f.followers_attributed === 1).length;
      console.log(`   ⚠️ Suspicious follower attribution:`);
      console.log(`      0 followers: ${zeros} records`);
      console.log(`      1 follower: ${ones} records`);
      report.patterns.suspicious_followers = suspiciousFollowers.length;
    }
    
  } catch (error) {
    console.error('   ❌ Error auditing comprehensive_metrics:', error.message);
  }
  
  console.log('');
  
  // ═══════════════════════════════════════════════════════════
  // CHECK 4: DATA SOURCE TRACKING
  // ═══════════════════════════════════════════════════════════
  console.log('📊 CHECK 4: Checking data source tracking...\n');
  
  try {
    const { data: dataSources } = await supabase
      .from('outcomes')
      .select('data_source')
      .not('data_source', 'is', null);
    
    if (dataSources) {
      const sourceCount = {};
      dataSources.forEach(d => {
        const source = d.data_source || 'unknown';
        sourceCount[source] = (sourceCount[source] || 0) + 1;
      });
      
      console.log('   Data sources:');
      Object.entries(sourceCount).forEach(([source, count]) => {
        console.log(`      ${source}: ${count} records`);
      });
      report.scope.data_sources = sourceCount;
    }
    
  } catch (error) {
    console.error('   ❌ Error checking data sources:', error.message);
  }
  
  console.log('');
  
  // ═══════════════════════════════════════════════════════════
  // GENERATE REPORT
  // ═══════════════════════════════════════════════════════════
  console.log('════════════════════════════════════════════════════════════');
  console.log('📋 AUDIT REPORT SUMMARY');
  console.log('════════════════════════════════════════════════════════════\n');
  
  const totalRecords = (report.scope.outcomes_total || 0) + 
                       (report.scope.posted_decisions_total || 0) +
                       (report.scope.comprehensive_metrics_total || 0);
  
  const suspiciousCount = (report.patterns.all_zeros || 0) +
                         (report.patterns.no_collection_time || 0) +
                         (report.patterns.invalid_tweet_ids || 0) +
                         (report.patterns.suspicious_followers || 0);
  
  console.log(`📊 SCOPE:`);
  console.log(`   Total records examined: ${totalRecords}`);
  console.log(`   Tables audited: 3`);
  console.log(`   Date range: Last 100 records per table`);
  console.log('');
  
  console.log(`🎯 FINDINGS:`);
  console.log(`   ⚠️ Suspicious patterns found: ${suspiciousCount}`);
  console.log(`   ✅ Valid tweet IDs: ${report.patterns.valid_tweet_ids || 0}`);
  console.log(`   ❌ Invalid tweet IDs: ${report.patterns.invalid_tweet_ids || 0}`);
  console.log('');
  
  console.log(`📈 PATTERNS DETECTED:`);
  console.log(`   All-zero metrics: ${report.patterns.all_zeros || 0}`);
  console.log(`   Metrics without timestamps: ${report.patterns.no_collection_time || 0}`);
  console.log(`   Invalid tweet ID formats: ${report.patterns.invalid_tweet_ids || 0}`);
  console.log(`   Suspicious followers: ${report.patterns.suspicious_followers || 0}`);
  console.log('');
  
  // Calculate severity
  const totalInvalid = report.patterns.invalid_tweet_ids || 0;
  const totalPosted = report.scope.posted_decisions_total || 0;
  const invalidRate = totalPosted > 0 ? (totalInvalid / totalPosted * 100) : 0;
  
  console.log(`🚨 SEVERITY ASSESSMENT:`);
  if (invalidRate > 50) {
    console.log(`   ❌ CRITICAL: ${invalidRate.toFixed(1)}% invalid IDs`);
    console.log(`   Action: Full database cleanup required`);
  } else if (invalidRate > 20) {
    console.log(`   ⚠️ MODERATE: ${invalidRate.toFixed(1)}% invalid IDs`);
    console.log(`   Action: Run cleanup script`);
  } else if (invalidRate > 5) {
    console.log(`   ⚠️ MINOR: ${invalidRate.toFixed(1)}% invalid IDs`);
    console.log(`   Action: Mark invalid IDs as unscrappable`);
  } else {
    console.log(`   ✅ GOOD: ${invalidRate.toFixed(1)}% invalid IDs`);
    console.log(`   Action: Monitor new posts only`);
  }
  console.log('');
  
  console.log(`📝 NEXT STEPS:`);
  console.log(`   1. Run clean_invalid_tweet_ids.js to mark old IDs`);
  console.log(`   2. Monitor next 5 posts for fake data patterns`);
  console.log(`   3. Verify fixes are working (no more all-zeros)`);
  console.log(`   4. Re-audit in 24 hours to confirm cleanup`);
  console.log('');
  
  console.log('════════════════════════════════════════════════════════════');
  console.log('✅ PHASE 1 AUDIT COMPLETE');
  console.log('════════════════════════════════════════════════════════════');
  
  // Save report
  const reportPath = './audit_report_' + Date.now() + '.json';
  require('fs').writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n📄 Detailed report saved to: ${reportPath}`);
}

runAudit().catch(error => {
  console.error('❌ Audit failed:', error.message);
  process.exit(1);
});

