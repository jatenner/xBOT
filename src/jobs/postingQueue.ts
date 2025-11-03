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
    
    // 🎯 QUEUE DEPTH MONITOR: Ensure minimum content ready (2/hr content + 4/hr replies)
    // NOTE: Disabled temporarily to prevent over-generation
    // await ensureMinimumQueueDepth();
    
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
    
    // 4. Process each decision WITH RATE LIMIT CHECK BETWEEN EACH POST
    let successCount = 0;
    let contentPostedThisCycle = 0;
    let repliesPostedThisCycle = 0;
    
    const config = getConfig();
    const maxContentPerHour = parseInt(String(config.MAX_POSTS_PER_HOUR || 2));
    const maxRepliesPerHour = parseInt(String(config.REPLIES_PER_HOUR || 4));
    
    for (const decision of readyDecisions) {
      try {
        // 🔥 CRITICAL: Check rate limit BEFORE each post (not just once at start!)
        const isReply = decision.decision_type === 'reply';
        const isContent = decision.decision_type === 'single' || decision.decision_type === 'thread';
        
        // Check current hour's posting count from database
        const { getSupabaseClient } = await import('../db/index');
        const supabase = getSupabaseClient();
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        
        if (isContent) {
          // 🚨 FIX: Query content_generation_metadata_comprehensive TABLE directly
          // (not posted_decisions VIEW which may have refresh lag!)
          const { count: contentCount } = await supabase
            .from('content_generation_metadata_comprehensive')
            .select('*', { count: 'exact', head: true })
            .in('decision_type', ['single', 'thread'])
            .eq('status', 'posted')
            .gte('posted_at', oneHourAgo);
          
          const totalContentThisHour = (contentCount || 0) + contentPostedThisCycle;
          
          console.log(`[POSTING_QUEUE] 📊 Content this hour: ${totalContentThisHour}/${maxContentPerHour} (DB: ${contentCount}, This cycle: ${contentPostedThisCycle})`);
          
          if (totalContentThisHour >= maxContentPerHour) {
            console.log(`[POSTING_QUEUE] ⛔ SKIP: Content limit reached ${totalContentThisHour}/${maxContentPerHour}`);
            continue; // Skip this decision, move to next
          }
        }
        
        if (isReply) {
          // 🚨 FIX: Query content_generation_metadata_comprehensive TABLE directly
          const { count: replyCount } = await supabase
            .from('content_generation_metadata_comprehensive')
            .select('*', { count: 'exact', head: true })
            .eq('decision_type', 'reply')
            .eq('status', 'posted')
            .gte('posted_at', oneHourAgo);
          
          const totalRepliesThisHour = (replyCount || 0) + repliesPostedThisCycle;
          
          console.log(`[POSTING_QUEUE] 📊 Replies this hour: ${totalRepliesThisHour}/${maxRepliesPerHour} (DB: ${replyCount}, This cycle: ${repliesPostedThisCycle})`);
          
          if (totalRepliesThisHour >= maxRepliesPerHour) {
            console.log(`[POSTING_QUEUE] ⛔ SKIP: Reply limit reached ${totalRepliesThisHour}/${maxRepliesPerHour}`);
            continue; // Skip this decision, move to next
          }
        }
        
        // Proceed with posting
        await processDecision(decision);
        successCount++;
        
        // Track what we posted this cycle
        if (isContent) contentPostedThisCycle++;
        if (isReply) repliesPostedThisCycle++;
        
      } catch (error) {
        console.error(`[POSTING_QUEUE] ❌ Failed to post decision ${decision.id}:`, error.message);
        await markDecisionFailed(decision.id, error.message);
      }
    }
    
    console.log(`[POSTING_QUEUE] ✅ Posted ${successCount}/${readyDecisions.length} decisions (${contentPostedThisCycle} content, ${repliesPostedThisCycle} replies)`);
    
  } catch (error) {
    console.error('[POSTING_QUEUE] ❌ Queue processing failed:', error.message);
    throw error;
  }
}

interface QueuedDecision {
  id: string;
  content: string;
  decision_type: 'single' | 'thread' | 'reply'; // FIXED: Match database schema
  target_tweet_id?: string;
  target_username?: string;
  bandit_arm: string;
  timing_arm?: string;
  predicted_er: number;
  quality_score?: number;
  topic_cluster: string;
  status: string;
  created_at: string;
  thread_parts?: string[]; // For threads
  features?: any; // For thread metadata
  visual_format?: string; // Visual formatting instructions
  // PHASE 5 additions for learning system
  predicted_followers?: number;
  hook_type?: string;
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
  const maxPostsPerHour = parseInt(String(config.MAX_POSTS_PER_HOUR || 2));
  
