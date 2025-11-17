/**
 * Check for duplicate posts in the system
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db/index';

async function main() {
  const supabase = getSupabaseClient();
  
  console.log('🔍 Checking for duplicate posts...\n');
  
  // Get last 50 posts
  const { data: recentPosts, error: postsError } = await supabase
    .from('content_metadata')
    .select('decision_id, content, status, posted_at, tweet_id, decision_type')
    .in('status', ['posted', 'posting'])
    .order('posted_at', { ascending: false })
    .limit(50);
  
  if (postsError) {
    console.error('❌ Error fetching posts:', postsError.message);
    process.exit(1);
  }
  
  if (!recentPosts || recentPosts.length === 0) {
    console.log('📭 No recent posts found');
    process.exit(0);
  }
  
  console.log(`📊 Found ${recentPosts.length} recent posts\n`);
  
  // Check for duplicate content
  const contentMap = new Map<string, { decision_id: string; posted_at: string; tweet_id: string | null }[]>();
  
  recentPosts.forEach((post: any) => {
    if (!post.content) return;
    
    // Normalize content (lowercase, trim whitespace)
    const normalized = post.content.toLowerCase().trim().replace(/\s+/g, ' ');
    
    if (!contentMap.has(normalized)) {
      contentMap.set(normalized, []);
    }
    
    contentMap.get(normalized)!.push({
      decision_id: post.decision_id,
      posted_at: post.posted_at || 'N/A',
      tweet_id: post.tweet_id || null
    });
  });
  
  // Find duplicates
  const duplicates: Array<{ content: string; posts: typeof recentPosts }> = [];
  
  contentMap.forEach((posts, content) => {
    if (posts.length > 1) {
      // Check if they were posted close together (within 1 hour)
      const sortedPosts = posts.sort((a, b) => 
        new Date(a.posted_at).getTime() - new Date(b.posted_at).getTime()
      );
      
      const firstPost = sortedPosts[0];
      const duplicatePosts = sortedPosts.slice(1);
      
      // Check if any duplicates were posted within 1 hour
      const oneHourAgo = Date.now() - (60 * 60 * 1000);
      const recentDuplicates = duplicatePosts.filter(p => {
        const postedTime = new Date(p.posted_at).getTime();
        return postedTime > oneHourAgo;
      });
      
      if (recentDuplicates.length > 0) {
        duplicates.push({
          content: content.substring(0, 100) + (content.length > 100 ? '...' : ''),
          posts: [firstPost, ...recentDuplicates] as any
        });
      }
    }
  });
  
  // Check posted_decisions for duplicate decision_ids
  const { data: postedDecisions, error: decisionsError } = await supabase
    .from('posted_decisions')
    .select('decision_id, tweet_id, posted_at, content')
    .order('posted_at', { ascending: false })
    .limit(100);
  
  if (decisionsError) {
    console.warn('⚠️ Error fetching posted_decisions:', decisionsError.message);
  }
  
  const decisionIdMap = new Map<string, number>();
  (postedDecisions || []).forEach((pd: any) => {
    const count = decisionIdMap.get(pd.decision_id) || 0;
    decisionIdMap.set(pd.decision_id, count + 1);
  });
  
  const duplicateDecisionIds = Array.from(decisionIdMap.entries())
    .filter(([_, count]) => count > 1)
    .map(([decision_id, count]) => ({ decision_id, count }));
  
  // Report findings
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📋 DUPLICATE CHECK RESULTS');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  if (duplicates.length > 0) {
    console.log(`🚨 FOUND ${duplicates.length} DUPLICATE CONTENT:\n`);
    duplicates.forEach((dup, idx) => {
      console.log(`${idx + 1}. Content: "${dup.content}"`);
      console.log(`   Posted ${dup.posts.length} times:`);
      dup.posts.forEach((p: any, i: number) => {
        console.log(`      ${i + 1}. Decision: ${p.decision_id}`);
        console.log(`         Posted: ${p.posted_at}`);
        console.log(`         Tweet ID: ${p.tweet_id || 'NULL'}`);
      });
      console.log('');
    });
  } else {
    console.log('✅ No duplicate content found\n');
  }
  
  if (duplicateDecisionIds.length > 0) {
    console.log(`🚨 FOUND ${duplicateDecisionIds.length} DUPLICATE DECISION IDs in posted_decisions:\n`);
    duplicateDecisionIds.forEach((dup, idx) => {
      console.log(`${idx + 1}. Decision ID: ${dup.decision_id}`);
      console.log(`   Appears ${dup.count} times in posted_decisions`);
      
      const matching = (postedDecisions || []).filter((pd: any) => pd.decision_id === dup.decision_id);
      matching.forEach((m: any, i: number) => {
        console.log(`      ${i + 1}. Tweet ID: ${m.tweet_id || 'NULL'}`);
        console.log(`         Posted: ${m.posted_at}`);
      });
      console.log('');
    });
  } else {
    console.log('✅ No duplicate decision_ids in posted_decisions\n');
  }
  
  // Show recent posts summary
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📊 RECENT POSTS SUMMARY (Last 10)');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  recentPosts.slice(0, 10).forEach((post: any, idx: number) => {
    console.log(`${idx + 1}. ${post.decision_type.toUpperCase()}`);
    console.log(`   Decision ID: ${post.decision_id}`);
    console.log(`   Status: ${post.status}`);
    console.log(`   Posted: ${post.posted_at || 'N/A'}`);
    console.log(`   Tweet ID: ${post.tweet_id || 'NULL'}`);
    console.log(`   Content: "${(post.content || '').substring(0, 80)}${post.content && post.content.length > 80 ? '...' : ''}"`);
    console.log('');
  });
  
  process.exit(0);
}

main().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});

