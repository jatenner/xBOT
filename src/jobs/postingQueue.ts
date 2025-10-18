/**
 * 📮 POSTING QUEUE JOB
 * Processes ready decisions and posts them to Twitter
 */

import { getConfig, getModeFlags } from '../config/config';
import { learningSystem } from '../learning/learningSystem';

export async function processPostingQueue(): Promise<void> {
  const config = getConfig();
  const flags = getModeFlags(config);
  
  console.log('[POSTING_QUEUE] 📮 Processing posting queue...');
  
  try {
    // 1. Check if posting is enabled
    if (flags.postingDisabled) {
      console.log('[POSTING_QUEUE] ⚠️ Posting disabled, skipping queue processing');
      return;
    }
    
    // 2. Check rate limits
    const canPost = await checkPostingRateLimits();
    if (!canPost) {
      console.log('[POSTING_QUEUE] ⚠️ Rate limit reached, skipping posting');
      return;
    }
    
    // 3. Get ready decisions from queue
    const readyDecisions = await getReadyDecisions();
    const GRACE_MINUTES = parseInt(process.env.GRACE_MINUTES || '5', 10);
    
    if (readyDecisions.length === 0) {
      console.log(`[POSTING_QUEUE] ℹ️ No decisions ready for posting (grace_window=${GRACE_MINUTES}m)`);
      return;
    }
    
    console.log(`[POSTING_QUEUE] 📝 Found ${readyDecisions.length} decisions ready for posting (grace_window=${GRACE_MINUTES}m)`);
    
    // 4. Process each decision
    let successCount = 0;
    for (const decision of readyDecisions) {
      try {
        await processDecision(decision);
        successCount++;
      } catch (error) {
        console.error(`[POSTING_QUEUE] ❌ Failed to post decision ${decision.id}:`, error.message);
        await markDecisionFailed(decision.id, error.message);
      }
    }
    
    console.log(`[POSTING_QUEUE] ✅ Posted ${successCount}/${readyDecisions.length} decisions`);
    
  } catch (error) {
    console.error('[POSTING_QUEUE] ❌ Queue processing failed:', error.message);
    throw error;
  }
}

interface QueuedDecision {
  id: string;
  content: string;
  decision_type: 'content' | 'reply';
  target_tweet_id?: string;
  target_username?: string;
  bandit_arm: string;
  timing_arm?: string;
  predicted_er: number;
  quality_score?: number;
  topic_cluster: string;
  status: string;
  created_at: string;
}

interface QueuedDecisionRow {
  [key: string]: unknown;
  id: unknown;
  content: unknown;
  decision_type: unknown;
  target_tweet_id?: unknown;
  target_username?: unknown;
  bandit_arm: unknown;
  timing_arm?: unknown;
  predicted_er: unknown;
  quality_score?: unknown;
  topic_cluster: unknown;
  status: unknown;
  created_at: unknown;
}

async function checkPostingRateLimits(): Promise<boolean> {
  const config = getConfig();
  const maxPostsPerHour = parseInt(String(config.MAX_POSTS_PER_HOUR || 1));
  
  try {
    const { getSupabaseClient } = await import('../db/index');
    const supabase = getSupabaseClient();
    
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    
    // SEPARATE RATE LIMITS: Content posts (2/hr) vs Replies (10/hr)
    // Only check CONTENT posts here - replies have their own quota in replyJob
    const { count, error } = await supabase
      .from('posted_decisions')
      .select('*', { count: 'exact', head: true })
      .eq('decision_type', 'content')  // Only count content posts, not replies
      .gte('posted_at', oneHourAgo);
    
    if (error) {
      console.warn('[POSTING_QUEUE] ⚠️ Failed to check posting rate limit, allowing posts');
      return true;
    }
    
    const recentPosts = count || 0;
    if (recentPosts >= maxPostsPerHour) {
      console.log(`[POSTING_QUEUE] ⚠️ Hourly CONTENT post limit reached: ${recentPosts}/${maxPostsPerHour}`);
      console.log(`[POSTING_QUEUE] ℹ️ Note: Replies have separate 4/hr limit and can still post`);
      return false;
    }
    
    console.log(`[POSTING_QUEUE] ✅ Post budget available: ${recentPosts}/${maxPostsPerHour} content posts`);
    return true;
    
  } catch (error) {
    console.warn('[POSTING_QUEUE] ⚠️ Failed to check rate limits, allowing posts:', error.message);
    return true;
  }
}

