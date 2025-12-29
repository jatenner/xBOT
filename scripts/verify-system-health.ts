import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface VerificationResult {
  category: string;
  status: 'PASS' | 'FAIL' | 'WARNING';
  details: string[];
  counts?: Record<string, number>;
}

async function main() {
  console.log('\n╔════════════════════════════════════════════════════╗');
  console.log('║    xBOT COMPREHENSIVE SYSTEM VERIFICATION         ║');
  console.log('╚════════════════════════════════════════════════════╝\n');
  
  const results: VerificationResult[] = [];
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  
  // ═══════════════════════════════════════════════════════════
  // CHECK 1: POSTING RATE (4 replies/hour target)
  // ═══════════════════════════════════════════════════════════
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('📊 CHECK 1: POSTING RATE\n');
  
  const { data: receipts } = await supabase
    .from('post_receipts')
    .select('receipt_id, post_type, posted_at, root_tweet_id, decision_id')
    .gte('posted_at', oneHourAgo)
    .order('posted_at', { ascending: false });
  
  const singles = receipts?.filter(r => r.post_type === 'single') || [];
  const threads = receipts?.filter(r => r.post_type === 'thread') || [];
  const replies = receipts?.filter(r => r.post_type === 'reply') || [];
  
  console.log(`Singles: ${singles.length} (max: 2/hour)`);
  console.log(`Threads: ${threads.length} (counted in 2/hour limit)`);
  console.log(`Replies: ${replies.length} (target: 4/hour)\n`);
  
  const postCount = singles.length + threads.length;
  const replyCount = replies.length;
  
  let rateStatus: 'PASS' | 'FAIL' | 'WARNING' = 'PASS';
  const rateDetails: string[] = [];
  
  if (postCount > 2) {
    rateStatus = 'FAIL';
    rateDetails.push(`❌ Over post limit: ${postCount}/2`);
    } else {
    rateDetails.push(`✅ Posts within limit: ${postCount}/2`);
  }
  
  if (replyCount < 4) {
    rateStatus = 'WARNING';
    rateDetails.push(`⚠️  Replies under target: ${replyCount}/4 (want 4/hour)`);
  } else if (replyCount === 4) {
    rateDetails.push(`✅ Replies at target: ${replyCount}/4`);
  } else {
    rateDetails.push(`⚠️  Replies over target: ${replyCount}/4`);
  }
  
  results.push({
    category: 'Posting Rate',
    status: rateStatus,
    details: rateDetails,
    counts: { singles: singles.length, threads: threads.length, replies: replyCount }
  });
  
  // ═══════════════════════════════════════════════════════════
  // CHECK 2: TYPE CLASSIFICATION (single/thread/reply correct?)
  // ═══════════════════════════════════════════════════════════
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('🏷️  CHECK 2: TYPE CLASSIFICATION\n');
  
  const { data: cmPosts } = await supabase
    .from('content_metadata')
    .select('decision_id, decision_type, tweet_id, thread_tweet_ids, target_tweet_id, posted_at, status')
    .eq('status', 'posted')
    .gte('posted_at', oneHourAgo)
    .order('posted_at', { ascending: false });
  
  let classificationStatus: 'PASS' | 'FAIL' | 'WARNING' = 'PASS';
  const classificationDetails: string[] = [];
  const mismatches: string[] = [];
  
  for (const post of cmPosts || []) {
    // Find matching receipt
    const receipt = receipts?.find(r => r.decision_id === post.decision_id);
    
    if (receipt) {
      // Check if type matches
      const cmType = post.decision_type;
      const receiptType = receipt.post_type;
      
      // Validate thread classification
      let threadIds: string[] = [];
      try {
        threadIds = post.thread_tweet_ids ? JSON.parse(post.thread_tweet_ids) : [];
      } catch {}
      
      const actuallyThread = threadIds.length > 1;
      
      if (cmType !== receiptType) {
        mismatches.push(`${post.decision_id.substring(0, 8)}: CM=${cmType} vs Receipt=${receiptType}`);
        classificationStatus = 'FAIL';
      }
      
      if (cmType === 'thread' && !actuallyThread) {
        mismatches.push(`${post.decision_id.substring(0, 8)}: Type=thread but only ${threadIds.length} tweet IDs`);
        classificationStatus = 'FAIL';
      }
      
      if (cmType === 'reply' && !post.target_tweet_id) {
        mismatches.push(`${post.decision_id.substring(0, 8)}: Type=reply but no target_tweet_id`);
        classificationStatus = 'WARNING';
      }
    }
  }
  
  if (mismatches.length === 0) {
    classificationDetails.push(`✅ All types match (${cmPosts?.length || 0} posts checked)`);
  } else {
    classificationDetails.push(`❌ Found ${mismatches.length} mismatches:`);
    mismatches.forEach(m => classificationDetails.push(`   ${m}`));
  }
  
  results.push({
    category: 'Type Classification',
    status: classificationStatus,
    details: classificationDetails
  });
  
  // ═══════════════════════════════════════════════════════════
  // CHECK 3: POSTING SUCCESS (receipt → DB pipeline)
  // ═══════════════════════════════════════════════════════════
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('✅ CHECK 3: POSTING SUCCESS PIPELINE\n');
  
  let pipelineStatus: 'PASS' | 'FAIL' | 'WARNING' = 'PASS';
  const pipelineDetails: string[] = [];
  
  // Check for orphans (receipts without CM entries)
  const orphans: any[] = [];
  for (const receipt of receipts || []) {
    const cmEntry = cmPosts?.find(p => p.decision_id === receipt.decision_id);
    if (!cmEntry) {
      orphans.push(receipt);
    }
  }
  
  if (orphans.length > 0) {
    pipelineStatus = 'FAIL';
    pipelineDetails.push(`❌ Found ${orphans.length} orphan receipts (posted but not in DB):`);
    orphans.slice(0, 3).forEach(o => {
      const ago = Math.round((Date.now() - new Date(o.posted_at).getTime()) / 60000);
      pipelineDetails.push(`   ${o.post_type} - ${ago}m ago - Tweet: ${o.root_tweet_id}`);
    });
  } else {
    pipelineDetails.push(`✅ Zero orphans (all receipts have DB entries)`);
  }
  
  // Check for missing tweet_id
  const missingIds = cmPosts?.filter(p => !p.tweet_id || p.tweet_id === '') || [];
  if (missingIds.length > 0) {
    pipelineStatus = 'FAIL';
    pipelineDetails.push(`❌ Found ${missingIds.length} posts with missing tweet_id`);
  } else {
    pipelineDetails.push(`✅ All posts have tweet_id`);
  }
  
  results.push({
    category: 'Posting Success',
    status: pipelineStatus,
    details: pipelineDetails,
    counts: { orphans: orphans.length, missingIds: missingIds.length }
  });
  
  // ═══════════════════════════════════════════════════════════
  // CHECK 4: TWEET ID INTEGRITY (CM + receipts consistent)
  // ═══════════════════════════════════════════════════════════
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('🔗 CHECK 4: TWEET ID INTEGRITY\n');
  
  let idStatus: 'PASS' | 'FAIL' | 'WARNING' = 'PASS';
  const idDetails: string[] = [];
  const idMismatches: string[] = [];
  
  for (const post of cmPosts || []) {
    const receipt = receipts?.find(r => r.decision_id === post.decision_id);
    
    if (receipt) {
      // Check if tweet IDs match
      if (post.tweet_id !== receipt.root_tweet_id) {
        idMismatches.push(`${post.decision_id.substring(0, 8)}: CM=${post.tweet_id} vs Receipt=${receipt.root_tweet_id}`);
        idStatus = 'FAIL';
      }
      
      // For threads, check thread_tweet_ids
      if (post.decision_type === 'thread') {
        let threadIds: string[] = [];
        try {
          threadIds = post.thread_tweet_ids ? JSON.parse(post.thread_tweet_ids) : [];
        } catch {}
        
        if (threadIds.length < 2) {
          idMismatches.push(`${post.decision_id.substring(0, 8)}: Thread with <2 IDs (${threadIds.length})`);
          idStatus = 'WARNING';
        }
      }
      
      // For replies, check target_tweet_id
      if (post.decision_type === 'reply' && !post.target_tweet_id) {
        idMismatches.push(`${post.decision_id.substring(0, 8)}: Reply missing target_tweet_id`);
        idStatus = 'WARNING';
      }
    }
  }
  
  if (idMismatches.length === 0) {
    idDetails.push(`✅ All tweet IDs consistent (${cmPosts?.length || 0} checked)`);
  } else {
    idDetails.push(`❌ Found ${idMismatches.length} ID issues:`);
    idMismatches.forEach(m => idDetails.push(`   ${m}`));
  }
  
  results.push({
    category: 'Tweet ID Integrity',
    status: idStatus,
    details: idDetails
  });
  
  // ═══════════════════════════════════════════════════════════
  // CHECK 5: METRICS SCRAPING READINESS
  // ═══════════════════════════════════════════════════════════
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('📈 CHECK 5: METRICS SCRAPING READINESS\n');
  
  let metricsStatus: 'PASS' | 'FAIL' | 'WARNING' = 'PASS';
  const metricsDetails: string[] = [];
  
  // Check if posts have required fields for metrics
  const unscrapable: string[] = [];
  
  for (const post of cmPosts || []) {
    if (!post.tweet_id) {
      unscrapable.push(`${post.decision_id.substring(0, 8)}: No tweet_id`);
      continue;
    }
    
    // For threads, need thread_tweet_ids for multi-tweet metrics
    if (post.decision_type === 'thread') {
      let threadIds: string[] = [];
      try {
        threadIds = post.thread_tweet_ids ? JSON.parse(post.thread_tweet_ids) : [];
      } catch {}
      
      if (threadIds.length < 2) {
        unscrapable.push(`${post.decision_id.substring(0, 8)}: Thread missing IDs for scraping`);
      }
    }
    
    // For replies, need target info
    if (post.decision_type === 'reply' && !post.target_tweet_id) {
      unscrapable.push(`${post.decision_id.substring(0, 8)}: Reply missing target_tweet_id`);
    }
  }
  
  if (unscrapable.length > 0) {
    metricsStatus = 'WARNING';
    metricsDetails.push(`⚠️  Found ${unscrapable.length} posts that may not scrape correctly:`);
    unscrapable.forEach(u => metricsDetails.push(`   ${u}`));
  } else {
    metricsDetails.push(`✅ All posts ready for metrics scraping`);
  }
  
  // Check if recent posts have been scraped
  const recentPostsWithMetrics = cmPosts?.filter(p => 
    p.tweet_id && (p as any).actual_likes !== null && (p as any).actual_likes !== undefined
  ).length || 0;
  
  if (recentPostsWithMetrics === 0 && cmPosts && cmPosts.length > 0) {
    metricsDetails.push(`⚠️  No recent posts have metrics yet (scraper may not have run)`);
  } else {
    metricsDetails.push(`✅ ${recentPostsWithMetrics}/${cmPosts?.length || 0} posts have metrics`);
  }
  
  results.push({
    category: 'Metrics Scraping',
    status: metricsStatus,
    details: metricsDetails
  });
  
  // ═══════════════════════════════════════════════════════════
  // FINAL REPORT
  // ═══════════════════════════════════════════════════════════
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('╔════════════════════════════════════════════════════╗');
  console.log('║              VERIFICATION SUMMARY                  ║');
  console.log('╚════════════════════════════════════════════════════╝\n');
  
  results.forEach(result => {
    const icon = result.status === 'PASS' ? '✅' : result.status === 'WARNING' ? '⚠️ ' : '❌';
    console.log(`${icon} ${result.category}: ${result.status}`);
    result.details.forEach(detail => console.log(`   ${detail}`));
    if (result.counts) {
      console.log(`   Counts:`, result.counts);
    }
    console.log('');
  });
  
  // Overall verdict
  const failCount = results.filter(r => r.status === 'FAIL').length;
  const warnCount = results.filter(r => r.status === 'WARNING').length;
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  if (failCount === 0 && warnCount === 0) {
    console.log('🎉 VERDICT: ALL SYSTEMS PASS\n');
    console.log('✅ Posting correctly');
    console.log('✅ Classifying correctly (single/thread/reply)');
    console.log('✅ Saving to Supabase correctly');
    console.log('✅ Tweet IDs captured correctly');
    console.log('✅ Ready for metrics scraping\n');
  } else if (failCount > 0) {
    console.log(`🚨 VERDICT: ${failCount} CRITICAL FAILURE(S)\n`);
    console.log('❌ System has issues that need immediate attention\n');
    process.exit(1);
  } else {
    console.log(`⚠️  VERDICT: ${warnCount} WARNING(S)\n`);
    console.log('⚠️  System working but has minor issues\n');
  }
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main();
