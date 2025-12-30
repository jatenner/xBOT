#!/usr/bin/env tsx
/**
 * ANALYZE POSTING ISSUES
 * Deep dive into why posts aren't being saved properly
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function analyze() {
  console.log('🔍 POSTING ISSUES DEEP ANALYSIS\n');
  console.log('='.repeat(80));
  
  // Issue 1: Posts missing receipts
  console.log('\n1️⃣  POSTS WITHOUT RECEIPTS (Last 24h)\n');
  
  const { data: postsWithoutReceipts } = await supabase
    .from('content_metadata')
    .select('decision_id, tweet_id, posted_at, status')
    .eq('status', 'posted')
    .not('tweet_id', 'is', null)
    .gte('posted_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .order('posted_at', { ascending: false });
  
  if (postsWithoutReceipts) {
    for (const post of postsWithoutReceipts) {
      // Check if receipt exists
      const { data: receipt } = await supabase
        .from('post_receipts')
        .select('receipt_id')
        .eq('root_tweet_id', post.tweet_id)
        .maybeSingle();
      
      if (!receipt) {
        const minAgo = Math.floor((Date.now() - new Date(post.posted_at).getTime()) / 60000);
        console.log(`   ❌ MISSING RECEIPT:`);
        console.log(`      Tweet: ${post.tweet_id}`);
        console.log(`      Posted: ${minAgo}min ago`);
        console.log(`      Decision: ${post.decision_id}`);
      }
    }
  }
  
  // Issue 2: Receipts not synced to metadata
  console.log('\n\n2️⃣  RECEIPTS NOT SYNCED TO METADATA (Orphans)\n');
  
  const { data: orphanReceipts } = await supabase
    .from('post_receipts')
    .select('receipt_id, root_tweet_id, posted_at, decision_id')
    .gte('posted_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .order('posted_at', { ascending: false });
  
  if (orphanReceipts) {
    for (const receipt of orphanReceipts) {
      // Check if in metadata
      const { data: metadata } = await supabase
        .from('content_metadata')
        .select('decision_id')
        .eq('tweet_id', receipt.root_tweet_id)
        .maybeSingle();
      
      if (!metadata) {
        const minAgo = Math.floor((Date.now() - new Date(receipt.posted_at).getTime()) / 60000);
        console.log(`   ⚠️  ORPHAN RECEIPT:`);
        console.log(`      Receipt ID: ${receipt.receipt_id}`);
        console.log(`      Tweet: ${receipt.root_tweet_id}`);
        console.log(`      Posted: ${minAgo}min ago`);
        console.log(`      Decision ID: ${receipt.decision_id || 'NULL'}`);
      }
    }
  }
  
  // Issue 3: Content in posting state
  console.log('\n\n3️⃣  STUCK IN POSTING STATE\n');
  
  const { data: stuckPosts } = await supabase
    .from('content_metadata')
    .select('decision_id, status, scheduled_at, created_at')
    .eq('status', 'posting')
    .order('created_at', { ascending: false })
    .limit(10);
  
  if (stuckPosts && stuckPosts.length > 0) {
    console.log(`   Found ${stuckPosts.length} stuck posts:`);
    stuckPosts.forEach((post: any) => {
      const minAgo = Math.floor((Date.now() - new Date(post.created_at).getTime()) / 60000);
      console.log(`      - ${post.decision_id} (stuck for ${minAgo}min)`);
    });
  } else {
    console.log(`   ✅ No stuck posts`);
  }
  
  // Issue 4: Failed posts
  console.log('\n\n4️⃣  RECENT FAILURES (Last 24h)\n');
  
  const { data: failedPosts } = await supabase
    .from('content_metadata')
    .select('decision_id, status, created_at')
    .in('status', ['failed', 'failed_permanent'])
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .order('created_at', { ascending: false })
    .limit(10);
  
  if (failedPosts && failedPosts.length > 0) {
    console.log(`   Found ${failedPosts.length} failed posts:`);
    failedPosts.forEach((post: any) => {
      const minAgo = Math.floor((Date.now() - new Date(post.created_at).getTime()) / 60000);
      console.log(`      - ${post.decision_id} (${post.status}, ${minAgo}min ago)`);
    });
  } else {
    console.log(`   ✅ No recent failures`);
  }
  
  // Issue 5: Rate analysis
  console.log('\n\n5️⃣  POSTING RATE ANALYSIS (Last 3 hours)\n');
  
  const { data: recentPosts } = await supabase
    .from('content_metadata')
    .select('posted_at, decision_type')
    .eq('status', 'posted')
    .gte('posted_at', new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString())
    .order('posted_at', { ascending: true });
  
  if (recentPosts && recentPosts.length > 0) {
    const byHour: { [key: string]: number } = {};
    recentPosts.forEach((post: any) => {
      const hour = new Date(post.posted_at).toISOString().substring(0, 13);
      byHour[hour] = (byHour[hour] || 0) + 1;
    });
    
    console.log(`   Total posts: ${recentPosts.length}`);
    console.log(`   By hour:`);
    Object.entries(byHour)
      .sort(([a], [b]) => b.localeCompare(a))
      .forEach(([hour, count]) => {
        const isOverLimit = count > 2;
        console.log(`      ${hour}: ${count} posts ${isOverLimit ? '⚠️  OVER LIMIT' : ''}`);
      });
  } else {
    console.log(`   ⚠️  No posts in last 3 hours`);
  }
  
  console.log('\n' + '='.repeat(80));
}

analyze().catch(console.error);