async function getReadyDecisions(): Promise<QueuedDecision[]> {
  try {
    const { getSupabaseClient } = await import('../db/index');
    const supabase = getSupabaseClient();
    
    // Add grace window for "close enough" posts
    const GRACE_MINUTES = parseInt(process.env.GRACE_MINUTES || '5', 10);
    const now = new Date();
    const graceWindow = new Date(Date.now() + GRACE_MINUTES * 60 * 1000);
    
    console.log(`[POSTING_QUEUE] 📅 Fetching posts ready within ${GRACE_MINUTES} minute window`);
    console.log(`[POSTING_QUEUE] 🕒 Current time: ${now.toISOString()}`);
    console.log(`[POSTING_QUEUE] 🕒 Grace window: ${graceWindow.toISOString()}`);
    
    // CRITICAL FIX: Check what's already been posted to avoid duplicates
    const { data: alreadyPosted } = await supabase
      .from('posted_decisions')
      .select('decision_id');
    
    const postedIds = new Set((alreadyPosted || []).map(p => p.decision_id));
    
    const { data, error } = await supabase
      .from('content_metadata')
      .select('*')
      .eq('status', 'queued')
      // Remove generation_source filter to allow all queued content
      .lte('scheduled_at', graceWindow.toISOString()) // Add grace window filter
      .order('scheduled_at', { ascending: true }) // Order by scheduled time, not creation time
      .limit(10); // Get more to filter out already-posted
    
    if (error) {
      console.error('[POSTING_QUEUE] ❌ Failed to fetch ready decisions:', error.message);
      return [];
    }
    
    console.log(`[POSTING_QUEUE] 📊 Query returned ${data?.length || 0} decisions`);
    
    if (!data || data.length === 0) {
      // Debug: Check what IS in the queue
      const { data: futureDecisions } = await supabase
        .from('content_metadata')
        .select('decision_id, scheduled_at, status, quality_score')
        .eq('status', 'queued')
        .order('scheduled_at', { ascending: true })
        .limit(5);
      
      if (futureDecisions && futureDecisions.length > 0) {
        console.log(`[POSTING_QUEUE] 🔮 Upcoming posts in queue:`);
        futureDecisions.forEach((d: any) => {
          const scheduledTime = new Date(d.scheduled_at);
          const minutesUntil = Math.round((scheduledTime.getTime() - now.getTime()) / 60000);
          console.log(`   - ${d.decision_id}: in ${minutesUntil} min (quality: ${d.quality_score})`);
        });
      } else {
        console.log(`[POSTING_QUEUE] ⚠️ No queued content found in database at all`);
      }
      
      return [];
    }
    
    // Map raw rows to typed decisions
    const rows = data as QueuedDecisionRow[];
    
    // DEDUPLICATION: Filter out already-posted content
    const filteredRows = rows.filter(row => {
      const id = String(row.id ?? '');
      if (postedIds.has(id)) {
        console.log(`[POSTING_QUEUE] ⚠️ Skipping duplicate: ${id} (already posted)`);
        return false;
      }
      return true;
    });
    
    console.log(`[POSTING_QUEUE] 📋 Filtered: ${rows.length} → ${filteredRows.length} (removed ${rows.length - filteredRows.length} duplicates)`);
    
    // SEPARATE RATE LIMITS: Content (2/hr) vs Replies (4/hr)
    const config = getConfig();
    const maxContentPerHour = parseInt(String(config.MAX_POSTS_PER_HOUR || 2));
    const maxRepliesPerHour = parseInt(String(config.REPLIES_PER_HOUR || 4)); // Replies have separate limit (4/hr)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    
    // Count content posts and replies separately
    const { count: contentCount } = await supabase
      .from('posted_decisions')
      .select('*', { count: 'exact', head: true })
      .eq('decision_type', 'content')
      .gte('posted_at', oneHourAgo);
    
    const { count: replyCount } = await supabase
      .from('posted_decisions')
      .select('*', { count: 'exact', head: true })
      .eq('decision_type', 'reply')
      .gte('posted_at', oneHourAgo);
    
    const contentPosted = contentCount || 0;
    const repliesPosted = replyCount || 0;
    const contentAllowed = Math.max(0, maxContentPerHour - contentPosted);
    const repliesAllowed = Math.max(0, maxRepliesPerHour - repliesPosted);
    
    console.log(`[POSTING_QUEUE] 🚦 Rate limits: Content ${contentPosted}/${maxContentPerHour}, Replies ${repliesPosted}/${maxRepliesPerHour}`);
    
    // Apply rate limits per type
    const decisionsWithLimits = filteredRows.filter(row => {
      const type = String(row.decision_type ?? 'content');
      if (type === 'reply') {
        return repliesPosted < maxRepliesPerHour;
      } else {
        return contentPosted < maxContentPerHour;
      }
    });
    
    console.log(`[POSTING_QUEUE] ✅ After rate limits: ${decisionsWithLimits.length} decisions can post (${contentAllowed} content, ${repliesAllowed} replies available)`);
    
    const decisions: QueuedDecision[] = decisionsWithLimits.map(row => ({
      id: String(row.id ?? ''),
      content: String(row.content ?? ''),
      decision_type: String(row.decision_type ?? 'content') as 'content' | 'reply',
      target_tweet_id: row.target_tweet_id ? String(row.target_tweet_id) : undefined,
      target_username: row.target_username ? String(row.target_username) : undefined,
      bandit_arm: String(row.bandit_arm ?? ''),
      timing_arm: row.timing_arm ? String(row.timing_arm) : undefined,
      predicted_er: Number(row.predicted_er ?? 0),
      quality_score: row.quality_score ? Number(row.quality_score) : undefined,
      topic_cluster: String(row.topic_cluster ?? ''),
      status: String(row.status ?? 'ready_for_posting'),
      created_at: String(row.created_at ?? new Date().toISOString()),
      // CRITICAL: Pass through features for thread_tweets
      features: row.features as any
    }));
    
    return decisions;
    
  } catch (error) {
    console.error('[POSTING_QUEUE] ❌ Failed to fetch ready decisions:', error.message);
    return [];
  }
}

