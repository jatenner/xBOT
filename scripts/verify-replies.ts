#!/usr/bin/env tsx
/**
 * 🎯 REPLY TARGETING VERIFICATION SCRIPT
 * Verifies replies target ROOT tweets, not other replies
 * Works against production via BASE_URL + Supabase env vars
 */

import { config } from 'dotenv';
config();

import { createClient } from '@supabase/supabase-js';

const BASE_URL = process.env.BASE_URL;
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function checkProductionStatus(): Promise<void> {
  if (!BASE_URL) {
    console.log('ℹ️  No BASE_URL provided, skipping production status check\n');
    return;
  }
  
  try {
    const response = await fetch(`${BASE_URL}/status`);
    const data = await response.json();
    
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('📡 PRODUCTION STATUS');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`Build: ${data.buildSha || 'unknown'}`);
    console.log(`Version: ${data.version || 'unknown'}`);
    console.log(`Ready: ${data.ready}`);
    console.log(`Degraded: ${data.degraded}`);
    console.log('');
  } catch (error: any) {
    console.warn(`⚠️  Could not fetch production status: ${error.message}\n`);
  }
}

async function verifyReplyTargeting(): Promise<{ pass: boolean; message: string; stats?: any }> {
  try {
    // Get last 50 reply decisions
    // Query the underlying table directly (content_metadata view may not include new columns)
    const { data: replies, error } = await supabase
      .from('content_generation_metadata_comprehensive')
      .select('decision_id, target_tweet_id, root_tweet_id, original_candidate_tweet_id, resolved_via_root, posted_at, status, created_at')
      .eq('decision_type', 'reply')
      .in('status', ['posted', 'queued'])
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (error) {
      return { pass: false, message: `❌ DB query failed: ${error.message}` };
    }
    
    if (!replies || replies.length === 0) {
      return { pass: true, message: 'ℹ️  No recent replies found (system may be new)' };
    }
    
    let rootResolved = 0;
    let notResolved = 0;
    let violations: string[] = [];
    let posted = 0;
    let queued = 0;
    
    for (const reply of replies) {
      if (reply.status === 'posted') posted++;
      if (reply.status === 'queued') queued++;
      
      if (reply.resolved_via_root) {
        rootResolved++;
        
        // Verify invariants
        if (!reply.root_tweet_id) {
          violations.push(`${reply.decision_id.substring(0, 8)}: resolved_via_root=true but root_tweet_id=null`);
        }
        
        if (!reply.original_candidate_tweet_id) {
          violations.push(`${reply.decision_id.substring(0, 8)}: resolved_via_root=true but original_candidate_tweet_id=null`);
        }
        
        if (reply.root_tweet_id && reply.target_tweet_id && reply.root_tweet_id !== reply.target_tweet_id) {
          violations.push(`${reply.decision_id.substring(0, 8)}: target_tweet_id != root_tweet_id`);
        }
      } else {
        notResolved++;
      }
    }
    
    const total = replies.length;
    const resolvedPct = total > 0 ? ((rootResolved / total) * 100).toFixed(1) : '0.0';
    const notResolvedPct = total > 0 ? ((notResolved / total) * 100).toFixed(1) : '0.0';
    
    const stats = {
      total,
      posted,
      queued,
      rootResolved,
      notResolved,
      resolvedPct,
      notResolvedPct,
      violations: violations.length,
    };
    
    if (violations.length > 0) {
      console.log('\n⚠️  VIOLATIONS FOUND:');
      violations.forEach(v => console.log(`   ${v}`));
      return { 
        pass: false, 
        message: `❌ Found ${violations.length} targeting violations`, 
        stats 
      };
    }
    
    return { 
      pass: true, 
      message: `✅ Checked ${total} replies: ${rootResolved} resolved (${resolvedPct}%), ${notResolved} not resolved (${notResolvedPct}%)`,
      stats
    };
  } catch (error: any) {
    return { pass: false, message: `❌ Verification failed: ${error.message}` };
  }
}

async function verifyNoPhantomPosts(): Promise<{ pass: boolean; message: string }> {
  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    const { data: phantoms, error } = await supabase
      .from('content_metadata')
      .select('decision_id, decision_type')
      .eq('status', 'posted')
      .is('tweet_id', null)
      .gte('posted_at', twentyFourHoursAgo);
    
    if (error) {
      return { pass: false, message: `❌ Phantom check failed: ${error.message}` };
    }
    
    if (phantoms && phantoms.length > 0) {
      console.log('\n⚠️  PHANTOM POSTS:');
      phantoms.forEach(p => console.log(`   ${p.decision_id.substring(0, 8)} (${p.decision_type})`));
      return { 
        pass: false, 
        message: `❌ Found ${phantoms.length} phantom posts (status=posted but tweet_id=null)` 
      };
    }
    
    return { pass: true, message: '✅ No phantom posts (last 24h)' };
  } catch (error: any) {
    return { pass: false, message: `❌ Phantom check failed: ${error.message}` };
  }
}

async function main() {
  await checkProductionStatus();
  
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🎯 REPLY TARGETING VERIFICATION');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  const checks = [
    { name: 'Reply Root Targeting', fn: verifyReplyTargeting },
    { name: 'No Phantom Posts', fn: verifyNoPhantomPosts },
  ];
  
  let allPassed = true;
  let stats: any = null;
  
  for (const check of checks) {
    const result = await check.fn();
    console.log(`${check.name}: ${result.message}`);
    if (!result.pass) {
      allPassed = false;
    }
    if ('stats' in result && result.stats) {
      stats = result.stats;
    }
  }
  
  if (stats) {
    console.log('\n📊 STATISTICS:');
    console.log(`   Total replies: ${stats.total}`);
    console.log(`   Posted: ${stats.posted}, Queued: ${stats.queued}`);
    console.log(`   Root resolved: ${stats.rootResolved} (${stats.resolvedPct}%)`);
    console.log(`   Not resolved: ${stats.notResolved} (${stats.notResolvedPct}%)`);
    console.log(`   Violations: ${stats.violations}`);
  }
  
  console.log('\n═══════════════════════════════════════════════════════════════');
  
  if (allPassed) {
    console.log('✅ ALL CHECKS PASSED');
    process.exit(0);
  } else {
    console.log('❌ SOME CHECKS FAILED');
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
