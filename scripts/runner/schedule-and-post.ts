#!/usr/bin/env tsx
/**
 * 🎯 MAC RUNNER SCHEDULER + POSTER
 * 
 * Converts reply_candidate_queue → reply_decisions → posts
 * Uses CDP-authenticated Chrome session
 */

import fs from 'fs';
import path from 'path';

// Load .env.local first
const envLocalPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
  require('dotenv').config({ path: envLocalPath });
} else {
  require('dotenv').config();
}

// Set runner mode
process.env.RUNNER_MODE = 'true';
if (!process.env.RUNNER_PROFILE_DIR) {
  process.env.RUNNER_PROFILE_DIR = path.join(process.cwd(), '.runner-profile');
}
if (!process.env.RUNNER_BROWSER) {
  process.env.RUNNER_BROWSER = 'cdp';
}

async function main() {
  const isLoop = process.argv.includes('--loop');
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           🎯 MAC RUNNER SCHEDULER + POSTER');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  if (isLoop) {
    console.log('🔄 Loop mode: Running every 60s with backoff\n');
  }
  
  // Step 1: Auto-sync env (fail-closed)
  console.log('📥 Step 1: Syncing env from Railway...');
  try {
    const { execSync } = require('child_process');
    execSync('pnpm run runner:autosync', { stdio: 'inherit' });
    console.log('✅ Env synced\n');
  } catch (error: any) {
    console.error(`❌ Env sync failed: ${error.message}`);
    process.exit(1);
  }
  
  // Step 2: Check session
  console.log('🔐 Step 2: Checking session...');
  const { execSync } = require('child_process');
  try {
    const sessionOutput = execSync(
      'RUNNER_MODE=true RUNNER_PROFILE_DIR=./.runner-profile RUNNER_BROWSER=cdp pnpm exec tsx scripts/runner/session-check.ts',
      { encoding: 'utf-8', stdio: 'pipe' }
    );
    
    if (!sessionOutput.includes('SESSION_OK')) {
      console.error('❌ Session expired. Run: pnpm run runner:login');
      process.exit(1);
    }
    console.log('✅ Session OK\n');
  } catch (error: any) {
    console.error(`❌ Session check failed: ${error.message}`);
    process.exit(1);
  }
  
  // Step 3: Lazy import after env is loaded
  const { getSupabaseClient } = await import('../../src/db');
  const supabase = getSupabaseClient();
  
  // Step 4: Fetch candidates from queue (prefer fresh ones created after runStartedAt if provided)
  console.log('📋 Step 3: Fetching candidates from reply_candidate_queue...');
  const runStartedAt = process.env.RUN_STARTED_AT || null;
  
  // Try to fetch fresh candidates first (created after runStartedAt)
  let candidates: any[] | null = null;
  let candidatesAreFresh = false;
  
  if (runStartedAt) {
    const { data: freshCandidates, error: freshError } = await supabase
      .from('reply_candidate_queue')
      .select('*')
      .eq('status', 'queued')
      .gt('expires_at', new Date().toISOString())
      .gte('created_at', runStartedAt)
      .order('predicted_tier', { ascending: true })
      .order('overall_score', { ascending: false })
      .limit(5);
    
    if (!freshError && freshCandidates && freshCandidates.length > 0) {
      candidates = freshCandidates;
      candidatesAreFresh = true;
      console.log(`✅ Found ${candidates.length} fresh candidates (created after ${runStartedAt})\n`);
    }
  }
  
  // Fallback to any queued candidates if no fresh ones found
  if (!candidates || candidates.length === 0) {
    const { data: allCandidates, error: queueError } = await supabase
      .from('reply_candidate_queue')
      .select('*')
      .eq('status', 'queued')
      .gt('expires_at', new Date().toISOString())
      .order('predicted_tier', { ascending: true })
      .order('overall_score', { ascending: false })
      .limit(5);
    
    if (queueError) {
      console.error(`❌ Failed to fetch candidates: ${queueError.message}`);
      process.exit(1);
    }
    
    if (!allCandidates || allCandidates.length === 0) {
      console.log('⚠️  No candidates available in queue');
      process.exit(0);
    }
    
    candidates = allCandidates;
    if (runStartedAt) {
      console.log(`⚠️  WARNING: No fresh candidates found, using existing queue (may contain stale candidates)\n`);
    }
    console.log(`✅ Found ${candidates.length} candidates\n`);
  }
  
  // Step 5: Process candidates through scheduler (one at a time)
  let decisionsCreated = 0;
  let postedSuccess = 0;
  let postedFailed = 0;
  const failureReasons: Record<string, number> = {};
  
  // attemptScheduledReply processes one candidate and creates reply_decisions
  // We'll call it once per candidate
  for (let i = 0; i < Math.min(candidates.length, 3); i++) { // Limit to 3 per run
    const candidate = candidates[i];
    try {
      console.log(`\n🎯 Processing candidate ${i + 1}/${Math.min(candidates.length, 3)}: ${candidate.candidate_tweet_id} (tier=${candidate.predicted_tier}, score=${candidate.overall_score})`);
      
      // Run tieredScheduler (it fetches from queue internally and creates reply_decisions)
      const { attemptScheduledReply } = await import('../../src/jobs/replySystemV2/tieredScheduler');
      const schedulerResult = await attemptScheduledReply();
      
      if (schedulerResult.posted) {
        decisionsCreated++;
        console.log(`   ✅ Decision created and queued: ${schedulerResult.candidate_tweet_id || candidate.candidate_tweet_id}`);
        
        // Wait a moment for decision to be written
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Immediately process posting queue
        console.log(`   📮 Processing posting queue...`);
        const { processPostingQueue } = await import('../../src/jobs/postingQueue');
        await processPostingQueue({ maxItems: 1 });
        
        // Wait for posting to complete
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Check if it posted successfully
        const { data: recentPosts } = await supabase
          .from('system_events')
          .select('event_type, event_data, created_at')
          .eq('event_type', 'POST_SUCCESS')
          .order('created_at', { ascending: false })
          .limit(1);
        
        if (recentPosts && recentPosts.length > 0) {
          const post = recentPosts[0];
          const data = typeof post.event_data === 'string' ? JSON.parse(post.event_data) : post.event_data;
          const postTime = new Date(post.created_at).getTime();
          const now = Date.now();
          
          // Only count if posted in last 10 seconds
          if (now - postTime < 10000) {
            postedSuccess++;
            console.log(`   ✅ POST_SUCCESS: ${data.tweet_url || `https://x.com/i/status/${data.posted_reply_tweet_id}`}`);
          }
        } else {
          // Check for POST_FAILED
          const { data: failedPosts } = await supabase
            .from('system_events')
            .select('event_type, event_data, created_at')
            .eq('event_type', 'POST_FAILED')
            .order('created_at', { ascending: false })
            .limit(1);
          
          if (failedPosts && failedPosts.length > 0) {
            const failed = failedPosts[0];
            const failedTime = new Date(failed.created_at).getTime();
            const now = Date.now();
            
            if (now - failedTime < 10000) {
              postedFailed++;
              const data = typeof failed.event_data === 'string' ? JSON.parse(failed.event_data) : failed.event_data;
              const reason = data.deny_reason_code || data.reason || 'unknown';
              failureReasons[reason] = (failureReasons[reason] || 0) + 1;
              console.log(`   ❌ POST_FAILED: ${reason}`);
            }
          }
        }
      } else {
        console.log(`   ⏭️  Scheduler skipped: ${schedulerResult.reason || 'unknown'}`);
        failureReasons[schedulerResult.reason || 'skipped'] = (failureReasons[schedulerResult.reason || 'skipped'] || 0) + 1;
      }
    } catch (error: any) {
      console.error(`   ❌ Error processing candidate: ${error.message}`);
      failureReasons['error'] = (failureReasons['error'] || 0) + 1;
    }
  }
  
  // Final summary
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           📊 SCHEDULER SUMMARY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  console.log(`Candidates fetched: ${candidates.length}`);
  console.log(`Decisions created: ${decisionsCreated}`);
  console.log(`POST_SUCCESS: ${postedSuccess}`);
  console.log(`POST_FAILED: ${postedFailed}`);
  
  if (Object.keys(failureReasons).length > 0) {
    console.log('\nTop failure reasons:');
    Object.entries(failureReasons)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .forEach(([reason, count]) => {
        console.log(`   ${reason}: ${count}`);
      });
  }
  
  console.log('');
  
  // Loop mode
  if (isLoop) {
    const delay = 60 * 1000; // 60 seconds
    console.log(`⏰ Waiting ${delay / 1000}s before next run...\n`);
    await new Promise(resolve => setTimeout(resolve, delay));
    return main(); // Recursive call
  }
}

main().catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
