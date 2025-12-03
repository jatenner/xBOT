/**
 * 🔍 COMPREHENSIVE DATABASE AUDIT
 * Checks how posts, singles, threads, and replies are stored
 */

import { getSupabaseClient } from './src/db/index';

async function auditDatabase() {
  const supabase = getSupabaseClient();
  
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('🔍 DATABASE AUDIT - Posts, Singles, Threads, Replies');
  console.log('═══════════════════════════════════════════════════════════\n');

  // 1. COUNT BY DECISION_TYPE
  console.log('📊 COUNT BY DECISION_TYPE');
  console.log('─────────────────────────────────────────────────────────');
  
  const { data: typeCounts, error: typeError } = await supabase
    .from('content_metadata')
    .select('decision_type, status')
    .order('created_at', { ascending: false })
    .limit(1000);
  
  if (typeError) {
    console.log(`❌ Error: ${typeError.message}`);
    return;
  }
  
  const byType = (typeCounts || []).reduce((acc: any, item: any) => {
    const type = item.decision_type || 'NULL';
    const status = item.status || 'NULL';
    if (!acc[type]) acc[type] = {};
    if (!acc[type][status]) acc[type][status] = 0;
    acc[type][status]++;
    return acc;
  }, {});
  
  console.log('\nBreakdown:');
  Object.entries(byType).forEach(([type, statuses]: [string, any]) => {
    console.log(`\n${type.toUpperCase()}:`);
    Object.entries(statuses).forEach(([status, count]: [string, any]) => {
      console.log(`  • ${status}: ${count}`);
    });
  });
  
  // 2. CHECK DATE FIELDS
  console.log('\n\n📅 DATE FIELD AUDIT');
  console.log('─────────────────────────────────────────────────────────');
  
  const { data: dateCheck, error: dateError } = await supabase
    .from('content_metadata')
    .select('decision_id, decision_type, status, created_at, posted_at, scheduled_at')
    .order('created_at', { ascending: false })
    .limit(100);
  
  if (dateError) {
    console.log(`❌ Error: ${dateError.message}`);
  } else {
    const withDates = (dateCheck || []).filter((item: any) => item.posted_at).length;
    const withoutDates = (dateCheck || []).filter((item: any) => !item.posted_at).length;
    const withCreated = (dateCheck || []).filter((item: any) => item.created_at).length;
    const withoutCreated = (dateCheck || []).filter((item: any) => !item.created_at).length;
    
    console.log(`\nRecent 100 items:`);
    console.log(`  • With posted_at: ${withDates}`);
    console.log(`  • Without posted_at: ${withoutDates}`);
    console.log(`  • With created_at: ${withCreated}`);
    console.log(`  • Without created_at: ${withoutCreated}`);
    
    // Show examples
    console.log(`\n📋 Sample items (last 10):`);
    (dateCheck || []).slice(0, 10).forEach((item: any, idx: number) => {
      console.log(`\n  ${idx + 1}. ${item.decision_type || 'NULL'} (${item.status || 'NULL'})`);
      console.log(`     • created_at: ${item.created_at || 'MISSING'}`);
      console.log(`     • posted_at: ${item.posted_at || 'MISSING'}`);
      console.log(`     • scheduled_at: ${item.scheduled_at || 'MISSING'}`);
    });
  }
  
  // 3. CHECK FOR DATA CORRUPTION
  console.log('\n\n🚨 DATA INTEGRITY CHECK');
  console.log('─────────────────────────────────────────────────────────');
  
  const { data: integrityCheck, error: integrityError } = await supabase
    .from('content_metadata')
    .select('decision_id, decision_type, status, content, target_tweet_id, target_username')
    .order('created_at', { ascending: false })
    .limit(50);
  
  if (integrityError) {
    console.log(`❌ Error: ${integrityError.message}`);
  } else {
    const invalidTypes = (integrityCheck || []).filter((item: any) => 
      item.decision_type && 
      !['single', 'thread', 'reply'].includes(item.decision_type)
    );
    
    const repliesWithoutTarget = (integrityCheck || []).filter((item: any) => 
      item.decision_type === 'reply' && !item.target_tweet_id
    );
    
    const singlesWithTarget = (integrityCheck || []).filter((item: any) => 
      item.decision_type === 'single' && item.target_tweet_id
    );
    
    const emptyContent = (integrityCheck || []).filter((item: any) => 
      !item.content || item.content.trim().length === 0
    );
    
    console.log(`\nIssues found:`);
    console.log(`  • Invalid decision_type values: ${invalidTypes.length}`);
    if (invalidTypes.length > 0) {
      invalidTypes.forEach((item: any) => {
        console.log(`    - ${item.decision_id}: "${item.decision_type}"`);
      });
    }
    
    console.log(`  • Replies without target_tweet_id: ${repliesWithoutTarget.length}`);
    if (repliesWithoutTarget.length > 0) {
      repliesWithoutTarget.slice(0, 5).forEach((item: any) => {
        console.log(`    - ${item.decision_id}: reply with no target`);
      });
    }
    
    console.log(`  • Singles with target_tweet_id (shouldn't have): ${singlesWithTarget.length}`);
    if (singlesWithTarget.length > 0) {
      singlesWithTarget.slice(0, 5).forEach((item: any) => {
        console.log(`    - ${item.decision_id}: single with target ${item.target_tweet_id}`);
      });
    }
    
    console.log(`  • Empty content: ${emptyContent.length}`);
  }
  
  // 4. CHECK HOW POSTS ARE SAVED
  console.log('\n\n💾 SAVE PATTERN ANALYSIS');
  console.log('─────────────────────────────────────────────────────────');
  
  const { data: savePattern, error: saveError } = await supabase
    .from('content_metadata')
    .select('decision_id, decision_type, status, created_at, posted_at, tweet_id')
    .order('created_at', { ascending: false })
    .limit(200);
  
  if (saveError) {
    console.log(`❌ Error: ${saveError.message}`);
  } else {
    const posted = (savePattern || []).filter((item: any) => item.status === 'posted');
    const withTweetId = posted.filter((item: any) => item.tweet_id);
    const withoutTweetId = posted.filter((item: any) => !item.tweet_id);
    
    console.log(`\nPosted items (last 200):`);
    console.log(`  • Total posted: ${posted.length}`);
    console.log(`  • With tweet_id: ${withTweetId.length}`);
    console.log(`  • Without tweet_id: ${withoutTweetId.length} ⚠️`);
    
    // Check by type
    const postedByType = posted.reduce((acc: any, item: any) => {
      const type = item.decision_type || 'NULL';
      if (!acc[type]) acc[type] = { total: 0, withId: 0, withoutId: 0 };
      acc[type].total++;
      if (item.tweet_id) acc[type].withId++;
      else acc[type].withoutId++;
      return acc;
    }, {});
    
    console.log(`\nPosted by type:`);
    Object.entries(postedByType).forEach(([type, stats]: [string, any]) => {
      console.log(`  ${type}:`);
      console.log(`    • Total: ${stats.total}`);
      console.log(`    • With tweet_id: ${stats.withId}`);
      console.log(`    • Without tweet_id: ${stats.withoutId} ${stats.withoutId > 0 ? '⚠️' : ''}`);
    });
  }
  
  // 5. DASHBOARD QUERY SIMULATION
  console.log('\n\n🖥️  DASHBOARD QUERY SIMULATION');
  console.log('─────────────────────────────────────────────────────────');
  
  // Simulate what dashboard does
  const { data: dashboardData, error: dashboardError } = await supabase
    .from('content_metadata')
    .select('decision_id, decision_type, status, content, posted_at, created_at, actual_impressions, actual_likes, target_username')
    .in('decision_type', ['single', 'thread', 'reply'])
    .order('posted_at', { ascending: false })
    .limit(50);
  
  if (dashboardError) {
    console.log(`❌ Error: ${dashboardError.message}`);
  } else {
    const byType = (dashboardData || []).reduce((acc: any, item: any) => {
      const type = item.decision_type || 'NULL';
      if (!acc[type]) acc[type] = [];
      acc[type].push(item);
      return acc;
    }, {});
    
    console.log(`\nWhat dashboard would show (last 50):`);
    Object.entries(byType).forEach(([type, items]: [string, any]) => {
      console.log(`\n${type.toUpperCase()}: ${items.length} items`);
      items.slice(0, 3).forEach((item: any) => {
        const date = item.posted_at || item.created_at || 'NO DATE';
        const preview = (item.content || '').substring(0, 50);
        console.log(`  • ${date} - ${preview}...`);
        if (type === 'reply' && item.target_username) {
          console.log(`    Replying to: @${item.target_username}`);
        }
      });
    });
    
    // Check if all are replies (the problem!)
    const allReplies = (dashboardData || []).every((item: any) => item.decision_type === 'reply');
    const allSingles = (dashboardData || []).every((item: any) => item.decision_type === 'single');
    
    if (allReplies) {
      console.log(`\n⚠️  PROBLEM: All items are REPLIES!`);
      console.log(`   Dashboard should show singles/threads too.`);
    } else if (allSingles) {
      console.log(`\n✅ All items are SINGLES (expected for posts page)`);
    } else {
      console.log(`\n✅ Mixed types (replies + singles/threads)`);
    }
  }
  
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('✅ Audit complete');
  console.log('═══════════════════════════════════════════════════════════\n');
}

auditDatabase().catch(console.error);


