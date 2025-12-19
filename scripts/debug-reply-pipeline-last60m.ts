/**
 * Reply Pipeline Verifier (Last 60 Minutes)
 * 
 * Checks all aspects of the reply pipeline:
 * - Discovery health
 * - Harvesting health
 * - Selection health
 * - Posting truth (hard invariants)
 * - Receipt reconciliation
 * - Rate limiter check
 * 
 * Exit code 0 = PASS, 1 = FAIL
 */

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface VerificationResult {
  section: string;
  passed: boolean;
  issues: string[];
  data?: any;
}

const results: VerificationResult[] = [];
let exitCode = 0;

async function main() {
  console.log('🔍 REPLY PIPELINE VERIFICATION (Last 60 Minutes)\n');
  console.log('═══════════════════════════════════════════════════════\n');
  
  // Get 60 minutes ago timestamp
  const sixtyMinutesAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const now = new Date().toISOString();
  
  // A) Discovery Health
  await checkDiscoveryHealth();
  
  // B) Harvesting Health
  await checkHarvestingHealth();
  
  // C) Selection Health
  await checkSelectionHealth(sixtyMinutesAgo);
  
  // D) Posting Truth (Hard Invariant)
  await checkPostingTruth();
  
  // E) Receipt Reconciliation
  await checkReceiptReconciliation();
  
  // F) Rate Limiter Check
  await checkRateLimiter(sixtyMinutesAgo);
  
  // Summary
  console.log('\n═══════════════════════════════════════════════════════\n');
  console.log('📊 SUMMARY:\n');
  
  for (const result of results) {
    const icon = result.passed ? '✅' : '❌';
    console.log(`${icon} ${result.section}: ${result.passed ? 'PASS' : 'FAIL'}`);
    if (!result.passed && result.issues.length > 0) {
      result.issues.forEach(issue => console.log(`   - ${issue}`));
    }
  }
  
  const allPassed = results.every(r => r.passed);
  console.log(`\n${allPassed ? '✅ ALL CHECKS PASSED' : '❌ SOME CHECKS FAILED'}\n`);
  
  process.exit(exitCode);
}

async function checkDiscoveryHealth() {
  console.log('A) DISCOVERY HEALTH\n');
  
  try {
    // Get count
    const { count } = await supabase
      .from('discovered_accounts')
      .select('*', { count: 'exact', head: true });
    
    console.log(`   Total discovered_accounts: ${count || 0}`);
    
    // Get top 5 by priority_score
    const { data: top5 } = await supabase
      .from('discovered_accounts')
      .select('username, priority_score, follower_count, updated_at')
      .order('priority_score', { ascending: false })
      .limit(5);
    
    if (top5 && top5.length > 0) {
      console.log(`\n   Top 5 by priority_score:`);
      top5.forEach((acc, i) => {
        const updated = new Date(acc.updated_at);
        const hoursAgo = Math.round((Date.now() - updated.getTime()) / (1000 * 60 * 60));
        console.log(`   ${i+1}. @${acc.username} (score: ${acc.priority_score.toFixed(2)}, followers: ${acc.follower_count}, updated: ${hoursAgo}h ago)`);
      });
    }
    
    // Get last updated timestamp
    const { data: latest } = await supabase
      .from('discovered_accounts')
      .select('updated_at')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();
    
    if (latest) {
      const lastUpdate = new Date(latest.updated_at);
      const hoursAgo = Math.round((Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60));
      console.log(`\n   Last updated: ${hoursAgo}h ago`);
    }
    
    results.push({
      section: 'Discovery Health',
      passed: (count || 0) > 0,
      issues: (count || 0) === 0 ? ['No discovered accounts'] : []
    });
    
  } catch (error: any) {
    console.error(`   ❌ Error: ${error.message}`);
    results.push({
      section: 'Discovery Health',
      passed: false,
      issues: [error.message]
    });
    exitCode = 1;
  }
  
  console.log('\n');
}

async function checkHarvestingHealth() {
  console.log('B) HARVESTING HEALTH\n');
  
  try {
    // Get count of fresh opportunities
    const { count } = await supabase
      .from('reply_opportunities')
      .select('*', { count: 'exact', head: true })
      .eq('replied_to', false)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);
    
    console.log(`   Fresh opportunities (not replied, not expired): ${count || 0}`);
    
    // Get last 10 harvested
    const { data: recent } = await supabase
      .from('reply_opportunities')
      .select('target_tweet_id, target_username, likes_count, tier, tweet_content, created_at')
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (recent && recent.length > 0) {
      console.log(`\n   Last 10 harvested opportunities:\n`);
      recent.forEach((opp, i) => {
        const preview = opp.tweet_content.substring(0, 60);
        const ago = Math.round((Date.now() - new Date(opp.created_at).getTime()) / (1000 * 60));
        console.log(`   ${i+1}. @${opp.target_username} (${opp.tier || 'N/A'}, ${opp.likes_count} likes, ${ago}m ago)`);
        console.log(`      "${preview}..."`);
      });
    } else {
      console.log(`\n   ⚠️  No opportunities harvested recently`);
    }
    
    results.push({
      section: 'Harvesting Health',
      passed: (count || 0) > 0,
      issues: (count || 0) === 0 ? ['No fresh opportunities available'] : []
    });
    
  } catch (error: any) {
    console.error(`   ❌ Error: ${error.message}`);
    results.push({
      section: 'Harvesting Health',
      passed: false,
      issues: [error.message]
    });
    exitCode = 1;
  }
  
  console.log('\n');
}

