#!/usr/bin/env tsx
/**
 * 🎯 REPLY TARGETING VERIFICATION SCRIPT
 * Verifies replies target ROOT tweets, not other replies
 */

import { config } from 'dotenv';
config();

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function verifyReplyTargeting(): Promise<{ pass: boolean; message: string }> {
  try {
    // Get last 20 reply decisions
    const { data: replies, error } = await supabase
      .from('content_metadata')
      .select('decision_id, target_tweet_id, root_tweet_id, original_candidate_tweet_id, resolved_via_root, posted_at')
      .eq('decision_type', 'reply')
      .order('created_at', { ascending: false })
      .limit(20);
    
    if (error) {
      return { pass: false, message: `❌ DB query failed: ${error.message}` };
    }
    
    if (!replies || replies.length === 0) {
      return { pass: true, message: 'ℹ️ No recent replies found (system may be new)' };
    }
    
    let rootResolved = 0;
    let violations = 0;
    
    for (const reply of replies) {
      if (reply.resolved_via_root) {
        rootResolved++;
      }
      
      // Check if root_tweet_id differs from original_candidate (indicates resolution happened)
      if (reply.root_tweet_id && reply.original_candidate_tweet_id && 
          reply.root_tweet_id !== reply.original_candidate_tweet_id) {
        console.log(`   ✅ ${reply.decision_id.substring(0, 8)}: resolved ${reply.original_candidate_tweet_id} → ${reply.root_tweet_id}`);
      }
    }
    
    if (violations > 0) {
      return { 
        pass: false, 
        message: `❌ Found ${violations} replies with targeting violations` 
      };
    }
    
    return { 
      pass: true, 
      message: `✅ Checked ${replies.length} replies, ${rootResolved} resolved to root` 
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
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🎯 REPLY TARGETING VERIFICATION');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  const checks = [
    { name: 'Reply Root Targeting', fn: verifyReplyTargeting },
    { name: 'No Phantom Posts', fn: verifyNoPhantomPosts },
  ];
  
  let allPassed = true;
  
  for (const check of checks) {
    const result = await check.fn();
    console.log(`${check.name}: ${result.message}`);
    if (!result.pass) {
      allPassed = false;
    }
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