async function processDecision(decision: QueuedDecision): Promise<void> {
  console.log(`[POSTING_QUEUE] 📮 Processing ${decision.decision_type}: ${decision.id}`);
  
    // Note: We keep status as 'queued' until actually posted
    // No intermediate 'posting' status to avoid DB constraint violations
    
    // Update metrics
    await updatePostingMetrics('queued');
  
  try {
    let tweetId: string;
    
    // 🚨 CRITICAL: Check if already posted (double-check before posting)
    const { getSupabaseClient } = await import('../db/index');
    const supabase = getSupabaseClient();
    const { data: alreadyExists } = await supabase
      .from('posted_decisions')
      .select('tweet_id')
      .eq('decision_id', decision.id)
      .single();
    
    if (alreadyExists) {
      console.log(`[POSTING_QUEUE] 🚫 DUPLICATE PREVENTED: ${decision.id} already posted as ${alreadyExists.tweet_id}`);
      await updateDecisionStatus(decision.id, 'posted'); // Mark as posted to prevent retry
      return; // Skip posting
    }
    
    // 🔍 CONTENT HASH CHECK: Also check for duplicate content
    const contentHash = require('crypto').createHash('md5').update(decision.content).digest('hex');
    const { data: duplicateContent } = await supabase
      .from('posted_decisions')
      .select('tweet_id, content')
      .eq('content', decision.content)
      .limit(1);
    
    if (duplicateContent && duplicateContent.length > 0) {
      console.log(`[POSTING_QUEUE] 🚫 DUPLICATE CONTENT PREVENTED: Same content already posted as ${duplicateContent[0].tweet_id}`);
      await updateDecisionStatus(decision.id, 'posted'); // Mark as posted to prevent retry
      return; // Skip posting
    }
    
    // 📊 INTELLIGENCE LAYER: Capture follower count BEFORE posting
    try {
      const { followerAttributionService } = await import('../intelligence/followerAttributionService');
      await followerAttributionService.captureFollowerCountBefore(decision.id);
    } catch (attrError: any) {
      console.warn(`[POSTING_QUEUE] ⚠️ Follower capture failed: ${attrError.message}`);
    }
    
    if (decision.decision_type === 'content') {
      tweetId = await postContent(decision);
    } else if (decision.decision_type === 'reply') {
      tweetId = await postReply(decision);
    } else {
      throw new Error(`Unknown decision type: ${decision.decision_type}`);
    }
    
    // 🎣 INTELLIGENCE LAYER: Extract and classify hook
    try {
      const { hookAnalysisService } = await import('../intelligence/hookAnalysisService');
      const hook = hookAnalysisService.extractHook(decision.content);
      const hookType = hookAnalysisService.classifyHookType(hook);
      
      // Store hook in outcomes
      const { getSupabaseClient: getSupa } = await import('../db/index');
      const supa = getSupa();
      await supa
        .from('outcomes')
        .update({ 
          hook_text: hook, 
          hook_type: hookType 
        })
        .eq('tweet_id', tweetId);
      
      console.log(`[POSTING_QUEUE] 🎣 Hook captured: "${hook}" (${hookType})`);
    } catch (hookError: any) {
      console.warn(`[POSTING_QUEUE] ⚠️ Hook capture failed: ${hookError.message}`);
    }
    
    // Mark as posted and store tweet ID
    await markDecisionPosted(decision.id, tweetId);
    
    // Update metrics
    await updatePostingMetrics('posted');
    
    // PHASE 2: Initialize attribution tracking
    try {
      const { initializePostAttribution } = await import('../learning/engagementAttribution');
      await initializePostAttribution(tweetId, {
        hook_pattern: (decision as any).metadata?.hook_pattern || 'unknown',
        topic: (decision as any).metadata?.topic || decision.topic_cluster,
        generator: (decision as any).metadata?.generator_used || 'unknown',
        format: (decision as any).metadata?.format || 'single',
        viral_score: (decision as any).metadata?.viral_score || 50
      });
      console.log(`[POSTING_QUEUE] 📊 Attribution tracking initialized for ${tweetId}`);
    } catch (attrError: any) {
      console.warn(`[POSTING_QUEUE] ⚠️ Attribution init failed: ${attrError.message}`);
    }
    
    console.log(`[POSTING_QUEUE] ✅ ${decision.decision_type} posted: ${tweetId}`);
    
    // ═══════════════════════════════════════════════════════════
    // 🚀 POST-POSTING FEEDBACK LOOP - Track with Advanced Algorithms
    // ═══════════════════════════════════════════════════════════
    
    try {
      // 1. TWITTER ALGORITHM OPTIMIZER - Track engagement velocity
      const { getTwitterAlgorithmOptimizer } = await import('../algorithms/twitterAlgorithmOptimizer');
      const twitterAlgo = getTwitterAlgorithmOptimizer();
      await twitterAlgo.trackVelocity(tweetId, new Date().toISOString());
      console.log(`[POSTING_QUEUE] ⚡ Velocity tracking initialized for ${tweetId}`);
    } catch (veloError: any) {
      console.warn(`[POSTING_QUEUE] ⚠️ Velocity tracking failed: ${veloError.message}`);
    }
    
    try {
      // 2. CONVERSION FUNNEL TRACKER - Track full funnel
      const { getConversionFunnelTracker } = await import('../algorithms/conversionFunnelTracker');
      const funnelTracker = getConversionFunnelTracker();
      await funnelTracker.trackFunnelMetrics(decision.id);
      console.log(`[POSTING_QUEUE] 📊 Funnel tracking initialized for ${decision.id}`);
    } catch (funnelError: any) {
      console.warn(`[POSTING_QUEUE] ⚠️ Funnel tracking failed: ${funnelError.message}`);
    }
    
    try {
      // 3. FOLLOWER PREDICTOR - Track prediction for accuracy
      // Prediction data is stored in planJobNew, we'll update accuracy later when real results come in
      const { getFollowerPredictor } = await import('../algorithms/followerPredictor');
      const predictor = getFollowerPredictor();
      // Note: Prediction was already tracked in planJobNew, will update with actuals in analytics job
      console.log(`[POSTING_QUEUE] 🔮 Prediction will be validated with actual results`);
    } catch (predError: any) {
      console.warn(`[POSTING_QUEUE] ⚠️ Predictor tracking failed: ${predError.message}`);
    }
    
    // ═══════════════════════════════════════════════════════════
    
    // TODO: Track with learning system (actual performance will be updated later via webhook/job)
    // For now, we'll simulate some basic metrics for learning
    try {
      await learningSystem.updatePostPerformance(decision.id, {
        likes: 0, // Will be updated later with real data
        retweets: 0,
        replies: 0,
        saves: 0,
        follower_growth: 0
      });
    } catch (learningError: any) {
      console.warn(`[POSTING_QUEUE] ⚠️ Learning system update failed: ${learningError.message}`);
    }
    
  } catch (error) {
    await updateDecisionStatus(decision.id, 'failed');
    await updatePostingMetrics('error');
    throw error;
  }
}