async function checkSelectionHealth(sixtyMinutesAgo: string) {
  console.log('C) SELECTION HEALTH\n');
  
  try {
    // Get last 10 reply decisions
    const { data: decisions } = await supabase
      .from('content_metadata')
      .select('decision_id, status, target_tweet_id, target_username, scheduled_at, created_at')
      .eq('decision_type', 'reply')
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (decisions && decisions.length > 0) {
      console.log(`   Last 10 reply decisions:\n`);
      decisions.forEach((d, i) => {
        const createdAgo = Math.round((Date.now() - new Date(d.created_at).getTime()) / (1000 * 60));
        const scheduled = d.scheduled_at ? new Date(d.scheduled_at).toLocaleString('en-US', { 
          timeZone: 'America/New_York',
          hour: 'numeric',
          minute: '2-digit'
        }) : 'N/A';
        console.log(`   ${i+1}. ${d.decision_id.substring(0, 8)}... (${d.status})`);
        console.log(`      Target: @${d.target_username || 'NULL'} (${d.target_tweet_id || 'NULL'})`);
        console.log(`      Created: ${createdAgo}m ago, Scheduled: ${scheduled}`);
      });
    } else {
      console.log(`   ⚠️  No reply decisions found`);
    }
    
    results.push({
      section: 'Selection Health',
      passed: true, // Not a failure if no decisions
      issues: []
    });
    
  } catch (error: any) {
    console.error(`   ❌ Error: ${error.message}`);
    results.push({
      section: 'Selection Health',
      passed: false,
      issues: [error.message]
    });
    exitCode = 1;
  }
  
  console.log('\n');
}

async function checkPostingTruth() {
  console.log('D) POSTING TRUTH (Hard Invariants)\n');
  
  try {
    // Get last 10 posted replies
    const { data: posted } = await supabase
      .from('content_metadata')
      .select('decision_id, tweet_id, target_tweet_id, content, posted_at')
      .eq('decision_type', 'reply')
      .eq('status', 'posted')
      .order('posted_at', { ascending: false })
      .limit(10);
    
    const issues: string[] = [];
    
    if (!posted || posted.length === 0) {
      console.log(`   ⚠️  No posted replies found in database`);
      results.push({
        section: 'Posting Truth',
        passed: true, // Not a failure if no posts
        issues: []
      });
      console.log('\n');
      return;
    }
    
    console.log(`   Last 10 posted replies:\n`);
    
    for (const reply of posted) {
      const id = reply.decision_id.substring(0, 8);
      console.log(`   ${id}...`);
      
      // INVARIANT 1: tweet_id must be present
      if (!reply.tweet_id) {
        const issue = `${id}: tweet_id is NULL`;
        console.log(`      ❌ ${issue}`);
        issues.push(issue);
      } else {
        console.log(`      ✅ tweet_id: ${reply.tweet_id}`);
      }
      
      // INVARIANT 2: target_tweet_id must be present
      if (!reply.target_tweet_id) {
        const issue = `${id}: target_tweet_id is NULL`;
        console.log(`      ❌ ${issue}`);
        issues.push(issue);
      } else {
        console.log(`      ✅ parent: ${reply.target_tweet_id}`);
      }
      
      // INVARIANT 3: content must be a string (not array)
      if (Array.isArray(reply.content)) {
        const issue = `${id}: content is an array`;
        console.log(`      ❌ ${issue}`);
        issues.push(issue);
      }
      
      // INVARIANT 4: No JSON artifacts ({ } [ ])
      if (typeof reply.content === 'string') {
        if (reply.content.includes('{') || reply.content.includes('}') || 
            reply.content.includes('[') || reply.content.includes(']')) {
          const issue = `${id}: content contains JSON artifacts`;
          console.log(`      ❌ ${issue}`);
          issues.push(issue);
        } else {
          console.log(`      ✅ content is clean string (${reply.content.length} chars)`);
        }
      }
    }
    
    results.push({
      section: 'Posting Truth',
      passed: issues.length === 0,
      issues
    });
    
    if (issues.length > 0) {
      exitCode = 1;
    }
    
  } catch (error: any) {
    console.error(`   ❌ Error: ${error.message}`);
    results.push({
      section: 'Posting Truth',
      passed: false,
      issues: [error.message]
    });
    exitCode = 1;
  }
  
  console.log('\n');
}

