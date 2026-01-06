/**
 * 🔍 POSTING SYSTEM FAILURE VALIDATION
 * 
 * Validates actual failure modes by querying database and checking logs
 * Run this to prove what's actually happening before implementing fixes
 */

import { getSupabaseClient } from '../src/db/index';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

interface FailureStats {
  duplicatePosts: number;
  phantomFailures: number;
  databaseSaveFailures: number;
  stuckPosts: number;
  verificationFailures: number;
}

async function validatePostingFailures(): Promise<void> {
  console.log('🔍 POSTING SYSTEM FAILURE VALIDATION\n');
  console.log('═'.repeat(60));
  
  const supabase = getSupabaseClient();
  const stats: FailureStats = {
    duplicatePosts: 0,
    phantomFailures: 0,
    databaseSaveFailures: 0,
    stuckPosts: 0,
    verificationFailures: 0
  };
  
  // 1. Check for duplicate posts
  console.log('\n📊 1. CHECKING FOR DUPLICATE POSTS...');
  const { data: duplicates } = await supabase
    .from('content_metadata')
    .select('content, tweet_id, status, posted_at, decision_id')
    .not('content', 'is', null)
    .order('created_at', { ascending: false })
    .limit(100);
  
  if (duplicates) {
    const contentMap = new Map<string, number>();
    duplicates.forEach(post => {
      const content = post.content || '';
      const count = contentMap.get(content) || 0;
      contentMap.set(content, count + 1);
    });
    
    const actualDuplicates = Array.from(contentMap.entries())
      .filter(([_, count]) => count > 1)
      .map(([content, count]) => ({ content, count }));
    
    stats.duplicatePosts = actualDuplicates.length;
    console.log(`   Found ${actualDuplicates.length} duplicate content entries`);
    if (actualDuplicates.length > 0) {
      console.log('   Examples:');
      actualDuplicates.slice(0, 3).forEach(dup => {
        console.log(`   - "${dup.content.substring(0, 60)}..." (${dup.count} times)`);
      });
    }
  }
  
  // 2. Check for phantom failures (failed status but tweet_id exists)
  console.log('\n📊 2. CHECKING FOR PHANTOM FAILURES...');
  const { data: phantomFailures } = await supabase
    .from('content_metadata')
    .select('decision_id, content, tweet_id, status, error_message, created_at')
    .eq('status', 'failed')
    .not('tweet_id', 'is', null)
    .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());
  
  if (phantomFailures) {
    stats.phantomFailures = phantomFailures.length;
    console.log(`   Found ${phantomFailures.length} posts marked as failed but have tweet_id`);
    if (phantomFailures.length > 0) {
      console.log('   Examples:');
      phantomFailures.slice(0, 3).forEach(post => {
        console.log(`   - Decision: ${post.decision_id.substring(0, 8)}..., Tweet ID: ${post.tweet_id}`);
        console.log(`     Error: ${post.error_message?.substring(0, 60) || 'No error message'}`);
      });
    }
  }
  
  // 3. Check for database save failures (retry queue)
  console.log('\n📊 3. CHECKING FOR DATABASE SAVE FAILURES...');
  const retryQueueFile = join(process.cwd(), 'logs', 'db_retry_queue.jsonl');
  if (existsSync(retryQueueFile)) {
    const fileContent = readFileSync(retryQueueFile, 'utf-8');
    const lines = fileContent.trim().split('\n').filter(line => line.trim());
    stats.databaseSaveFailures = lines.length;
    console.log(`   Found ${lines.length} entries in retry queue`);
    if (lines.length > 0) {
      console.log('   Examples:');
      lines.slice(0, 3).forEach((line, i) => {
        try {
          const entry = JSON.parse(line);
          console.log(`   - Entry ${i + 1}: Decision ${entry.decisionId?.substring(0, 8)}..., Tweet ${entry.tweetId}, Retries: ${entry.retryCount}`);
        } catch (e) {
          console.log(`   - Entry ${i + 1}: Parse error`);
        }
      });
    }
  } else {
    console.log('   No retry queue file found (good - no pending failures)');
  }
  
  // 4. Check for stuck posts
  console.log('\n📊 4. CHECKING FOR STUCK POSTS...');
  const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const { data: stuckPosts } = await supabase
    .from('content_metadata')
    .select('decision_id, decision_type, created_at, status, content')
    .eq('status', 'posting')
    .lt('created_at', fifteenMinAgo);
  
  if (stuckPosts) {
    stats.stuckPosts = stuckPosts.length;
    console.log(`   Found ${stuckPosts.length} posts stuck in 'posting' status >15 minutes`);
    if (stuckPosts.length > 0) {
      console.log('   Examples:');
      stuckPosts.slice(0, 3).forEach(post => {
        const minutesStuck = Math.round((Date.now() - new Date(String(post.created_at)).getTime()) / (1000 * 60));
        console.log(`   - Decision: ${post.decision_id.substring(0, 8)}..., Stuck: ${minutesStuck} minutes`);
        console.log(`     Content: "${post.content?.substring(0, 60)}..."`);
      });
    }
  }
  
  // 5. Check for verification failures (failed posts with timeout errors)
  console.log('\n📊 5. CHECKING FOR VERIFICATION FAILURES...');
  const { data: verificationFailures } = await supabase
    .from('content_metadata')
    .select('decision_id, error_message, status, created_at')
    .eq('status', 'failed')
    .or('error_message.ilike.%timeout%,error_message.ilike.%verification%')
    .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());
  
  if (verificationFailures) {
    stats.verificationFailures = verificationFailures.length;
    console.log(`   Found ${verificationFailures.length} posts with timeout/verification errors`);
    if (verificationFailures.length > 0) {
      console.log('   Examples:');
      verificationFailures.slice(0, 3).forEach(post => {
        console.log(`   - Decision: ${post.decision_id.substring(0, 8)}...`);
        console.log(`     Error: ${post.error_message?.substring(0, 80) || 'No error message'}`);
      });
    }
  }
  
  // 6. Overall posting statistics
  console.log('\n📊 6. OVERALL POSTING STATISTICS...');
  const { data: recentPosts } = await supabase
    .from('content_metadata')
    .select('status, tweet_id, created_at')
    .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());
  
  if (recentPosts) {
    const total = recentPosts.length;
    const posted = recentPosts.filter(p => p.status === 'posted' && p.tweet_id).length;
    const failed = recentPosts.filter(p => p.status === 'failed').length;
    const queued = recentPosts.filter(p => p.status === 'queued').length;
    const posting = recentPosts.filter(p => p.status === 'posting').length;
    
    const successRate = total > 0 ? (posted / total * 100).toFixed(1) : '0.0';
    
    console.log(`   Total posts (last 7 days): ${total}`);
    console.log(`   Posted: ${posted} (${successRate}%)`);
    console.log(`   Failed: ${failed}`);
    console.log(`   Queued: ${queued}`);
    console.log(`   Posting: ${posting}`);
  }
  
  // Summary
  console.log('\n' + '═'.repeat(60));
  console.log('📋 SUMMARY OF FAILURE MODES:\n');
  console.log(`   Duplicate Posts: ${stats.duplicatePosts}`);
  console.log(`   Phantom Failures: ${stats.phantomFailures}`);
  console.log(`   Database Save Failures: ${stats.databaseSaveFailures}`);
  console.log(`   Stuck Posts: ${stats.stuckPosts}`);
  console.log(`   Verification Failures: ${stats.verificationFailures}`);
  
  const totalIssues = Object.values(stats).reduce((sum, val) => sum + val, 0);
  console.log(`\n   Total Issues Found: ${totalIssues}`);
  
  if (totalIssues === 0) {
    console.log('\n✅ No issues found! System appears healthy.');
  } else {
    console.log('\n⚠️ Issues detected. Review details above.');
  }
  
  console.log('\n' + '═'.repeat(60));
}

// Run validation
validatePostingFailures()
  .then(() => {
    console.log('\n✅ Validation complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Validation failed:', error);
    process.exit(1);
  });




