/**
 * 🔍 FORENSIC PIPELINE: Reply Decision Recorder
 * Records every reply decision (ALLOW/DENY) with ancestry depth and root tweet tracking
 */

import { getSupabaseClient } from '../../db';

export interface ReplyAncestry {
  targetTweetId: string;
  targetInReplyToTweetId: string | null; // What the target tweet is replying to (if any)
  rootTweetId: string | null; // null = cannot determine root (fail-closed)
  ancestryDepth: number | null; // null = uncertain, 0 = root tweet, 1+ = reply depth
  isRoot: boolean; // true if targetTweetId == rootTweetId AND status=OK
  // 🔒 FAIL-CLOSED: Status and confidence tracking
  status: 'OK' | 'UNCERTAIN' | 'ERROR';
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  method: string;
  signals?: {
    replying_to_text: boolean;
    social_context: boolean;
    main_article_reply_indicator: boolean;
    multiple_articles: boolean;
    verification_passed: boolean;
  };
  error?: string;
  cache_hit?: boolean; // Whether this resolution used cache
}

export interface ReplyDecisionRecord {
  decision_id?: string; // Optional link to content_metadata
  target_tweet_id: string;
  target_in_reply_to_tweet_id?: string | null;
  root_tweet_id: string;
  ancestry_depth: number;
  is_root: boolean;
  decision: 'ALLOW' | 'DENY';
  reason?: string;
  deny_reason_code?: string | null; // 🎯 ANALYTICS: Structured deny reason code (NON_ROOT, ANCESTRY_UNCERTAIN, ANCESTRY_ERROR, ANCESTRY_TIMEOUT, ANCESTRY_PLAYWRIGHT_DROPPED, ANCESTRY_NAV_FAIL, ANCESTRY_PARSE_FAIL, LOW_RELEVANCE, LOW_AUTHOR_SIGNAL, LOW_QUALITY_SCORE, CONSENT_WALL, DUPLICATE_TOPIC, RATE_LIMITED, NO_CANDIDATES, OTHER)
  // 🔒 REQUIRED: Status, confidence, method must always be provided
  status: 'OK' | 'UNCERTAIN' | 'ERROR';
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';
  method: string; // Resolution method (metadata, json, dom, cache, explicit_signals, dom_verification, error, fallback, unknown)
  // 🎨 QUALITY TRACKING: Candidate features and template tracking
  candidate_features?: Record<string, any>; // JSON of candidate scoring features
  candidate_score?: number; // Overall candidate score (0-100)
  template_id?: string | null; // Template used (e.g., 'explanation', 'actionable') - NULL if not selected yet
  prompt_version?: string | null; // Prompt version/template version used - NULL if not selected yet
  template_status?: 'PENDING' | 'SET' | 'FAILED'; // Template selection status
  template_error_reason?: string | null; // Reason for FAILED status (e.g., TEMPLATE_SELECTION_TIMEOUT, UPDATE_FAILED)
  // 🎯 PIPELINE STAGES: Stage timestamps
  scored_at?: string; // ISO timestamp when decision row created
  template_selected_at?: string; // ISO timestamp when template selected
  generation_started_at?: string; // ISO timestamp when generation started
  generation_completed_at?: string; // ISO timestamp when generation completed
  posting_started_at?: string; // ISO timestamp when posting started
  posting_completed_at?: string; // ISO timestamp when posting completed
  pipeline_error_reason?: string | null; // Specific pipeline stage error
  trace_id?: string; // feed_run_id, scheduler_run_id, etc.
  job_run_id?: string;
  pipeline_source?: string;
  playwright_post_attempted?: boolean;
  posted_reply_tweet_id?: string;
  error?: string;
  cache_hit?: boolean; // Whether this resolution used cache
}

/**
 * Resolve tweet ancestry: compute root tweet ID and depth
 * Cap depth at 10 to prevent infinite loops
 * 🔒 FAIL-CLOSED: Returns UNCERTAIN/ERROR status when resolution fails
 * 🚀 IMPROVED: Uses cache + metadata + JSON + DOM fallback order
 */
