/**
 * 📊 METRICS SCRAPER JOB
 * 
 * SMART BATCH FIX: Scheduled job to collect metrics from posted tweets
 * Runs every 10 minutes to ensure we have fresh data for learning
 */

import { log } from '../lib/logger';
import { getSupabaseClient } from '../db';
import { BulletproofTwitterScraper } from '../scrapers/bulletproofTwitterScraper';
import { ScrapingOrchestrator } from '../metrics/scrapingOrchestrator';
import { validatePostsForScraping, validateTweetIdForScraping } from './metricsScraperValidation';
import {
  calculateV2ObjectiveMetrics,
  extractContentStructureTypes,
  type FollowerAttributionData,
  type EngagementMetrics
} from '../utils/v2ObjectiveScoreCalculator';
import { logScrapeAudit } from '../utils/scrapeAuditLogger';
import { recordAction, updateOutcomes } from '../strategy/growthLedgerWriter';
import { scheduleCheckpoints } from '../strategy/checkpointScraper';

const parseMetricValue = (value: unknown): number | null => {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string') {
    const normalized = value.replace(/,/g, '').trim();
    if (normalized.length === 0) {
      return null;
    }
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const toNumberWithFallback = (value: unknown, fallback = 0): number => {
  const parsed = parseMetricValue(value);
  return parsed === null ? fallback : parsed;
};

export async function metricsScraperJob(): Promise<void> {
  log({ op: 'metrics_scraper_start' });
  if (!process.env.USE_ANALYTICS_PAGE) {
    process.env.USE_ANALYTICS_PAGE = 'false';
  }
  
  // ✅ MEMORY OPTIMIZATION: Check memory before starting
  try {
    const { isMemorySafeForOperation } = await import('../utils/memoryOptimization');
    const memoryCheck = await isMemorySafeForOperation(100, 1400);
    if (!memoryCheck.safe) {
      console.warn(`[METRICS_JOB] ⚠️ Low memory (${memoryCheck.currentMB}MB), skipping this run`);
      log({ op: 'metrics_scraper_skipped', reason: 'low_memory', memoryMB: memoryCheck.currentMB });
      return;
    }
  } catch (error) {
    // If memory check fails, continue anyway (don't block operations)
    console.warn('[METRICS_JOB] ⚠️ Memory check failed, continuing:', error);
  }
  
  // Get Sentry if available (optional)
  let Sentry: any = null;
  try {
    Sentry = (await import('../observability/instrument')).Sentry;
  } catch {
    // Sentry not available, continue without it
  }
  
  // Execute job with optional Sentry span
  const executeJob = async () => {
  try {
    const supabase = getSupabaseClient();

    let allPostsRaw: any[];
    let postsError: any = null;

    const controlledDecisionId = process.env.CONTROLLED_DECISION_ID?.trim();
    const controlledTweetId = process.env.CONTROLLED_TWEET_ID?.trim();

    let missingCount = 0;
    let recentCount = 0;
    let historicalCount = 0;

    if (controlledDecisionId || controlledTweetId) {
      // Use base table so controlled proof works when content_metadata view is out of sync
      let query = supabase
        .from('content_generation_metadata_comprehensive')
        .select('decision_id, tweet_id, posted_at, metrics_scrape_attempts, metrics_last_scrape_at')
        .eq('status', 'posted')
        .not('tweet_id', 'is', null)
        .in('decision_type', ['single', 'thread', 'reply']);
      if (controlledDecisionId) query = query.eq('decision_id', controlledDecisionId);
      else query = query.eq('tweet_id', controlledTweetId!);
      const { data: controlledRow, error: controlledErr } = await query.maybeSingle();
      if (controlledErr) {
        console.error('[METRICS_JOB] ❌ Controlled fetch failed:', controlledErr.message);
        return;
      }
      if (!controlledRow) {
        console.log('[METRICS_JOB] ℹ️ No post found for CONTROLLED_DECISION_ID/CONTROLLED_TWEET_ID');
        return;
      }
      allPostsRaw = [controlledRow];
    } else {
      // 🔒 Only scrape tweets posted after RAMP_START_DATE to avoid visiting suspended account pages
      const rampStart = process.env.RAMP_START_DATE || '2026-03-23T00:00:00Z';

      // PRIORITY 1: Posts missing metrics (last 7 days) - scrape aggressively
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const { data: missingMetricsPosts, error: missingError } = await supabase
        .from('content_generation_metadata_comprehensive')
        .select('decision_id, tweet_id, posted_at, metrics_scrape_attempts, metrics_last_scrape_at')
        .eq('status', 'posted')
        .not('tweet_id', 'is', null)
        .in('decision_type', ['single', 'thread', 'reply'])
        .gte('posted_at', rampStart)
        .gte('posted_at', sevenDaysAgo.toISOString())
        .or('actual_impressions.is.null,actual_impressions.eq.0')
        .order('posted_at', { ascending: false })
        .limit(15);

      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const { data: recentPosts, error: recentError } = await supabase
        .from('content_generation_metadata_comprehensive')
        .select('decision_id, tweet_id, posted_at, metrics_scrape_attempts, metrics_last_scrape_at')
        .eq('status', 'posted')
        .not('tweet_id', 'is', null)
        .in('decision_type', ['single', 'thread', 'reply'])
        .gte('posted_at', rampStart)
        .gte('posted_at', oneDayAgo.toISOString())
        .order('posted_at', { ascending: false })
        .limit(5);

      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const { data: historicalPosts, error: historicalError } = await supabase
        .from('content_generation_metadata_comprehensive')
        .select('decision_id, tweet_id, posted_at, metrics_scrape_attempts, metrics_last_scrape_at')
        .eq('status', 'posted')
        .not('tweet_id', 'is', null)
        .in('decision_type', ['single', 'thread', 'reply'])
        .gte('posted_at', rampStart)
        .lt('posted_at', sevenDaysAgo.toISOString())
        .gte('posted_at', thirtyDaysAgo.toISOString())
        .or('actual_impressions.is.null,actual_impressions.eq.0')
        .order('posted_at', { ascending: false })
        .limit(3);

      allPostsRaw = [...(missingMetricsPosts || []), ...(recentPosts || []), ...(historicalPosts || [])];
      postsError = missingError || recentError || historicalError;
      missingCount = missingMetricsPosts?.length || 0;
      recentCount = recentPosts?.length || 0;
      historicalCount = historicalPosts?.length || 0;
    }
    
    // 🔒 VALIDATION: Filter out posts with invalid tweet IDs before processing
    const validatedPostIds = new Set<string>();
    const filteredPosts = allPostsRaw.filter((post: any) => {
      // Validate tweet ID
      const validation = validateTweetIdForScraping(post.tweet_id);
      if (!validation.valid) {
        console.warn(`[METRICS_SCRAPER] ⚠️ Skipping post with invalid tweet_id: ${post.decision_id} (${validation.error})`);
        return false;
      }
      
      validatedPostIds.add(post.decision_id);
      return true;
    });
    
    // Deduplicate by decision_id
    const seen = new Set<string>();
    const posts = filteredPosts.filter((post: any) => {
      if (seen.has(post.decision_id)) return false;
      seen.add(post.decision_id);
      return true;
    });
    
    if (postsError) {
      console.error('[METRICS_JOB] ❌ Failed to fetch posts:', postsError.message);
      return;
    }
    
    if (!posts || posts.length === 0) {
      console.log('[METRICS_JOB] ℹ️ No recent posts to scrape');
      return;
    }
    
    console.log(`[METRICS_JOB] 📊 Found ${posts.length} posts to check (${missingCount} missing metrics, ${recentCount} recent refresh, ${historicalCount} historical)`);
    
    let updated = 0;
    let skipped = 0;
    let failed = 0;
    let v2CalculatedCount = 0;
    let verificationFailedCount = 0;
    let scrapeFailedCount = 0;
    
    // PHASE 4: Use ScrapingOrchestrator instead of direct scraper
    const orchestrator = ScrapingOrchestrator.getInstance();
    
    // 🚀 OPTIMIZATION: Filter posts that need scraping BEFORE acquiring browser
    const postsToScrape = [];
    
    const MAX_SCRAPE_ATTEMPTS = 10;

    for (const post of posts) {
      try {
        // 🔄 RETRY BACKOFF: Skip posts that have exhausted retry attempts or are in backoff window
        const attempts = (post as any).metrics_scrape_attempts || 0;
        if (attempts >= MAX_SCRAPE_ATTEMPTS) {
          skipped++;
          continue; // Give up after max attempts
        }
        if (attempts > 0 && (post as any).metrics_last_scrape_at) {
          const backoffMs = attempts * 10 * 60 * 1000; // attempts * 10 minutes
          const lastAttempt = new Date(String((post as any).metrics_last_scrape_at)).getTime();
          if (Date.now() - lastAttempt < backoffMs) {
            skipped++;
            continue; // Too soon to retry
          }
        }

        // Check if we collected metrics recently (skip if collected in last 30 minutes for efficiency)
        // But ALWAYS scrape if actual_impressions is null/0 (missing metrics)
        const { data: contentMeta } = await supabase
          .from('content_metadata')
          .select('actual_impressions, updated_at')
          .eq('decision_id', post.decision_id)
          .single();
        
        const hasMetrics = contentMeta?.actual_impressions !== null && contentMeta?.actual_impressions > 0;
        const recentlyUpdated = contentMeta?.updated_at && 
          new Date(String(contentMeta.updated_at)) > new Date(Date.now() - 30 * 60 * 1000);
        
        // Skip if we have metrics AND updated recently (avoid redundant scraping)
        if (hasMetrics && recentlyUpdated) {
          skipped++;
          continue;
        }
        
        // Check outcomes table for very recent scraping (last 30 min)
        const { data: lastMetrics } = await supabase
          .from('outcomes')
          .select('collected_at')
          .eq('decision_id', post.decision_id)
          .order('collected_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (lastMetrics && hasMetrics &&
            new Date(String(lastMetrics.collected_at)) > new Date(Date.now() - 30 * 60 * 1000)) {
          skipped++;
          continue; // Skip if collected in last 30 minutes AND we have metrics
        }
        
        // Skip invalid tweet IDs (from cleanup)
        if (String(post.tweet_id).includes('verified_') || String(post.tweet_id).length < 19) {
          skipped++;
          continue;
        }
        
        postsToScrape.push(post);
      } catch (error: any) {
        console.warn(`[METRICS_JOB] ⚠️ Pre-filter failed for ${post.decision_id}: ${error.message}`);
        failed++;
      }
    }
    
    if (postsToScrape.length === 0) {
      console.log(`[METRICS_JOB] ℹ️ No posts need scraping (${skipped} skipped, ${failed} failed pre-filter)`);
      return;
    }
    
    // 🔧 CONFIG: Control how many tweets we refresh per run
    // 🔥 INCREASED: Default to 20 posts per run to clear backlogs faster
    const maxPostsPerRunRaw = Number(process.env.METRICS_MAX_POSTS_PER_RUN ?? '20');
    const maxPostsPerRun = Number.isFinite(maxPostsPerRunRaw) && maxPostsPerRunRaw > 0 ? maxPostsPerRunRaw : 20;
    const postsToProcess = postsToScrape.slice(0, maxPostsPerRun);
    if (postsToProcess.length < postsToScrape.length) {
      console.log(`[METRICS_JOB] ⏳ Processing ${postsToProcess.length}/${postsToScrape.length} tweets this cycle (${postsToScrape.length - postsToProcess.length} remaining for next run)`);
    }
    
    console.log(`[METRICS_JOB] 🔍 Batching ${postsToProcess.length} tweets into single browser session...`);
    
    // 🔒 BROWSER SEMAPHORE: Acquire ONE browser lock for ALL tweets (BATCHED)
    const { withBrowserLock, BrowserPriority } = await import('../browser/BrowserSemaphore');
    
    // 🔒 RAILWAY GATE: Playwright scraping only runs on Mac Runner
    if (process.env.RUNNER_MODE !== 'true') {
      console.log('[METRICS_SCRAPER] ⏭️  Skipping Playwright scraping on Railway (RUNNER_MODE not set)');
      console.log('[METRICS_SCRAPER] proof_run executor=false reason=RUNNER_MODE_not_set selected_eligible=' + postsToProcess.length + ' updated=0');
      return; // Skip silently - metrics can be fetched via API if needed
    }
    console.log('[METRICS_SCRAPER] proof_run executor=true RUNNER_MODE=true selected_eligible=' + postsToProcess.length);
    await withBrowserLock('metrics_batch', BrowserPriority.METRICS, async () => {
      // Use UnifiedBrowserPool (same as working discovery system)
      const { UnifiedBrowserPool } = await import('../browser/UnifiedBrowserPool');
      const pool = UnifiedBrowserPool.getInstance();
      const page = await pool.acquirePage('metrics_batch');
      
      try {
        console.log(`[METRICS_JOB] 🚀 Starting batched scraping of ${postsToProcess.length} tweets...`);
        
        // Process all tweets in sequence using the same browser session
        for (const post of postsToProcess) {
          try {
            console.log(`[METRICS_JOB] 🔍 Scraping ${post.tweet_id} (${updated + failed + 1}/${postsToProcess.length})...`);

            const scrapeStartMs = Date.now();

            // Use the shared page from the batch session
            // PHASE 4: Use orchestrator (includes validation, quality tracking, caching)
            const postedAt = new Date(String(post.posted_at));  // ✅ FIXED: Use posted_at, not created_at
            const hoursSincePostScrape = (Date.now() - postedAt.getTime()) / (1000 * 60 * 60);
            
            let scrapeAttempt = 0;
            let lastError: string | undefined;
            let result = await orchestrator.scrapeAndStore(
              page,
              String(post.tweet_id),
              {
                collectionPhase: 'scheduled_job',
                postedAt: postedAt
              },
              { useAnalytics: false }
            );

            while (!result.success && scrapeAttempt < 1) {
              const errorMessage = (result.error || '').toUpperCase();
              if (!errorMessage.includes('ANALYTICS_AUTH_FAILED')) {
                break;
              }

              scrapeAttempt++;
              lastError = errorMessage;
              console.warn(`[METRICS_JOB] ⚠️ Analytics auth failed for ${post.tweet_id}. Reloading session (attempt ${scrapeAttempt})...`);

              try {
                await pool.reloadSessionState();
                console.log('[METRICS_JOB] 🔄 Session reloaded. Retrying scrape...');
              } catch (reloadError: any) {
                console.error(`[METRICS_JOB] ❌ Session reload failed: ${reloadError?.message || reloadError}`);
                break;
              }

              // Brief pause before retrying to allow cookies to apply
              await new Promise(resolve => setTimeout(resolve, 1500));

              result = await orchestrator.scrapeAndStore(
                page,
                String(post.tweet_id),
                {
                  collectionPhase: 'scheduled_job',
                  postedAt: postedAt
                },
                { useAnalytics: false }
              );
            }
            
            if (!result.success) {
              const errorMessage = result.error || lastError || 'unknown_error';
              const currentAttempts = ((post as any).metrics_scrape_attempts || 0) + 1;
              console.warn(`[METRICS_JOB] ⚠️ Scraping failed for ${post.tweet_id} (attempt ${currentAttempts}/${MAX_SCRAPE_ATTEMPTS}): ${errorMessage}`);
              // Audit trail: record failed scrape attempt
              logScrapeAudit({
                tweet_id: String(post.tweet_id),
                decision_id: post.decision_id,
                collection_phase: 'scheduled_job',
                collection_status: 'failed',
                error_message: errorMessage,
                duration_ms: Date.now() - scrapeStartMs,
              });
              // 🔄 RETRY TRACKING: Record failure for backoff
              try {
                await supabase
                  .from('content_generation_metadata_comprehensive')
                  .update({
                    metrics_scrape_attempts: currentAttempts,
                    metrics_last_scrape_at: new Date().toISOString(),
                  })
                  .eq('decision_id', post.decision_id);
              } catch (retryErr: any) {
                console.warn(`[METRICS_JOB] ⚠️ Failed to record scrape attempt: ${retryErr.message}`);
              }
              scrapeFailedCount++;
              failed++;
              continue;
            }
            
            const metrics = (result.metrics || {}) as Record<string, unknown>;
            const likesValue = toNumberWithFallback(metrics.likes);
            const retweetsValue = toNumberWithFallback(metrics.retweets);
            const repliesValue = toNumberWithFallback(metrics.replies);
            const quoteTweetsValue = toNumberWithFallback(metrics.quote_tweets);
            const bookmarksValue = toNumberWithFallback(metrics.bookmarks);
            const viewsValue = toNumberWithFallback(metrics.views);
            const viewsNullable = parseMetricValue(metrics.views);
            const profileClicksValue = parseMetricValue(metrics.profile_clicks);
            const likesNullable = parseMetricValue(metrics.likes);
            const retweetsNullable = parseMetricValue(metrics.retweets);
            const repliesNullable = parseMetricValue(metrics.replies);
            const quoteTweetsNullable = parseMetricValue(metrics.quote_tweets);
            const bookmarksNullable = parseMetricValue(metrics.bookmarks);
            const isFirstHour = hoursSincePostScrape <= 1;
            
            // 🔍 CONTENT VERIFICATION: Check if scraped content matches database content
            let verificationFailed = false;
            let verificationReason = '';
            const scrapedContent = result.content || metrics.content;
            if (scrapedContent && typeof scrapedContent === 'string') {
              try {
                const { data: metadata } = await supabase
                  .from('content_metadata')
                  .select('content, thread_parts, decision_type')
                  .eq('decision_id', post.decision_id)
                  .single();
                
                if (metadata) {
                  const expectedContent = metadata.decision_type === 'thread' 
                    ? (Array.isArray(metadata.thread_parts) ? metadata.thread_parts.join(' ') : (metadata.content || ''))
                    : (metadata.content || '');
                  
                  if (expectedContent && typeof expectedContent === 'string') {
                    const { verifyContentMatch, verifyThreadContentMatch } = await import('../utils/contentVerification');
                    const threadParts = Array.isArray(metadata.thread_parts) ? metadata.thread_parts as string[] : [];
                    const verification = metadata.decision_type === 'thread'
                      ? verifyThreadContentMatch(threadParts, scrapedContent, 0.6)
                      : verifyContentMatch(expectedContent, scrapedContent, 0.7);
                    
                    if (!verification.isValid) {
                      verificationFailed = true;
                      verificationReason = `content_mismatch (similarity: ${(verification.similarity * 100).toFixed(1)}%)`;
                      console.error(`[METRICS_JOB] 🚨 MISATTRIBUTION DETECTED!`);
                      console.error(`[METRICS_JOB] Tweet ID: ${post.tweet_id}`);
                      console.error(`[METRICS_JOB] Decision ID: ${post.decision_id}`);
                      console.error(`[METRICS_JOB] Expected: "${verification.expectedPreview}..."`);
                      console.error(`[METRICS_JOB] Actual: "${verification.actualPreview}..."`);
                      console.error(`[METRICS_JOB] Similarity: ${(verification.similarity * 100).toFixed(1)}%`);
                      console.error(`[METRICS_JOB] ⚠️ SKIPPING metrics update - content mismatch!`);
                      console.error(`[METRICS_JOB] 💡 This indicates the tweet_id in database is WRONG!`);
                      console.error(`[METRICS_JOB] 💡 Manual investigation required - tweet_id may belong to different post`);
                      // Audit trail: record content mismatch
                      logScrapeAudit({
                        tweet_id: String(post.tweet_id),
                        decision_id: post.decision_id,
                        collection_phase: 'scheduled_job',
                        collection_status: 'content_mismatch',
                        error_message: `similarity: ${(verification.similarity * 100).toFixed(1)}%`,
                        duration_ms: Date.now() - scrapeStartMs,
                      });
                      verificationFailedCount++;
                      failed++;
                      continue; // Skip this tweet - don't store wrong metrics
                    } else {
                      console.log(`[METRICS_JOB] ✅ CONTENT VERIFICATION: Match ${(verification.similarity * 100).toFixed(1)}% - proceeding`);
                    }
                  } else {
                    verificationFailed = true;
                    verificationReason = 'no_expected_content_in_db';
                    console.warn(`[METRICS_JOB] ⚠️ No expected content found in database for decision_id: ${post.decision_id}`);
                  }
                } else {
                  verificationFailed = true;
                  verificationReason = 'metadata_not_found';
                  console.warn(`[METRICS_JOB] ⚠️ No metadata found for decision_id: ${post.decision_id}`);
                }
              } catch (verifyError: any) {
                verificationFailed = true;
                verificationReason = `verification_error: ${verifyError.message}`;
                console.warn(`[METRICS_JOB] ⚠️ Content verification failed: ${verifyError.message}`);
                // Continue anyway - verification failure shouldn't block metrics collection
              }
            } else {
              verificationFailed = true;
              verificationReason = 'no_content_extracted';
              console.warn(`[METRICS_JOB] ⚠️ No content extracted for verification (tweet_id: ${post.tweet_id})`);
            }
            
            // If verification failed, we still want to log it but may continue with metrics
            // (For now, we skip on verification failure to avoid misattribution)
            if (verificationFailed && !verificationReason.includes('verification_error')) {
              // Already handled above with continue statement
            }
            
            const totalEngagement =
              likesValue +
              retweetsValue +
              quoteTweetsValue +
              repliesValue +
              bookmarksValue;
            
            // 🐛 DEBUG: Log what the scraper actually extracted
            console.log(`[METRICS_JOB] 🔍 Extracted metrics for ${post.tweet_id}:`, JSON.stringify({
              views: metrics.views,
              impressions: metrics.views,
              profile_clicks: metrics.profile_clicks,
              likes: metrics.likes,
              retweets: metrics.retweets,
              replies: metrics.replies,
              _verified: metrics._verified,
              _status: metrics._status,
              _dataSource: metrics._dataSource
            }, null, 2));
            
            // Log validation quality
            if (result.validationResult) {
              console.log(`[METRICS_JOB] 📊 Quality: confidence=${result.validationResult.confidence.toFixed(2)}, valid=${result.validationResult.isValid}`);
            }
            
            // Calculate engagement rate (needed for v2 metrics)
            // 🔧 FIX: Distinguish between "no data" (NULL) and "zero engagement" (0)
            // If we successfully scraped (viewsNullable !== null), engagement_rate should be 0 if no engagement
            // NULL should only mean "we truly could not scrape this tweet"
            let engagementRate: number | null;
            if (viewsNullable !== null && viewsNullable !== undefined) {
              // We have view data - calculate engagement_rate (will be 0 if no engagement)
              engagementRate = viewsValue > 0
                ? ((likesValue + retweetsValue + repliesValue) / viewsValue)
                : 0; // If views is 0 but we scraped, engagement_rate is 0 (not NULL)
            } else {
              // No view data available - engagement_rate is NULL (scraping failed)
              engagementRate = null;
            }
            
            // 🎯 v2 UPGRADE: Get follower attribution BEFORE outcomes upsert
            let followersGained = 0;
            let followersBefore: number | undefined;
            let followers24hAfter: number | undefined;
            let followers2hAfter: number | undefined;
            let followers48hAfter: number | undefined;
            let hoursSincePostAttribution: number | undefined;
            
            try {
              const { data: followerTracking } = await supabase
                .from('post_follower_tracking')
                .select('follower_count, hours_after_post')
                .eq('post_id', post.decision_id)
                .in('hours_after_post', [0, 2, 24, 48])
                .order('hours_after_post', { ascending: true });
              
              if (followerTracking && followerTracking.length > 0) {
                // Extract follower counts by time window
                for (const tracking of followerTracking) {
                  const hours = Number(tracking.hours_after_post) || 0;
                  const count = Number(tracking.follower_count) || 0;
                  
                  if (hours === 0) {
                    followersBefore = count;
                  } else if (hours === 2) {
                    followers2hAfter = count;
                  } else if (hours === 24) {
                    followers24hAfter = count;
                  } else if (hours === 48) {
                    followers48hAfter = count;
                  }
                }
                
                // Calculate followers gained (prefer 24h, fall back to 48h or 2h)
                if (followersBefore !== undefined && followers24hAfter !== undefined) {
                  followersGained = Math.max(0, followers24hAfter - followersBefore);
                  hoursSincePostAttribution = 24;
                  console.log(`[METRICS_JOB] 👥 Follower attribution (24h): ${followersBefore} → ${followers24hAfter} (+${followersGained})`);
                } else if (followersBefore !== undefined && followers48hAfter !== undefined) {
                  followersGained = Math.max(0, followers48hAfter - followersBefore);
                  hoursSincePostAttribution = 48;
                  console.log(`[METRICS_JOB] 👥 Follower attribution (48h): ${followersBefore} → ${followers48hAfter} (+${followersGained})`);
                } else if (followersBefore !== undefined && followers2hAfter !== undefined) {
                  followersGained = Math.max(0, followers2hAfter - followersBefore);
                  hoursSincePostAttribution = 2;
                  console.log(`[METRICS_JOB] 👥 Follower attribution (2h): ${followersBefore} → ${followers2hAfter} (+${followersGained})`);
                } else if (followersBefore !== undefined) {
                  console.log(`[METRICS_JOB] 👥 Follower baseline: ${followersBefore} (time window data pending)`);
                }
                
                // Calculate hours since post if we have posted_at
                if (!hoursSincePostAttribution && post.posted_at) {
                  const postedAt = new Date(post.posted_at);
                  const now = new Date();
                  hoursSincePostAttribution = (now.getTime() - postedAt.getTime()) / (1000 * 60 * 60);
                }
              }
            } catch (followerError: any) {
              console.warn(`[METRICS_JOB] ⚠️ Follower attribution failed: ${followerError.message}`);
            }
            
            // 🎯 v2 UPGRADE: Calculate v2 objective metrics
            let v2Metrics: {
              followers_gained_weighted: number | null;
              primary_objective_score: number | null;
              hook_type?: string;
              cta_type?: string;
              structure_type?: string;
            } = {
              followers_gained_weighted: null,
              primary_objective_score: null
            };

            try {
              // 🎯 FIX: Calculate v2 metrics if we have ANY engagement data OR follower tracking
              // This ensures v2 metrics are populated even with zero engagement (for learning)
              // NULL should only mean "we truly could not scrape this tweet"
              const hasEngagementData = viewsNullable !== null || likesNullable !== null || retweetsNullable !== null || repliesNullable !== null;
              const hasFollowerTracking = followersBefore !== undefined;
              
              if (hasEngagementData || hasFollowerTracking) {
                // Use engagement_rate if available, otherwise calculate from engagement
                // If views is 0 but we have data, engagement_rate should be 0 (not NULL)
                const effectiveEngagementRate = engagementRate !== null && engagementRate !== undefined 
                  ? engagementRate 
                  : (viewsValue > 0 ? ((likesValue + retweetsValue + repliesValue) / viewsValue) : 0);
                
                const attributionData: FollowerAttributionData = {
                  followers_gained: followersGained || 0, // Default to 0 if no follower data
                  followers_before: followersBefore,
                  followers_24h_after: followers24hAfter,
                  followers_48h_after: followers48hAfter,
                  followers_2h_after: followers2hAfter,
                  hours_since_post: hoursSincePostAttribution
                };

                const engagementData: EngagementMetrics = {
                  engagement_rate: effectiveEngagementRate,
                  impressions: viewsValue,
                  likes: likesValue,
                  retweets: retweetsValue,
                  replies: repliesValue
                };

                const v2Result = calculateV2ObjectiveMetrics(attributionData, engagementData);
                v2Metrics.followers_gained_weighted = v2Result.followers_gained_weighted;
                v2Metrics.primary_objective_score = v2Result.primary_objective_score;

                v2CalculatedCount++;
                console.log(`[METRICS_JOB][V2] Calculated v2 metrics for ${post.tweet_id}:`, {
                  followers_gained_weighted: v2Metrics.followers_gained_weighted,
                  primary_objective_score: v2Metrics.primary_objective_score,
                  hasEngagementData,
                  hasFollowerTracking,
                  engagement_rate: effectiveEngagementRate,
                  followers_gained: followersGained || 0
                });

                // Extract content structure types if we have content
                try {
                  const { data: contentData } = await supabase
                    .from('content_metadata')
                    .select('content, decision_type')
                    .eq('decision_id', post.decision_id)
                    .single();

                  if (contentData?.content) {
                    const structureTypes = extractContentStructureTypes(
                      contentData.content,
                      contentData.decision_type
                    );
                    v2Metrics.hook_type = structureTypes.hook_type;
                    v2Metrics.cta_type = structureTypes.cta_type;
                    v2Metrics.structure_type = structureTypes.structure_type;
                    
                    console.log(`[METRICS_JOB] 📝 Content structure: hook=${structureTypes.hook_type}, cta=${structureTypes.cta_type}, structure=${structureTypes.structure_type}`);
                  }
                } catch (contentError: any) {
                  // Non-critical - continue without structure types
                  console.warn(`[METRICS_JOB] ⚠️ Failed to extract content structure: ${contentError.message}`);
                }
              } else {
                console.log(`[METRICS_JOB][V2] Skipping v2 metrics for ${post.tweet_id}:`, {
                  reason: 'no engagement and no follower tracking',
                  viewsNullable,
                  likesNullable,
                  retweetsNullable,
                  repliesNullable,
                  followersBefore
                });
              }
            } catch (v2Error: any) {
              console.error(`[METRICS_JOB] ❌ v2 metrics calculation failed: ${v2Error.message}`);
              console.error(`[METRICS_JOB] Stack: ${v2Error.stack}`);
              // Don't fail - continue with basic metrics
            }
            
            // Update outcomes table (for backward compatibility with existing systems + v2 fields)
            const outcomesPayload = {
              decision_id: post.decision_id,  // 🔥 FIX: Use decision_id (UUID), not integer id
              tweet_id: post.tweet_id,
              likes: likesNullable,
              retweets: retweetsNullable,
              quote_tweets: quoteTweetsNullable,
              replies: repliesNullable,
              views: viewsNullable,
              bookmarks: bookmarksNullable,
              impressions: viewsNullable, // Map views to impressions
              engagement_rate: engagementRate, // ✅ Store engagement_rate for v2 calculations
              profile_clicks: profileClicksValue, // 📊 Save Profile visits from analytics page
              first_hour_engagement: isFirstHour ? totalEngagement : null,
              followers_gained: followersGained, // ✅ Store raw followers_gained
              followers_before: followersBefore,
              followers_after: followers24hAfter || followers48hAfter || followers2hAfter,
              collected_at: new Date().toISOString(),
              data_source: 'playwright_scraper',
              collection_status: 'success',
              confidence: result.validationResult?.confidence ?? null,
              metric_age_hours: hoursSincePostScrape,
              simulated: false,
              // 🎯 v2 FIELDS:
              followers_gained_weighted: v2Metrics.followers_gained_weighted,
              primary_objective_score: v2Metrics.primary_objective_score,
              hook_type: v2Metrics.hook_type,
              cta_type: v2Metrics.cta_type,
              structure_type: v2Metrics.structure_type
            };
            
            // 🔍 DEBUG: Log v2 fields being written
            console.log(`[METRICS_JOB] 📝 Writing outcomes for ${post.tweet_id}:`);
            console.log(`[METRICS_JOB]   - followers_gained_weighted: ${v2Metrics.followers_gained_weighted}`);
            console.log(`[METRICS_JOB]   - primary_objective_score: ${v2Metrics.primary_objective_score}`);
            console.log(`[METRICS_JOB]   - hook_type: ${v2Metrics.hook_type || 'null'}`);
            console.log(`[METRICS_JOB]   - cta_type: ${v2Metrics.cta_type || 'null'}`);
            console.log(`[METRICS_JOB]   - structure_type: ${v2Metrics.structure_type || 'null'}`);
            
            // Backfill content features if not already present
            try {
              const { extractContentFeatures } = require('../utils/contentFeatureExtractor');
              const postContent = String(post.content || '');
              if (postContent.length > 0) {
                const existingFeatures = (post as any).features || {};
                if (!existingFeatures.content_features) {
                  const contentFeatures = extractContentFeatures(postContent);
                  await supabase.from('content_metadata')
                    .update({ features: { ...existingFeatures, content_features: contentFeatures } })
                    .eq('decision_id', post.decision_id);
                  console.log(`[METRICS_JOB] 📊 Backfilled content features for ${post.tweet_id} (${contentFeatures.word_count} words, numbers=${contentFeatures.has_numbers})`);
                }
              }
            } catch (cfErr: any) {
              // Non-critical
            }

            const { data: outcomeData, error: outcomeError } = await supabase.from('outcomes').upsert(
              outcomesPayload,
              { onConflict: 'decision_id' }
            );
            
            if (outcomeError) {
              console.error(`[METRICS_JOB] ❌ Failed to write outcomes for ${post.tweet_id}:`, outcomeError.message);
              console.error(`[METRICS_JOB] ❌ Error code: ${outcomeError.code}, details: ${outcomeError.details}, hint: ${outcomeError.hint}`);
              console.error(`[METRICS_JOB] ❌ Payload:`, JSON.stringify(outcomesPayload, null, 2));
              failed++;
              continue;
            } else {
              console.log(`[METRICS_JOB] ✅ Outcomes written successfully for ${post.tweet_id}`);
              // Audit trail: record successful scrape
              logScrapeAudit({
                tweet_id: String(post.tweet_id),
                decision_id: post.decision_id,
                collection_phase: 'scheduled_job',
                collection_status: 'success',
                confidence: result.validationResult?.confidence ?? null,
                parsed_values: { likes: likesValue, retweets: retweetsValue, replies: repliesValue, views: viewsValue, bookmarks: bookmarksValue },
                duration_ms: Date.now() - scrapeStartMs,
              });
            }

            // 📊 GROWTH LEDGER: Record action + outcomes for unified learning
            try {
              // Fetch content metadata for action signals
              const { data: actionMeta } = await supabase
                .from('content_metadata')
                .select('decision_type, content, features, target_username, target_tweet_id, posted_at')
                .eq('decision_id', post.decision_id)
                .single();

              if (actionMeta) {
                const features = actionMeta.features as any;
                // Upsert: creates ledger entry if missing, updates outcomes if exists
                await recordAction({
                  action_type: actionMeta.decision_type as 'reply' | 'single' | 'thread',
                  decision_id: post.decision_id,
                  tweet_id: post.tweet_id,
                  topic: features?.topic || features?.raw_topic,
                  format_type: features?.format_type || features?.structural_type,
                  hook_type: features?.hook_type,
                  archetype: features?.reply_archetype,
                  content_length: actionMeta.content?.length,
                  target_username: actionMeta.target_username,
                  discovery_source: features?.discovery_source || features?.discovery_bucket,
                  discovery_keyword: features?.discovery_keyword,
                  posted_at: new Date(actionMeta.posted_at),
                  target_age_minutes: features?.target_age_minutes,
                });
                await updateOutcomes(
                  { decision_id: post.decision_id },
                  {
                    views: viewsValue,
                    likes: likesValue,
                    replies: repliesValue,
                    retweets: retweetsValue,
                    bookmarks: bookmarksValue,
                    engagement_rate: engagementRate ?? undefined,
                    followers_gained: followersGained,
                  }
                );
              }
            } catch (ledgerErr: any) {
              console.warn(`[METRICS_JOB] ⚠️ Growth ledger write failed (non-fatal): ${ledgerErr.message}`);
            }

            // 🧪 CONTENT EXPERIMENT: Update experiment outcome with scraped metrics
            try {
              const { updateExperimentOutcome } = await import('../intelligence/contentExperimentEngine');
              await updateExperimentOutcome(post.decision_id, {
                views: viewsValue || 0,
                engagement_rate: engagementRate || 0,
                followers_gained: followersGained || 0,
              });
            } catch { /* non-fatal */ }

            // 📊 CHECKPOINT SCHEDULING: Ensure this post has scrape checkpoints
            // Only schedule if this is the first time we're scraping (no existing checkpoints)
            try {
              const { count: existingCheckpoints } = await supabase
                .from('scrape_checkpoints')
                .select('*', { count: 'exact', head: true })
                .eq('tweet_id', post.tweet_id);
              if (!existingCheckpoints || existingCheckpoints === 0) {
                await scheduleCheckpoints(post.decision_id, String(post.tweet_id), postedAt);
              }
            } catch (cpErr: any) {
              // Non-fatal
            }

            // CRITICAL: Also update learning_posts table (used by 30+ learning systems!)
            const { error: learningError } = await supabase.from('learning_posts').upsert({
              tweet_id: post.tweet_id,
              likes_count: likesValue,
              retweets_count: retweetsValue,
              replies_count: repliesValue,
              bookmarks_count: bookmarksValue,
              impressions_count: viewsValue,
              updated_at: new Date().toISOString()
            }, { onConflict: 'tweet_id' });
            
            if (learningError) {
              console.warn(`[METRICS_JOB] ⚠️ Failed to update learning_posts for ${post.tweet_id}:`, learningError.message);
              // Don't fail - outcomes table is the primary store
            }
            
            // CRITICAL: Also update tweet_metrics table (used by timing & quantity optimizers!)
            const { error: metricsTableError } = await supabase.from('tweet_metrics').upsert({
              tweet_id: post.tweet_id,
              likes_count: likesValue,
              retweets_count: retweetsValue,
              replies_count: repliesValue,
              impressions_count: viewsValue,
              updated_at: new Date().toISOString(),
              created_at: post.posted_at  // ✅ Use posted_at (when actually posted to Twitter)
            }, { onConflict: 'tweet_id' });
            
            if (metricsTableError) {
              // 🔥 FIX: Log SPECIFIC error details for debugging
              console.error(`[METRICS_JOB] ❌ Failed to update tweet_metrics for ${post.tweet_id}:`, {
                error: metricsTableError.message,
                code: metricsTableError.code,
                details: metricsTableError.details,
                hint: metricsTableError.hint,
                tweet_id: post.tweet_id,
                decision_id: post.decision_id
              });
              
              // 🔥 FIX: If it's a constraint violation, log which constraint failed
              if (metricsTableError.code === '23505') { // Unique violation
                console.error(`[METRICS_JOB] 🔍 CONSTRAINT VIOLATION: Duplicate tweet_id detected`);
                console.error(`[METRICS_JOB] 💡 This might be due to tweet_metrics UNIQUE constraint on (tweet_id, collected_at)`);
                console.error(`[METRICS_JOB] 💡 Consider using INSERT ... ON CONFLICT DO UPDATE with collected_at`);
              }
              
              // Don't fail the job - outcomes table is the primary store
              // But log comprehensively so we can debug the root cause
            }
            
            // 🔥 CRITICAL: Update base table (content_metadata may be a VIEW in some envs)
            // Dashboard reads actual_* from content_metadata; view reflects content_generation_metadata_comprehensive
            // Writing to base table ensures metrics persist whether content_metadata is table or view
            const { error: contentMetadataError } = await supabase
              .from('content_generation_metadata_comprehensive')
              .update({
                actual_impressions: viewsNullable,  // Dashboard shows this as "VIEWS"
                actual_likes: likesValue,           // Dashboard shows this as "LIKES"
                actual_retweets: retweetsValue,     // Used for viral score
                actual_replies: repliesValue,       // Used for engagement rate
                actual_engagement_rate: engagementRate,     // Dashboard shows this as "ER"
                updated_at: new Date().toISOString(),
                metrics_scrape_attempts: 0,         // Reset retry counter on success
                metrics_last_scrape_at: new Date().toISOString()
              })
              .eq('decision_id', post.decision_id);  // Match by decision_id (UUID)
            
            if (contentMetadataError) {
              console.error(`[METRICS_JOB] ❌ CRITICAL: Failed to update content_generation_metadata_comprehensive for ${post.tweet_id}:`, contentMetadataError.message);
              // This is critical - dashboard won't show metrics without this!
              failed++;
              continue;
            } else {
              console.log(`[METRICS_JOB] ✅ Dashboard data updated: ${viewsValue} views, ${likesValue} likes`);
            }
            
            // 🔍 VERIFICATION LOOP: Ensure data actually reached base table (dashboard reads via content_metadata view/table)
            try {
              const { data: verification, error: verifyError } = await supabase
                .from('content_generation_metadata_comprehensive')
                .select('actual_impressions, actual_likes, actual_retweets')
                .eq('decision_id', post.decision_id)
                .single();
              
              if (verifyError || !verification) {
                console.error(`[METRICS_JOB] ❌ VERIFICATION: Failed to read back from content_generation_metadata_comprehensive for ${post.tweet_id}`);
                console.error(`[METRICS_JOB] 💡 Sync write succeeded but read failed - possible database issue`);
              } else if (verification.actual_impressions === null && viewsValue > 0) {
                console.error(`[METRICS_JOB] ❌ VERIFICATION: Data NOT in dashboard for ${post.tweet_id}`);
                console.error(`[METRICS_JOB] 💡 Expected ${viewsValue} views, got NULL - retrying sync...`);
                
                // AUTO-FIX: Retry sync one more time (write to base table)
                const { error: retryError } = await supabase
                  .from('content_generation_metadata_comprehensive')
                  .update({
                    actual_impressions: viewsValue,
                    actual_likes: likesValue,
                    actual_retweets: retweetsValue,
                    actual_replies: repliesValue,
                    actual_engagement_rate: engagementRate
                  })
                  .eq('decision_id', post.decision_id);
                
                if (retryError) {
                  console.error(`[METRICS_JOB] ❌ AUTO-FIX FAILED: ${retryError.message}`);
                } else {
                  console.log(`[METRICS_JOB] ✅ AUTO-FIX: Retry sync succeeded for ${post.tweet_id}`);
                }
              } else {
                console.log(`[METRICS_JOB] ✅ VERIFICATION: Dashboard confirmed with ${verification.actual_impressions ?? 0} views`);
              }
            } catch (verificationError: any) {
              console.warn(`[METRICS_JOB] ⚠️ Verification check failed: ${verificationError.message}`);
              // Don't fail the job - metrics are stored, just verification failed
            }
            
            console.log(`[METRICS_JOB] ✅ Updated ${post.tweet_id}: ${likesValue} likes, ${viewsValue} views`);
            updated++;
            
            // Update generator stats for autonomous learning
            try {
              const { data: metadata } = await supabase
                .from('content_metadata')
                .select('generator_name')
                .eq('decision_id', post.decision_id)  // 🔥 FIX: Use decision_id (UUID)
                .single();
              
              if (metadata && metadata.generator_name && typeof metadata.generator_name === 'string') {
                const { getGeneratorPerformanceTracker } = await import('../learning/generatorPerformanceTracker');
                const tracker = getGeneratorPerformanceTracker();
                await tracker.updateGeneratorStats(metadata.generator_name);
                console.log(`[METRICS_JOB] 📊 Updated generator stats for ${metadata.generator_name}`);
              }
            } catch (statsError: any) {
              console.warn(`[METRICS_JOB] ⚠️ Failed to update generator stats:`, statsError.message);
            }
            
            // 🔧 NEW: Update learning system with actual performance data (including real followers!)
            // Note: followersGained and engagementRate already calculated above for v2 metrics
            try {
              const { learningSystem } = await import('../learning/learningSystem');
              await learningSystem.updatePostPerformance(post.decision_id, {
                likes: likesValue,
                retweets: retweetsValue,
                replies: repliesValue,
                impressions: viewsValue,
                engagement_rate: engagementRate,
                followers_gained: followersGained // ✅ Real value from follower tracking!
              });
              console.log(`[METRICS_JOB] 🧠 Updated learning system with performance data (${followersGained} followers gained)`);
            } catch (learningError: any) {
              console.warn(`[METRICS_JOB] ⚠️ Failed to update learning system:`, learningError.message);
              // Don't fail - metrics are stored, just learning update failed
            }
            
            // 🎯 PHASE 6.3B: Compute and persist reward for strategy learning
            try {
              const { computeReward, formatRewardForStorage } = await import('../growth/reward');
              const { recordStrategyReward } = await import('../growth/strategyRewards');
              
              // Get strategy info from features
              const { data: decisionData } = await supabase
                .from('content_metadata')
                .select('features, decision_id')
                .eq('decision_id', post.decision_id)
                .single();
              
              const features = (decisionData?.features as any) || {};
              const strategyId = features.strategy_id || 'baseline';
              const strategyVersion = String(features.strategy_version || '1');
              
              // Compute reward from engagement metrics
              const reward = computeReward({
                likes: likesValue,
                replies: repliesValue,
                reposts: retweetsValue,
                retweets: retweetsValue,
                bookmarks: 0, // Not available in current metrics
                impressions: viewsValue,
              });
              
              // Update features with reward
              const rewardData = formatRewardForStorage(reward, {
                likes: likesValue,
                replies: repliesValue,
                reposts: retweetsValue,
                impressions: viewsValue,
              });
              
              await supabase
                .from('content_metadata')
                .update({
                  features: {
                    ...features,
                    ...rewardData,
                    strategy_id: strategyId,
                    strategy_version: strategyVersion,
                  },
                })
                .eq('decision_id', post.decision_id);
              
              // Record reward in strategy_rewards table
              await recordStrategyReward(strategyId, strategyVersion, reward);
              
              console.log(`[METRICS_JOB] 🎯 Computed reward=${reward.toFixed(3)} for strategy=${strategyId}/${strategyVersion}`);
            } catch (rewardError: any) {
              console.warn(`[METRICS_JOB] ⚠️ Failed to compute/persist reward:`, rewardError.message);
              // Don't fail - reward tracking is not critical
            }
            
            // Rate limit: wait 2 seconds between scrapes in batch
            await new Promise(resolve => setTimeout(resolve, 2000));
            
          } catch (err: any) {
            console.error(`[METRICS_JOB] ⚠️ Failed ${post.tweet_id}: ${err.message}`);
            failed++;
          }
        }
        
      } finally {
        await pool.releasePage(page);
      }
    });
    
    console.log(`[METRICS_JOB] ✅ Metrics collection complete: ${updated} updated, ${skipped} skipped, ${failed} failed`);
    console.log('[METRICS_SCRAPER] proof_run executor=true selected_eligible=' + postsToProcess.length + ' updated=' + updated + ' failed=' + failed + (updated === 0 && postsToProcess.length > 0 ? ' reason=see_logs_above' : ''));
    console.log(`[METRICS_JOB][SUMMARY]`, {
      totalProcessed: posts.length,
      updated,
      skipped,
      failed,
      v2CalculatedCount,
      verificationFailedCount,
      scrapeFailedCount
    });
    
    // 🔒 HARDENING: Alert if 0 successful updates for >60 minutes
    if (updated === 0 && posts.length > 0) {
      console.warn(`[METRICS_JOB] ⚠️ WARNING: 0 metrics updated despite processing ${posts.length} posts`);
      
      // Check last successful update time
      const { data: lastUpdate } = await supabase
        .from('content_metadata')
        .select('updated_at')
        .not('actual_impressions', 'is', null)
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();
      
      if (lastUpdate?.updated_at) {
        const lastUpdateTime = new Date(lastUpdate.updated_at).getTime();
        const minutesSinceLastUpdate = (Date.now() - lastUpdateTime) / (1000 * 60);
        
        if (minutesSinceLastUpdate > 60) {
          const errorMsg = `[METRICS_JOB] 🚨 CRITICAL: Metrics scraper has 0 successful updates for ${Math.round(minutesSinceLastUpdate)} minutes!`;
          console.error(errorMsg);
          
          // Send Discord alert
          try {
            const { sendDiscordAlert } = await import('../monitoring/discordAlerts');
            await sendDiscordAlert(
              `🚨 Metrics Scraper Failure\n\n` +
              `• 0 metrics updated in this run\n` +
              `• Last successful update: ${Math.round(minutesSinceLastUpdate)} minutes ago\n` +
              `• Posts processed: ${posts.length}\n` +
              `• Failed: ${failed}\n` +
              `• Skipped: ${skipped}\n\n` +
              `**Action Required:** Check metrics scraper logs and browser health.`,
              true
            );
          } catch (alertError) {
            console.error('[METRICS_JOB] Failed to send Discord alert:', alertError);
          }
          
          // Log to system_events
          try {
            await supabase.from('system_events').insert({
              event_type: 'metrics_scraper_stalled',
              severity: 'critical',
              event_data: {
                minutes_since_last_update: Math.round(minutesSinceLastUpdate),
                posts_processed: posts.length,
                updated: 0,
                failed,
                skipped
              },
              created_at: new Date().toISOString()
            });
          } catch (dbError) {
            // Non-critical
          }
        }
      }
    }
    
    // Record success metrics in Sentry (if span available)
    // Note: span is only available when Sentry.startSpan is used
    
  } catch (error: any) {
    console.error('[METRICS_JOB] ❌ Metrics collection failed:', error.message);
    
    // 🔒 HARDENING: Alert on crash
    try {
      const { sendDiscordAlert } = await import('../monitoring/discordAlerts');
      await sendDiscordAlert(
        `🚨 Metrics Scraper Crashed\n\n` +
        `• Error: ${error.message}\n` +
        `• Stack: ${error.stack?.substring(0, 500) || 'N/A'}\n\n` +
        `**Action Required:** Check metrics scraper logs and fix the error.`,
        true
      );
    } catch (alertError) {
      console.error('[METRICS_JOB] Failed to send Discord alert:', alertError);
    }
    
    // Capture error in Sentry if available
    if (Sentry?.captureException) {
      try {
        Sentry.captureException(error, {
          tags: { job: 'metrics_scraper' },
          extra: { error_message: error.message }
        });
      } catch (sentryError) {
        // Ignore Sentry errors
      }
    }
    
    throw error;
  }
  };
  
  // Execute with optional Sentry span
  if (Sentry?.startSpan) {
    return await Sentry.startSpan(
      {
        op: 'job',
        name: 'metrics_scraper_job'
      },
      executeJob
    );
  } else {
    return await executeJob();
  }
}

/**
 * Enhanced metrics scraper with velocity tracking
 * Runs less frequently but collects more detailed data
 */
export async function enhancedMetricsScraperJob(): Promise<void> {
  console.log('[ENHANCED_METRICS] 🔍 Starting enhanced metrics collection...');
  
  try {
    const supabase = getSupabaseClient();
    
    // Find posts that are 1h, 6h, 24h, or 7d old for velocity tracking
    const now = new Date();
    const timeWindows = [
      { hours: 1, label: '1h' },
      { hours: 6, label: '6h' }, 
      { hours: 24, label: '24h' },
      { hours: 168, label: '7d' } // 7 days
    ];
    
    for (const window of timeWindows) {
      const targetTime = new Date(now.getTime() - window.hours * 60 * 60 * 1000);
      const windowStart = new Date(targetTime.getTime() - 30 * 60 * 1000); // 30 min before
      const windowEnd = new Date(targetTime.getTime() + 30 * 60 * 1000);   // 30 min after
      
      const { data: posts } = await supabase
        .from('content_metadata')
        .select('decision_id, tweet_id, created_at')  // 🔥 FIX: Use decision_id (UUID), not id
        .eq('status', 'posted')
        .not('tweet_id', 'is', null)
        .gte('created_at', windowStart.toISOString())
        .lte('created_at', windowEnd.toISOString())
        .limit(10);
      
      if (!posts || posts.length === 0) continue;
      
      console.log(`[ENHANCED_METRICS] 📊 Checking ${posts.length} posts at ${window.label} mark`);
      
      const scraper = BulletproofTwitterScraper.getInstance();
      
      for (const post of posts) {
        try {
          // Check if we already have velocity data for this window
          const { data: existing } = await supabase
            .from('post_velocity_tracking')
            .select('id')
            .eq('post_id', post.decision_id)  // 🔥 FIX: Use decision_id (UUID), not integer id
            .eq('hours_after_post', window.hours)
            .single();
          
          if (existing) continue; // Already tracked
          
          // Skip invalid IDs
          if (String(post.tweet_id).includes('verified_') || String(post.tweet_id).length < 19) continue;
          
          const { UnifiedBrowserPool } = await import('../browser/UnifiedBrowserPool');
          const pool = UnifiedBrowserPool.getInstance();
          const page = await pool.acquirePage(`velocity_${window.hours}h`);
          
          try {
            const result = await scraper.scrapeTweetMetrics(page, String(post.tweet_id));
            const metrics = result.metrics || {} as any;
            
            if (!result.success) {
              console.warn(`[ENHANCED_METRICS] ⚠️ Scraping failed: ${result.error}`);
              continue;
            }
          
            // Calculate engagement for this checkpoint
            const checkpointEngagement = (metrics.likes ?? 0) + (metrics.retweets ?? 0) + 
                                         (metrics.quote_tweets ?? 0) + (metrics.replies ?? 0) + 
                                         (metrics.bookmarks ?? 0);
            
            // Store velocity data
            await supabase.from('post_velocity_tracking').insert({
              post_id: post.decision_id,  // 🔥 FIX: Use decision_id (UUID), not integer id
              tweet_id: post.tweet_id,
              check_time: now.toISOString(),
              hours_after_post: window.hours,
              likes: metrics.likes ?? null,
              retweets: metrics.retweets ?? null,
              quote_tweets: metrics.quote_tweets ?? null,
              replies: metrics.replies ?? null,
              bookmarks: metrics.bookmarks ?? null,
              views: metrics.views ?? null,
              total_engagement: checkpointEngagement,
              collection_phase: `checkpoint_${window.hours}h`
            });
            
            console.log(`[ENHANCED_METRICS] ✅ Velocity tracked for ${post.tweet_id} at ${window.label}: ${metrics.likes ?? 0} likes`);
            
          } finally {
            await pool.releasePage(page);
          }
          
          // Rate limit
          await new Promise(resolve => setTimeout(resolve, 3000));
          
        } catch (err: any) {
          console.warn(`[ENHANCED_METRICS] ⚠️ Failed velocity tracking: ${err.message}`);
        }
      }
    }
    
    console.log('[ENHANCED_METRICS] ✅ Enhanced metrics collection complete');
    
  } catch (error: any) {
    console.error('[ENHANCED_METRICS] ❌ Enhanced metrics failed:', error.message);
  }
}
