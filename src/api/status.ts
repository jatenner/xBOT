/**
 * Comprehensive /status endpoint for xBOT health monitoring
 */

import { pgPool } from '../db/pg';
import { getBudgetStatus } from '../budget/guard';
import { getBudgetStatusForAPI } from '../budget/hardGuard';
import { getRealMetricsConfig } from '../config/realMetrics';
import { budgetedOpenAI } from '../services/openaiBudgetedClient';
import { getOpenAIHealth } from '../llm/openaiClient';
import { getLearningStatus } from '../ai/learningScheduler';
import { flags } from '../config/featureFlags';

export interface SystemStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  database: {
    connected: boolean;
    pool_total: number;
    pool_idle: number;
    latest_migration?: string;
    migration_count?: number;
    error?: string;
  };
  budget: {
    enabled: boolean;
    daily_spent: number;
    daily_limit: number;
    hourly_generations: number;
    hourly_limit: number;
    posting_disabled: boolean;
    dry_run: boolean;
  };
  circuit_breaker: {
    circuit_open: boolean;
    circuit_remaining_ms: number;
    quota_override: boolean;
  };
  learning: {
    should_run: boolean;
    last_run_at: string | null;
    next_run_at: string | null;
    minutes_remaining: number;
  };
  posting: {
    enabled: boolean;
    reason?: string;
  };
  real_metrics: {
    enabled: boolean;
    browser_required: boolean;
    reason: string;
  };
  environment: {
    node_env: string;
    posting_disabled: boolean;
    posting_enabled: boolean;
    ai_cooldown_minutes: number;
    learning_debounce_minutes: number;
    dry_run: boolean;
    budget_enforcer_enabled: boolean;
    real_metrics_enabled: boolean;
  };
  memory: {
    used_mb: number;
    heap_used_mb: number;
    heap_total_mb: number;
    rss_mb: number;
  };
  // 🎯 PHASE 4: Reply monitoring metrics (last 60 min)
  reply_metrics?: {
    opportunities_available: number;
    fresh_opportunities_available: number;
    stale_opportunities_count: number;
    replies_queued_60m: number;
    replies_posted_60m: number;
    replies_blocked_60m: number;
    invariant_blocks_60m: number;
    skipped_is_reply_60m: number;
    skipped_thread_like_60m: number;
    skipped_no_context_60m: number;
    skipped_stale_60m: number;
    // 🚨 CRITICAL: All the blocking reasons for fail-closed gates
    thread_like_blocked_60m: number;
    target_not_root_or_missing_60m: number;
    context_mismatch_blocked_60m: number;
    topic_mismatch_blocked_60m: number;
    missing_gate_data_blocked_60m: number;
    verification_fetch_error_60m: number;
    missing_target_text_60m: number;
    posting_target_not_root_60m: number;
    low_similarity_blocked_60m: number;
    root_cooldown_blocked_60m: number;
    author_cooldown_blocked_60m: number;
    self_reply_blocked_60m: number;
    hourly_rate_blocked_60m: number;
    last_successful_reply_at: string | null;
    last_harvest_success_at: string | null;
    pacing_status: string;
    opportunity_pool_health: string;
  };
}

/**
 * Get current system status
 */