  try {
    const { getSupabaseClient } = await import('../db/index');
    const supabase = getSupabaseClient();
    
    // 🔥 CRITICAL FIX: Count by created_at (when post was attempted)
    // This prevents flooding when posts succeed on Twitter but fail ID extraction
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    
    const { count, error } = await supabase
      .from('content_metadata')
      .select('*', { count: 'exact', head: true })
      .in('decision_type', ['single', 'thread'])
      .gte('created_at', oneHourAgo);
      // ↑ Use created_at, not posted_at!
      // ↑ No status filter - counts ALL attempts (posted, failed, queued)
    
    if (error) {
      console.error('[POSTING_QUEUE] ❌ Rate limit check failed:', error.message);
      console.warn('[POSTING_QUEUE] 🛡️ BLOCKING posts as safety measure');
      return false;  // ← Block when check fails (safer than allowing)
    }
    
    const postsThisHour = count || 0;
    
    console.log(`[POSTING_QUEUE] 📊 Content posts attempted this hour: ${postsThisHour}/${maxPostsPerHour}`);
    console.log(`[POSTING_QUEUE] 📋 Counting ALL posts (posted + failed + queued) by created_at`);
    
    if (postsThisHour >= maxPostsPerHour) {
      console.log(`[POSTING_QUEUE] ⛔ RATE LIMIT REACHED: ${postsThisHour}/${maxPostsPerHour}`);
      console.log(`[POSTING_QUEUE] ⏰ Next content post slot available in ~${60 - Math.floor((Date.now() - new Date(oneHourAgo).getTime()) / 60000)} minutes`);
      console.log(`[POSTING_QUEUE] ℹ️ This prevents flooding even when ID extraction fails`);
      return false;
    }
    
    console.log(`[POSTING_QUEUE] ✅ Rate limit OK: ${postsThisHour}/${maxPostsPerHour} posts`);
    return true;
    
  } catch (error) {
    console.error('[POSTING_QUEUE] ❌ Rate limit check exception:', error.message);
    console.warn('[POSTING_QUEUE] 🛡️ BLOCKING posts as safety measure');
    return false;  // ← Block on error (safer)
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
    
    // ✅ FIX: Fetch content and replies SEPARATELY to prevent blocking
    // Prioritize content posts (main tweets), then add replies
    const { data: contentPosts, error: contentError } = await supabase
      .from('content_metadata')
      .select('*')
      .eq('status', 'queued')
      .in('decision_type', ['single', 'thread'])
      .lte('scheduled_at', graceWindow.toISOString())
      .order('scheduled_at', { ascending: true })
      .limit(10); // Get up to 10 content posts
    
    const { data: replyPosts, error: replyError } = await supabase
      .from('content_metadata')
      .select('*')
      .eq('status', 'queued')
      .eq('decision_type', 'reply')
      .lte('scheduled_at', graceWindow.toISOString())
      .order('scheduled_at', { ascending: true })
      .limit(10); // Get up to 10 replies
    
    // Combine: prioritize content, then replies
    const data = [...(contentPosts || []), ...(replyPosts || [])];
    const error = contentError || replyError;
    
    console.log(`[POSTING_QUEUE] 📊 Content posts: ${contentPosts?.length || 0}, Replies: ${replyPosts?.length || 0}`);
    
    // 🧵 DYNAMIC PRIORITY SYSTEM: Fresh threads first, failed threads drop priority
    // This prevents failed threads from blocking the queue forever
    data.sort((a, b) => {
      // Get retry counts from features
      const aRetries = ((a.features as any)?.retry_count || 0);
      const bRetries = ((b.features as any)?.retry_count || 0);
      
      // Base priority levels: thread (1) > reply (2) > single (3)
      const getBasePriority = (type: string) => {
        if (type === 'thread') return 1;
        if (type === 'reply') return 2;
        return 3;
      };
      
      let aPriority = getBasePriority(String(a.decision_type));
      let bPriority = getBasePriority(String(b.decision_type));
      
      // 🚀 DYNAMIC ADJUSTMENT: Failed threads lose priority
      // - Fresh thread: priority 1 (goes first)
      // - Thread retry 1: priority 2 (same as replies)
      // - Thread retry 2+: priority 3 (same as singles)
      if (a.decision_type === 'thread') {
        aPriority += Math.min(aRetries, 2); // Max penalty: +2
      }
      if (b.decision_type === 'thread') {
        bPriority += Math.min(bRetries, 2); // Max penalty: +2
      }
      
      if (aPriority !== bPriority) {
        return aPriority - bPriority; // Lower number = higher priority
      }
      
      // Within same priority level, maintain scheduled order (FIFO)
      return new Date(String(a.scheduled_at)).getTime() - new Date(String(b.scheduled_at)).getTime();
    });
    
    const prioritizedThreads = data.filter(d => d.decision_type === 'thread').length;
    const prioritizedReplies = data.filter(d => d.decision_type === 'reply').length;
    const singles = data.filter(d => d.decision_type === 'single').length;
    
    if (prioritizedThreads > 0 || prioritizedReplies > 0) {
      console.log(`[POSTING_QUEUE] 🎯 Queue order: ${prioritizedThreads} threads → ${prioritizedReplies} replies → ${singles} singles`);
    }
    
    // ✅ AUTO-CLEANUP: Cancel stale items to prevent queue blocking
    // Threads get 6 hours (complex, rare), Singles get 2 hours (simple, common)
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
    
    // Clean up stale singles (>2 hours old)
    const { data: staleSingles } = await supabase
      .from('content_metadata')
      .select('decision_id')
      .eq('status', 'queued')
      .eq('decision_type', 'single')
      .lt('scheduled_at', twoHoursAgo.toISOString());
    
    // Clean up stale threads (>6 hours old - threads get more time due to complexity)
    const { data: staleThreads } = await supabase
      .from('content_metadata')
      .select('decision_id')
      .eq('status', 'queued')
      .eq('decision_type', 'thread')
      .lt('scheduled_at', sixHoursAgo.toISOString());
    
    const totalStale = (staleSingles?.length || 0) + (staleThreads?.length || 0);
    
    if (totalStale > 0) {
      console.log(`[POSTING_QUEUE] 🧹 Auto-cleaning ${totalStale} stale items (${staleSingles?.length || 0} singles >2h, ${staleThreads?.length || 0} threads >6h)`);
      
      // Cancel stale singles
      if (staleSingles && staleSingles.length > 0) {
        await supabase
          .from('content_metadata')
          .update({ status: 'cancelled' })
          .eq('status', 'queued')
          .eq('decision_type', 'single')
          .lt('scheduled_at', twoHoursAgo.toISOString());
      }
      
      // Cancel stale threads
      if (staleThreads && staleThreads.length > 0) {
        await supabase
          .from('content_metadata')
          .update({ status: 'cancelled' })
          .eq('status', 'queued')
          .eq('decision_type', 'thread')
          .lt('scheduled_at', sixHoursAgo.toISOString());
      }
    }
    
    if (error) {
      console.error('[POSTING_QUEUE] ❌ Failed to fetch ready decisions:', error.message);
      return [];
    }
    
    console.log(`[POSTING_QUEUE] 📊 Total decisions ready: ${data?.length || 0}`);
    
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
      const decisionId = String(row.decision_id ?? '');  // 🔥 FIX: Use decision_id (UUID), not id (integer)
      if (postedIds.has(decisionId)) {
        console.log(`[POSTING_QUEUE] ⚠️ Skipping duplicate: ${decisionId} (already posted)`);
        return false;
      }
      return true;
    });
    
    console.log(`[POSTING_QUEUE] 📋 Filtered: ${rows.length} → ${filteredRows.length} (removed ${rows.length - filteredRows.length} duplicates)`);
    
    // SEPARATE RATE LIMITS: Content (2/hr for singles+threads combined) vs Replies (4/hr separate)
    const config = getConfig();
    const maxContentPerHour = parseInt(String(config.MAX_POSTS_PER_HOUR || 2)); // Singles + threads share this
    const maxRepliesPerHour = parseInt(String(config.REPLIES_PER_HOUR || 4)); // Replies independent
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    
    // Count content (singles + threads combined) vs replies separately
    const { count: contentCount } = await supabase
      .from('posted_decisions')
      .select('*', { count: 'exact', head: true })
      .in('decision_type', ['single', 'thread']) // Singles and threads share 2/hr budget
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
    
    console.log(`[POSTING_QUEUE] 🚦 Rate limits: Content ${contentPosted}/${maxContentPerHour} (singles+threads), Replies ${repliesPosted}/${maxRepliesPerHour}`);
    
    // Apply rate limits per type
    const decisionsWithLimits = filteredRows.filter(row => {
      const type = String(row.decision_type ?? 'single');
      if (type === 'reply') {
        return repliesPosted < maxRepliesPerHour;
      } else {
        // 'single' and 'thread' both count as content (share 2/hr budget)
        return contentPosted < maxContentPerHour;
      }
    });
    
    console.log(`[POSTING_QUEUE] ✅ After rate limits: ${decisionsWithLimits.length} decisions can post (${contentAllowed} content, ${repliesAllowed} replies available)`);
    
    const decisions: QueuedDecision[] = decisionsWithLimits.map(row => ({
      id: String(row.decision_id ?? ''),  // 🔥 FIX: Map to decision_id (UUID), not id (integer)!
      content: String(row.content ?? ''),
      decision_type: String(row.decision_type ?? 'single') as 'single' | 'thread' | 'reply',
      target_tweet_id: row.target_tweet_id ? String(row.target_tweet_id) : undefined,
      target_username: row.target_username ? String(row.target_username) : undefined,
      bandit_arm: String(row.bandit_arm ?? ''),
      thread_parts: row.thread_parts as string[] | undefined,
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
  const isThread = decision.decision_type === 'thread';
  const logPrefix = isThread ? '[POSTING_QUEUE] 🧵' : '[POSTING_QUEUE] 📝';
  
  console.log(`${logPrefix} Processing ${decision.decision_type}: ${decision.id}`);
  
  // 🧵 THREAD DIAGNOSTICS: Enhanced logging for threads
  if (isThread) {
    const { getSupabaseClient } = await import('../db/index');
    const supabase = getSupabaseClient();
    
    const { data: threadData } = await supabase
      .from('content_metadata')
      .select('thread_parts, created_at, scheduled_at')
      .eq('decision_id', decision.id)
      .single();
    
    if (threadData) {
      const parts = threadData.thread_parts as string[] || [];
      const age = (Date.now() - new Date(String(threadData.created_at)).getTime()) / (1000 * 60);
      console.log(`${logPrefix} ⚡ THREAD DETECTED FOR POSTING ⚡`);
      console.log(`${logPrefix} Thread ID: ${decision.id}`);
      console.log(`${logPrefix} Thread details: ${parts.length} tweets, created ${age.toFixed(0)}min ago`);
      console.log(`${logPrefix} Full thread content:`);
      parts.forEach((tweet: string, i: number) => {
        console.log(`${logPrefix}   Tweet ${i + 1}/${parts.length}: "${tweet.substring(0, 80)}..." (${tweet.length} chars)`);
      });
    } else {
      console.warn(`${logPrefix} ⚠️ Thread data not found for decision ${decision.id}`);
    }
  }
  
  // SMART BATCH FIX: Hard stop - double-check rate limit before EVERY post
  if (decision.decision_type === 'single' || decision.decision_type === 'thread') {
    const canPost = await checkPostingRateLimits();
    if (!canPost) {
      console.log(`[POSTING_QUEUE] ⛔ HARD STOP: Rate limit reached, skipping ${decision.id}`);
      return; // Don't process this decision
    }
  }
  
    // Note: We keep status as 'queued' until actually posted
    // No intermediate 'posting' status to avoid DB constraint violations
    
    // Update metrics
    await updatePostingMetrics('queued');
  
  // Declare variables at function scope so they're accessible in catch block
  let tweetId: string = '';
  let tweetUrl: string | undefined;
  let tweetIds: string[] | undefined;
  let postingSucceeded = false;
  
  try {
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
    
    // ═══════════════════════════════════════════════════════════
    // 🎯 PHASE 1: POST TO TWITTER (CRITICAL - Must succeed or fail here)
    // ═══════════════════════════════════════════════════════════
    
    try {
      if (decision.decision_type === 'single' || decision.decision_type === 'thread') {
        const result = await postContent(decision);
        tweetId = result.tweetId;
        tweetUrl = result.tweetUrl;
        tweetIds = result.tweetIds; // 🆕 Capture thread IDs if available
      } else if (decision.decision_type === 'reply') {
        tweetId = await postReply(decision);
        // For replies, construct URL (reply system doesn't return URL yet)
        tweetUrl = `https://x.com/${process.env.TWITTER_USERNAME || 'SignalAndSynapse'}/status/${tweetId}`;
      } else {
        throw new Error(`Unknown decision type: ${decision.decision_type}`);
      }
      
      // 🎉 TWEET IS LIVE! From this point on, we ALWAYS mark as posted
      postingSucceeded = true;
      console.log(`[POSTING_QUEUE] 🎉 TWEET POSTED SUCCESSFULLY: ${tweetId}`);
      console.log(`[POSTING_QUEUE] 🔗 Tweet URL: ${tweetUrl}`);
      console.log(`[POSTING_QUEUE] ⚠️ From this point on, all operations are best-effort only`);
      
    } catch (postError: any) {
      // Posting failed - tweet never made it to Twitter
      console.error(`[POSTING_QUEUE] ❌ POSTING FAILED: ${postError.message}`);
      console.error(`[POSTING_QUEUE] 📝 Content: "${decision.content.substring(0, 100)}..."`);
      
      // Only mark as failed if posting actually failed
      if (decision.decision_type === 'thread') {
        // Threads get retry logic
        const { getSupabaseClient } = await import('../db/index');
        const supabase = getSupabaseClient();
        
        const { data: metadata } = await supabase
          .from('content_metadata')
          .select('features')
          .eq('decision_id', decision.id)
          .single();
        
        const retryCount = (metadata?.features as any)?.retry_count || 0;
        const maxRetries = 3;
        
        if (retryCount < maxRetries) {
          const { ThreadValidator } = await import('./threadValidator');
          const retryDelay = ThreadValidator.getRetryDelay(retryCount, postError.message);
          
          console.log(`[POSTING_QUEUE] 🔄 Thread will retry (attempt ${retryCount + 1}/${maxRetries}) in ${retryDelay / 60000}min`);
          
          await supabase
            .from('content_metadata')
            .update({
              scheduled_at: new Date(Date.now() + retryDelay).toISOString(),
              features: {
                ...(typeof metadata?.features === 'object' && metadata?.features !== null ? metadata.features : {}),
                retry_count: retryCount + 1,
                last_error: postError.message,
                last_attempt: new Date().toISOString()
              }
            })
            .eq('decision_id', decision.id);
          
          await updatePostingMetrics('error');
          return; // Don't mark as failed, will retry
        }
      }
      
      // Mark as failed (posting never succeeded)
      await updateDecisionStatus(decision.id, 'failed');
      await updatePostingMetrics('error');
      throw postError;
    }
    
    // ═══════════════════════════════════════════════════════════
    // 🎯 PHASE 2: POST-POSTING OPERATIONS (BEST EFFORT ONLY)
    // ═══════════════════════════════════════════════════════════
    // Tweet is live - nothing below can fail the post!
    
    // Best-effort: Extract and classify hook
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
      console.warn(`[POSTING_QUEUE] ⚠️ Hook capture failed (non-critical): ${hookError.message}`);
    }
    
    // Mark as posted and store tweet ID and URL
    // 🚨 CRITICAL: Retry database save if it fails (tweet is already on Twitter!)
    let dbSaveSuccess = false;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        // 🆕 Pass thread IDs if available
        await markDecisionPosted(decision.id, tweetId, tweetUrl, tweetIds);
        dbSaveSuccess = true;
        break;
      } catch (dbError: any) {
        console.error(`[POSTING_QUEUE] 🚨 Database save attempt ${attempt}/3 failed:`, dbError.message);
        if (attempt < 3) {
          console.log(`[POSTING_QUEUE] 🔄 Retrying in 2 seconds...`);
          await new Promise(r => setTimeout(r, 2000));
        }
      }
    }
    
    if (!dbSaveSuccess) {
      console.error(`[POSTING_QUEUE] 💥 Tweet ${tweetId} posted but database save failed after 3 attempts!`);
      console.error(`[POSTING_QUEUE] 🔗 Tweet URL: ${tweetUrl}`);
      console.error(`[POSTING_QUEUE] 📝 Content: ${decision.content.substring(0, 100)}`);
      console.error(`[POSTING_QUEUE] ⚠️ Marking as posted anyway - background job will sync later`);
      
      // 🔥 CRITICAL: Mark as 'posted' even if database save failed
      // This prevents retry and duplicate posting!
      try {
        await supabase
          .from('content_metadata')
          .update({ 
            status: 'posted',
            tweet_id: tweetId,
            posted_at: new Date().toISOString()
          })
          .eq('decision_id', decision.id);
        console.log(`[POSTING_QUEUE] ✅ Status marked as 'posted' (basic update succeeded)`);
      } catch (simpleSaveError: any) {
        console.error(`[POSTING_QUEUE] 💥 Even simple status update failed: ${simpleSaveError.message}`);
        console.error(`[POSTING_QUEUE] ⚠️ Background job will find and sync this tweet`);
      }
      
      // DON'T throw - post succeeded! Database just needs to catch up.
    }
    
    // Best-effort: Update metrics
    try {
      await updatePostingMetrics('posted');
    } catch (metricsError: any) {
      console.warn(`[POSTING_QUEUE] ⚠️ Metrics update failed (non-critical): ${metricsError.message}`);
    }
    
    // Best-effort: Initialize attribution tracking
    try {
      const { initializePostAttribution } = await import('../learning/engagementAttribution');
      await initializePostAttribution(tweetId, {
        hook_pattern: (decision as any).metadata?.hook_pattern || 'unknown',
        topic: (decision as any).metadata?.topic || decision.topic_cluster,
        generator: (decision as any).metadata?.generator_used || 'unknown',
        format: (decision as any).metadata?.format || 'single',
        viral_score: (decision as any).metadata?.viral_score || 50
      });
      console.log(`[POSTING_QUEUE] 📊 Attribution tracking initialized`);
    } catch (attrError: any) {
      console.warn(`[POSTING_QUEUE] ⚠️ Attribution init failed (non-critical): ${attrError.message}`);
    }
    
    console.log(`[POSTING_QUEUE] ✅ ${decision.decision_type} POSTED SUCCESSFULLY: ${tweetId}`);
    
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
    
    // PHASE 5 FIX: Initialize tracking in learning system FIRST
    try {
      // Step 1: Add post to tracking (so learning system knows about it)
      await learningSystem.processNewPost(
        decision.id,
        String(decision.content),
        {
          followers_gained_prediction: decision.predicted_followers || 0
        },
        {
          content_type_name: decision.decision_type,
          hook_used: decision.hook_type || 'unknown',
          topic: decision.topic_cluster || 'health'
        }
      );
      console.log('[LEARNING_SYSTEM] ✅ Post ' + decision.id + ' tracked');
    } catch (learningError: any) {
      console.warn('[LEARNING_SYSTEM] ⚠️ Failed to track post:', learningError.message);
    }
    
    // SMART BATCH FIX: Immediate metrics scraping after post
    try {
      console.log(`[METRICS] 🔍 Collecting initial metrics for ${tweetId}...`);
      
      // Wait 30 seconds for tweet to be indexed by Twitter
      await new Promise(resolve => setTimeout(resolve, 30000));
      
      // SMART BATCH FIX: Simplified metrics collection (avoid complex scraping in posting flow)
      // Store placeholder entry, let scheduled scraper collect real metrics
      await supabase.from('outcomes').upsert({
        decision_id: decision.id,
        tweet_id: tweetId,
        likes: null, // Will be filled by scheduled scraper
        retweets: null,
        replies: null,
        views: null,
        bookmarks: null,
        impressions: null,
        collected_at: new Date().toISOString(),
        data_source: 'post_placeholder',
        simulated: false
      }, { onConflict: 'decision_id' });
      
      console.log(`[METRICS] ✅ Placeholder created for ${tweetId}, scheduled scraper will collect metrics`);
    } catch (metricsError: any) {
      console.warn(`[METRICS] ⚠️ Failed to collect initial metrics (non-critical): ${metricsError.message}`);
      // Don't fail the post, just log and continue
    }
    
    console.log(`[POSTING_QUEUE] 🎉 POST COMPLETE: Tweet is live on Twitter, all tracking initiated!`);
  } catch (error: any) {
    // This catch block only catches post-posting errors (tweet is already live)
    // Actual posting errors are caught in the posting phase above
    console.error(`[POSTING_QUEUE] ⚠️ Post-posting operation failed: ${error.message}`);
    if (postingSucceeded && tweetId) {
      console.error(`[POSTING_QUEUE] ✅ But tweet ${tweetId} is LIVE - this is not a failure!`);
    }
    // DON'T re-throw - tweet might be live!
  }
}

