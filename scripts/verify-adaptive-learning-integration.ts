/**
 * 🔍 ADAPTIVE LEARNING INTEGRATION VERIFICATION
 * 
 * This script verifies all integration points are working correctly
 * Run with: pnpm tsx scripts/verify-adaptive-learning-integration.ts
 */

import 'dotenv/config';

async function verify() {
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('           🔍 ADAPTIVE LEARNING INTEGRATION VERIFICATION');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

let allPassed = true;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TEST 1: IMPORTS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
console.log('📦 TEST 1: Verifying imports...\n');

try {
  const { PerformanceAnalyzer } = await import('../src/analytics/PerformanceAnalyzer.js');
  console.log('   ✅ PerformanceAnalyzer imported successfully');
} catch (error: any) {
  console.error('   ❌ PerformanceAnalyzer import failed:', error.message);
  allPassed = false;
}

try {
  const { analyticsJob } = await import('../src/jobs/analyticsJob.js');
  console.log('   ✅ analyticsJob imported successfully');
} catch (error: any) {
  console.error('   ❌ analyticsJob import failed:', error.message);
  allPassed = false;
}

try {
  const { OpportunityScorer } = await import('../src/intelligence/OpportunityScorer.js');
  console.log('   ✅ OpportunityScorer imported successfully');
} catch (error: any) {
  console.error('   ❌ OpportunityScorer import failed:', error.message);
  allPassed = false;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TEST 2: DATABASE CONNECTION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
console.log('\n📊 TEST 2: Verifying database connection...\n');

try {
  const { getSupabaseClient } = await import('../src/db/index.js');
  const supabase = getSupabaseClient();
  console.log('   ✅ Supabase client initialized');
  
  // Test query
  const { data, error } = await supabase
    .from('content_metadata')
    .select('decision_id')
    .limit(1);
  
  if (error) {
    console.error('   ❌ Database query failed:', error.message);
    allPassed = false;
  } else {
    console.log('   ✅ Database connection working');
  }
} catch (error: any) {
  console.error('   ❌ Database connection failed:', error.message);
  allPassed = false;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TEST 3: DATABASE TABLES & COLUMNS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
console.log('\n🗄️  TEST 3: Verifying database schema...\n');

try {
  const { getSupabaseClient } = await import('../src/db/index.js');
  const supabase = getSupabaseClient();
  
  // Check reply_performance_analytics table
  const { data: analyticsData, error: analyticsError } = await supabase
    .from('reply_performance_analytics')
    .select('*')
    .limit(1);
  
  if (analyticsError && analyticsError.code === '42P01') {
    console.error('   ❌ reply_performance_analytics table does not exist');
    console.error('   → Run: railway run --service xBOT pnpm tsx scripts/apply-schema-direct.ts');
    allPassed = false;
  } else if (analyticsError) {
    console.warn('   ⚠️  reply_performance_analytics table check:', analyticsError.message);
  } else {
    console.log('   ✅ reply_performance_analytics table exists');
  }
  
  // Check reply_opportunities columns
  const { data: oppData, error: oppError } = await supabase
    .from('reply_opportunities')
    .select('engagement_tier, timing_window, account_size_tier, opportunity_score_v2')
    .limit(1);
  
  if (oppError && oppError.message.includes('does not exist')) {
    console.error('   ❌ reply_opportunities missing new columns');
    console.error('   → Run: railway run --service xBOT pnpm tsx scripts/apply-schema-direct.ts');
    allPassed = false;
  } else if (oppError) {
    console.warn('   ⚠️  reply_opportunities column check:', oppError.message);
  } else {
    console.log('   ✅ reply_opportunities columns exist');
  }
  
  // Check discovered_accounts columns
  const { data: accountData, error: accountError } = await supabase
    .from('discovered_accounts')
    .select('avg_followers_per_reply, performance_tier, last_high_value_reply_at, total_replies_count')
    .limit(1);
  
  if (accountError && accountError.message.includes('does not exist')) {
    console.error('   ❌ discovered_accounts missing new columns');
    console.error('   → Run: railway run --service xBOT pnpm tsx scripts/apply-schema-direct.ts');
    allPassed = false;
  } else if (accountError) {
    console.warn('   ⚠️  discovered_accounts column check:', accountError.message);
  } else {
    console.log('   ✅ discovered_accounts columns exist');
  }
  
} catch (error: any) {
  console.error('   ❌ Schema verification failed:', error.message);
  allPassed = false;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TEST 4: PERFORMANCE ANALYZER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
console.log('\n📈 TEST 4: Testing PerformanceAnalyzer...\n');

try {
  const { PerformanceAnalyzer } = await import('../src/analytics/PerformanceAnalyzer.js');
  const analyzer = PerformanceAnalyzer.getInstance();
  
  console.log('   ✅ PerformanceAnalyzer instance created');
  
  // Try to analyze (will work even with no data)
  const tierAnalysis = await analyzer.analyzeEngagementTiers(30);
  console.log(`   ✅ Engagement tier analysis ran (${tierAnalysis.length} tiers found)`);
  
  if (tierAnalysis.length === 0) {
    console.log('   ℹ️  No data yet - system will populate as replies are posted');
  } else {
    console.log(`   📊 Sample: ${tierAnalysis[0].tier} - ${tierAnalysis[0].replyCount} replies`);
  }
  
} catch (error: any) {
  console.error('   ❌ PerformanceAnalyzer test failed:', error.message);
  allPassed = false;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TEST 5: OPPORTUNITY SCORER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
console.log('\n🎯 TEST 5: Testing OpportunityScorer...\n');

try {
  const { OpportunityScorer } = await import('../src/intelligence/OpportunityScorer.js');
  
  // Test with mock opportunity
  const mockOpportunity = {
    like_count: 50000,
    reply_count: 150,
    target_username: 'test_account',
    tweet_posted_at: new Date(Date.now() - 1000 * 60 * 60).toISOString() // 1 hour ago
  };
  
  const score = await OpportunityScorer.calculateScore(mockOpportunity);
  console.log(`   ✅ OpportunityScorer working (mock score: ${score.toFixed(1)})`);
  
} catch (error: any) {
  console.error('   ❌ OpportunityScorer test failed:', error.message);
  allPassed = false;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SUMMARY
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

if (allPassed) {
  console.log('           ✅ ALL TESTS PASSED - SYSTEM OPERATIONAL');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('🎉 Adaptive learning system is fully integrated and ready!');
  console.log('');
  console.log('Next steps:');
  console.log('  1. Monitor logs: railway logs --service xBOT');
  console.log('  2. Watch for learning signals in harvester and reply jobs');
  console.log('  3. Run analytics after 6 hours: pnpm analytics:report');
  console.log('');
  process.exit(0);
} else {
  console.log('           ⚠️  SOME TESTS FAILED - ACTION REQUIRED');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('❌ Please fix the issues above before proceeding.');
  console.log('');
  console.log('Most common fix:');
  console.log('  railway run --service xBOT pnpm tsx scripts/apply-schema-direct.ts');
  console.log('');
  process.exit(1);
}
}

verify();