export async function getSystemStatus(): Promise<SystemStatus> {
  const startTime = Date.now();
  
  // Database status
  const dbStatus = await getDatabaseStatus();
  
  // Budget status (use new budgeted client for comprehensive status)
  const budgetStatus = await getComprehensiveBudgetStatus();
  
  // Circuit breaker status
  const circuitStatus = await getOpenAIHealth();
  
  // Learning scheduler status
  const learningStatus = await getLearningStatus();
  
  // Real metrics status
  const realMetricsConfig = getRealMetricsConfig();
  const realMetricsStatus = {
    enabled: realMetricsConfig.enabled,
    browser_required: realMetricsConfig.browserRequired,
    reason: realMetricsConfig.reason
  };
  
  // Posting status
  const postingStatus = getPostingStatus();
  
  // Memory usage
  const memoryUsage = process.memoryUsage();
  const memory = {
    used_mb: Math.round(memoryUsage.rss / 1024 / 1024),
    heap_used_mb: Math.round(memoryUsage.heapUsed / 1024 / 1024),
    heap_total_mb: Math.round(memoryUsage.heapTotal / 1024 / 1024),
    rss_mb: Math.round(memoryUsage.rss / 1024 / 1024)
  };
  
  // 🎯 PHASE 4: Reply monitoring metrics
  const replyMetrics = await getReplyMetrics();
  
  // Overall health determination
  let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  
  if (!dbStatus.connected) {
    overallStatus = 'unhealthy';
  } else if (memory.used_mb > 400) { // High memory usage
    overallStatus = 'degraded';
  } else if (replyMetrics.opportunity_pool_health === 'critical') {
    overallStatus = 'degraded';
  }
  
  const status: SystemStatus = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    database: dbStatus,
    budget: {
      enabled: true,
      daily_spent: (budgetStatus as any).usedTodayUSD || (budgetStatus as any).spent || 0,
      daily_limit: (budgetStatus as any).dailyLimitUSD || (budgetStatus as any).limit || 5,
      hourly_generations: 0,
      hourly_limit: parseInt(process.env.MAX_GENERATIONS_PER_HOUR || '0'),
      posting_disabled: (budgetStatus as any).postingDisabled || false,
      dry_run: process.env.DRY_RUN === 'true'
    },
    circuit_breaker: circuitStatus,
    learning: learningStatus,
    posting: postingStatus,
    real_metrics: realMetricsStatus,
    environment: {
      node_env: process.env.NODE_ENV || 'production',
      posting_disabled: process.env.POSTING_DISABLED === 'true',
      posting_enabled: flags.postingEnabled,
      ai_cooldown_minutes: parseInt(process.env.AI_COOLDOWN_MINUTES || '0'),
      learning_debounce_minutes: parseInt(process.env.LEARNING_DEBOUNCE_MINUTES || '60'),
      dry_run: process.env.DRY_RUN === 'true',
      budget_enforcer_enabled: process.env.BUDGET_ENFORCER_ENABLED === 'true',
      real_metrics_enabled: process.env.REAL_METRICS_ENABLED === 'true'
    },
    memory,
    reply_metrics: replyMetrics
  };
  
  const duration = Date.now() - startTime;
  console.log(`STATUS_CHECK: Completed in ${duration}ms (${overallStatus})`);
  
  return status;
}

/**
 * 🎯 PHASE 4: Get reply monitoring metrics (last 60 minutes)
 */