async function postContent(decision: QueuedDecision): Promise<{ tweetId: string; tweetUrl: string; tweetIds?: string[] }> {
  console.log(`[POSTING_QUEUE] 📝 Posting content: "${decision.content.substring(0, 50)}..."`);
  
  // 📊 FOLLOWER TRACKING: Capture baseline before posting
  const followersBefore = await captureFollowerBaseline(decision.id);
  
  // 🔒 BROWSER SEMAPHORE: Acquire exclusive browser access (highest priority)
  const { withBrowserLock, BrowserPriority } = await import('../browser/BrowserSemaphore');
  
  return await withBrowserLock('posting', BrowserPriority.POSTING, async () => {
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
        if (!result.tweetId) {
          throw new Error('X API posting succeeded but no tweet ID was returned');
        }
        console.log(`[POSTING_QUEUE] ✅ Content posted via X API with ID: ${result.tweetId}`);
        const tweetUrl = `https://x.com/${process.env.TWITTER_USERNAME || 'SignalAndSynapse'}/status/${result.tweetId}`;
        return { tweetId: result.tweetId, tweetUrl };
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
      // 🧵 CHECK IF THIS IS A THREAD (retrieve from thread_parts)
      const thread_parts = decision.thread_parts || (decision as any).thread_tweets; // Support both names for backwards compat
      const isThread = Array.isArray(thread_parts) && thread_parts.length > 1;
      
      console.log(`[POSTING_QUEUE] 🔍 Thread detection: isThread=${isThread}, segments=${isThread ? thread_parts.length : 0}`);
      
      if (isThread) {
        console.log(`[POSTING_QUEUE] 🧵 THREAD MODE: Posting ${thread_parts.length} connected tweets`);
        
        // 🎨 GET METADATA FOR VISUAL FORMATTING CONTEXT
        const { getSupabaseClient } = await import('../db/index');
        const supabase = getSupabaseClient();
        const { data: metadata } = await supabase
          .from('content_generation_metadata_comprehensive')
          .select('raw_topic, angle, tone, format_strategy, generator_name')
          .eq('decision_id', decision.id)
          .single();
        
        // ✅ Content is ALREADY formatted (done in planJob before queueing)
        // No need to format again - just use thread_parts directly
        console.log(`[POSTING_QUEUE] 📝 Using pre-formatted thread (${thread_parts.length} tweets)`);
        console.log(`[POSTING_QUEUE] 💡 Visual formatting was applied before queueing`);
        
        // 🚀 POST THREAD (using simplified poster)
        console.log(`[POSTING_QUEUE] 🚀 Posting thread to Twitter...`);
        const { SimpleThreadPoster } = await import('./simpleThreadPoster');
        
        const result = await SimpleThreadPoster.postThread(thread_parts);
        
        if (!result.success) {
          // Thread completely failed
          console.error(`[POSTING_QUEUE] ❌ Thread failed: ${result.error}`);
          throw new Error(`Thread posting failed: ${result.error}`);
        }
        
        // Success (full or partial)
        console.log(`[POSTING_QUEUE] ✅ Thread posted: ${result.mode}`);
        console.log(`[POSTING_QUEUE] 🔗 Root tweet: ${result.tweetId}`);
        console.log(`[POSTING_QUEUE] 📊 Tweet count: ${result.tweetIds.length}/${thread_parts.length}`);
        
        if (result.mode === 'partial_thread') {
          console.warn(`[POSTING_QUEUE] ⚠️ Partial thread: ${result.note}`);
        }
        
        if (result.tweetIds && result.tweetIds.length > 0) {
          console.log(`[POSTING_QUEUE] 🔗 Tweet IDs: ${result.tweetIds.join(', ')}`);
        }
        
        return {
          tweetId: result.tweetId,
          tweetUrl: result.tweetUrl,
          tweetIds: result.tweetIds
        }
      } else {
        console.log(`[POSTING_QUEUE] 📝 Posting as SINGLE tweet`);
        const { UltimateTwitterPoster } = await import('../posting/UltimateTwitterPoster');
        const { BulletproofTweetExtractor } = await import('../utils/bulletproofTweetExtractor');
        
        // ✅ Content is ALREADY formatted (done in planJob before queueing)
        console.log(`[POSTING_QUEUE] 💡 Using pre-formatted content (visual formatting applied before queueing)`);
        
        const poster = new UltimateTwitterPoster();
        const result = await poster.postTweet(decision.content);
        
        if (!result.success) {
          await poster.dispose();
          console.error(`[POSTING_QUEUE] ❌ Playwright posting failed: ${result.error}`);
          throw new Error(result.error || 'Playwright posting failed');
        }
        
        // ✅ POST SUCCEEDED - Now extract tweet ID using ONLY bulletproof method
        console.log(`[POSTING_QUEUE] ✅ Tweet posted! Waiting for Twitter to process...`);
        
        const page = (poster as any).page;
        if (!page) {
          await poster.dispose();
          throw new Error('No browser page available after posting');
        }
        
        // Give Twitter time to process the post and update profile
        await page.waitForTimeout(5000); // Increased to 5 seconds
        console.log(`[POSTING_QUEUE] 🔍 Now extracting tweet ID from profile...`);
        
        // Use bulletproof extractor (this is the ONLY extraction method now)
        const extraction = await BulletproofTweetExtractor.extractTweetId(page, {
          expectedContent: decision.content,  // ✅ Already formatted content
          expectedUsername: process.env.TWITTER_USERNAME || 'SignalAndSynapse',
          maxAgeSeconds: 600, // ✅ FIXED: 10 minutes to handle Twitter profile caching
          navigateToVerify: true
        });
        
        BulletproofTweetExtractor.logVerificationSteps(extraction);
        
        // Clean up browser
        await poster.dispose();
        
        if (!extraction.success || !extraction.tweetId) {
          // ⚠️ ID extraction failed BUT tweet is LIVE on Twitter!
          console.warn(`[POSTING_QUEUE] ⚠️ Tweet posted successfully but ID extraction failed`);
          console.warn(`[POSTING_QUEUE] 📝 Content: "${decision.content.substring(0, 60)}..."`);
          console.warn(`[POSTING_QUEUE] 💡 Error: ${extraction.error || 'Unknown error'}`);
          console.warn(`[POSTING_QUEUE] ✅ Tweet is LIVE - returning success with null ID`);
          console.warn(`[POSTING_QUEUE] 🔄 Background job will find real ID later`);
          
          // Return success with null ID (DON'T throw error!)
          // Tweet is live - this is NOT a failure!
          return { 
            tweetId: null,  // ← null is OK! Background job will find it
            tweetUrl: `https://x.com/${process.env.TWITTER_USERNAME || 'SignalAndSynapse'}`
          };
        }
        
        console.log(`[POSTING_QUEUE] ✅ Tweet ID extracted: ${extraction.tweetId}`);
        console.log(`[POSTING_QUEUE] ✅ Tweet URL: ${extraction.url}`);
        
        // Return object with both ID and URL
        return { tweetId: extraction.tweetId, tweetUrl: extraction.url || extraction.tweetId };
      }
    } catch (error: any) {
      console.error(`[POSTING_QUEUE] ❌ Playwright system error: ${error.message}`);
      throw new Error(`Playwright posting failed: ${error.message}`);
    }
  }
  }); // End withBrowserLock
}

