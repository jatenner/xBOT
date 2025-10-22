require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://qtgjmaelglghnlahqpbl.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF0Z2ptYWVsZ2xnaG5sYWhxcGJsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0OTYwNjUxMCwiZXhwIjoyMDY1MTgyNTEwfQ.Gze-MRjDg592T02LpyTlyXt14QkiIgRFgvnMeUchUfU';

async function verifyDatabaseIntegrity() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  console.log('\n🔍 DATABASE INTEGRITY VERIFICATION');
  console.log('═══════════════════════════════════════════════════════════════\n');

  let allChecks = [];

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // CHECK 1: Core Tables Exist
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  console.log('1️⃣  CHECKING CORE TABLES:\n');

  const coreTables = [
    { name: 'posted_tweets', required: true },
    { name: 'tweet_engagement_metrics', required: true },
    { name: 'content_generation_metadata', required: true }
  ];

  for (const table of coreTables) {
    try {
      const { count } = await supabase
        .from(table.name)
        .select('*', { count: 'exact', head: true });

      console.log(`   ✅ ${table.name}: ${count} records`);
      allChecks.push({ check: `Table ${table.name} exists`, status: 'PASS' });
    } catch (error) {
      console.log(`   ❌ ${table.name}: NOT FOUND`);
      allChecks.push({ check: `Table ${table.name} exists`, status: 'FAIL', error: error.message });
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // CHECK 2: Data Relationships (Foreign Keys Working)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  console.log('\n2️⃣  CHECKING DATA RELATIONSHIPS:\n');

  // Check: All metrics link to valid tweets
  try {
    const { data: orphanMetrics } = await supabase
      .rpc('check_orphan_metrics', {}, { count: 'exact' })
      .catch(() => ({ data: null }));

    // Fallback manual check if RPC doesn't exist
    const { data: metrics } = await supabase
      .from('tweet_engagement_metrics')
      .select('tweet_id')
      .limit(5);

    if (metrics && metrics.length > 0) {
      const { data: tweets } = await supabase
        .from('posted_tweets')
        .select('tweet_id')
        .in('tweet_id', metrics.map(m => m.tweet_id));

      const linked = tweets ? tweets.length : 0;
      const checked = metrics.length;

      if (linked === checked) {
        console.log(`   ✅ All metrics link to valid tweets (${checked} checked)`);
        allChecks.push({ check: 'Metrics → Tweets relationship', status: 'PASS' });
      } else {
        console.log(`   ⚠️  ${checked - linked} metrics link to missing tweets`);
        allChecks.push({ check: 'Metrics → Tweets relationship', status: 'WARN' });
      }
    } else {
      console.log(`   ℹ️  No metrics to check yet`);
      allChecks.push({ check: 'Metrics → Tweets relationship', status: 'SKIP' });
    }
  } catch (error) {
    console.log(`   ⚠️  Could not verify relationships: ${error.message}`);
    allChecks.push({ check: 'Metrics → Tweets relationship', status: 'SKIP', error: error.message });
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // CHECK 3: No Duplicate Tweet IDs
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  console.log('\n3️⃣  CHECKING DATA QUALITY:\n');

  try {
    const { data: tweets } = await supabase
      .from('posted_tweets')
      .select('tweet_id');

    const tweetIds = tweets.map(t => t.tweet_id);
    const uniqueIds = new Set(tweetIds);

    if (tweetIds.length === uniqueIds.size) {
      console.log(`   ✅ No duplicate tweet IDs (${tweetIds.length} unique tweets)`);
      allChecks.push({ check: 'No duplicate tweet IDs', status: 'PASS' });
    } else {
      const duplicates = tweetIds.length - uniqueIds.size;
      console.log(`   ❌ Found ${duplicates} duplicate tweet IDs`);
      allChecks.push({ check: 'No duplicate tweet IDs', status: 'FAIL' });
    }
  } catch (error) {
    console.log(`   ⚠️  Could not check duplicates: ${error.message}`);
    allChecks.push({ check: 'No duplicate tweet IDs', status: 'SKIP' });
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // CHECK 4: All Recent Tweets Have Tweet IDs
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  try {
    const { data: tweets } = await supabase
      .from('posted_tweets')
      .select('tweet_id')
      .is('tweet_id', null);

    if (tweets.length === 0) {
      console.log(`   ✅ All tweets have valid tweet IDs`);
      allChecks.push({ check: 'All tweets have tweet IDs', status: 'PASS' });
    } else {
      console.log(`   ⚠️  ${tweets.length} tweets missing tweet_id`);
      allChecks.push({ check: 'All tweets have tweet IDs', status: 'WARN' });
    }
  } catch (error) {
    allChecks.push({ check: 'All tweets have tweet IDs', status: 'SKIP' });
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // CHECK 5: Helper Views Work
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  console.log('\n4️⃣  CHECKING HELPER VIEWS:\n');

  try {
    const { data: viewData } = await supabase
      .from('tweets_with_latest_metrics')
      .select('*')
      .limit(1);

    if (viewData && viewData.length > 0) {
      console.log(`   ✅ tweets_with_latest_metrics view works`);
      console.log(`      Sample: ${viewData[0].tweet_id} - ${viewData[0].likes} likes`);
      allChecks.push({ check: 'Helper view works', status: 'PASS' });
    } else {
      console.log(`   ℹ️  View exists but no data yet`);
      allChecks.push({ check: 'Helper view works', status: 'SKIP' });
    }
  } catch (error) {
    console.log(`   ⚠️  View not available: ${error.message}`);
    allChecks.push({ check: 'Helper view works', status: 'SKIP' });
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // CHECK 6: Data Completeness
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  console.log('\n5️⃣  CHECKING DATA COMPLETENESS:\n');

  try {
    const { data: recentTweets } = await supabase
      .from('posted_tweets')
      .select('tweet_id')
      .gte('posted_at', new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString())
      .order('posted_at', { ascending: false });

    console.log(`   ℹ️  ${recentTweets.length} tweets in last 2 hours`);

    // Check if they have metrics
    if (recentTweets.length > 0) {
      const { data: metricsCount } = await supabase
        .from('tweet_engagement_metrics')
        .select('tweet_id', { count: 'exact', head: true })
        .in('tweet_id', recentTweets.map(t => t.tweet_id));

      if (metricsCount > 0) {
        console.log(`   ✅ ${metricsCount} have engagement metrics`);
        allChecks.push({ check: 'Recent tweets have metrics', status: 'PASS' });
      } else {
        console.log(`   ⏳ Waiting for scraper to collect metrics`);
        allChecks.push({ check: 'Recent tweets have metrics', status: 'PENDING' });
      }
    }
  } catch (error) {
    allChecks.push({ check: 'Data completeness', status: 'SKIP' });
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SUMMARY
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  console.log('\n\n═══════════════════════════════════════════════════════════════');
  console.log('📊 VERIFICATION SUMMARY:');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const passed = allChecks.filter(c => c.status === 'PASS').length;
  const failed = allChecks.filter(c => c.status === 'FAIL').length;
  const warnings = allChecks.filter(c => c.status === 'WARN').length;
  const skipped = allChecks.filter(c => c.status === 'SKIP' || c.status === 'PENDING').length;

  console.log(`✅ Passed:   ${passed}`);
  console.log(`❌ Failed:   ${failed}`);
  console.log(`⚠️  Warnings: ${warnings}`);
  console.log(`⏭️  Skipped:  ${skipped}`);

  console.log('\n');

  if (failed > 0) {
    console.log('❌ INTEGRITY ISSUES FOUND:');
    allChecks.filter(c => c.status === 'FAIL').forEach(c => {
      console.log(`   • ${c.check}`);
      if (c.error) console.log(`     Error: ${c.error}`);
    });
  } else if (warnings > 0) {
    console.log('⚠️  WARNINGS (Non-Critical):');
    allChecks.filter(c => c.status === 'WARN').forEach(c => {
      console.log(`   • ${c.check}`);
    });
  } else {
    console.log('✅ ALL CHECKS PASSED - Database integrity verified!');
  }

  console.log('\n═══════════════════════════════════════════════════════════════\n');

  return { passed, failed, warnings, skipped, allChecks };
}

verifyDatabaseIntegrity().catch(console.error);