async function checkReceiptReconciliation() {
  console.log('E) RECEIPT RECONCILIATION\n');
  
  try {
    // Check if post_receipts table exists
    const { data: receipts, error } = await supabase
      .from('post_receipts')
      .select('receipt_id, root_tweet_id, decision_id, post_type, posted_at, metadata')
      .eq('post_type', 'reply')
      .order('posted_at', { ascending: false })
      .limit(10);
    
    if (error) {
      if (error.message.includes('does not exist')) {
        console.log(`   ⚠️  post_receipts table does not exist (skipping)`);
        results.push({
          section: 'Receipt Reconciliation',
          passed: true,
          issues: []
        });
        console.log('\n');
        return;
      }
      throw error;
    }
    
    if (!receipts || receipts.length === 0) {
      // 🔥 CRITICAL: No receipts found for replies
      // Check if there ARE posted replies in content_metadata
      const { count: postedCount } = await supabase
        .from('content_metadata')
        .select('*', { count: 'exact', head: true })
        .eq('decision_type', 'reply')
        .eq('status', 'posted')
        .gte('posted_at', new Date(Date.now() - 60 * 60 * 1000).toISOString());
      
      if (postedCount && postedCount > 0) {
        console.log(`   ❌ CRITICAL: ${postedCount} posted replies in last 60m, but 0 receipts!`);
        console.log(`   This means receipts are NOT being written for replies.`);
        results.push({
          section: 'Receipt Reconciliation',
          passed: false,
          issues: [`${postedCount} posted replies have no receipts (receipt write not wired)`]
        });
        exitCode = 1;
      } else {
        console.log(`   ⚠️  No reply receipts found (no replies posted in last 60m)`);
        results.push({
          section: 'Receipt Reconciliation',
          passed: true,
          issues: []
        });
      }
      console.log('\n');
      return;
    }
    
    console.log(`   Last 10 reply receipts:\n`);
    
    const issues: string[] = [];
    
    for (const receipt of receipts) {
      const id = receipt.receipt_id;
      const ago = Math.round((Date.now() - new Date(receipt.posted_at).getTime()) / (1000 * 60));
      console.log(`   Receipt ${id} (${ago}m ago):`);
      console.log(`      Tweet ID: ${receipt.root_tweet_id}`);
      console.log(`      Decision ID: ${receipt.decision_id || 'NULL'}`);
      
      // Check for parent_tweet_id in metadata
      const parentTweetId = receipt.metadata?.parent_tweet_id || receipt.metadata?.target_tweet_id;
      if (parentTweetId) {
        console.log(`      Parent: ${parentTweetId}`);
      } else {
        const issue = `Receipt ${id}: Missing parent_tweet_id in metadata`;
        console.log(`      ⚠️  ${issue}`);
        issues.push(issue);
      }
      
      // Check if matching content_metadata row exists
      if (receipt.decision_id) {
        const { data: cm } = await supabase
          .from('content_metadata')
          .select('tweet_id, status')
          .eq('decision_id', receipt.decision_id)
          .single();
        
        if (!cm) {
          const issue = `Receipt ${id}: No matching content_metadata row`;
          console.log(`      ❌ ${issue}`);
          issues.push(issue);
        } else if (cm.tweet_id !== receipt.root_tweet_id) {
          const issue = `Receipt ${id}: tweet_id mismatch (receipt: ${receipt.root_tweet_id}, cm: ${cm.tweet_id})`;
          console.log(`      ❌ ${issue}`);
          issues.push(issue);
        } else {
          console.log(`      ✅ Matches content_metadata (status: ${cm.status})`);
        }
      } else {
        const issue = `Receipt ${id}: decision_id is NULL`;
        console.log(`      ❌ ${issue}`);
        issues.push(issue);
      }
    }
    
    results.push({
      section: 'Receipt Reconciliation',
      passed: issues.length === 0,
      issues
    });
    
    if (issues.length > 0) {
      exitCode = 1;
    }
    
  } catch (error: any) {
    console.error(`   ❌ Error: ${error.message}`);
    results.push({
      section: 'Receipt Reconciliation',
      passed: false,
      issues: [error.message]
    });
    exitCode = 1;
  }
  
  console.log('\n');
}

async function checkRateLimiter(sixtyMinutesAgo: string) {
  console.log('F) RATE LIMITER CHECK\n');
  
  try {
    // Count posted replies in last 60 minutes
    const { count } = await supabase
      .from('content_metadata')
      .select('*', { count: 'exact', head: true })
      .eq('decision_type', 'reply')
      .eq('status', 'posted')
      .gte('posted_at', sixtyMinutesAgo);
    
    const repliesLastHour = count || 0;
    const limit = 4;
    const wouldBlock = repliesLastHour >= limit;
    
    console.log(`   Replies in last 60m: ${repliesLastHour} / ${limit}`);
    console.log(`   Rate limiter would ${wouldBlock ? '🔒 BLOCK' : '✅ ALLOW'} new replies`);
    
    results.push({
      section: 'Rate Limiter',
      passed: true, // Not a failure
      issues: [],
      data: { repliesLastHour, limit, wouldBlock }
    });
    
  } catch (error: any) {
    console.error(`   ❌ Error: ${error.message}`);
    results.push({
      section: 'Rate Limiter',
      passed: false,
      issues: [error.message]
    });
    exitCode = 1;
  }
  
  console.log('\n');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

