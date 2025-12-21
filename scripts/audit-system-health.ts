#!/usr/bin/env tsx
/**
 * 🔍 COMPREHENSIVE SYSTEM HEALTH AUDIT
 * 
 * DB-only checks - no Railway CLI required
 * Verifies all truth invariants using Supabase service role
 */

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface HealthCheck {
  name: string;
  status: 'PASS' | 'FAIL' | 'WARNING';
  message: string;
  details?: any;
}

const checks: HealthCheck[] = [];
let exitCode = 0;

async function check(name: string, fn: () => Promise<{ pass: boolean; message: string; details?: any }>): Promise<void> {
  try {
    const result = await fn();
    checks.push({
      name,
      status: result.pass ? 'PASS' : 'FAIL',
      message: result.message,
      details: result.details
    });
    if (!result.pass) exitCode = 1;
  } catch (error: any) {
    checks.push({
      name,
      status: 'FAIL',
      message: `Error: ${error.message}`,
    });
    exitCode = 1;
  }
}

async function main() {
  console.log('╔════════════════════════════════════════════════════╗');
  console.log('║        COMPREHENSIVE SYSTEM HEALTH AUDIT          ║');
  console.log('╚════════════════════════════════════════════════════╝\n');
  
  // ═══════════════════════════════════════════════════════════
  // CHECK 1: DB CONNECTIVITY
  // ═══════════════════════════════════════════════════════════
  await check('DB Connectivity', async () => {
    const { data, error } = await supabase.from('content_metadata').select('decision_id').limit(1);
    return {
      pass: !error,
      message: error ? `Connection failed: ${error.message}` : 'Connected successfully'
    };
  });
  
  // ═══════════════════════════════════════════════════════════
  // CHECK 2: REQUIRED TABLES EXIST
  // ═══════════════════════════════════════════════════════════
  await check('Required Tables', async () => {
    const tables = ['content_metadata', 'post_receipts', 'system_events', 'reply_opportunities', 'discovered_accounts'];
    const missing: string[] = [];
    
    for (const table of tables) {
      const { error } = await supabase.from(table).select('*').limit(1);
      if (error && error.message.includes('does not exist')) {
        missing.push(table);
      }
    }
    
    return {
      pass: missing.length === 0,
      message: missing.length === 0 
        ? `All ${tables.length} tables exist` 
        : `Missing tables: ${missing.join(', ')}`,
      details: { missing }
    };
  });
  
  // ═══════════════════════════════════════════════════════════
  // CHECK 3: POSTING TRUTH (Last 2 hours)
  // ═══════════════════════════════════════════════════════════
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  
  await check('Posting Truth (2h)', async () => {
    // Check receipts vs content_metadata
    const { data: receipts } = await supabase
      .from('post_receipts')
      .select('decision_id, post_type')
      .in('post_type', ['single', 'thread'])
      .gte('posted_at', twoHoursAgo);
    
    const { data: dbPosts } = await supabase
      .from('content_metadata')
      .select('decision_id, decision_type, tweet_id')
      .in('decision_type', ['single', 'thread'])
      .eq('status', 'posted')
      .gte('posted_at', twoHoursAgo);
    
    const receiptCount = receipts?.length || 0;
    const dbCount = dbPosts?.length || 0;
    const gap = Math.abs(receiptCount - dbCount);
    
    // Check for null tweet_ids
    const nullTweetIds = dbPosts?.filter(p => !p.tweet_id || p.tweet_id === '').length || 0;
    
    return {
      pass: gap === 0 && nullTweetIds === 0,
      message: gap === 0 && nullTweetIds === 0
        ? `Perfect match: ${receiptCount} receipts = ${dbCount} DB entries, 0 null tweet_ids`
        : `Truth gap: ${receiptCount} receipts vs ${dbCount} DB (gap: ${gap}), ${nullTweetIds} null tweet_ids`,
      details: { receiptCount, dbCount, gap, nullTweetIds }
    };
  });
  
  // ═══════════════════════════════════════════════════════════
  // CHECK 4: REPLY TRUTH (Last 2 hours)
  // ═══════════════════════════════════════════════════════════
  await check('Reply Truth (2h)', async () => {
    const { data: replyReceipts } = await supabase
      .from('post_receipts')
      .select('decision_id, root_tweet_id')
      .eq('post_type', 'reply')
      .gte('posted_at', twoHoursAgo);
    
    const { data: dbReplies } = await supabase
      .from('content_metadata')
      .select('decision_id, tweet_id, target_tweet_id')
      .eq('decision_type', 'reply')
      .eq('status', 'posted')
      .gte('posted_at', twoHoursAgo);
    
    const receiptCount = replyReceipts?.length || 0;
    const dbCount = dbReplies?.length || 0;
    const gap = Math.abs(receiptCount - dbCount);
    
    // Check for null tweet_ids
    const nullTweetIds = dbReplies?.filter(r => !r.tweet_id || r.tweet_id === '').length || 0;
    
    // Check for missing parent_tweet_id
    const missingParent = dbReplies?.filter(r => !r.target_tweet_id).length || 0;
    
    return {
      pass: gap === 0 && nullTweetIds === 0 && missingParent === 0,
      message: gap === 0 && nullTweetIds === 0 && missingParent === 0
        ? `Perfect: ${receiptCount} receipts = ${dbCount} DB, all have tweet_id & parent`
        : `Issues: ${gap} gap, ${nullTweetIds} null tweet_ids, ${missingParent} missing parent`,
      details: { receiptCount, dbCount, gap, nullTweetIds, missingParent }
    };
  });
  
  // ═══════════════════════════════════════════════════════════
  // CHECK 5: RATE COMPLIANCE (Last hour)
  // ═══════════════════════════════════════════════════════════
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  
  await check('Rate Compliance (1h)', async () => {
    const { data: postsLastHour } = await supabase
      .from('post_receipts')
      .select('post_type')
      .in('post_type', ['single', 'thread'])
      .gte('posted_at', oneHourAgo);
    
    const { data: repliesLastHour } = await supabase
      .from('post_receipts')
      .select('post_type')
      .eq('post_type', 'reply')
      .gte('posted_at', oneHourAgo);
    
    const postCount = postsLastHour?.length || 0;
    const replyCount = repliesLastHour?.length || 0;
    
    const maxPosts = parseInt(process.env.MAX_POSTS_PER_HOUR || '2');
    const maxReplies = parseInt(process.env.MAX_REPLIES_PER_HOUR || '4');
    
    const postsOk = postCount <= maxPosts;
    const repliesOk = replyCount <= maxReplies;
    
    return {
      pass: postsOk && repliesOk,
      message: postsOk && repliesOk
        ? `Within limits: ${postCount}/${maxPosts} posts, ${replyCount}/${maxReplies} replies`
        : `OVER LIMIT: ${postCount}/${maxPosts} posts, ${replyCount}/${maxReplies} replies`,
      details: { postCount, maxPosts, replyCount, maxReplies }
    };
  });
  
  // ═══════════════════════════════════════════════════════════
  // CHECK 6: METRICS COVERAGE
  // ═══════════════════════════════════════════════════════════
  await check('Metrics Coverage (24h)', async () => {
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    const { data: postedContent } = await supabase
      .from('content_metadata')
      .select('decision_id, tweet_id, actual_likes')
      .eq('status', 'posted')
      .gte('posted_at', last24h);
    
    const totalPosted = postedContent?.length || 0;
    const withMetrics = postedContent?.filter(p => p.actual_likes !== null && p.actual_likes !== undefined).length || 0;
    const coverage = totalPosted > 0 ? (withMetrics / totalPosted * 100).toFixed(1) : '0.0';
    
    return {
      pass: parseFloat(coverage) >= 50, // Warning if < 50%
      message: `${withMetrics}/${totalPosted} posts have metrics (${coverage}%)`,
      details: { totalPosted, withMetrics, coveragePercent: parseFloat(coverage) }
    };
  });
  
  // ═══════════════════════════════════════════════════════════
  // CHECK 7: HARVESTER HEALTH
  // ═══════════════════════════════════════════════════════════
  await check('Harvester Health (24h)', async () => {
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    const { data: opportunities } = await supabase
      .from('reply_opportunities')
      .select('target_tweet_id, created_at')
      .gte('created_at', last24h);
    
    const count = opportunities?.length || 0;
    const target = 20; // Minimum 20 opportunities per day
    
    return {
      pass: count >= target,
      message: count >= target
        ? `${count} opportunities discovered (target: ${target}+)`
        : `LOW: Only ${count} opportunities (target: ${target}+)`,
      details: { count, target }
    };
  });
  
  // ═══════════════════════════════════════════════════════════
  // CHECK 8: ACCOUNT DISCOVERY
  // ═══════════════════════════════════════════════════════════
  await check('Account Discovery', async () => {
    const { data: accounts } = await supabase
      .from('discovered_accounts')
      .select('username, discovery_date');
    
    const totalAccounts = accounts?.length || 0;
    
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const recentAccounts = accounts?.filter(a => a.discovery_date && new Date(a.discovery_date) > new Date(last24h)).length || 0;
    
    return {
      pass: totalAccounts >= 10, // At least 10 accounts needed
      message: totalAccounts >= 10
        ? `${totalAccounts} total accounts, ${recentAccounts} added last 24h`
        : `CRITICAL: Only ${totalAccounts} accounts (need 10+ minimum)`,
      details: { totalAccounts, recentAccounts }
    };
  });
  
  // ═══════════════════════════════════════════════════════════
  // CHECK 9: QUEUE BACKLOG
  // ═══════════════════════════════════════════════════════════
  await check('Queue Backlog', async () => {
    const { data: queued } = await supabase
      .from('content_metadata')
      .select('decision_id, decision_type, created_at')
      .in('status', ['pending', 'ready', 'queued']);
    
    const count = queued?.length || 0;
    const oldQueued = queued?.filter(q => {
      const age = Date.now() - new Date(q.created_at).getTime();
      return age > 6 * 60 * 60 * 1000; // Older than 6 hours
    }).length || 0;
    
    return {
      pass: oldQueued === 0,
      message: oldQueued === 0
        ? `${count} queued items, all fresh (<6h old)`
        : `${oldQueued}/${count} queued items are stale (>6h old)`,
      details: { totalQueued: count, staleQueued: oldQueued }
    };
  });
  
  // ═══════════════════════════════════════════════════════════
  // CHECK 10: ORPHAN RECEIPTS
  // ═══════════════════════════════════════════════════════════
  await check('Orphan Receipts (24h)', async () => {
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    const { data: receipts } = await supabase
      .from('post_receipts')
      .select('receipt_id, decision_id, post_type')
      .gte('posted_at', last24h);
    
    const orphans: any[] = [];
    
    for (const receipt of receipts || []) {
      if (!receipt.decision_id) {
        orphans.push(receipt);
        continue;
      }
      
      const { data: decision } = await supabase
        .from('content_metadata')
        .select('decision_id, status')
        .eq('decision_id', receipt.decision_id)
        .eq('status', 'posted')
        .single();
      
      if (!decision) {
        orphans.push(receipt);
      }
    }
    
    const orphanCount = orphans.length;
    
    return {
      pass: orphanCount === 0,
      message: orphanCount === 0
        ? `No orphan receipts found`
        : `${orphanCount} orphan receipts (posted but not in DB)`,
      details: { orphanCount, receiptsChecked: receipts?.length || 0 }
    };
  });
  
  // ═══════════════════════════════════════════════════════════
  // PRINT RESULTS
  // ═══════════════════════════════════════════════════════════
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 HEALTH CHECK RESULTS\n');
  
  let passCount = 0;
  let failCount = 0;
  let warnCount = 0;
  
  for (const check of checks) {
    const icon = check.status === 'PASS' ? '✅' : check.status === 'WARNING' ? '⚠️' : '❌';
    console.log(`${icon} ${check.name}`);
    console.log(`   ${check.message}`);
    if (check.details) {
      console.log(`   Details: ${JSON.stringify(check.details)}`);
    }
    console.log('');
    
    if (check.status === 'PASS') passCount++;
    else if (check.status === 'WARNING') warnCount++;
    else failCount++;
  }
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🎯 SUMMARY\n');
  console.log(`✅ PASS: ${passCount}`);
  console.log(`⚠️  WARN: ${warnCount}`);
  console.log(`❌ FAIL: ${failCount}\n`);
  
  if (failCount === 0) {
    console.log('✅ ALL SYSTEMS OPERATIONAL\n');
  } else {
    console.log(`🚨 ${failCount} CRITICAL ISSUES DETECTED\n`);
  }
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  process.exit(exitCode);
}

main().catch((error) => {
  console.error('🚨 Audit failed:', error);
  process.exit(1);
});