async function getReplyMetrics(): Promise<SystemStatus['reply_metrics']> {
  try {
    const sixtyMinutesAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const MAX_AGE_MIN = 180;
    const freshnessThreshold = new Date(Date.now() - MAX_AGE_MIN * 60 * 1000).toISOString();
    
    // Run queries in parallel
    const [
      opportunitiesResult,
      freshOpportunitiesResult,
      staleOpportunitiesResult,
      queuedResult,
      postedResult,
      blockedResult,
      invariantBlocksResult,
      blockedByReasonResult,
      lastSuccessResult,
      lastHarvestResult
    ] = await Promise.all([
      // All opportunities available (not replied, not expired)
      pgPool.query(`
        SELECT COUNT(*) as count FROM reply_opportunities 
        WHERE replied_to = false 
        AND (expires_at IS NULL OR expires_at > NOW())
      `),
      
      // Fresh opportunities (<180 min old)
      pgPool.query(`
        SELECT COUNT(*) as count FROM reply_opportunities 
        WHERE replied_to = false 
        AND (expires_at IS NULL OR expires_at > NOW())
        AND tweet_posted_at >= $1
      `, [freshnessThreshold]),
      
      // Stale opportunities (>180 min old)
      pgPool.query(`
        SELECT COUNT(*) as count FROM reply_opportunities 
        WHERE replied_to = false 
        AND tweet_posted_at < $1
      `, [freshnessThreshold]),
      
      // Replies queued in last 60 min
      pgPool.query(`
        SELECT COUNT(*) as count FROM content_generation_metadata_comprehensive 
        WHERE decision_type = 'reply' 
        AND status = 'queued'
        AND created_at >= $1
      `, [sixtyMinutesAgo]),
      
      // Replies posted in last 60 min
      pgPool.query(`
        SELECT COUNT(*) as count FROM content_generation_metadata_comprehensive 
        WHERE decision_type = 'reply' 
        AND status = 'posted'
        AND posted_at >= $1
      `, [sixtyMinutesAgo]),
      
      // Replies blocked in last 60 min
      pgPool.query(`
        SELECT COUNT(*) as count FROM content_generation_metadata_comprehensive 
        WHERE decision_type = 'reply' 
        AND status = 'blocked'
        AND created_at >= $1
      `, [sixtyMinutesAgo]),
      
      // Invariant blocks in last 24h (from system_events)
      pgPool.query(`
        SELECT 
          COUNT(*) FILTER (WHERE event_data->>'reason' LIKE '%root%' OR event_data->>'reason' LIKE '%reply%') as root_blocks,
          COUNT(*) FILTER (WHERE event_data->>'reason' LIKE '%format%' OR event_data->>'reason' LIKE '%thread%') as format_blocks,
          COUNT(*) FILTER (WHERE event_data->>'reason' LIKE '%context%') as context_blocks,
          COUNT(*) FILTER (WHERE event_data->>'reason' LIKE '%stale%' OR event_data->>'reason' LIKE '%old%') as stale_blocks,
          COUNT(*) as total_blocks
        FROM system_events 
        WHERE event_type = 'reply_invariant_blocked' 
        AND created_at >= $1
      `, [twentyFourHoursAgo]),
      
      // Blocked by specific reasons (from content_metadata) - FINAL_REPLY_GATE reasons
      pgPool.query(`
        SELECT 
          COUNT(*) FILTER (WHERE skip_reason = 'missing_gate_data_safety_block') as missing_gate_data,
          COUNT(*) FILTER (WHERE skip_reason = 'target_not_found_or_deleted') as target_not_found,
          COUNT(*) FILTER (WHERE skip_reason = 'target_not_root' OR skip_reason = 'target_not_root_violation') as target_not_root,
          COUNT(*) FILTER (WHERE skip_reason = 'missing_root_tweet_id' OR skip_reason = 'missing_target_tweet_id') as missing_root_or_target,
          COUNT(*) FILTER (WHERE skip_reason = 'snapshot_too_short') as snapshot_too_short,
          COUNT(*) FILTER (WHERE skip_reason = 'context_mismatch') as context_mismatch,
          COUNT(*) FILTER (WHERE skip_reason = 'topic_mismatch') as topic_mismatch,
          COUNT(*) FILTER (WHERE skip_reason = 'verification_fetch_error') as verification_fetch_error,
          COUNT(*) FILTER (WHERE skip_reason LIKE '%similarity%' OR skip_reason = 'low_semantic_similarity') as low_similarity,
          COUNT(*) FILTER (WHERE skip_reason LIKE '%thread_like%') as thread_like_blocked,
          COUNT(*) FILTER (WHERE skip_reason = 'root_tweet_cooldown') as root_cooldown,
          COUNT(*) FILTER (WHERE skip_reason = 'author_cooldown') as author_cooldown,
          COUNT(*) FILTER (WHERE skip_reason = 'self_reply_blocked') as self_reply,
          COUNT(*) FILTER (WHERE skip_reason = 'hourly_rate_limit_reached') as hourly_rate,
          COUNT(*) FILTER (WHERE skip_reason = 'missing_target_text') as missing_target_text,
          COUNT(*) FILTER (WHERE skip_reason = 'posting_target_not_root') as posting_target_not_root
        FROM content_generation_metadata_comprehensive
        WHERE decision_type = 'reply'
          AND status = 'blocked'
          AND created_at >= $1
      `, [sixtyMinutesAgo]),
      
      // Last successful reply
      pgPool.query(`
        SELECT posted_at FROM content_generation_metadata_comprehensive 
        WHERE decision_type = 'reply' 
        AND status = 'posted' 
        AND tweet_id IS NOT NULL
        ORDER BY posted_at DESC 
        LIMIT 1
      `),
      
      // Last harvest success (from system_events)
      pgPool.query(`
        SELECT created_at FROM system_events 
        WHERE event_type = 'harvester_complete' 
        ORDER BY created_at DESC 
        LIMIT 1
      `)
    ]);
    
    const opportunitiesAvailable = parseInt(opportunitiesResult.rows[0]?.count || '0');
    const freshOpportunities = parseInt(freshOpportunitiesResult.rows[0]?.count || '0');
    const staleOpportunities = parseInt(staleOpportunitiesResult.rows[0]?.count || '0');
    const repliesQueued = parseInt(queuedResult.rows[0]?.count || '0');
    const repliesPosted = parseInt(postedResult.rows[0]?.count || '0');
    const repliesBlocked = parseInt(blockedResult.rows[0]?.count || '0');
    const invariantBlocks = invariantBlocksResult.rows[0] || { root_blocks: 0, format_blocks: 0, context_blocks: 0, stale_blocks: 0, total_blocks: 0 };
    const blockedByReason = blockedByReasonResult.rows[0] || {
      missing_gate_data: 0,
      target_not_found: 0,
      target_not_root: 0,
      missing_root_or_target: 0,
      snapshot_too_short: 0,
      context_mismatch: 0,
      topic_mismatch: 0,
      verification_fetch_error: 0,
      low_similarity: 0,
      thread_like_blocked: 0,
      missing_target_text: 0,
      posting_target_not_root: 0,
      root_cooldown: 0,
      author_cooldown: 0,
      self_reply: 0,
      hourly_rate: 0
    };
    const lastSuccessAt = lastSuccessResult.rows[0]?.posted_at || null;
    const lastHarvestAt = lastHarvestResult.rows[0]?.created_at || null;
    
    // Determine pool health (based on FRESH opportunities, not total)
    let poolHealth = 'healthy';
    if (freshOpportunities < 10) {
      poolHealth = 'critical';
    } else if (freshOpportunities < 50) {
      poolHealth = 'low';
    } else if (freshOpportunities < 100) {
      poolHealth = 'moderate';
    }
    
    // Determine pacing status
    let pacingStatus = 'ok';
    if (repliesPosted >= 4) {
      pacingStatus = 'at_hourly_limit';
    } else if (repliesPosted === 0 && freshOpportunities > 10) {
      pacingStatus = 'no_activity';
    } else if (freshOpportunities === 0) {
      pacingStatus = 'no_fresh_opportunities';
    }
    
    return {
      opportunities_available: opportunitiesAvailable,
      fresh_opportunities_available: freshOpportunities,
      stale_opportunities_count: staleOpportunities,
      replies_queued_60m: repliesQueued,
      replies_posted_60m: repliesPosted,
      replies_blocked_60m: repliesBlocked,
      invariant_blocks_60m: parseInt(invariantBlocks.total_blocks || '0'),
      skipped_is_reply_60m: parseInt(invariantBlocks.root_blocks || '0'),
      skipped_thread_like_60m: parseInt(invariantBlocks.format_blocks || '0'),
      skipped_no_context_60m: parseInt(invariantBlocks.context_blocks || '0'),
      skipped_stale_60m: parseInt(invariantBlocks.stale_blocks || '0'),
      // 🚨 CRITICAL: All blocking reasons from fail-closed gates (FINAL_REPLY_GATE)
      thread_like_blocked_60m: parseInt(blockedByReason.thread_like_blocked || '0'),
      target_not_root_or_missing_60m: (parseInt(blockedByReason.target_not_found || '0') + parseInt(blockedByReason.target_not_root || '0') + parseInt(blockedByReason.missing_root_or_target || '0') + parseInt(blockedByReason.snapshot_too_short || '0')),
      context_mismatch_blocked_60m: parseInt(blockedByReason.context_mismatch || '0'),
      topic_mismatch_blocked_60m: parseInt(blockedByReason.topic_mismatch || '0'),
      missing_gate_data_blocked_60m: parseInt(blockedByReason.missing_gate_data || '0'),
      verification_fetch_error_60m: parseInt(blockedByReason.verification_fetch_error || '0'),
      missing_target_text_60m: parseInt(blockedByReason.missing_target_text || '0'),
      posting_target_not_root_60m: parseInt(blockedByReason.posting_target_not_root || '0'),
      low_similarity_blocked_60m: parseInt(blockedByReason.low_similarity || '0'),
      root_cooldown_blocked_60m: parseInt(blockedByReason.root_cooldown || '0'),
      author_cooldown_blocked_60m: parseInt(blockedByReason.author_cooldown || '0'),
      self_reply_blocked_60m: parseInt(blockedByReason.self_reply || '0'),
      hourly_rate_blocked_60m: parseInt(blockedByReason.hourly_rate || '0'),
      last_successful_reply_at: lastSuccessAt ? new Date(lastSuccessAt).toISOString() : null,
      last_harvest_success_at: lastHarvestAt ? new Date(lastHarvestAt).toISOString() : null,
      pacing_status: pacingStatus,
      opportunity_pool_health: poolHealth
    };
    
  } catch (error: any) {
    console.error('REPLY_METRICS_ERROR:', error.message);
    return {
      opportunities_available: 0,
      fresh_opportunities_available: 0,
      stale_opportunities_count: 0,
      replies_queued_60m: 0,
      replies_posted_60m: 0,
      replies_blocked_60m: 0,
      invariant_blocks_60m: 0,
      skipped_is_reply_60m: 0,
      skipped_thread_like_60m: 0,
      skipped_no_context_60m: 0,
      skipped_stale_60m: 0,
      thread_like_blocked_60m: 0,
      target_not_root_or_missing_60m: 0,
      context_mismatch_blocked_60m: 0,
      topic_mismatch_blocked_60m: 0,
      missing_gate_data_blocked_60m: 0,
      verification_fetch_error_60m: 0,
      missing_target_text_60m: 0,
      posting_target_not_root_60m: 0,
      low_similarity_blocked_60m: 0,
      root_cooldown_blocked_60m: 0,
      author_cooldown_blocked_60m: 0,
      self_reply_blocked_60m: 0,
      hourly_rate_blocked_60m: 0,
      last_successful_reply_at: null,
      last_harvest_success_at: null,
      pacing_status: 'error',
      opportunity_pool_health: 'unknown'
    };
  }
}