async function postReply(decision: QueuedDecision): Promise<string> {
  console.log(`[POSTING_QUEUE] 💬 Posting reply to @${decision.target_username}: "${decision.content.substring(0, 50)}..."`);
  
  // 🔒 BROWSER SEMAPHORE: Acquire exclusive browser access (high priority)
  const { withBrowserLock, BrowserPriority } = await import('../browser/BrowserSemaphore');
  
  return await withBrowserLock('reply_posting', BrowserPriority.REPLIES, async () => {
    if (!decision.target_tweet_id) {
    throw new Error('Reply decision missing target_tweet_id');
  }
  
  // 🚨 CRITICAL PRE-POST CHECK: Verify we haven't already replied to this tweet
  const { getSupabaseClient } = await import('../db/index');
  const supabase = getSupabaseClient();
  
  const { data: existingReply } = await supabase
    .from('content_metadata')
    .select('tweet_id, posted_at')
    .eq('decision_type', 'reply')
    .eq('target_tweet_id', decision.target_tweet_id)
    .eq('status', 'posted')
    .limit(1)
    .single();
    
  if (existingReply) {
    const replyTime = existingReply.posted_at ? new Date(String(existingReply.posted_at)).toLocaleString() : 'unknown time';
    console.log(`[POSTING_QUEUE] 🚫 DUPLICATE PREVENTED: Already replied to tweet ${decision.target_tweet_id} at ${replyTime}`);
    console.log(`[POSTING_QUEUE]    Previous reply ID: ${existingReply.tweet_id}`);
    
    // Mark this decision as posted (to prevent retry) but don't actually post
    await updateDecisionStatus(decision.id, 'posted');
    throw new Error(`Duplicate reply prevented: Already replied to ${decision.target_tweet_id}`);
  }
  
  console.log(`[POSTING_QUEUE] ✅ Duplicate check passed - no existing reply to ${decision.target_tweet_id}`);
  
  // ✅ Content is ALREADY formatted (done in replyJob before queueing)
  console.log(`[POSTING_QUEUE] 💡 Using pre-formatted reply content`);
  
  // 🛡️ Use PROPER reply system (posts as actual reply, not @mention)
  console.log(`[POSTING_QUEUE] 💬 Using UltimateTwitterPoster.postReply() for REAL replies...`);
  
  try {
    // Validate we have the target tweet ID
    if (!decision.target_tweet_id) {
      throw new Error('Cannot post reply: missing target_tweet_id');
    }
    
    // Use UltimateTwitterPoster for replies (no Redis dependency!)
    const { UltimateTwitterPoster } = await import('../posting/UltimateTwitterPoster');
    const poster = new UltimateTwitterPoster();
    
    console.log(`[POSTING_QUEUE] 💬 Posting REAL reply to tweet ${decision.target_tweet_id}...`);
    console.log(`[POSTING_QUEUE] 📝 Reply content: "${decision.content.substring(0, 60)}..."`);
    
    // Post as ACTUAL reply (not @mention tweet!) - content already formatted
    const result = await poster.postReply(
      decision.content, // Already formatted in replyJob
      decision.target_tweet_id
    );
    
    if (!result.success || !result.tweetId) {
      throw new Error(result.error || 'Reply posting failed');
    }
    
    // ═══════════════════════════════════════════════════════════
    // ✅ CRITICAL VALIDATION: Reply ID MUST be different from parent!
    // ═══════════════════════════════════════════════════════════
    if (result.tweetId === decision.target_tweet_id) {
      console.error(`[POSTING_QUEUE] 🚨 CRITICAL BUG DETECTED:`);
      console.error(`   Reply ID matches parent ID: ${result.tweetId}`);
      console.error(`   This means ID extraction failed!`);
      console.error(`   To @${decision.target_username}: "${decision.content.substring(0, 40)}..."`);
      
      // Don't store bad data - throw error
      throw new Error(`Reply ID extraction bug: got parent ID ${decision.target_tweet_id} instead of new reply ID`);
    }
    
    console.log(`[POSTING_QUEUE] ✅ Reply ID validated: ${result.tweetId} (≠ parent ${decision.target_tweet_id})`);
    console.log(`[POSTING_QUEUE] ✅ REAL reply posted successfully with ID: ${result.tweetId}`);
    const username = process.env.TWITTER_USERNAME || 'SignalAndSynapse';
    console.log(`[POSTING_QUEUE] 🔗 Reply URL: https://x.com/${username}/status/${result.tweetId}`);
    
    await poster.dispose();
    
    // ✅ VALIDATION: Reject placeholder IDs but allow null
    if (result.tweetId && (result.tweetId.startsWith('reply_posted_') || result.tweetId.startsWith('posted_'))) {
      console.error(`[POSTING_QUEUE] ❌ Reply posted but got PLACEHOLDER ID: ${result.tweetId}`);
      console.error(`[POSTING_QUEUE] 📝 Reply to: ${decision.target_tweet_id}`);
      console.warn(`[POSTING_QUEUE] ⚠️ Using null instead - background job will find real ID`);
      return null;  // ← Return null instead of throwing
    }
    
    if (!result.tweetId) {
      console.warn(`[POSTING_QUEUE] ⚠️ Reply posted but ID is null (extraction failed)`);
      console.warn(`[POSTING_QUEUE] ✅ Reply is LIVE - will track with null ID`);
    }
    
    return result.tweetId || null;  // ← Can be null!
  } catch (error: any) {
    console.error(`[POSTING_QUEUE] ❌ Reply system error: ${error.message}`);
    throw new Error(`Reply posting failed: ${error.message}`);
  }
  }); // End withBrowserLock
}