export async function resolveTweetAncestry(targetTweetId: string): Promise<ReplyAncestry> {
  // Step 1: Check cache
  const { getCachedAncestry, setCachedAncestry } = await import('./ancestryCache');
  const cached = await getCachedAncestry(targetTweetId);
  if (cached) {
    cached.cache_hit = true;
    return cached;
  }
  
  // Step 2: Try metadata first (if available)
  const metadataAncestry = await tryMetadataResolution(targetTweetId);
  if (metadataAncestry && metadataAncestry.status === 'OK') {
    await setCachedAncestry(targetTweetId, metadataAncestry);
    return metadataAncestry;
  }
  
  // Step 3: Check if system is overloaded (skip ancestry if overloaded)
  const { UnifiedBrowserPool } = await import('../../browser/UnifiedBrowserPool');
  const pool = UnifiedBrowserPool.getInstance();
  const poolAny = pool as any;
  const queueLen = poolAny.queue?.length || 0;
  const activeContexts = poolAny.getActiveCount?.() || 0;
  const maxContexts = poolAny.MAX_CONTEXTS || 0;
  const isOverloaded = queueLen >= 20 || (activeContexts >= maxContexts && queueLen >= 5);
  
  if (isOverloaded && !cached) {
    // Skip ancestry resolution if overloaded and no cache hit
    console.warn(`[ANCESTRY] ⚠️ System overloaded (queue=${queueLen}, active=${activeContexts}/${maxContexts}), skipping ancestry resolution for ${targetTweetId}`);
    const skippedResult = {
      targetTweetId,
      targetInReplyToTweetId: null,
      rootTweetId: null,
      ancestryDepth: null,
      isRoot: false,
      status: 'ERROR' as const,
      confidence: 'LOW' as const,
      method: 'skipped_overload',
      error: `Ancestry resolution skipped due to system overload (queue=${queueLen}, active=${activeContexts}/${maxContexts})`,
      cache_hit: false,
    };
    // Cache skipped result to avoid retrying immediately
    await setCachedAncestry(targetTweetId, skippedResult);
    return skippedResult;
  }
  
  // Step 4: Fall back to DOM resolution
  const { resolveRootTweetId } = await import('../../utils/resolveRootTweet');
  
  let currentTweetId = targetTweetId;
  let depth = 0;
  const MAX_DEPTH = 10;
  const visited = new Set<string>();
  let targetInReplyToTweetId: string | null = null;
  let lastResolution: any = null;
  
  while (depth < MAX_DEPTH) {
    if (visited.has(currentTweetId)) {
      console.warn(`[ANCESTRY] ⚠️ Circular reference detected at ${currentTweetId}, stopping`);
      return {
        targetTweetId,
        targetInReplyToTweetId,
        rootTweetId: null,
        ancestryDepth: null,
        isRoot: false,
        status: 'ERROR',
        confidence: 'LOW',
        method: 'circular_reference',
        error: `Circular reference detected at ${currentTweetId}`,
      };
    }
    visited.add(currentTweetId);
    
    try {
      let resolution = await resolveRootTweetId(currentTweetId);
      lastResolution = resolution;
      
      // 🎯 RETRY LOGIC: If ERROR and transient (timeout/dropped), retry once with backoff
      if (resolution.status === 'ERROR' && resolution.error) {
        const errorMsg = resolution.error.toLowerCase();
        const isTransient = 
          errorMsg.includes('timeout') || 
          errorMsg.includes('queue timeout') ||
          errorMsg.includes('pool overloaded') ||
          errorMsg.includes('dropped') ||
          errorMsg.includes('disconnected') ||
          errorMsg.includes('browser has been closed');
        
        if (isTransient && depth === 0) {
          // Only retry at top level (not in recursion)
          console.log(`[ANCESTRY] 🔄 Transient error detected, retrying once with backoff...`);
          await new Promise(resolve => setTimeout(resolve, 2000)); // 2s backoff
          
          try {
            resolution = await resolveRootTweetId(currentTweetId);
            lastResolution = resolution;
            console.log(`[ANCESTRY] ✅ Retry result: status=${resolution.status}, method=${resolution.method}`);
          } catch (retryError: any) {
            console.warn(`[ANCESTRY] ⚠️ Retry also failed: ${retryError.message}`);
            // Continue with original error
          }
        }
      }
      
      // 🔒 FAIL-CLOSED: If resolution is UNCERTAIN or ERROR, propagate it
      if (resolution.status === 'UNCERTAIN' || resolution.status === 'ERROR') {
        console.warn(`[ANCESTRY] ⚠️ Resolution ${resolution.status} for ${currentTweetId} - FAIL-CLOSED`);
        const uncertainResult = {
          targetTweetId,
          targetInReplyToTweetId: depth === 0 ? null : currentTweetId,
          rootTweetId: null,
          ancestryDepth: null,
          isRoot: false,
          status: resolution.status,
          confidence: resolution.confidence,
          method: resolution.method,
          signals: resolution.signals,
          error: resolution.error,
          cache_hit: false,
        };
        // Cache UNCERTAIN/ERROR result (still useful to avoid retrying)
        await setCachedAncestry(targetTweetId, uncertainResult);
        return uncertainResult;
      }
      
      if (resolution.isRootTweet && resolution.status === 'OK') {
        // Found root with OK status
        const result = {
          targetTweetId,
          targetInReplyToTweetId: depth === 0 ? null : currentTweetId,
          rootTweetId: resolution.rootTweetId || currentTweetId,
          ancestryDepth: depth,
          isRoot: depth === 0,
          status: 'OK' as const,
          confidence: resolution.confidence,
          method: resolution.method,
          signals: resolution.signals,
          cache_hit: false,
        };
        // Cache result
        await setCachedAncestry(targetTweetId, result);
        return result;
      }
      
      // This is a reply, get the parent
      if (resolution.rootTweetId && resolution.rootTweetId !== currentTweetId && resolution.status === 'OK') {
        if (depth === 0) {
          targetInReplyToTweetId = currentTweetId;
        }
        depth++;
        currentTweetId = resolution.rootTweetId;
        continue;
      }
      
      // Could not resolve further - UNCERTAIN
      console.warn(`[ANCESTRY] ⚠️ Could not resolve parent for ${currentTweetId}`);
      const uncertainResult = {
        targetTweetId,
        targetInReplyToTweetId,
        rootTweetId: null,
        ancestryDepth: null,
        isRoot: false,
        status: 'UNCERTAIN' as const,
        confidence: 'LOW' as const,
        method: 'incomplete_resolution',
        error: `Could not resolve parent for ${currentTweetId}`,
      };
      // Cache UNCERTAIN result (still useful to avoid retrying)
      await setCachedAncestry(targetTweetId, uncertainResult);
      return uncertainResult;
    } catch (error: any) {
      console.error(`[ANCESTRY] ❌ Error resolving ancestry for ${currentTweetId}:`, error.message);
      const errorResult = {
        targetTweetId,
        targetInReplyToTweetId,
        rootTweetId: null,
        ancestryDepth: null,
        isRoot: false,
        status: 'ERROR' as const,
        confidence: 'LOW' as const,
        method: 'exception',
        error: error.message,
        cache_hit: false,
      };
      // Cache ERROR result (still useful to avoid retrying)
      await setCachedAncestry(targetTweetId, errorResult);
      return errorResult;
    }
  }
  
  // Hit MAX_DEPTH - UNCERTAIN
  console.warn(`[ANCESTRY] ⚠️ Hit MAX_DEPTH (${MAX_DEPTH}) - UNCERTAIN`);
  const maxDepthResult = {
    targetTweetId,
    targetInReplyToTweetId,
    rootTweetId: null,
    ancestryDepth: null,
    isRoot: false,
    status: 'UNCERTAIN' as const,
    confidence: 'LOW' as const,
    method: 'max_depth_reached',
    error: `Hit MAX_DEPTH (${MAX_DEPTH}) without finding root`,
    cache_hit: false,
  };
  // Cache UNCERTAIN result
  await setCachedAncestry(targetTweetId, maxDepthResult);
  return maxDepthResult;
}