/**
 * Get database connection status and migration info
 */
async function getDatabaseStatus(): Promise<SystemStatus['database']> {
  try {
    // Test basic connectivity
    const client = await pgPool.connect();
    
    try {
      // Check pool status
      const poolInfo = {
        total: pgPool.totalCount,
        idle: pgPool.idleCount
      };
      
      // Get migration status
      let migrationInfo: { latest?: string; count?: number } = {};
      
      try {
        const migrationResult = await client.query(`
          SELECT id, applied_at 
          FROM schema_migrations 
          ORDER BY applied_at DESC 
          LIMIT 1
        `);
        
        if (migrationResult.rows.length > 0) {
          migrationInfo.latest = migrationResult.rows[0].id;
        }
        
        const countResult = await client.query('SELECT COUNT(*) as count FROM schema_migrations');
        migrationInfo.count = parseInt(countResult.rows[0].count);
        
      } catch (migrationError) {
        // Migration table might not exist yet
        migrationInfo = { count: 0 };
      }
      
      return {
        connected: true,
        pool_total: poolInfo.total,
        pool_idle: poolInfo.idle,
        latest_migration: migrationInfo.latest,
        migration_count: migrationInfo.count
      };
      
    } finally {
      client.release();
    }
    
  } catch (error: any) {
    console.error('STATUS_DB_ERROR:', error.message);
    
    return {
      connected: false,
      pool_total: 0,
      pool_idle: 0,
      error: error.message
    };
  }
}

