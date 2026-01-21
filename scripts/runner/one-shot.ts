#!/usr/bin/env tsx
/**
 * 🚀 RUNNER ONE-SHOT
 * 
 * Orchestrates the full Mac Runner workflow in a single run:
 * 1. Auto-sync env from Railway
 * 2. Reset Chrome CDP
 * 3. Session check
 * 4. Harvest opportunities
 * 5. Evaluate opportunities → candidate_evaluations
 * 6. Refresh candidate queue
 * 7. Schedule decisions
 * 8. Process posting queue
 * 9. Verify POST_SUCCESS and print summary
 * 
 * Usage:
 *   pnpm run runner:one-shot
 */

import { spawn, execSync } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { enforceCDPMode } from './enforce-cdp';

const exec = promisify(execSync);

const RUNNER_PROFILE_DIR = process.env.RUNNER_PROFILE_DIR || path.join(process.cwd(), '.runner-profile');

// Enforce CDP mode
enforceCDPMode();

interface ExecResult {
  success: boolean;
  output: string;
  exitCode: number;
}

/**
 * Execute command with live output streaming
 */
function execLive(command: string, description: string): Promise<ExecResult> {
  return new Promise((resolve) => {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📋 ${description}`);
    console.log(`${'='.repeat(80)}\n`);
    
    const [cmd, ...args] = command.split(' ');
    const child = spawn(cmd, args, {
      stdio: 'inherit',
      cwd: process.cwd(),
      shell: true,
    });
    
    let output = '';
    
    child.on('close', (code) => {
      resolve({
        success: code === 0,
        output,
        exitCode: code || 0,
      });
    });
    
    child.on('error', (error) => {
      resolve({
        success: false,
        output: error.message,
        exitCode: 1,
      });
    });
  });
}

/**
 * Extract POST_SUCCESS tweet URL from database
 */
async function extractTweetUrl(runStartedAt?: string): Promise<string | null> {
  try {
    // Load env
    const envLocalPath = path.join(process.cwd(), '.env.local');
    const envPath = path.join(process.cwd(), '.env');
    if (fs.existsSync(envLocalPath)) {
      require('dotenv').config({ path: envLocalPath });
    } else if (fs.existsSync(envPath)) {
      require('dotenv').config({ path: envPath });
    }
    
    const { getSupabaseClient } = await import('../../src/db');
    const supabase = getSupabaseClient();
    
    // Get most recent POST_SUCCESS (filtered by run start time if provided)
    const cutoffTime = runStartedAt || new Date(Date.now() - 240 * 60 * 1000).toISOString();
    const { data: successEvent } = await supabase
      .from('system_events')
      .select('event_data, created_at')
      .eq('event_type', 'POST_SUCCESS')
      .gte('created_at', cutoffTime)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (successEvent?.event_data) {
      const eventData = typeof successEvent.event_data === 'string'
        ? JSON.parse(successEvent.event_data)
        : successEvent.event_data;
      
      const tweetId = eventData?.posted_reply_tweet_id || eventData?.tweet_id;
      if (tweetId) {
        return `https://x.com/i/status/${tweetId}`;
      }
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Main workflow
 */
async function main() {
  // Capture run start time for filtering counts
  const runStartedAt = new Date().toISOString();
  
  console.log('\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           🚀 RUNNER ONE-SHOT WORKFLOW');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  
  // Step 1: Auto-sync env from Railway
  console.log('STEP 1: Auto-syncing env from Railway...');
  await execLive('pnpm run runner:autosync', 'Auto-sync env');
  
  // Step 2: Reset Chrome CDP
  console.log('\nSTEP 2: Resetting Chrome CDP...');
  await execLive('RUNNER_MODE=true RUNNER_PROFILE_DIR=' + RUNNER_PROFILE_DIR + ' tsx scripts/runner/reset-chrome.ts', 'Reset Chrome');
  
  // Step 3: Session check
  console.log('\nSTEP 3: Checking session...');
  const sessionResult = await execLive('RUNNER_MODE=true RUNNER_PROFILE_DIR=' + RUNNER_PROFILE_DIR + ' RUNNER_BROWSER=cdp pnpm run runner:session', 'Session check');
  
  if (sessionResult.exitCode !== 0 || sessionResult.output.includes('SESSION_EXPIRED')) {
    console.error('\n❌ SESSION_EXPIRED - Login required');
    console.error('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('           🔐 LOGIN REQUIRED');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('\nPlease complete login/2FA in Chrome until you are on https://x.com/home');
    console.error('Then rerun:');
    console.error('  HARVEST_IGNORE_STATE=true ONE_SHOT_FRESH_ONLY=true pnpm run runner:one-shot');
    console.error('');
    
    // Try to run login helper
    console.log('Running login helper...');
    await execLive('pnpm run runner:login', 'Login helper');
    console.error('\n⚠️  Please complete login in Chrome, then rerun the command above\n');
    process.exit(2);
  }
  
  console.log('✅ Session OK - proceeding with workflow\n');
  
  // Step 4: Harvest opportunities (default mode is curated_profile_posts) - enforce HARVEST_IGNORE_STATE=true
  const harvestIgnoreState = process.env.HARVEST_IGNORE_STATE !== 'false'; // Default to true unless explicitly false
  console.log('\nSTEP 4: Harvesting opportunities...');
  let opportunitiesInserted = 0;
  try {
    const harvestOutput = execSync(
      `HARVEST_MODE=curated_profile_posts HARVEST_IGNORE_STATE=${harvestIgnoreState ? 'true' : 'false'} RUNNER_MODE=true RUNNER_PROFILE_DIR=${RUNNER_PROFILE_DIR} RUNNER_BROWSER=cdp pnpm exec tsx scripts/runner/harvest-curated.ts`,
      { encoding: 'utf-8', stdio: 'pipe', timeout: 120000 } // 120s timeout (harvest can be slow, ~110s observed)
    );
    
    const insertMatch = harvestOutput.match(/Inserted:\s*(\d+)/);
    opportunitiesInserted = insertMatch ? parseInt(insertMatch[1], 10) : 0;
    console.log(`✅ Harvest complete: ${opportunitiesInserted} opportunities inserted`);
    console.log(harvestOutput);
  } catch (error: any) {
    if (error.signal === 'SIGTERM' || error.message.includes('timeout')) {
      console.error(`❌ Harvest TIMED OUT after 120s - step hung at harvest`);
      process.exit(1);
    }
    console.error(`⚠️  Harvest failed: ${error.message}`);
  }
  
  // Step 5: Evaluate opportunities → candidate_evaluations (lightweight, no browser/X session)
  console.log('\nSTEP 5: Evaluating opportunities...');
  let opportunitiesEvaluated = 0;
  let candidateEvaluationsCreated = 0;
  let candidateEvaluationsFailed = 0;
  try {
    // Load env before import
    const envLocalPath = path.join(process.cwd(), '.env.local');
    const envPath = path.join(process.cwd(), '.env');
    if (fs.existsSync(envLocalPath)) {
      require('dotenv').config({ path: envLocalPath });
    } else if (fs.existsSync(envPath)) {
      require('dotenv').config({ path: envPath });
    }
    
    const { getSupabaseClient } = await import('../../src/db');
    const supabase = getSupabaseClient();
    
    // Get opportunities from this run
    const { data: opportunities, error: fetchError } = await supabase
      .from('reply_opportunities')
      .select('target_tweet_id, target_username, target_tweet_content, tweet_posted_at, opportunity_score, discovery_method, account_username, is_root_tweet, root_tweet_id, target_in_reply_to_tweet_id')
      .gte('created_at', runStartedAt)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    
    if (fetchError) {
      console.error(`⚠️  Failed to fetch opportunities: ${fetchError.message}`);
    } else if (!opportunities || opportunities.length === 0) {
      console.log(`⚠️  No opportunities to evaluate (inserted: ${opportunitiesInserted})`);
    } else {
      console.log(`📋 Found ${opportunities.length} opportunities to evaluate...`);
      
      // Generate feed run ID for traceability
      const feedRunId = `one-shot-${Date.now()}`;
      
      // Lightweight scoring helpers (no browser/X session required)
      const scorerModule = await import('../../src/jobs/replySystemV2/candidateScorer');
      const calculateTopicRelevance = scorerModule.calculateTopicRelevance;
      const calculateSpamScore = scorerModule.calculateSpamScore;
      const calculateVelocityScore = scorerModule.calculateVelocityScore;
      const calculateRecencyScore = scorerModule.calculateRecencyScore;
      
      for (const opp of opportunities) {
        try {
          opportunitiesEvaluated++;
          
          // Validate required fields
          if (!opp.target_tweet_id) {
            console.error(`   ❌ Skipped opportunity (no tweet_id)`);
            candidateEvaluationsFailed++;
            continue;
          }
          
          const tweetId = opp.target_tweet_id;
          const authorUsername = opp.target_username || opp.account_username || 'unknown';
          const content = opp.target_tweet_content || '';
          const postedAt = opp.tweet_posted_at || new Date().toISOString();
          
          // Ensure postedAt is a valid ISO string
          let validPostedAt: string;
          try {
            const postedDate = new Date(postedAt);
            if (isNaN(postedDate.getTime())) {
              validPostedAt = new Date().toISOString();
            } else {
              validPostedAt = postedDate.toISOString();
            }
          } catch {
            validPostedAt = new Date().toISOString();
          }
          
          console.log(`   🔍 Evaluating ${tweetId} by @${authorUsername}...`);
          
          // Trust is_root_tweet from opportunities (no browser check)
          const isRoot = opp.is_root_tweet ?? true;
          
          // Lightweight scoring (no OpenAI judge, no browser checks)
          let score: any;
          let evaluationError: string | null = null;
          
          try {
            // Calculate basic scores
            const topicRelevance = calculateTopicRelevance(content);
            const spamScore = calculateSpamScore(content);
            const ageMinutes = Math.max(0.1, (Date.now() - new Date(validPostedAt).getTime()) / (1000 * 60));
            const velocityScore = calculateVelocityScore(0, 0, 0, ageMinutes); // No engagement metrics available
            const recencyScore = calculateRecencyScore(ageMinutes);
            
            // Author signal (simplified - check curated accounts only)
            let authorSignalScore = 0.2; // Default for unknown
            try {
              const { data: curated } = await supabase
                .from('curated_accounts')
                .select('signal_score')
                .eq('username', authorUsername.toLowerCase())
                .eq('enabled', true)
                .maybeSingle();
              if (curated) {
                authorSignalScore = curated.signal_score || 0.5;
              }
            } catch (err) {
              // Fail-soft: use default
            }
            
            // Calculate overall score (heuristic, no OpenAI)
            const overallScore = (
              topicRelevance * 0.25 +
              (1 - spamScore) * 0.15 +
              velocityScore * 0.35 +
              recencyScore * 0.15 +
              authorSignalScore * 0.10
            ) * 100;
            
            // Hard filters (using is_root_tweet from opportunities)
            const passedHardFilters = isRoot && spamScore <= 0.7 && content.trim().length >= 20;
            const filterReason = !isRoot ? 'not_root_tweet' : 
                                spamScore > 0.7 ? `high_spam_score_${spamScore.toFixed(2)}` :
                                content.trim().length < 20 ? `insufficient_text_${content.trim().length}` :
                                '';
            
            // Estimate 24h views (conservative, no engagement data)
            const predicted24hViews = Math.round(500 * (1 + topicRelevance)); // Base 500, boost for relevance
            const predictedTier = predicted24hViews >= 5000 ? 1 : predicted24hViews >= 2000 ? 2 : predicted24hViews >= 500 ? 3 : 4;
            
            score = {
              is_root_tweet: isRoot,
              is_parody: false,
              topic_relevance_score: topicRelevance,
              spam_score: spamScore,
              velocity_score: velocityScore,
              recency_score: recencyScore,
              author_signal_score: authorSignalScore,
              overall_score: overallScore,
              passed_hard_filters: passedHardFilters,
              filter_reason: filterReason,
              predicted_24h_views: predicted24hViews,
              predicted_tier: predictedTier,
              judge_decision: null, // No OpenAI judge call
            };
          } catch (scoringError: any) {
            evaluationError = scoringError.message;
            // Fallback score
            score = {
              is_root_tweet: isRoot,
              is_parody: false,
              topic_relevance_score: 0.5,
              spam_score: 0.3,
              velocity_score: 0.5,
              recency_score: 0.8,
              author_signal_score: 0.2,
              overall_score: 50,
              passed_hard_filters: isRoot && content.trim().length >= 20,
              filter_reason: evaluationError ? `scoring_error: ${evaluationError}` : '',
              predicted_24h_views: 500,
              predicted_tier: 3,
              judge_decision: null,
            };
          }
          
          // Check if evaluation already exists
          const { data: existing } = await supabase
            .from('candidate_evaluations')
            .select('id')
            .eq('candidate_tweet_id', tweetId)
            .maybeSingle();
          
          if (existing) {
            console.log(`   ⏭️  Skipped ${tweetId}: already evaluated`);
            continue;
          }
          
          // Insert evaluation (with fallback scores if scoring failed)
          const { error: insertError } = await supabase
            .from('candidate_evaluations')
            .insert({
              candidate_tweet_id: tweetId,
              candidate_author_username: authorUsername,
              candidate_content: content,
              candidate_posted_at: validPostedAt,
              source_id: tweetId,
              source_type: 'reply_opportunity',
              source_feed_name: opp.discovery_method || 'one_shot',
              feed_run_id: feedRunId,
              is_root_tweet: isRoot,
              is_parody: false,
              topic_relevance_score: score.topic_relevance_score,
              spam_score: score.spam_score,
              velocity_score: score.velocity_score,
              recency_score: score.recency_score,
              author_signal_score: score.author_signal_score,
              overall_score: score.overall_score,
              passed_hard_filters: score.passed_hard_filters,
              filter_reason: evaluationError ? `${score.filter_reason} (fallback due to: ${evaluationError})` : score.filter_reason,
              predicted_24h_views: score.predicted_24h_views,
              predicted_tier: score.predicted_tier,
              status: score.passed_hard_filters ? 'evaluated' : 'blocked',
              ai_judge_decision: null, // No OpenAI judge (lightweight evaluation)
              judge_relevance: null,
              judge_replyability: null,
            });
          
          if (insertError) {
            candidateEvaluationsFailed++;
            if (insertError.message.includes('duplicate') || insertError.message.includes('unique')) {
              console.log(`   ⏭️  Skipped ${tweetId}: duplicate evaluation`);
            } else {
              console.error(`   ❌ Failed to evaluate ${tweetId}: ${insertError.message}`);
            }
          } else {
            candidateEvaluationsCreated++;
            const statusIcon = evaluationError ? '⚠️' : '✅';
            console.log(`   ${statusIcon} Evaluated ${tweetId} (score: ${score.overall_score.toFixed(1)}, tier: ${score.predicted_tier}, passed: ${score.passed_hard_filters}${evaluationError ? ', fallback scores' : ''})`);
          }
        } catch (error: any) {
          candidateEvaluationsFailed++;
          console.error(`   ❌ Evaluation error for ${opp?.target_tweet_id || 'unknown'}: ${error.message}`);
        }
      }
      
      console.log(`✅ Evaluation complete: ${opportunitiesEvaluated} evaluated, ${candidateEvaluationsCreated} created, ${candidateEvaluationsFailed} failed`);
    }
  } catch (error: any) {
    console.error(`⚠️  Evaluation failed: ${error.message}`);
  }
  
  // Fail-closed safety: if opportunities were inserted but none evaluated, error
  if (opportunitiesInserted > 0 && opportunitiesEvaluated === 0) {
    console.error('\n❌ EVALUATION_MISSING_OR_FAILED: Opportunities inserted but none evaluated');
    console.error(`   Opportunities inserted: ${opportunitiesInserted}`);
    console.error(`   Opportunities evaluated: ${opportunitiesEvaluated}`);
    console.error('   This indicates a systemic issue - opportunities are not being evaluated');
    process.exit(1);
  }
  
  // Step 5a: Refresh candidate queue (evaluations → queue) - 30s timeout
  console.log('\nSTEP 5a: Refreshing candidate queue...');
  let candidatesQueued = 0;
  try {
    // Load env before import
    const envLocalPath = path.join(process.cwd(), '.env.local');
    const envPath = path.join(process.cwd(), '.env');
    if (fs.existsSync(envLocalPath)) {
      require('dotenv').config({ path: envLocalPath });
    } else if (fs.existsSync(envPath)) {
      require('dotenv').config({ path: envPath });
    }
    
    const queueStartTime = Date.now();
    const { refreshCandidateQueue } = await import('../../src/jobs/replySystemV2/queueManager');
    const queueResult = await refreshCandidateQueue();
    const queueDuration = Date.now() - queueStartTime;
    
    if (queueDuration > 30000) {
      console.error(`❌ Queue refresh TIMED OUT after ${queueDuration}ms - step hung at queue refresh`);
      process.exit(1);
    }
    
    candidatesQueued = queueResult.queued || 0;
    console.log(`✅ Queue refresh complete: ${candidatesQueued} candidates queued`);
  } catch (error: any) {
    console.error(`⚠️  Queue refresh failed: ${error.message}`);
  }
  
  // Step 5b: Cleanup bad candidates from queue (replies, off-limits, old)
  console.log('\nSTEP 5b: Cleaning up candidate queue...');
  let candidatesRemoved = 0;
  try {
    const cleanupOutput = execSync(
      'RUNNER_MODE=true RUNNER_PROFILE_DIR=' + RUNNER_PROFILE_DIR + ' pnpm exec tsx scripts/runner/cleanup-candidate-queue.ts',
      { encoding: 'utf-8', stdio: 'pipe', timeout: 30000 } // 30s timeout
    );
    
    // Extract count of removed candidates
    const removedMatch = cleanupOutput.match(/Deleting (\d+) candidates/);
    candidatesRemoved = removedMatch ? parseInt(removedMatch[1], 10) : 0;
    
    console.log(cleanupOutput);
  } catch (error: any) {
    if (error.signal === 'SIGTERM' || error.message.includes('timeout')) {
      console.error(`❌ Cleanup TIMED OUT after 30s - step hung at cleanup`);
      process.exit(1);
    }
    console.error(`⚠️  Cleanup failed: ${error.message}`);
  }
  
  // Step 6: Schedule and create decisions - limit to 10 fresh candidates for speed, stop early on success
  console.log('\nSTEP 6: Scheduling decisions...');
  let candidatesProcessed = 0;
  let decisionsCreated = 0;
  let gateReasons: Record<string, number> = {};
  try {
    // Pass runStartedAt to scheduler and limit to 10 candidates for speed
    const scheduleOutput = execSync(
      `RUN_STARTED_AT=${runStartedAt} SCHEDULER_DEBUG_LIMIT=10 RUNNER_MODE=true RUNNER_PROFILE_DIR=${RUNNER_PROFILE_DIR} RUNNER_BROWSER=cdp pnpm run runner:schedule-once`,
      { encoding: 'utf-8', stdio: 'pipe', timeout: 120000 } // 120s timeout for up to 10 candidates
    );
    
    const candidatesMatch = scheduleOutput.match(/Candidates fetched:\s*(\d+)/);
    candidatesProcessed = candidatesMatch ? parseInt(candidatesMatch[1], 10) : 0;
    
    const decisionsMatch = scheduleOutput.match(/Decisions created:\s*(\d+)/);
    decisionsCreated = decisionsMatch ? parseInt(decisionsMatch[1], 10) : 0;
    
    // Extract gate reasons from scheduler output
    const gateReasonLines = scheduleOutput.split('\n').filter(line => 
      line.includes('🚫') || line.includes('BLOCKED') || line.includes('Skipped')
    );
    gateReasonLines.forEach(line => {
      const match = line.match(/(NON_HEALTH_TOPIC|CONSENT_WALL|ANCESTRY|TARGET_QUALITY|queue_empty|RUNNER_MODE_NOT_SET)/);
      if (match) {
        gateReasons[match[1]] = (gateReasons[match[1]] || 0) + 1;
      }
    });
    
    console.log(`✅ Schedule complete: ${candidatesProcessed} candidates processed, ${decisionsCreated} decisions created`);
    console.log(scheduleOutput);
    
    if (Object.keys(gateReasons).length > 0) {
      console.log('\nGate reasons from scheduler:');
      Object.entries(gateReasons).forEach(([reason, count]) => {
        console.log(`   ${reason}: ${count}`);
      });
    }
  } catch (error: any) {
    if (error.signal === 'SIGTERM' || error.message.includes('timeout')) {
      console.error(`❌ Schedule TIMED OUT after 90s - step hung at schedule`);
      console.error(`   This usually means ancestry resolution or browser operations are hanging.`);
      console.error(`   Check logs above for timeout details.`);
      // Don't exit - let it continue to post step to see if there are any decisions already created
    }
    console.error(`⚠️  Schedule failed: ${error.message}`);
  }
  
  // Step 7: Process posting queue - 60s timeout
  console.log('\nSTEP 7: Processing posting queue...');
  try {
    const postOutput = execSync(
      'RUNNER_MODE=true RUNNER_PROFILE_DIR=' + RUNNER_PROFILE_DIR + ' RUNNER_BROWSER=cdp pnpm run runner:once',
      { encoding: 'utf-8', stdio: 'pipe', timeout: 60000 } // 60s timeout
    );
    console.log(postOutput);
  } catch (error: any) {
    if (error.signal === 'SIGTERM' || error.message.includes('timeout')) {
      console.error(`❌ Post queue TIMED OUT after 60s - step hung at post queue`);
      process.exit(1);
    }
    console.error(`⚠️  Post queue failed: ${error.message}`);
  }
  
  // Step 8: Verify POST_SUCCESS
  console.log('\nSTEP 8: Verifying POST_SUCCESS events...');
  await execLive('pnpm exec tsx scripts/verify-post-success.ts --minutes=240', 'Verify POST_SUCCESS');
  
  // Load env before DB import
  const envLocalPath = path.join(process.cwd(), '.env.local');
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envLocalPath)) {
    require('dotenv').config({ path: envLocalPath });
  } else if (fs.existsSync(envPath)) {
    require('dotenv').config({ path: envPath });
  }
  
  // Get final counts from DB (filtered by run start time)
  const { getSupabaseClient } = await import('../../src/db');
  const supabase = getSupabaseClient();
  
  const { count: queuedDecisions } = await supabase
    .from('reply_decisions')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'queued')
    .gte('created_at', runStartedAt);
  
  const { data: recentDenies } = await supabase
    .from('reply_decisions')
    .select('deny_reason_code')
    .eq('decision', 'DENY')
    .gte('created_at', runStartedAt);
  
  const denyCounts: Record<string, number> = {};
  recentDenies?.forEach(d => {
    const code = d.deny_reason_code || 'NO_CODE';
    denyCounts[code] = (denyCounts[code] || 0) + 1;
  });
  
  const consentWallCount = denyCounts['CONSENT_WALL'] || 0;
  
  // Get candidate queue count
  const { count: candidatesQueuedCount } = await supabase
    .from('reply_candidate_queue')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'queued')
    .gt('expires_at', new Date().toISOString())
    .gte('created_at', runStartedAt);
  
  // Get POST_SUCCESS count (filtered by run start time)
  const { count: postSuccessCount } = await supabase
    .from('system_events')
    .select('*', { count: 'exact', head: true })
    .eq('event_type', 'POST_SUCCESS')
    .gte('created_at', runStartedAt);
  
  // Extract tweet URL from database (filtered by run start time)
  const tweetUrl = await extractTweetUrl(runStartedAt);
  
  // Check ONE_SHOT_FRESH_ONLY flag
  const freshOnly = process.env.ONE_SHOT_FRESH_ONLY === 'true';
  if (freshOnly && opportunitiesInserted === 0 && (candidatesQueuedCount || 0) === 0) {
    console.error('\n❌ ONE_SHOT_FRESH_ONLY=true: FAIL-CLOSED');
    console.error(`   Opportunities inserted: ${opportunitiesInserted}`);
    console.error(`   Candidates queued after ${runStartedAt}: ${candidatesQueuedCount || 0}`);
    console.error('   Pipeline ran but did nothing - this indicates a systemic issue');
    process.exit(1);
  }
  
  // Final summary
  console.log('\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           📊 FINAL SUMMARY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  
  console.log(`Run started at: ${runStartedAt}`);
  console.log(`Opportunities inserted: ${opportunitiesInserted}`);
  console.log(`Opportunities evaluated: ${opportunitiesEvaluated || 0}`);
  console.log(`Candidate evaluations created: ${candidateEvaluationsCreated || 0}`);
  console.log(`Candidate evaluations failed: ${candidateEvaluationsFailed || 0}`);
  console.log(`Candidates queued (after run start): ${candidatesQueuedCount || 0}`);
  console.log(`Candidates removed by cleanup: ${candidatesRemoved || 0}`);
  console.log(`Candidates processed: ${candidatesProcessed}`);
  console.log(`Decisions created: ${decisionsCreated}`);
  console.log(`Queued decisions: ${queuedDecisions || 0}`);
  console.log(`POST_SUCCESS count: ${postSuccessCount || 0}`);
  console.log(`CONSENT_WALL count: ${consentWallCount}`);
  
  // Print example inserted opportunities
  if (opportunitiesInserted > 0) {
    const { data: insertedOpps } = await supabase
      .from('reply_opportunities')
      .select('target_tweet_id, target_tweet_url, target_tweet_content, target_username')
      .gte('created_at', runStartedAt)
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (insertedOpps && insertedOpps.length > 0) {
      console.log('\nExample inserted opportunities:');
      insertedOpps.slice(0, 2).forEach((opp, i) => {
        const contentPreview = opp.target_tweet_content ? opp.target_tweet_content.substring(0, 120) : 'N/A';
        console.log(`   ${i + 1}. ${opp.target_tweet_url || `https://x.com/i/status/${opp.target_tweet_id}`}`);
        console.log(`      Author: @${opp.target_username || 'unknown'}`);
        console.log(`      Text: ${contentPreview}${opp.target_tweet_content && opp.target_tweet_content.length > 120 ? '...' : ''}`);
      });
    }
  }
  
  // Print top skip reasons
  const topDenies = Object.entries(denyCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  
  if (topDenies.length > 0) {
    console.log('\nTop skip reasons:');
    topDenies.forEach(([code, count], i) => {
      console.log(`   ${i + 1}. ${code}: ${count}`);
    });
  }
  
  // Get top 10 denied tweets with URLs and details
  const { data: deniedTweets } = await supabase
    .from('reply_decisions')
    .select('target_tweet_id, deny_reason_code, deny_reason_detail, created_at')
    .eq('decision', 'DENY')
    .gte('created_at', runStartedAt)
    .order('created_at', { ascending: false })
    .limit(10);
  
  if (deniedTweets && deniedTweets.length > 0) {
    console.log('\nTop 10 denied tweets from this run:');
    deniedTweets.forEach((d, i) => {
      const url = `https://x.com/i/status/${d.target_tweet_id}`;
      console.log(`   ${i + 1}. ${url}`);
      console.log(`      Deny reason: ${d.deny_reason_code || 'NO_CODE'}`);
      if (d.deny_reason_detail) {
        try {
          const detail = typeof d.deny_reason_detail === 'string' ? JSON.parse(d.deny_reason_detail) : d.deny_reason_detail;
          if (detail && typeof detail === 'object') {
            if (detail.isCurated !== undefined) console.log(`      isCurated: ${detail.isCurated}`);
            if (detail.author_handle_norm) console.log(`      Handle: @${detail.author_handle_norm}`);
            if (detail.extracted_text_len) console.log(`      Text length: ${detail.extracted_text_len}`);
            if (detail.first_120_chars) console.log(`      Preview: ${detail.first_120_chars.substring(0, 80)}...`);
          }
        } catch (parseError) {
          // Skip if JSON parsing fails
        }
      }
    });
  }
  
  if (tweetUrl) {
    console.log(`\n✅ POST_SUCCESS: ${tweetUrl}`);
  } else {
    console.log('\n⚠️  No POST_SUCCESS found');
    
    // Identify where pipeline died
    let pipelineStage = 'unknown';
    if (opportunitiesInserted === 0) {
      pipelineStage = 'harvest';
    } else if ((candidatesQueuedCount || 0) === 0) {
      pipelineStage = 'evaluate/queue';
    } else if (decisionsCreated === 0) {
      pipelineStage = 'schedule';
    } else if ((queuedDecisions || 0) === 0) {
      pipelineStage = 'decisions';
    } else if (postSuccessCount === 0) {
      pipelineStage = 'post';
    }
    
    console.log(`\nPipeline stopped at: ${pipelineStage}`);
    
    // Print top 5 skip/deny reasons
    const allReasons: Record<string, number> = { ...denyCounts };
    
    // Add skip reasons from harvest if available (would need to parse from harvest output)
    // For now, just show deny reasons from scheduler
    
    const top5Reasons = Object.entries(allReasons)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    
    if (top5Reasons.length > 0) {
      console.log('\nTop skip/deny reasons:');
      top5Reasons.forEach(([reason, count], i) => {
        console.log(`   ${i + 1}. ${reason}: ${count}`);
      });
    }
    
    // Print debug artifact paths
    const consentDebugDir = path.join(RUNNER_PROFILE_DIR, 'consent_debug');
    const harvestDebugDir = path.join(RUNNER_PROFILE_DIR, 'harvest_debug');
    const debugPaths: string[] = [];
    
    if (fs.existsSync(consentDebugDir)) {
      const artifacts = fs.readdirSync(consentDebugDir).filter(f => f.includes('consent_wall_'));
      artifacts.slice(0, 3).forEach(artifact => {
        debugPaths.push(path.join(consentDebugDir, artifact));
      });
    }
    
    if (fs.existsSync(harvestDebugDir)) {
      const artifacts = fs.readdirSync(harvestDebugDir);
      artifacts.slice(0, 3).forEach(artifact => {
        debugPaths.push(path.join(harvestDebugDir, artifact));
      });
    }
    
    if (debugPaths.length > 0) {
      console.log('\nDebug artifacts:');
      debugPaths.forEach(path => {
        console.log(`   ${path}`);
      });
    }
  }
  
  console.log('');
  console.log('✅ One-shot workflow complete');
  console.log('');
}

main().catch((error) => {
  console.error('❌ One-shot workflow failed:', error);
  process.exit(1);
});