/**
 * Try to resolve ancestry from existing metadata (fastest, most reliable)
 */
async function tryMetadataResolution(tweetId: string): Promise<ReplyAncestry | null> {
  try {
    const { getSupabaseClient } = await import('../../db');
    const supabase = getSupabaseClient();
    
    // Check reply_opportunities for metadata
    const { data: opp } = await supabase
      .from('reply_opportunities')
      .select('tweet_id, target_in_reply_to_tweet_id, root_tweet_id, is_root_tweet')
      .eq('tweet_id', tweetId)
      .maybeSingle();
    
    if (opp && opp.root_tweet_id && opp.is_root_tweet !== undefined) {
      const isRoot = opp.is_root_tweet && opp.tweet_id === opp.root_tweet_id;
      const depth = isRoot ? 0 : (opp.target_in_reply_to_tweet_id ? 1 : null);
      
      if (depth !== null) {
        console.log(`[ANCESTRY] ✅ Resolved from metadata: ${tweetId} → depth=${depth}, root=${opp.root_tweet_id}`);
        return {
          targetTweetId: tweetId,
          targetInReplyToTweetId: opp.target_in_reply_to_tweet_id || null,
          rootTweetId: opp.root_tweet_id,
          ancestryDepth: depth,
          isRoot: isRoot,
          status: 'OK',
          confidence: 'HIGH',
          method: 'metadata',
        };
      }
    }
    
    // Check content_metadata for reply info
    const { data: meta } = await supabase
      .from('content_metadata')
      .select('target_tweet_id, root_tweet_id')
      .eq('target_tweet_id', tweetId)
      .eq('decision_type', 'reply')
      .maybeSingle();
    
    if (meta && meta.root_tweet_id) {
      const isRoot = meta.target_tweet_id === meta.root_tweet_id;
      const depth = isRoot ? 0 : 1; // Assume depth 1 if target != root
      
      console.log(`[ANCESTRY] ✅ Resolved from content_metadata: ${tweetId} → depth=${depth}, root=${meta.root_tweet_id}`);
      return {
        targetTweetId: tweetId,
        targetInReplyToTweetId: isRoot ? null : meta.target_tweet_id,
        rootTweetId: meta.root_tweet_id,
        ancestryDepth: depth,
        isRoot: isRoot,
        status: 'OK',
        confidence: 'HIGH',
        method: 'metadata',
      };
    }
    
    // Check cache table (if exists)
    try {
      const { data: cached } = await supabase
        .from('reply_ancestry_cache')
        .select('*')
        .eq('tweet_id', tweetId)
        .maybeSingle();
      
      if (cached && cached.status === 'OK' && cached.depth !== null) {
        console.log(`[ANCESTRY] ✅ Resolved from cache metadata: ${tweetId} → depth=${cached.depth}, root=${cached.root_tweet_id}`);
        return {
          targetTweetId: tweetId,
          targetInReplyToTweetId: null,
          rootTweetId: cached.root_tweet_id,
          ancestryDepth: cached.depth,
          isRoot: cached.depth === 0,
          status: cached.status as 'OK',
          confidence: cached.confidence as 'HIGH' | 'MEDIUM' | 'LOW',
          method: cached.method,
        };
      }
    } catch (cacheError: any) {
      // Cache table might not exist yet, ignore
    }
    
    return null; // No metadata available
  } catch (error: any) {
    console.warn(`[ANCESTRY] ⚠️ Metadata resolution failed: ${error.message}`);
    return null;
  }
}