async function postContent(decision: QueuedDecision): Promise<string> {
  console.log(`[POSTING_QUEUE] 📝 Posting content: "${decision.content.substring(0, 50)}..."`);
  
  // Check feature flag for posting method
  const { getEnvConfig } = await import('../config/env');
  const config = getEnvConfig();
  
  if (config.FEATURE_X_API_POSTING) {
    console.log('[POSTING_QUEUE] 🔌 Using official X API posting...');
    
    try {
      const { XApiPoster } = await import('../posting/xApiPoster');
      const apiPoster = new XApiPoster();
      const result = await apiPoster.postStatus(decision.content);
      
      if (result.success) {
        const tweetId = result.tweetId || `api_${Date.now()}`;
        console.log(`[POSTING_QUEUE] ✅ Content posted via X API with ID: ${tweetId}`);
        return tweetId;
      } else {
        console.error(`[POSTING_QUEUE] ❌ X API posting failed: ${result.error}`);
        throw new Error(result.error || 'X API posting failed');
      }
    } catch (error: any) {
      console.error(`[POSTING_QUEUE] ❌ X API system error: ${error.message}`);
      throw new Error(`X API posting failed: ${error.message}`);
    }
  } else {
    console.log('[POSTING_QUEUE] 🌐 Using reliable Playwright posting...');
    
    try {
      // 🧵 CHECK IF THIS IS A THREAD (retrieve from features.thread_tweets)
      const features = (decision as any).features || {};
      const thread_tweets = features.thread_tweets || (decision as any).thread_tweets;
      const isThread = Array.isArray(thread_tweets) && thread_tweets.length > 1;
      
      console.log(`[POSTING_QUEUE] 🔍 Thread detection: isThread=${isThread}, segments=${isThread ? thread_tweets.length : 0}`);
      
      if (isThread) {
        console.log(`[POSTING_QUEUE] 🧵 THREAD MODE: Posting ${thread_tweets.length} connected tweets`);
        thread_tweets.forEach((tweet: string, i: number) => {
          console.log(`[POSTING_QUEUE]   📝 Tweet ${i + 1}/${thread_tweets.length}: "${tweet.substring(0, 60)}..."`);
        });
        
        const { BulletproofThreadComposer } = await import('../posting/BulletproofThreadComposer');
        const result = await BulletproofThreadComposer.post(thread_tweets);
        
        if (result.success) {
          const tweetId = result.tweetIds?.[0] || result.rootTweetUrl || `thread_${Date.now()}`;
          console.log(`[POSTING_QUEUE] ✅ Thread posted via Playwright with ID: ${tweetId}`);
          return tweetId;
        } else {
          console.error(`[POSTING_QUEUE] ❌ Thread posting failed: ${result.error}`);
          throw new Error(result.error || 'Thread posting failed');
        }
      } else {
        console.log(`[POSTING_QUEUE] 📝 Posting as SINGLE tweet`);
        const { UltimateTwitterPoster } = await import('../posting/UltimateTwitterPoster');
        const poster = new UltimateTwitterPoster();
        const result = await poster.postTweet(decision.content);
        
        // Clean up resources
        await poster.dispose();
        
        if (result.success) {
          const tweetId = result.tweetId || `playwright_${Date.now()}`;
          console.log(`[POSTING_QUEUE] ✅ Content posted via Playwright with ID: ${tweetId}`);
          return tweetId;
        } else {
          console.error(`[POSTING_QUEUE] ❌ Playwright posting failed: ${result.error}`);
          throw new Error(result.error || 'Playwright posting failed');
        }
      }
    } catch (error: any) {
      console.error(`[POSTING_QUEUE] ❌ Playwright system error: ${error.message}`);
      throw new Error(`Playwright posting failed: ${error.message}`);
    }
  }
}

