#!/usr/bin/env tsx
/**
 * 🔍 TRUTH GAP VERIFICATION SCRIPT
 * 
 * Comprehensive verification of system health and truth-gap prevention:
 * 1. Tests /status and /ready endpoints (if BASE_URL provided)
 * 2. Checks DB invariant: no posted content with null tweet_id in last hour
 * 3. Verifies receipts vs metadata reconciliation: no orphan receipts older than 30 min
 */

import 'dotenv/config';

const BASE_URL = process.env.BASE_URL;

interface VerificationResult {
  passed: boolean;
  checks: {
    name: string;
    passed: boolean;
    message: string;
  }[];
}

async function checkEndpoints(): Promise<{ passed: boolean; message: string }> {
  if (!BASE_URL) {
    return { passed: true, message: 'Skipped (no BASE_URL provided)' };
  }
  
  try {
    // Check /status
    const statusResp = await fetch(`${BASE_URL}/status`);
    if (statusResp.status !== 200) {
      return { passed: false, message: `/status returned ${statusResp.status} (expected 200)` };
    }
    
    // Check /ready
    const readyResp = await fetch(`${BASE_URL}/ready`);
    if (readyResp.status !== 200 && readyResp.status !== 503) {
      return { passed: false, message: `/ready returned ${readyResp.status} (expected 200 or 503)` };
    }
    
    return { passed: true, message: 'Endpoints responding correctly' };
  } catch (error: any) {
    return { passed: false, message: `Endpoint check failed: ${error.message}` };
  }
}

async function checkDBInvariant(): Promise<{ passed: boolean; message: string }> {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    
    const { data, error } = await supabase
      .from('content_metadata')
      .select('decision_id, decision_type, posted_at')
      .eq('status', 'posted')
      .is('tweet_id', null)
      .gte('posted_at', oneHourAgo);
    
    if (error) {
      return { passed: false, message: `DB query error: ${error.message}` };
    }
    
    if (data && data.length > 0) {
      return { 
        passed: false, 
        message: `Found ${data.length} phantom posts (posted but tweet_id=NULL): ${data.map(d => d.decision_id).join(', ')}` 
      };
    }
    
    return { passed: true, message: 'No phantom posts in last hour' };
    
  } catch (error: any) {
    return { passed: false, message: `DB invariant check failed: ${error.message}` };
  }
}

async function checkReconciliation(): Promise<{ passed: boolean; message: string }> {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    
    // Get receipts older than 30 min
    const { data: receipts, error: receiptError } = await supabase
      .from('post_receipts')
      .select('decision_id, root_tweet_id')
      .lt('posted_at', thirtyMinAgo)
      .order('posted_at', { ascending: false })
      .limit(50);
    
    if (receiptError) {
      return { passed: false, message: `Receipt query error: ${receiptError.message}` };
    }
    
    if (!receipts || receipts.length === 0) {
      return { passed: true, message: 'No receipts to check (or all recent)' };
    }
    
    // Check if each receipt has corresponding metadata
    let orphanCount = 0;
    const orphans: string[] = [];
    
    for (const receipt of receipts) {
      const { data: metadata, error: metaError } = await supabase
        .from('content_metadata')
        .select('decision_id, status, tweet_id')
        .eq('decision_id', receipt.decision_id)
        .eq('status', 'posted')
        .eq('tweet_id', receipt.root_tweet_id)
        .single();
      
      if (metaError || !metadata) {
        orphanCount++;
        if (orphans.length < 5) {
          orphans.push(receipt.decision_id);
        }
      }
    }
    
    if (orphanCount > 0) {
      return { 
        passed: false, 
        message: `Found ${orphanCount} orphan receipts (not reconciled in metadata): ${orphans.join(', ')}${orphanCount > 5 ? '...' : ''}` 
      };
    }
    
    return { passed: true, message: `All ${receipts.length} receipts properly reconciled` };
    
  } catch (error: any) {
    return { passed: false, message: `Reconciliation check failed: ${error.message}` };
  }
}

async function checkDiscoveredTweets(): Promise<{ passed: boolean; message: string }> {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    // Count tweets discovered via profile backfill
    const { count, error } = await supabase
      .from('content_metadata')
      .select('*', { count: 'exact', head: true })
      .eq('discovered_via_profile', true);
    
    if (error) {
      return { passed: true, message: `Query error (non-critical): ${error.message}` };
    }
    
    if (count && count > 0) {
      return { 
        passed: true, 
        message: `Found ${count} tweets backfilled via Tier-2 profile recovery (system working correctly)` 
      };
    }
    
    return { passed: true, message: 'No discovered tweets yet (Tier-1 recovery sufficient)' };
    
  } catch (error: any) {
    return { passed: true, message: `Check skipped: ${error.message}` };
  }
}

async function main() {
  console.log('🔍 TRUTH GAP VERIFICATION');
  console.log('═══════════════════════════════════════\n');
  
  const result: VerificationResult = {
    passed: true,
    checks: []
  };
  
  // Check 1: Endpoints
  console.log('Check 1: Endpoints (if BASE_URL provided)...');
  const endpointCheck = await checkEndpoints();
  result.checks.push({
    name: 'Endpoints',
    passed: endpointCheck.passed,
    message: endpointCheck.message
  });
  console.log(endpointCheck.passed ? '✅ PASS' : '❌ FAIL');
  console.log(`   ${endpointCheck.message}\n`);
  if (!endpointCheck.passed) result.passed = false;
  
  // Check 2: DB Invariant
  console.log('Check 2: DB Invariant (no phantom posts)...');
  const invariantCheck = await checkDBInvariant();
  result.checks.push({
    name: 'DB Invariant',
    passed: invariantCheck.passed,
    message: invariantCheck.message
  });
  console.log(invariantCheck.passed ? '✅ PASS' : '❌ FAIL');
  console.log(`   ${invariantCheck.message}\n`);
  if (!invariantCheck.passed) result.passed = false;
  
  // Check 3: Reconciliation
  console.log('Check 3: Reconciliation (receipts vs metadata)...');
  const reconcileCheck = await checkReconciliation();
  result.checks.push({
    name: 'Reconciliation',
    passed: reconcileCheck.passed,
    message: reconcileCheck.message
  });
  console.log(reconcileCheck.passed ? '✅ PASS' : '❌ FAIL');
  console.log(`   ${reconcileCheck.message}\n`);
  if (!reconcileCheck.passed) result.passed = false;
  
  // Check 4: Discovered tweets (backfilled via profile recovery)
  console.log('Check 4: Discovered Tweets (profile backfill stats)...');
  const discoveredCheck = await checkDiscoveredTweets();
  result.checks.push({
    name: 'Discovered Tweets',
    passed: discoveredCheck.passed,
    message: discoveredCheck.message
  });
  console.log(discoveredCheck.passed ? '✅ PASS' : '❌ INFO');
  console.log(`   ${discoveredCheck.message}\n`);
  // Don't fail overall if discovered tweets exist - it's just informational
  
  // Summary
  console.log('═══════════════════════════════════════');
  const passCount = result.checks.filter(c => c.passed).length;
  const totalCount = result.checks.length;
  
  if (result.passed) {
    console.log(`✅ ALL CHECKS PASSED (${passCount}/${totalCount})`);
    process.exit(0);
  } else {
    console.log(`❌ CHECKS FAILED (${passCount}/${totalCount} passed)`);
    process.exit(1);
  }
}

main().catch(error => {
  console.error('💥 Verification script error:', error.message);
  process.exit(1);
});