/**
 * 📊 Capture follower baseline before posting
 */
async function captureFollowerBaseline(decisionId: string): Promise<number | null> {
  try {
    const { getSupabaseClient } = await import('../db/index');
    const supabase = getSupabaseClient();
    
    // Get most recent follower snapshot
    const { data: snapshot } = await supabase
      .from('follower_snapshots')
      .select('follower_count')
      .order('timestamp', { ascending: false })
      .limit(1)
      .single();
    
    const followerCount = snapshot?.follower_count ? Number(snapshot.follower_count) : null;
    
    if (followerCount) {
      console.log(`[FOLLOWER_TRACKING] 📊 Baseline: ${followerCount} followers before post`);
      
      // Store baseline in post_follower_tracking
      await supabase
        .from('post_follower_tracking')
        .insert({
          post_id: decisionId,
          tweet_id: null, // Will be updated after posting
          check_time: new Date().toISOString(),
          follower_count: followerCount,
          hours_after_post: 0, // Baseline
          collection_phase: 'baseline'
        });
    }
    
    return followerCount;
    
  } catch (error: any) {
    console.warn('[FOLLOWER_TRACKING] ⚠️ Failed to capture baseline:', error.message);
    return null;
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
      .eq('decision_id', decisionId);  // 🔥 FIX: decisionId is UUID, query by decision_id not id!
    
    if (error) {
      console.warn(`[POSTING_QUEUE] ⚠️ Failed to update status for ${decisionId}:`, error.message);
    }
  } catch (error) {
    console.warn(`[POSTING_QUEUE] ⚠️ Failed to update status for ${decisionId}:`, error.message);
  }
}