async function postReply(decision: QueuedDecision): Promise<string> {
  console.log(`[POSTING_QUEUE] 💬 Posting reply to @${decision.target_username}: "${decision.content.substring(0, 50)}..."`);
  
  if (!decision.target_tweet_id) {
    throw new Error('Reply decision missing target_tweet_id');
  }
  
  // ✅ Use Playwright-based reply system (only way to post replies)
  console.log(`[POSTING_QUEUE] 🎯 Posting reply to tweet ${decision.target_tweet_id}...`);
  
  try {
    const browserManager = (await import('../lib/browser')).default;
    const { BulletproofTwitterComposer } = await import('../posting/bulletproofTwitterComposer');
    
    // Get authenticated browser page
    const page = await browserManager.newPage();
    
    // Create composer with page and post reply
    const composer = new BulletproofTwitterComposer(page);
    const result = await composer.postReply(decision.content, decision.target_tweet_id);
    
    if (result.success) {
      const replyId = result.tweetId || `reply_${Date.now()}`;
      console.log(`[POSTING_QUEUE] ✅ Reply posted successfully with ID: ${replyId}`);
      console.log(`[POSTING_QUEUE] 🔗 Reply URL: https://x.com/i/web/status/${replyId}`);
      return replyId;
    } else {
      console.error(`[POSTING_QUEUE] ❌ Reply posting failed: ${result.error}`);
      throw new Error(result.error || 'Reply posting failed');
    }
  } catch (error: any) {
    console.error(`[POSTING_QUEUE] ❌ Reply system error: ${error.message}`);
    throw new Error(`Reply posting failed: ${error.message}`);
  }
}