/**
 * Get posting status
 */
function getPostingStatus(): SystemStatus['posting'] {
  const postingDisabled = process.env.POSTING_DISABLED === 'true';
  const dryRun = process.env.DRY_RUN === 'true';
  const disablePosting = process.env.DISABLE_POSTING === 'true';
  
  // 🔥 PERMANENT FIX: Check MODE configuration
  const mode = process.env.MODE || 'live';
  const isShadow = mode === 'shadow';

  if (isShadow) {
    return { enabled: false, reason: 'MODE=shadow disables posting' };
  }

  if (postingDisabled) {
    return { enabled: false, reason: 'POSTING_DISABLED=true' };
  }

  if (dryRun) {
    return { enabled: false, reason: 'DRY_RUN=true' };
  }

  if (disablePosting) {
    return { enabled: false, reason: 'DISABLE_POSTING=true' };
  }

  return { enabled: true };
}

/**
 * Simple Express-style handler for /status endpoint
 */
export async function handleStatusRequest(req: any, res: any): Promise<void> {
  try {
    const status = await getSystemStatus();
    
    // Set appropriate HTTP status code
    const httpStatus = status.status === 'healthy' ? 200 : 
                      status.status === 'degraded' ? 200 : 503;
    
    res.status(httpStatus).json(status);
    
  } catch (error: any) {
    console.error('STATUS_ENDPOINT_ERROR:', error.message);
    
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Status check failed',
      message: error.message
    });
  }
}