async function markDecisionPosted(decisionId: string, tweetId: string, tweetUrl?: string, tweetIds?: string[]): Promise<void> {
  try {
    const { getSupabaseClient } = await import('../db/index');
    const supabase = getSupabaseClient();
    
    // 🆕 Log thread IDs if this is a thread
    if (tweetIds && tweetIds.length > 1) {
      console.log(`[POSTING_QUEUE] 💾 Storing thread with ${tweetIds.length} tweet IDs: ${tweetIds.join(', ')}`);
    }
    
    // 1. Update content_metadata status and tweet_id (CRITICAL!)
    // NOTE: tweet_url column commented out until added to database schema
    const { error: updateError } = await supabase
      .from('content_metadata')
      .update({
        status: 'posted',
        tweet_id: tweetId, // 🔥 CRITICAL: Save tweet ID for metrics scraping!
        thread_tweet_ids: tweetIds ? JSON.stringify(tweetIds) : null, // 🆕 Store all thread IDs as JSON
        posted_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
        // tweet_url: tweetUrl // 🔗 TODO: Add this column to database first!
      })
      .eq('decision_id', decisionId);  // 🔥 FIX: decisionId is UUID, query by decision_id not id!
    
    if (updateError) {
      console.error(`[POSTING_QUEUE] 🚨 CRITICAL: Failed to save tweet_id ${tweetId} to database:`, updateError.message);
      throw new Error(`Database save failed for tweet ${tweetId}: ${updateError.message}`);
    }
    
    console.log(`[POSTING_QUEUE] ✅ Database updated: tweet_id ${tweetId} saved for decision ${decisionId}`);
    
    // 2. Get the full decision details for posted_decisions archive
    const { data: decisionData, error: fetchError } = await supabase
      .from('content_metadata')
      .select('*')
      .eq('decision_id', decisionId)  // 🔥 FIX: decisionId is UUID, query by decision_id not id!
      .single();
    
    if (fetchError || !decisionData) {
      console.error(`[POSTING_QUEUE] 🚨 CRITICAL: Failed to fetch decision data for ${decisionId}:`, fetchError?.message);
      throw new Error(`Cannot archive decision: ${fetchError?.message || 'No data found'}`);
    }
    
    // 3. Store in posted_decisions archive with safer numeric handling
    const { error: archiveError } = await supabase
      .from('posted_decisions')
      .insert([{
        decision_id: decisionData.decision_id,  // 🔥 FIX: Use UUID from data, not integer ID!
        content: decisionData.content,
        tweet_id: tweetId,
        decision_type: decisionData.decision_type || 'single',  // Default to 'single' not 'content'
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
        error_message: errorMessage, // Also store the error
        updated_at: new Date().toISOString()
      })
      .eq('decision_id', decisionId);  // 🔥 FIX: Use decision_id (UUID), not id (integer)!
    
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

/**
 * 🎯 QUEUE DEPTH MONITOR - Ensures minimum content always queued
 * 
 * Guarantees:
 * - MINIMUM 2 content posts/hour (singles + threads)
 * - MINIMUM 4 replies/hour
 * 
 * How it works:
 * - Maintains 4-8 content posts in queue (2-4 hours buffer)
 * - Maintains 8-16 replies in queue (2-4 hours buffer)
 * - Triggers emergency generation if queue drops below minimum
 * - Self-healing: handles browser crashes, generation failures, rate limits
 */
async function ensureMinimumQueueDepth(): Promise<void> {
  try {
    const { getSupabaseClient } = await import('../db/index');
    const supabase = getSupabaseClient();
    
    // Count queued content (singles + threads)
    const { count: queuedContent } = await supabase
      .from('content_metadata')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'queued')
      .in('decision_type', ['single', 'thread']);
    
    // Count queued replies
    const { count: queuedReplies } = await supabase
      .from('content_metadata')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'queued')
      .eq('decision_type', 'reply');
    
    const contentQueueSize = queuedContent || 0;
    const replyQueueSize = queuedReplies || 0;
    
    // Minimum thresholds (2 hours of buffer = 4 content, 8 replies)
    const MIN_CONTENT_QUEUE = 4;  // 2 posts/hour × 2 hours
    const MIN_REPLY_QUEUE = 8;     // 4 replies/hour × 2 hours
    
    console.log(`[QUEUE_MONITOR] 📊 Queue depth: ${contentQueueSize} content, ${replyQueueSize} replies`);
    
    // 🚨 EMERGENCY: Content queue low
    if (contentQueueSize < MIN_CONTENT_QUEUE) {
      console.log(`[QUEUE_MONITOR] ⚠️ Content queue LOW: ${contentQueueSize}/${MIN_CONTENT_QUEUE}`);
      console.log(`[QUEUE_MONITOR] 🚨 Triggering emergency content generation...`);
      
      try {
        const { planContent } = await import('./planJob');
        await planContent();
        console.log(`[QUEUE_MONITOR] ✅ Emergency content generation complete`);
      } catch (error: any) {
        console.error(`[QUEUE_MONITOR] ❌ Emergency content generation failed:`, error.message);
      }
    } else {
      console.log(`[QUEUE_MONITOR] ✅ Content queue healthy: ${contentQueueSize}/${MIN_CONTENT_QUEUE}`);
    }
    
    // 🚨 EMERGENCY: Reply queue low
    if (replyQueueSize < MIN_REPLY_QUEUE) {
      console.log(`[QUEUE_MONITOR] ⚠️ Reply queue LOW: ${replyQueueSize}/${MIN_REPLY_QUEUE}`);
      console.log(`[QUEUE_MONITOR] 🚨 Triggering emergency reply generation...`);
      
      try {
        const { generateReplies } = await import('./replyJob');
        await generateReplies();
        console.log(`[QUEUE_MONITOR] ✅ Emergency reply generation complete`);
      } catch (error: any) {
        console.error(`[QUEUE_MONITOR] ❌ Emergency reply generation failed:`, error.message);
      }
    } else {
      console.log(`[QUEUE_MONITOR] ✅ Reply queue healthy: ${replyQueueSize}/${MIN_REPLY_QUEUE}`);
    }
    
  } catch (error: any) {
    console.error('[QUEUE_MONITOR] ❌ Queue depth check failed:', error.message);
    // Don't throw - this is a safety net, not critical path
  }
}