/**
 * Record a reply decision in the forensic pipeline
 * 🔒 REQUIRED: status, confidence, method must always be provided
 */
export async function recordReplyDecision(record: ReplyDecisionRecord): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    
    // 🔒 VALIDATION: Ensure required fields are present
    if (!record.status || !record.confidence || !record.method) {
      console.error(`[REPLY_DECISION] ❌ Missing required fields: status=${record.status}, confidence=${record.confidence}, method=${record.method}`);
      // Fallback to safe defaults (will DENY)
      record.status = record.status || 'UNCERTAIN';
      record.confidence = record.confidence || 'UNKNOWN';
      record.method = record.method || 'unknown';
    }
    
    const { error } = await supabase.from('reply_decisions').insert({
      decision_id: record.decision_id || null,
      target_tweet_id: record.target_tweet_id,
      target_in_reply_to_tweet_id: record.target_in_reply_to_tweet_id || null,
      root_tweet_id: record.root_tweet_id || 'null', // Store 'null' string if null
      ancestry_depth: record.ancestry_depth ?? -1, // Use -1 for null depth (DB constraint requires int)
      is_root: record.is_root,
      decision: record.decision,
      reason: record.reason || null,
      deny_reason_code: record.decision === 'DENY' ? (record.deny_reason_code || 'OTHER') : null, // 🎯 ANALYTICS: Set deny_reason_code for DENY decisions
      status: record.status, // 🔒 REQUIRED
      confidence: record.confidence, // 🔒 REQUIRED
      method: record.method, // 🔒 REQUIRED
      cache_hit: record.cache_hit || false,
      candidate_features: record.candidate_features || null, // 🎨 QUALITY TRACKING
      candidate_score: record.candidate_score || null, // 🎨 QUALITY TRACKING
      template_id: record.template_id || null, // 🎨 QUALITY TRACKING (NULL if not selected)
      prompt_version: record.prompt_version || null, // 🎨 QUALITY TRACKING (NULL if not selected)
      template_status: record.template_status || 'PENDING', // 🎨 QUALITY TRACKING
      template_error_reason: (record as any).template_error_reason || null, // 🎨 QUALITY TRACKING
      // 🎯 PIPELINE STAGES: Stage timestamps
      scored_at: record.scored_at || null,
      template_selected_at: record.template_selected_at || null,
      generation_started_at: record.generation_started_at || null,
      generation_completed_at: record.generation_completed_at || null,
      posting_started_at: record.posting_started_at || null,
      posting_completed_at: record.posting_completed_at || null,
      pipeline_error_reason: record.pipeline_error_reason || null,
      trace_id: record.trace_id || null,
      job_run_id: record.job_run_id || null,
      pipeline_source: record.pipeline_source || null,
      playwright_post_attempted: record.playwright_post_attempted || false,
      posted_reply_tweet_id: record.posted_reply_tweet_id || null,
      error: record.error || null,
      deny_reason_detail: (record as any).deny_reason_detail || null,
      build_sha: process.env.APP_VERSION || process.env.RAILWAY_GIT_COMMIT_SHA || 'unknown',
    });
    
    if (error) {
      console.error(`[REPLY_DECISION] ❌ Failed to record decision: ${error.message}`);
    } else {
      console.log(`[REPLY_DECISION] ✅ Recorded: ${record.decision} for ${record.target_tweet_id} (depth=${record.ancestry_depth}, root=${record.is_root})`);
    }
  } catch (error: any) {
    console.error(`[REPLY_DECISION] ❌ Error recording decision: ${error.message}`);
  }
}

