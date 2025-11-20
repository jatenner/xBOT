/**
 * 🔍 CHECK LATEST POSTS - Direct Database Query
 * Finds the latest 2 POSTS (singles/threads) vs replies
 */

import { getSupabaseClient } from './src/db/index';

async function checkLatestPosts() {
  const supabase = getSupabaseClient();
  
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('🔍 CHECKING LATEST POSTS IN DATABASE');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    // Get latest 2 POSTS (singles/threads, NOT replies)
    console.log('📝 LATEST 2 POSTS (singles/threads):');
    console.log('─────────────────────────────────────────────────────────');
    
    const { data: latestPosts, error: postsError } = await supabase
      .from('content_metadata')
      .select('decision_id, decision_type, status, content, posted_at, created_at, tweet_id, actual_impressions, actual_likes, target_tweet_id, target_username')
      .in('decision_type', ['single', 'thread'])
      .eq('status', 'posted')
      .order('posted_at', { ascending: false })
      .limit(2);
    
    if (postsError) {
      console.log(`❌ Error: ${postsError.message}`);
    } else {
      if (!latestPosts || latestPosts.length === 0) {
        console.log('⚠️  NO POSTS FOUND! All items might be replies.');
      } else {
        latestPosts.forEach((post: any, idx: number) => {
          console.log(`\n${idx + 1}. ${post.decision_type.toUpperCase()}:`);
          console.log(`   • Decision ID: ${post.decision_id}`);
          console.log(`   • Status: ${post.status}`);
          console.log(`   • Posted at: ${post.posted_at || 'MISSING ⚠️'}`);
          console.log(`   • Created at: ${post.created_at || 'MISSING ⚠️'}`);
          console.log(`   • Tweet ID: ${post.tweet_id || 'MISSING ⚠️'}`);
          console.log(`   • Content: ${(post.content || '').substring(0, 100)}...`);
          console.log(`   • Views: ${post.actual_impressions || 0}`);
          console.log(`   • Likes: ${post.actual_likes || 0}`);
          if (post.target_tweet_id) {
            console.log(`   ⚠️  HAS target_tweet_id (shouldn't for posts!): ${post.target_tweet_id}`);
          }
        });
      }
    }

    // Get latest 5 items overall (to see what's actually in DB)
    console.log('\n\n📊 LATEST 5 ITEMS OVERALL (any type):');
    console.log('─────────────────────────────────────────────────────────');
    
    const { data: latestAll, error: allError } = await supabase
      .from('content_metadata')
      .select('decision_id, decision_type, status, content, posted_at, created_at, tweet_id, target_tweet_id, target_username')
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (allError) {
      console.log(`❌ Error: ${allError.message}`);
    } else {
      (latestAll || []).forEach((item: any, idx: number) => {
        console.log(`\n${idx + 1}. ${(item.decision_type || 'NULL').toUpperCase()}:`);
        console.log(`   • Status: ${item.status || 'NULL'}`);
        console.log(`   • Posted at: ${item.posted_at || 'MISSING'}`);
        console.log(`   • Created at: ${item.created_at || 'MISSING'}`);
        console.log(`   • Tweet ID: ${item.tweet_id || 'MISSING'}`);
        console.log(`   • Content: ${(item.content || '').substring(0, 80)}...`);
        if (item.target_tweet_id) {
          console.log(`   • Target: @${item.target_username || 'unknown'} (${item.target_tweet_id})`);
        }
      });
    }

    // Count by type
    console.log('\n\n📈 COUNT BY TYPE:');
    console.log('─────────────────────────────────────────────────────────');
    
    const { data: allData, error: countError } = await supabase
      .from('content_metadata')
      .select('decision_type, status')
      .limit(1000);
    
    if (countError) {
      console.log(`❌ Error: ${countError.message}`);
    } else {
      const counts = (allData || []).reduce((acc: any, item: any) => {
        const type = item.decision_type || 'NULL';
        const status = item.status || 'NULL';
        if (!acc[type]) acc[type] = {};
        if (!acc[type][status]) acc[type][status] = 0;
        acc[type][status]++;
        return acc;
      }, {});
      
      Object.entries(counts).forEach(([type, statuses]: [string, any]) => {
        console.log(`\n${type.toUpperCase()}:`);
        Object.entries(statuses).forEach(([status, count]: [string, any]) => {
          console.log(`  • ${status}: ${count}`);
        });
      });
    }

    // Check for data corruption
    console.log('\n\n🚨 DATA INTEGRITY CHECK:');
    console.log('─────────────────────────────────────────────────────────');
    
    const { data: integrity, error: integrityError } = await supabase
      .from('content_metadata')
      .select('decision_id, decision_type, status, target_tweet_id')
      .limit(200);
    
    if (integrityError) {
      console.log(`❌ Error: ${integrityError.message}`);
    } else {
      const singlesWithTarget = (integrity || []).filter((item: any) => 
        item.decision_type === 'single' && item.target_tweet_id
      );
      const repliesWithoutTarget = (integrity || []).filter((item: any) => 
        item.decision_type === 'reply' && !item.target_tweet_id
      );
      const invalidTypes = (integrity || []).filter((item: any) => 
        item.decision_type && !['single', 'thread', 'reply'].includes(item.decision_type)
      );
      
      console.log(`\nIssues found:`);
      console.log(`  • Singles with target_tweet_id: ${singlesWithTarget.length} ${singlesWithTarget.length > 0 ? '⚠️' : ''}`);
      console.log(`  • Replies without target_tweet_id: ${repliesWithoutTarget.length} ${repliesWithoutTarget.length > 0 ? '⚠️' : ''}`);
      console.log(`  • Invalid decision_type values: ${invalidTypes.length} ${invalidTypes.length > 0 ? '⚠️' : ''}`);
      
      if (singlesWithTarget.length > 0) {
        console.log(`\n  Examples of singles with target (CORRUPTED):`);
        singlesWithTarget.slice(0, 3).forEach((item: any) => {
          console.log(`    - ${item.decision_id}: single with target ${item.target_tweet_id}`);
        });
      }
    }

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('✅ Check complete');
    console.log('═══════════════════════════════════════════════════════════\n');

  } catch (error: any) {
    console.error('❌ Fatal error:', error.message);
    console.error(error.stack);
  }
}

checkLatestPosts().catch(console.error);