async function updateDecisionStatus(decisionId: string, status: string): Promise<void> {
  try {
    const { getSupabaseClient } = await import('../db/index');
    const supabase = getSupabaseClient();
    
    const { error } = await supabase
      .from('content_metadata')
      .update({ 
        status,
        updated_at: new Date().toISOString()
      })
      .eq('id', decisionId);
    
    if (error) {
      console.warn(`[POSTING_QUEUE] ⚠️ Failed to update status for ${decisionId}:`, error.message);
    }
  } catch (error) {
    console.warn(`[POSTING_QUEUE] ⚠️ Failed to update status for ${decisionId}:`, error.message);
  }
}

async function markDecisionPosted(decisionId: string, tweetId: string): Promise<void> {
  try {
    const { getSupabaseClient } = await import('../db/index');
    const supabase = getSupabaseClient();
    
    // 1. Update content_metadata status
    const { error: updateError } = await supabase
      .from('content_metadata')
      .update({ 
        status: 'posted',
        updated_at: new Date().toISOString()
      })
      .eq('id', decisionId);
    
    if (updateError) {
      console.warn(`[POSTING_QUEUE] ⚠️ Failed to update content_metadata for ${decisionId}:`, updateError.message);
    }
    
    // 2. Get the full decision details for posted_decisions archive
    const { data: decisionData, error: fetchError } = await supabase
      .from('content_metadata')
      .select('*')
      .eq('id', decisionId)
      .single();
    
    if (fetchError || !decisionData) {
      console.warn(`[POSTING_QUEUE] ⚠️ Failed to fetch decision data for ${decisionId}`);
      return;
    }
    
    // 3. Store in posted_decisions archive with safer numeric handling
    const { error: archiveError } = await supabase
      .from('posted_decisions')
      .insert([{
        decision_id: decisionId,
        content: decisionData.content,
        tweet_id: tweetId,
        decision_type: decisionData.decision_type || 'content',
        target_tweet_id: decisionData.target_tweet_id,
        target_username: decisionData.target_username,
        bandit_arm: decisionData.bandit_arm,
        timing_arm: decisionData.timing_arm,
        predicted_er: Math.min(1.0, Math.max(0.0, Number(decisionData.predicted_er) || 0)),
        quality_score: Math.min(1.0, Math.max(0.0, Number(decisionData.quality_score) || 0)),
        topic_cluster: decisionData.topic_cluster,
        posted_at: new Date().toISOString()
      }]);
    
    if (archiveError) {
      console.warn(`[POSTING_QUEUE] ⚠️ Failed to archive posted decision ${decisionId}:`, archiveError.message);
    } else {
      console.log(`[POSTING_QUEUE] 📝 Decision ${decisionId} marked as posted with tweet ID: ${tweetId}`);
    }
  } catch (error) {
    console.warn(`[POSTING_QUEUE] ⚠️ Failed to mark posted for ${decisionId}:`, error.message);
  }
}

