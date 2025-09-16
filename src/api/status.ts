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
import { FEATURE_FLAGS } from '../config/featureFlags';
import { handleLearningStatusRequest } from './learningStatus';

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
  const realMetricsStatus = getRealMetricsConfig();
  
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
  
  // Overall health determination
  let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  
  if (!dbStatus.connected) {
    overallStatus = 'unhealthy';
  } else if (memory.used_mb > 400) { // High memory usage
    overallStatus = 'degraded';
  }
  
  const status: SystemStatus = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    database: dbStatus,
    budget: budgetStatus,
    circuit_breaker: circuitStatus,
    learning: learningStatus,
    posting: postingStatus,
    real_metrics: realMetricsStatus,
    environment: {
      node_env: process.env.NODE_ENV || 'production',
      posting_disabled: process.env.POSTING_DISABLED === 'true',
      posting_enabled: FEATURE_FLAGS.POSTING_ENABLED,
      ai_cooldown_minutes: FEATURE_FLAGS.AI_COOLDOWN_MINUTES,
      learning_debounce_minutes: FEATURE_FLAGS.LEARNING_DEBOUNCE_MINUTES,
      dry_run: process.env.DRY_RUN === 'true',
      budget_enforcer_enabled: process.env.BUDGET_ENFORCER_ENABLED === 'true',
      real_metrics_enabled: process.env.REAL_METRICS_ENABLED === 'true'
    },
    memory
  };
  
  const duration = Date.now() - startTime;
  console.log(`STATUS_CHECK: Completed in ${duration}ms (${overallStatus})`);
  
  return status;
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
  
  if (postingDisabled) {
    return { enabled: false, reason: 'POSTING_DISABLED=true' };
  }
  
  if (dryRun) {
    return { enabled: false, reason: 'DRY_RUN=true' };
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
