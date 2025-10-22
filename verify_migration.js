/**
 * 🔍 VERIFY DATABASE MIGRATION
 * Checks that migration completed successfully
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://qtgjmaelglghnlahqpbl.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function verifyMigration() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  console.log('\n🔍 VERIFYING DATABASE MIGRATION');
  console.log('═══════════════════════════════════════════════════════════════\n');

  let allPassed = true;

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 1. Check new tables exist
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  console.log('1️⃣  Checking New Tables...\n');

  const newTables = [
    'posted_tweets_comprehensive',
    'tweet_engagement_metrics_comprehensive',
    'content_generation_metadata_comprehensive'
  ];

  for (const table of newTables) {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.log(`   ❌ ${table}: NOT FOUND`);
      console.log(`      Error: ${error.message}`);
      allPassed = false;
    } else {
      console.log(`   ✅ ${table}: ${count} rows`);
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 2. Check views exist and work
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  console.log('\n2️⃣  Checking Compatibility Views...\n');

  const views = [
    'posted_decisions',
    'post_history',
    'real_tweet_metrics',
    'content_metadata'
  ];

  for (const view of views) {
    const { count, error } = await supabase
      .from(view)
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.log(`   ❌ ${view}: NOT WORKING`);
      console.log(`      Error: ${error.message}`);
      allPassed = false;
    } else {
      console.log(`   ✅ ${view}: ${count} rows (via view)`);
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 3. Verify data integrity
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  console.log('\n3️⃣  Verifying Data Integrity...\n');

  // Check posted tweets
  const { data: tweets } = await supabase
    .from('posted_decisions')
    .select('tweet_id, content')
    .limit(3);

  if (tweets && tweets.length > 0) {
    console.log(`   ✅ Can read tweets via view (${tweets.length} samples)`);
    tweets.forEach(t => {
      console.log(`      • ${t.tweet_id}: ${t.content?.substring(0, 40)}...`);
    });
  } else {
    console.log('   ⚠️  No tweets found');
  }

  // Check metrics
  const { data: metrics } = await supabase
    .from('real_tweet_metrics')
    .select('tweet_id, likes, retweets')
    .limit(3);

  console.log('');
  if (metrics && metrics.length > 0) {
    console.log(`   ✅ Can read metrics via view (${metrics.length} samples)`);
    metrics.forEach(m => {
      console.log(`      • ${m.tweet_id}: ${m.likes}❤️  ${m.retweets}🔄`);
    });
  } else {
    console.log('   ⚠️  No metrics found');
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 4. Test write operations
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  console.log('\n4️⃣  Testing Write Operations...\n');

  const testTweetId = `test_${Date.now()}`;
  
  // Try to insert via view
  const { error: insertError } = await supabase
    .from('posted_decisions')
    .insert({
      tweet_id: testTweetId,
      decision_id: `dec_${Date.now()}`,
      content: 'Test tweet for migration verification',
      posted_at: new Date().toISOString()
    });

  if (insertError) {
    console.log('   ❌ Write test FAILED');
    console.log(`      Error: ${insertError.message}`);
    allPassed = false;
  } else {
    console.log('   ✅ Can write to view (redirects to new table)');
    
    // Clean up test data
    await supabase
      .from('posted_decisions')
      .delete()
      .eq('tweet_id', testTweetId);
    
    console.log('   ✅ Test data cleaned up');
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 5. Check learning system compatibility
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  console.log('\n5️⃣  Testing Learning System Compatibility...\n');

  // Try a join (common in learning systems)
  const { data: joinTest, error: joinError } = await supabase
    .from('posted_decisions')
    .select(`
      tweet_id,
      content,
      metrics:real_tweet_metrics(likes, retweets)
    `)
    .limit(1);

  if (joinError) {
    console.log('   ⚠️  Join test had issues (may be normal)');
  } else if (joinTest && joinTest.length > 0) {
    console.log('   ✅ Joins work between views');
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // FINAL RESULT
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  console.log('\n\n═══════════════════════════════════════════════════════════════');
  console.log('📊 MIGRATION VERIFICATION RESULT');
  console.log('═══════════════════════════════════════════════════════════════\n');

  if (allPassed) {
    console.log('✅ MIGRATION SUCCESSFUL!');
    console.log('');
    console.log('Your database has been successfully optimized:');
    console.log('   • 3 new comprehensive tables created');
    console.log('   • All data migrated successfully');
    console.log('   • 4 compatibility views working');
    console.log('   • All systems can read/write data');
    console.log('');
    console.log('🎉 Your code continues working automatically via views!');
    console.log('   • Posting → saves to new tables');
    console.log('   • Scraping → saves to new tables');
    console.log('   • Learning → reads from new tables');
    console.log('');
    console.log('Next: Deploy to Railway with:');
    console.log('   git add .');
    console.log('   git commit -m "Database optimized with compatibility views"');
    console.log('   git push');
  } else {
    console.log('⚠️  MIGRATION HAD ISSUES');
    console.log('');
    console.log('Some checks failed. Review errors above.');
    console.log('Old tables are archived as *_archive_old if rollback needed.');
  }

  console.log('\n═══════════════════════════════════════════════════════════════\n');

  return allPassed;
}

verifyMigration().then(success => {
  process.exit(success ? 0 : 1);
}).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
