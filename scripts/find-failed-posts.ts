/**
 * 🔍 FIND POSTS WITH MISSING TWEET IDs
 * Finds posts marked as 'posted' but missing tweet_id
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

async function findFailedPosts() {
  try {
    const { getSupabaseClient } = await import('../src/db/index');
    const supabase = getSupabaseClient();
    
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('🔍 FINDING POSTS WITH MISSING TWEET IDs');
    console.log('═══════════════════════════════════════════════════════════\n');

    // Find posts with status='posted' but no tweet_id
    const { data: failedPosts, error } = await supabase
      .from('content_metadata')
      .select(`
        decision_id,
        decision_type,
        status,
        content,
        thread_parts,
        posted_at,
        created_at,
        tweet_id,
        actual_impressions,
        actual_likes,
        features
      `)
      .eq('status', 'posted')
      .is('tweet_id', null)
      .order('posted_at', { ascending: false });

    if (error) {
      console.error(`❌ Error: ${error.message}`);
      return;
    }

    if (!failedPosts || failedPosts.length === 0) {
      console.log('✅ No posts found with missing tweet_id!');
      return;
    }

    console.log(`⚠️  Found ${failedPosts.length} posts marked as 'posted' but missing tweet_id:\n`);

    failedPosts.forEach((post: any, idx: number) => {
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`POST #${idx + 1}: ${post.decision_type.toUpperCase()}`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`Decision ID: ${post.decision_id}`);
      console.log(`Status: ${post.status}`);
      console.log(`Posted at: ${post.posted_at || 'MISSING'}`);
      console.log(`Created at: ${post.created_at || 'MISSING'}`);
      console.log(`Tweet ID: ${post.tweet_id || '❌ MISSING'}`);
      console.log(`Views: ${post.actual_impressions || 0}`);
      console.log(`Likes: ${post.actual_likes || 0}`);
      
      const features = post.features || {};
      if (features.last_error) {
        console.log(`Last error: ${features.last_error}`);
      }
      if (features.retry_count) {
        console.log(`Retry count: ${features.retry_count}`);
      }
      
      if (post.decision_type === 'thread' && post.thread_parts) {
        const parts = Array.isArray(post.thread_parts) ? post.thread_parts : [];
        console.log(`\nThread Content (${parts.length} parts):`);
        parts.forEach((part: string, i: number) => {
          console.log(`  ${i + 1}. [${part.length} chars] "${part.substring(0, 80)}${part.length > 80 ? '...' : ''}"`);
        });
      } else {
        console.log(`\nContent [${post.content?.length || 0} chars]:`);
        console.log(`  "${post.content?.substring(0, 150)}${(post.content?.length || 0) > 150 ? '...' : ''}"`);
      }
      
      console.log('');
    });

    // Check if they exist in posted_decisions
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('🔍 CHECKING posted_decisions TABLE');
    console.log('═══════════════════════════════════════════════════════════\n');

    for (const post of failedPosts) {
      const { data: postedDecision } = await supabase
        .from('posted_decisions')
        .select('tweet_id, posted_at')
        .eq('decision_id', post.decision_id)
        .single();

      if (postedDecision) {
        console.log(`✅ Found in posted_decisions: ${post.decision_id} → tweet_id: ${postedDecision.tweet_id}`);
        
        // Offer to fix
        if (postedDecision.tweet_id && postedDecision.tweet_id !== 'unknown' && !postedDecision.tweet_id.startsWith('posted_')) {
          console.log(`   🔧 Would update content_metadata with tweet_id: ${postedDecision.tweet_id}`);
        }
      } else {
        console.log(`❌ NOT found in posted_decisions: ${post.decision_id}`);
      }
    }

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('✅ Analysis complete');
    console.log('═══════════════════════════════════════════════════════════\n');

  } catch (error: any) {
    console.error('❌ Fatal error:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
  }
}

findFailedPosts().catch(console.error);