async function markDecisionFailed(decisionId: string, errorMessage: string): Promise<void> {
  try {
    const { getSupabaseClient } = await import('../db/index');
    const supabase = getSupabaseClient();
    
    const { error } = await supabase
      .from('content_metadata')
      .update({ 
        status: 'failed',
        updated_at: new Date().toISOString()
      })
      .eq('id', decisionId);
    
    if (error) {
      console.warn(`[POSTING_QUEUE] ⚠️ Failed to mark failed for ${decisionId}:`, error.message);
    } else {
      console.log(`[POSTING_QUEUE] ❌ Decision ${decisionId} marked as failed: ${errorMessage}`);
    }
  } catch (error) {
    console.warn(`[POSTING_QUEUE] ⚠️ Failed to mark failed for ${decisionId}:`, error.message);
  }
}

async function updatePostingMetrics(type: 'queued' | 'posted' | 'error'): Promise<void> {
  try {
    const { updateMockMetrics } = await import('../api/metrics');
    
    switch (type) {
      case 'queued':
        updateMockMetrics({ postsQueued: 1 });
        break;
      case 'posted':
        updateMockMetrics({ postsPosted: 1 });
        break;
      case 'error':
        updateMockMetrics({ postingErrors: 1 });
        break;
    }
  } catch (error) {
    console.warn('[POSTING_QUEUE] ⚠️ Failed to update posting metrics:', error.message);
  }
}