/**
 * Check if reply should be allowed based on ancestry
 * 🔒 FAIL-CLOSED: Only allow when status=OK AND depth===0 AND method != 'unknown'
 * All other cases (UNCERTAIN, ERROR, depth>=1, method=unknown) result in DENY
 * 🎯 ANALYTICS: Returns deny_reason_code for structured analytics
 */
export function shouldAllowReply(ancestry: ReplyAncestry): { allow: boolean; reason: string; deny_reason_code?: string; deny_reason_detail?: string } {
  // 🔒 FAIL-CLOSED: Must have OK status
  if (ancestry.status !== 'OK') {
    const statusReason = ancestry.status === 'UNCERTAIN' 
      ? 'ANCESTRY_UNCERTAIN_FAIL_CLOSED'
      : 'ANCESTRY_ERROR_FAIL_CLOSED';
    
    // 🎯 SPECIFIC ERROR BUCKETS: Map error to specific deny_reason_code (stage-aware)
    let denyReasonCode: string = ancestry.status === 'UNCERTAIN' ? 'ANCESTRY_UNCERTAIN' : 'ANCESTRY_ERROR';
    let denyReasonDetail: string | undefined = undefined;
    
    if (ancestry.status === 'ERROR' && ancestry.error) {
      const errorLower = ancestry.error.toLowerCase();
      const errorMsg = ancestry.error;
      
      // 🎯 PART B: Stage-specific error codes (highest priority)
      // Extract stage info from error message if available
      let stageName = 'unknown';
      let durationMs = null;
      let poolSnapshot: any = null;
      
      // Try to extract stage from error message or ancestry metadata
      const stageMatch = errorMsg.match(/stage=(\w+)/);
      if (stageMatch) {
        stageName = stageMatch[1];
      }
      
      // Try to extract duration from stage_timings JSON if present
      const timingsMatch = errorMsg.match(/stage_timings=(\{[^}]+\})/);
      if (timingsMatch) {
        try {
          const timings = JSON.parse(timingsMatch[1]);
          durationMs = timings[stageName] || Object.values(timings)[0] || null;
        } catch {}
      }
      
      // Get pool snapshot for context
      try {
        const { UnifiedBrowserPool } = await import('../../browser/UnifiedBrowserPool');
        const pool = UnifiedBrowserPool.getInstance();
        const poolAny = pool as any;
        const metrics = pool.getMetrics();
        poolSnapshot = {
          queue_len: poolAny.queue?.length || 0,
          active: poolAny.getActiveCount?.() || 0,
          idle: (poolAny.contexts?.size || 0) - (poolAny.getActiveCount?.() || 0),
          total_contexts: poolAny.contexts?.size || 0,
          max_contexts: poolAny.MAX_CONTEXTS || 0,
          semaphore_inflight: 0, // Will be filled if limiter available
        };
        
        try {
          const { getAncestryLimiter } = await import('../../utils/ancestryConcurrencyLimiter');
          const limiter = getAncestryLimiter();
          const limiterStats = limiter.getStats();
          poolSnapshot.semaphore_inflight = limiterStats.current || 0;
        } catch {}
      } catch {}
      
      // Build detailed deny_reason_detail
      const detailParts: string[] = [];
      if (stageName !== 'unknown') detailParts.push(`stage=${stageName}`);
      if (durationMs !== null) detailParts.push(`duration_ms=${durationMs}`);
      if (poolSnapshot) {
        detailParts.push(`pool={queue=${poolSnapshot.queue_len},active=${poolSnapshot.active}/${poolSnapshot.max_contexts},idle=${poolSnapshot.idle},semaphore=${poolSnapshot.semaphore_inflight}}`);
      }
      const baseDetail = errorMsg.split(':').slice(1).join(':').trim();
      if (baseDetail && !baseDetail.includes('stage=')) {
        detailParts.push(`error=${baseDetail.substring(0, 200)}`);
      }
      denyReasonDetail = detailParts.join(' ');
      
      if (errorMsg.includes('ANCESTRY_ACQUIRE_CONTEXT_TIMEOUT') || errorLower.includes('acquire_context_timeout')) {
        denyReasonCode = 'ANCESTRY_ACQUIRE_CONTEXT_TIMEOUT';
      } else if (errorMsg.includes('ANCESTRY_NAV_TIMEOUT') || errorLower.includes('nav_timeout')) {
        denyReasonCode = 'ANCESTRY_NAV_TIMEOUT';
      } else if (errorMsg.includes('ANCESTRY_PARSE_TIMEOUT') || errorLower.includes('parse_timeout')) {
        denyReasonCode = 'ANCESTRY_PARSE_TIMEOUT';
      } else if (errorMsg.includes('ANCESTRY_QUEUE_TIMEOUT') || errorLower.includes('queue_timeout')) {
        denyReasonCode = 'ANCESTRY_QUEUE_TIMEOUT';
      } else if (errorMsg.includes('CONSENT_WALL') || errorLower.includes('consent_wall')) {
        denyReasonCode = 'CONSENT_WALL';
      } else if (errorLower.includes('skipped') || errorLower.includes('overload')) {
        denyReasonCode = 'ANCESTRY_SKIPPED_OVERLOAD';
      } else if (errorLower.includes('timeout') || errorLower.includes('queue timeout') || errorLower.includes('pool overloaded')) {
        denyReasonCode = 'ANCESTRY_TIMEOUT'; // Generic timeout fallback
      } else if (errorLower.includes('dropped') || errorLower.includes('disconnected') || errorLower.includes('browser has been closed')) {
        denyReasonCode = 'ANCESTRY_PLAYWRIGHT_DROPPED';
      } else if (errorLower.includes('navigation') || errorLower.includes('nav_fail') || errorLower.includes('goto failed')) {
        denyReasonCode = 'ANCESTRY_NAV_FAIL';
      } else if (errorLower.includes('parse') || errorLower.includes('extraction failed') || errorLower.includes('dom query failed')) {
        denyReasonCode = 'ANCESTRY_PARSE_FAIL';
      }
    }
    
    console.log(`[REPLY_DECISION] 🚫 DENY: ${statusReason} status=${ancestry.status} target=${ancestry.targetTweetId} method=${ancestry.method} code=${denyReasonCode}${denyReasonDetail ? ` detail=${denyReasonDetail}` : ''}`);
    return {
      allow: false,
      reason: `${statusReason}: status=${ancestry.status}, target=${ancestry.targetTweetId}, method=${ancestry.method}${ancestry.error ? `, error=${ancestry.error}` : ''}`,
      deny_reason_code: denyReasonCode,
      deny_reason_detail: denyReasonDetail,
    };
  }
  
  // 🔒 FAIL-CLOSED: Method must not be 'unknown'
  if (ancestry.method === 'unknown' || !ancestry.method) {
    console.log(`[REPLY_DECISION] 🚫 DENY: METHOD_UNKNOWN target=${ancestry.targetTweetId} method=${ancestry.method || 'missing'}`);
    return {
      allow: false,
      reason: `METHOD_UNKNOWN_FAIL_CLOSED: method=${ancestry.method || 'missing'}, target=${ancestry.targetTweetId}`,
      deny_reason_code: 'ANCESTRY_ERROR', // Method unknown = ancestry error
      deny_reason_detail: `method=${ancestry.method || 'missing'}`,
    };
  }
  
  // 🔒 FAIL-CLOSED: Depth must be exactly 0 (root tweet)
  if (ancestry.ancestryDepth === null || ancestry.ancestryDepth !== 0) {
    return {
      allow: false,
      reason: `Non-root reply blocked: depth=${ancestry.ancestryDepth ?? 'null'}, target=${ancestry.targetTweetId}, root=${ancestry.rootTweetId || 'null'}`,
      deny_reason_code: 'NON_ROOT',
      deny_reason_detail: `depth=${ancestry.ancestryDepth ?? 'null'}`,
    };
  }
  
  // 🔒 FAIL-CLOSED: Must be confirmed root
  if (!ancestry.isRoot) {
    return {
      allow: false,
      reason: `Target tweet is not root: target=${ancestry.targetTweetId}, root=${ancestry.rootTweetId || 'null'}`,
      deny_reason_code: 'NON_ROOT',
      deny_reason_detail: `is_root=false`,
    };
  }
  
  // ✅ ALLOW: status=OK, depth=0, isRoot=true, method != unknown
  return {
    allow: true,
    reason: `Root tweet allowed: target=${ancestry.targetTweetId}, status=${ancestry.status}, confidence=${ancestry.confidence}, method=${ancestry.method}`,
  };
}
