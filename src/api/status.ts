/**
 * Comprehensive /status endpoint for xBOT health monitoring
 */

import { pgPool } from '../db/pg';
import { getBudgetStatus } from '../budget/guard';
import { getBudgetStatusForAPI } from '../budget/hardGuard';
import { getRealMetricsConfig } from '../config/realMetrics';

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
  
  // Budget status (use hard guard for production)
  const budgetStatus = await getBudgetStatusForAPI();
  
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
    posting: postingStatus,
    real_metrics: realMetricsStatus,
    environment: {
      node_env: process.env.NODE_ENV || 'production',
      posting_disabled: process.env.POSTING_DISABLED === 'true',
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
