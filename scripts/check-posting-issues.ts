/**
 * Check for posting issues: stuck posts, missing tweet IDs, etc.
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db/index';

async function main() {
  const supabase = getSupabaseClient();
  
  console.log('🔍 Checking for posting issues...\n');
  
  // Check for stuck 'posting' status
  const { data: stuckPosts, error: stuckError } = await supabase
    .from('content_metadata')
    .select('decision_id, content, status, scheduled_at, posted_at, tweet_id, decision_type')
    .eq('status', 'posting')
    .order('scheduled_at', { ascending: false });
  
  // Check for posted but no tweet_id
  const { data: missingTweetIds, error: missingError } = await supabase
    .from('content_metadata')
    .select('decision_id, content, status, posted_at, tweet_id, decision_type')
    .eq('status', 'posted')
    .is('tweet_id', null)
    .order('posted_at', { ascending: false })
    .limit(20);
  
  // Check for duplicate content (exact matches)
  const { data: allRecent, error: allError } = await supabase
    .from('content_metadata')
    .select('decision_id, content, posted_at, tweet_id')
    .eq('status', 'posted')
    .not('content', 'is', null)
    .order('posted_at', { ascending: false })
    .limit(100);
  
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📋 POSTING ISSUES CHECK');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  // Stuck posts
  if (stuckPosts && stuckPosts.length > 0) {
    console.log(`🚨 FOUND ${stuckPosts.length} STUCK POSTS (status: 'posting'):\n`);
    stuckPosts.forEach((post: any, idx: number) => {
      const age = post.scheduled_at 
        ? Math.round((Date.now() - new Date(post.scheduled_at).getTime()) / (1000 * 60))
        : 'N/A';
      console.log(`${idx + 1}. Decision: ${post.decision_id}`);
      console.log(`   Type: ${post.decision_type}`);
      console.log(`   Scheduled: ${post.scheduled_at} (${age} minutes ago)`);
      console.log(`   Content: "${(post.content || '').substring(0, 60)}..."`);
      console.log('');
    });
  } else {
    console.log('✅ No stuck posts (status: posting)\n');
  }
  
  // Missing tweet IDs
  if (missingTweetIds && missingTweetIds.length > 0) {
    console.log(`⚠️ FOUND ${missingTweetIds.length} POSTED BUT MISSING TWEET IDs:\n`);
    missingTweetIds.forEach((post: any, idx: number) => {
      const age = post.posted_at 
        ? Math.round((Date.now() - new Date(post.posted_at).getTime()) / (1000 * 60))
        : 'N/A';
      console.log(`${idx + 1}. Decision: ${post.decision_id}`);
      console.log(`   Type: ${post.decision_type}`);
      console.log(`   Posted: ${post.posted_at} (${age} minutes ago)`);
      console.log(`   Content: "${(post.content || '').substring(0, 60)}..."`);
      console.log('');
    });
  } else {
    console.log('✅ No missing tweet IDs\n');
  }
  
  // Check for exact duplicate content
  if (allRecent && allRecent.length > 0) {
    const contentMap = new Map<string, typeof allRecent>();
    
    allRecent.forEach((post: any) => {
      if (!post.content) return;
      const normalized = post.content.trim();
      
      if (!contentMap.has(normalized)) {
        contentMap.set(normalized, []);
      }
      contentMap.get(normalized)!.push(post);
    });
    
    const exactDuplicates = Array.from(contentMap.entries())
      .filter(([_, posts]) => posts.length > 1)
      .map(([content, posts]) => ({ content, posts }));
    
    if (exactDuplicates.length > 0) {
      console.log(`🚨 FOUND ${exactDuplicates.length} EXACT DUPLICATE CONTENT:\n`);
      exactDuplicates.forEach((dup, idx) => {
        console.log(`${idx + 1}. Content: "${dup.content.substring(0, 80)}..."`);
        console.log(`   Posted ${dup.posts.length} times:`);
        dup.posts.forEach((p: any, i: number) => {
          const age = p.posted_at 
            ? Math.round((Date.now() - new Date(p.posted_at).getTime()) / (1000 * 60))
            : 'N/A';
          console.log(`      ${i + 1}. Decision: ${p.decision_id}`);
          console.log(`         Posted: ${p.posted_at} (${age} min ago)`);
          console.log(`         Tweet ID: ${p.tweet_id || 'NULL'}`);
        });
        console.log('');
      });
    } else {
      console.log('✅ No exact duplicate content found\n');
    }
  }
  
  // Check posted_decisions for duplicates
  const { data: postedDecisions, error: pdError } = await supabase
    .from('posted_decisions')
    .select('decision_id, tweet_id, posted_at, content')
    .order('posted_at', { ascending: false })
    .limit(100);
  
  if (!pdError && postedDecisions) {
    const decisionIdCounts = new Map<string, number>();
    postedDecisions.forEach((pd: any) => {
      const count = decisionIdCounts.get(pd.decision_id) || 0;
      decisionIdCounts.set(pd.decision_id, count + 1);
    });
    
    const duplicateDecisionIds = Array.from(decisionIdCounts.entries())
      .filter(([_, count]) => count > 1)
      .map(([decision_id, count]) => ({ decision_id, count }));
    
    if (duplicateDecisionIds.length > 0) {
      console.log(`🚨 FOUND ${duplicateDecisionIds.length} DUPLICATE DECISION IDs in posted_decisions:\n`);
      duplicateDecisionIds.forEach((dup, idx) => {
        console.log(`${idx + 1}. Decision ID: ${dup.decision_id}`);
        console.log(`   Appears ${dup.count} times`);
        
        const matching = postedDecisions.filter((pd: any) => pd.decision_id === dup.decision_id);
        matching.forEach((m: any, i: number) => {
          console.log(`      ${i + 1}. Tweet ID: ${m.tweet_id || 'NULL'}`);
          console.log(`         Posted: ${m.posted_at}`);
        });
        console.log('');
      });
    } else {
      console.log('✅ No duplicate decision_ids in posted_decisions\n');
    }
  }
  
  process.exit(0);
}

main().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});

