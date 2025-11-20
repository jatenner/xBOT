/**
 * Verify tweet attribution - check if database content matches actual Twitter content
 * This will help identify misattribution issues
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.join(__dirname, '../.env') });

async function verifyTweetAttribution() {
  try {
    const { getSupabaseClient } = await import('../src/db/index');
    const supabase = getSupabaseClient();

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('🔍 VERIFYING TWEET ATTRIBUTION (Database vs Reality)');
    console.log('═══════════════════════════════════════════════════════════\n');

    // Get recent posts with tweet_ids
    const { data: posts, error } = await supabase
      .from('content_metadata')
      .select('decision_id, decision_type, content, thread_parts, generator_name, tweet_id, actual_impressions, posted_at, status')
      .eq('status', 'posted')
      .not('tweet_id', 'is', null)
      .in('decision_type', ['single', 'thread']) // Only actual posts, not replies
      .order('posted_at', { ascending: false })
      .limit(20);

    if (error) {
      console.error(`❌ Error querying posts: ${error.message}`);
      return;
    }

    if (!posts || posts.length === 0) {
      console.log('✅ No posts found with tweet_ids.');
      return;
    }

    console.log(`📊 Found ${posts.length} posts with tweet_ids to verify:\n`);

    for (const post of posts) {
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`POST: ${post.decision_type.toUpperCase()}`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`Decision ID: ${post.decision_id}`);
      console.log(`Generator: ${post.generator_name || 'UNKNOWN'}`);
      console.log(`Tweet ID: ${post.tweet_id}`);
      console.log(`Posted At: ${post.posted_at}`);
      console.log(`Views: ${post.actual_impressions || 0}`);
      
      // Show what's stored in database
      console.log(`\n📝 DATABASE STORED CONTENT:`);
      if (post.decision_type === 'thread' && post.thread_parts && Array.isArray(post.thread_parts)) {
        post.thread_parts.forEach((part: string, i: number) => {
          const preview = part.substring(0, 80).replace(/\n/g, ' ');
          console.log(`  Tweet ${i + 1}: "${preview}${part.length > 80 ? '...' : ''}"`);
        });
      } else {
        const preview = (post.content || '').substring(0, 150).replace(/\n/g, ' ');
        console.log(`  "${preview}${(post.content || '').length > 150 ? '...' : ''}"`);
      }
      
      console.log(`\n🔗 Twitter Link: https://twitter.com/i/web/status/${post.tweet_id}`);
      console.log(`   👆 MANUALLY VERIFY: Does the content on Twitter match what's in the database?`);
      console.log('');
    }

    // Also check for suspiciously high view counts on posts
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('⚠️  POTENTIAL MISATTRIBUTION FLAGS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const { data: highViews } = await supabase
      .from('content_metadata')
      .select('decision_id, decision_type, content, tweet_id, actual_impressions, generator_name')
      .eq('status', 'posted')
      .in('decision_type', ['single', 'thread'])
      .not('actual_impressions', 'is', null)
      .gt('actual_impressions', 1000) // Posts with >1000 views (suspicious for posts)
      .order('actual_impressions', { ascending: false });

    if (highViews && highViews.length > 0) {
      console.log(`🚨 Found ${highViews.length} posts with >1000 views (suspicious - should verify):\n`);
      highViews.forEach((p: any) => {
        console.log(`  ⚠️  Tweet ID: ${p.tweet_id}`);
        console.log(`     Views: ${p.actual_impressions}`);
        console.log(`     Content preview: "${(p.content || '').substring(0, 60)}..."`);
        console.log(`     Link: https://twitter.com/i/web/status/${p.tweet_id}`);
        console.log('');
      });
    } else {
      console.log('✅ No posts with >1000 views found.');
    }

    // Check posted_decisions table for comparison
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔍 CHECKING posted_decisions TABLE');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    for (const post of posts.slice(0, 5)) { // Check first 5
      const { data: postedDecision } = await supabase
        .from('posted_decisions')
        .select('tweet_id, posted_at, content')
        .eq('decision_id', post.decision_id)
        .single();

      if (postedDecision) {
        console.log(`Decision ID: ${post.decision_id}`);
        console.log(`  content_metadata.tweet_id: ${post.tweet_id}`);
        console.log(`  posted_decisions.tweet_id: ${postedDecision.tweet_id}`);
        if (post.tweet_id !== postedDecision.tweet_id) {
          console.log(`  ⚠️  MISMATCH! Tweet IDs don't match!`);
        }
        if (postedDecision.content) {
          const preview = postedDecision.content.substring(0, 60).replace(/\n/g, ' ');
          console.log(`  posted_decisions.content: "${preview}..."`);
        }
        console.log('');
      }
    }

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('✅ Verification complete');
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log('📋 ACTION ITEMS:');
    console.log('  1. Manually check the Twitter links above');
    console.log('  2. Verify if database content matches Twitter content');
    console.log('  3. Report any mismatches - this indicates a serious bug!');
    console.log('');

  } catch (error: any) {
    console.error('❌ Fatal error:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
  }
}

verifyTweetAttribution().catch(console.error);