/**
 * Health check for load balancers (simple OK/ERROR)
 */
export async function handleHealthCheck(req: any, res: any): Promise<void> {
  try {
    // Quick database ping
    const client = await pgPool.connect();
    await client.query('SELECT 1');
    client.release();
    
    res.status(200).send('OK');
    
  } catch (error) {
    res.status(503).send('ERROR');
  }
}

/**
 * Get comprehensive budget status using the new budgeted client
 */
async function getComprehensiveBudgetStatus() {
  try {
    const [status, spending] = await Promise.all([
      budgetedOpenAI.getBudgetStatus(),
      budgetedOpenAI.getSpendingBreakdown()
    ]);
    
    return {
      ...status,
      spending_breakdown: {
        by_model: Object.entries(spending.byModel).slice(0, 5), // Top 5 models
        by_purpose: Object.entries(spending.byPurpose).slice(0, 5), // Top 5 purposes
        top_expensive_calls: spending.topExpensive.slice(0, 3) // Top 3 expensive calls
      },
      alerts: {
        budget_warning: status.percentUsed > 80,
        budget_critical: status.percentUsed > 95,
        blocked: status.isBlocked
      }
    };
  } catch (error) {
    console.error('❌ COMPREHENSIVE_BUDGET_STATUS_ERROR:', error);
    
    // Fallback to legacy budget status
    try {
      return await getBudgetStatusForAPI();
    } catch (fallbackError) {
      return {
        error: 'Budget status unavailable',
        dailyLimitUSD: parseFloat(process.env.DAILY_OPENAI_LIMIT_USD || '5.0'),
        usedTodayUSD: 0,
        remainingUSD: 0,
        percentUsed: 0,
        isBlocked: false
      };
    }
  }
}
