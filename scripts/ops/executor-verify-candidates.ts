#!/usr/bin/env tsx
/**
 * Executor-Verified Candidate Pool
 * 
 * Executor-only script that probes candidates and marks them accessibility_status='ok'.
 * Uses executor browser pool (authenticated Chrome profile).
 * 
 * Usage:
 *   EXECUTION_MODE=executor RUNNER_MODE=true pnpm exec tsx scripts/ops/executor-verify-candidates.ts [--limit=N] [--dry-run]
 */

import 'dotenv/config';
import { getSupabaseClient } from '../../src/db/index';
import { requireExecutorMode } from '../../src/infra/executionMode';
import { checkWhoami } from '../../src/utils/whoamiAuth';

// Require executor mode
requireExecutorMode();

interface VerificationResult {
  tweet_id: string;
  status: 'ok' | 'forbidden' | 'deleted' | 'login_wall' | 'timeout';
  reason: string;
  whoami_logged_in: boolean;
}

async function verifyCandidate(
  page: any,
  tweetId: string,
  tweetUrl: string
): Promise<VerificationResult> {
  try {
    // Navigate to tweet URL
    await page.goto(tweetUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 10000
    });
    
    await page.waitForTimeout(2000); // Let page load
    
    const finalUrl = page.url();
    const pageText = await page.evaluate(() => document.body?.textContent || '').catch(() => '');
    const pageTitle = await page.title().catch(() => '');
    
    // Check whoami first (must be logged in in executor mode)
    // Navigate to home first to check auth, then navigate to tweet
    const whoami = await checkWhoami(page);
    
    if (!whoami.logged_in) {
      console.error(`[EXECUTOR_VERIFY] FATAL not logged in after navigating to ${tweetUrl}`);
      console.error(`   reason: ${whoami.reason}`);
      console.error(`   url: ${whoami.url}`);
      throw new Error(`Not logged in: ${whoami.reason}`);
    }
    
    // Check for login wall (should not happen in executor mode)
    if (finalUrl.includes('/i/flow/login') || 
        pageText.includes('Log in') && pageText.includes('Sign in') ||
        pageTitle.toLowerCase().includes('log in')) {
      return {
        tweet_id: tweetId,
        status: 'login_wall',
        reason: 'Login wall detected (unexpected in executor mode)',
        whoami_logged_in: whoami.logged_in
      };
    }
    
    // Check for deleted tweet
    if (pageText.includes("This post doesn't exist") ||
        pageText.includes("Post not found") ||
        pageText.includes("doesn't exist") ||
        finalUrl.includes('/i/web/status/') && pageText.length < 100) {
      return {
        tweet_id: tweetId,
        status: 'deleted',
        reason: 'Tweet does not exist',
        whoami_logged_in: whoami.logged_in
      };
    }
    
    // Check for forbidden/protected
    const hasForbidden = pageText.includes('forbidden') ||
                        pageText.includes('403') ||
                        pageText.includes('protected') ||
                        pageText.includes('This account is protected') ||
                        pageText.includes('These posts are protected');
    
    if (hasForbidden) {
      return {
        tweet_id: tweetId,
        status: 'forbidden',
        reason: 'Protected account or forbidden',
        whoami_logged_in: whoami.logged_in
      };
    }
    
    // Check for tweet content and reply UI
    const hasTweetContent = await page.evaluate(() => {
      // Look for tweet text
      const tweetText = document.querySelector('[data-testid="tweetText"]') ||
                       document.querySelector('article[data-testid="tweet"]')?.textContent;
      
      // Look for reply button
      const replyButton = document.querySelector('[data-testid="reply"]') ||
                         document.querySelector('button[aria-label*="Reply"]');
      
      return {
        hasContent: !!tweetText && (tweetText.textContent || '').length > 20,
        hasReplyUI: !!replyButton
      };
    }).catch(() => ({ hasContent: false, hasReplyUI: false }));
    
    if (hasTweetContent.hasContent || hasTweetContent.hasReplyUI) {
      return {
        tweet_id: tweetId,
        status: 'ok',
        reason: 'Tweet content loads and reply UI present',
        whoami_logged_in: whoami.logged_in
      };
    }
    
    // Fallback: check if we can see any tweet-like content
    if (pageText.length > 200 && !hasForbidden) {
      return {
        tweet_id: tweetId,
        status: 'ok',
        reason: 'Tweet content detectable (fallback)',
        whoami_logged_in: whoami.logged_in
      };
    }
    
    return {
      tweet_id: tweetId,
      status: 'forbidden',
      reason: 'Cannot determine accessibility',
      whoami_logged_in: whoami.logged_in
    };
    
  } catch (error: any) {
    if (error.message.includes('timeout') || error.message.includes('Timeout')) {
      return {
        tweet_id: tweetId,
        status: 'timeout',
        reason: `Timeout: ${error.message}`,
        whoami_logged_in: false
      };
    }
    throw error;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const limitArg = args.find(arg => arg.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : 50;
  
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔍 Executor-Verified Candidate Pool');
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log(`Mode: ${dryRun ? 'DRY-RUN' : 'LIVE'}`);
  console.log(`Limit: ${limit}`);
  console.log(`EXECUTION_MODE: ${process.env.EXECUTION_MODE}`);
  console.log(`RUNNER_MODE: ${process.env.RUNNER_MODE}\n`);
  
  const supabase = getSupabaseClient();
  
  // Query for candidates to verify
  // Use 24-hour window to catch candidates that may be slightly older
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  
  // Query for candidates: include NULL, 'unknown', or missing accessibility_status
  const { data: candidates, error: queryError } = await supabase
    .from('reply_opportunities')
    .select('target_tweet_id, target_tweet_url, discovery_source, accessibility_status')
    .like('discovery_source', 'public_search_%')
    .neq('discovery_source', 'public_search_manual')
    .gte('created_at', twentyFourHoursAgo)
    .eq('replied_to', false)
    .order('created_at', { ascending: false })
    .limit(limit);
  
  // Filter in memory to include NULL, 'unknown', or missing status (exclude 'ok', 'forbidden', etc.)
  const candidatesToVerify = (candidates || []).filter(c => {
    const status = c.accessibility_status;
    return !status || status === 'unknown' || status === null;
  });
  
  if (queryError) {
    console.error(`❌ Query error: ${queryError.message}`);
    process.exit(1);
  }
  
  if (!candidatesToVerify || candidatesToVerify.length === 0) {
    console.log('⚠️  No candidates found to verify (all already have accessibility_status set)');
    if (candidates && candidates.length > 0) {
      const statusCounts: Record<string, number> = {};
      candidates.forEach((c: any) => {
        const status = c.accessibility_status || 'NULL';
        statusCounts[status] = (statusCounts[status] || 0) + 1;
      });
      console.log(`\n📊 Existing candidates status breakdown:`);
      Object.entries(statusCounts).forEach(([status, count]) => {
        console.log(`   ${status}: ${count}`);
      });
    }
    process.exit(0);
  }
  
  console.log(`📊 Found ${candidatesToVerify.length} candidates to verify (out of ${candidates?.length || 0} total)\n`);
  
  // Get executor browser context
  // Use direct launch mode (not CDP) for executor verification
  const { chromium } = await import('playwright');
  const { ensureRunnerProfileDir, RUNNER_PROFILE_PATHS } = await import('../../src/infra/runnerProfile');
  const RUNNER_PROFILE_DIR = ensureRunnerProfileDir();
  const BROWSER_USER_DATA_DIR = RUNNER_PROFILE_PATHS.chromeProfile(); // Use executor-chrome-profile, not .chrome-profile
  
  console.log(`[EXECUTOR_VERIFY] Using profile: ${BROWSER_USER_DATA_DIR}`);
  
  // Ensure profile dir exists
  const fs = await import('fs');
  if (!fs.existsSync(BROWSER_USER_DATA_DIR)) {
    fs.mkdirSync(BROWSER_USER_DATA_DIR, { recursive: true });
  }
  
  const context = await chromium.launchPersistentContext(BROWSER_USER_DATA_DIR, {
    headless: true,
    channel: 'chrome',
    args: [
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 720 },
  });
  const page = await context.newPage();
  
  // Verify auth first
  console.log('[EXECUTOR_VERIFY] 🔍 Verifying authentication...');
  const whoami = await checkWhoami(page);
  
  if (!whoami.logged_in) {
    console.error(`[EXECUTOR_VERIFY] FATAL not logged in`);
    console.error(`   reason: ${whoami.reason}`);
    console.error(`   url: ${whoami.url}`);
    console.error(`\n[EXECUTOR_VERIFY] 🔐 Authentication required:`);
    console.error(`   Profile: ${BROWSER_USER_DATA_DIR}`);
    console.error(`   To authenticate:`);
    console.error(`   1. Run: EXECUTION_MODE=executor RUNNER_MODE=true RUNNER_PROFILE_DIR=./.runner-profile pnpm run executor:auth`);
    console.error(`   2. Or use CDP mode: pnpm run runner:chrome-cdp`);
    console.error(`   3. Then re-run this verification script`);
    await page.close();
    await context.close();
    process.exit(1);
  }
  
  console.log(`[EXECUTOR_VERIFY] ✅ Authenticated: logged_in=true handle=${whoami.handle || 'unknown'}\n`);
  
  const results: VerificationResult[] = [];
  let attempted = 0;
  let ok = 0;
  let forbidden = 0;
  let deleted = 0;
  let login_wall = 0;
  let timeout = 0;
  
  for (const candidate of candidatesToVerify) {
    const tweetId = candidate.target_tweet_id;
    const tweetUrl = candidate.target_tweet_url || `https://x.com/i/web/status/${tweetId}`;
    
    attempted++;
    console.log(`[${attempted}/${candidates.length}] Verifying ${tweetId}...`);
    
    if (dryRun) {
      console.log(`   [DRY-RUN] Would verify: ${tweetUrl}`);
      continue;
    }
    
    try {
      const result = await verifyCandidate(page, tweetId, tweetUrl);
      results.push(result);
      
      // Update DB
      await supabase
        .from('reply_opportunities')
        .update({
          accessibility_status: result.status,
          accessibility_checked_at: new Date().toISOString(),
          accessibility_reason: result.reason,
        })
        .eq('target_tweet_id', tweetId);
      
      // Count results
      if (result.status === 'ok') ok++;
      else if (result.status === 'forbidden') forbidden++;
      else if (result.status === 'deleted') deleted++;
      else if (result.status === 'login_wall') login_wall++;
      else if (result.status === 'timeout') timeout++;
      
      console.log(`   ✅ ${result.status}: ${result.reason}`);
      
      // Small delay between verifications
      await page.waitForTimeout(1000);
      
    } catch (error: any) {
      console.error(`   ❌ Error: ${error.message}`);
      timeout++;
    }
  }
  
  await page.close();
  await context.close();
  
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('📊 Summary:');
  console.log(`   attempted=${attempted}`);
  console.log(`   ok=${ok}`);
  console.log(`   forbidden=${forbidden}`);
  console.log(`   deleted=${deleted}`);
  console.log(`   login_wall=${login_wall}`);
  console.log(`   timeout=${timeout}`);
  console.log('═══════════════════════════════════════════════════════════\n');
  
  if (dryRun) {
    console.log('[DRY-RUN] No changes made');
  } else {
    console.log(`✅ Verified ${attempted} candidates`);
  }
  
  process.exit(0);
}

main().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
