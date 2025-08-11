/**
 * 🏥 SYSTEM HEALTH MONITORING
 * 
 * PURPOSE: Comprehensive health checks for learning v2 system
 * STRATEGY: Redis, DB, queues, and learning system monitoring
 */

import { redisManager } from '../lib/redisManager';
import { DatabaseManager } from '../lib/db';
import { CandidateQueue } from '../candidates/queue';
import { GamingBanditManager } from '../learn/bandit';
import { LogisticRegressionModel } from '../learn/model';

export interface HealthStatus {
  status: 'healthy' | 'warning' | 'critical';
  message: string;
  details?: any;
  lastCheck: Date;
}

export interface SystemHealth {
  overall: HealthStatus;
  components: {
    redis: HealthStatus;
    database: HealthStatus;
    candidateQueue: HealthStatus;
    banditSystem: HealthStatus;
    modelSystem: HealthStatus;
    schedulingLoop: HealthStatus;
  };
  metrics: {
    queueDepths: Record<string, number>;
    rateLimits: Record<string, number>;
    lastPostTime: Date | null;
    banditArms: number;
    systemUptime: number;
  };
}

/**
 * System health monitor
 */
export class HealthMonitor {
  private dbManager: DatabaseManager;
  private candidateQueue: CandidateQueue;
  private banditManager: GamingBanditManager;
  private model: LogisticRegressionModel;

  constructor() {
    this.dbManager = DatabaseManager.getInstance();
    this.candidateQueue = new CandidateQueue();
    this.banditManager = new GamingBanditManager();
    this.model = new LogisticRegressionModel();
  }

  /**
   * Check Redis health
   */
  async checkRedis(): Promise<HealthStatus> {
    try {
      // Basic connectivity
      const ping = await redisManager.ping();
      if (!ping || ping === 'error') {
        return {
          status: 'critical',
          message: 'Redis not responding to PING',
          lastCheck: new Date()
        };
      }

      // Test SET/GET operation
      const testKey = `${process.env.REDIS_PREFIX || 'app:'}health_check`;
      const testValue = Date.now().toString();
      
      await redisManager.set(testKey, testValue, 60);
      const retrieved = await redisManager.get(testKey);
      
      if (retrieved !== testValue) {
        return {
          status: 'warning',
          message: 'Redis SET/GET test failed',
          details: { expected: testValue, received: retrieved },
          lastCheck: new Date()
        };
      }

      // Clean up test key
      await redisManager.del(testKey);

      return {
        status: 'healthy',
        message: 'Redis operating normally',
        lastCheck: new Date()
      };
    } catch (error: any) {
      return {
        status: 'critical',
        message: `Redis error: ${error.message}`,
        lastCheck: new Date()
      };
    }
  }

  /**
   * Check database health
   */
  async checkDatabase(): Promise<HealthStatus> {
    try {
      const db = this.dbManager.getSupabase();
      if (!db) {
        return {
          status: 'critical',
          message: 'Database connection not available',
          lastCheck: new Date()
        };
      }

      // Test basic query
      const { data, error } = await db
        .from('tweets')
        .select('count')
        .limit(1);

      if (error) {
        return {
          status: 'critical',
          message: `Database query failed: ${error.message}`,
          lastCheck: new Date()
        };
      }

      // Check required views exist
      const { data: viewData, error: viewError } = await db
        .rpc('check_view_exists', { view_name: 'vw_recent_posts' });

      if (viewError) {
        return {
          status: 'warning',
          message: 'Analytics views may not be available',
          details: { error: viewError.message },
          lastCheck: new Date()
        };
      }

      return {
        status: 'healthy',
        message: 'Database operating normally',
        lastCheck: new Date()
      };
    } catch (error: any) {
      return {
        status: 'critical',
        message: `Database error: ${error.message}`,
        lastCheck: new Date()
      };
    }
  }

  /**
   * Check candidate queue health
   */
  async checkCandidateQueue(): Promise<HealthStatus> {
    try {
      const queueHealth = await this.candidateQueue.getHealth();
      
      return {
        status: queueHealth.status === 'healthy' ? 'healthy' : 
                queueHealth.status === 'warning' ? 'warning' : 'critical',
        message: queueHealth.message,
        details: queueHealth.details,
        lastCheck: new Date()
      };
    } catch (error: any) {
      return {
        status: 'critical',
        message: `Queue check failed: ${error.message}`,
        lastCheck: new Date()
      };
    }
  }

  /**
   * Check bandit system health
   */
  async checkBanditSystem(): Promise<HealthStatus> {
    try {
      const banditHealth = await this.banditManager.getPerformanceReport();
      
      if (banditHealth.system.totalArms === 0) {
        return {
          status: 'warning',
          message: 'No bandit arms initialized',
          details: banditHealth.system,
          lastCheck: new Date()
        };
      }

      if (banditHealth.system.activeArms < banditHealth.system.totalArms * 0.5) {
        return {
          status: 'warning',
          message: 'Low bandit arm activity',
          details: banditHealth.system,
          lastCheck: new Date()
        };
      }

      return {
        status: 'healthy',
        message: 'Bandit system operating normally',
        details: banditHealth.system,
        lastCheck: new Date()
      };
    } catch (error: any) {
      return {
        status: 'critical',
        message: `Bandit system error: ${error.message}`,
        lastCheck: new Date()
      };
    }
  }

  /**
   * Check model system health
   */
  async checkModelSystem(): Promise<HealthStatus> {
    try {
      const modelHealth = await this.model.getPerformanceMetrics();
      
      if (modelHealth.cacheStatus === 'error') {
        return {
          status: 'critical',
          message: 'Model cache error',
          details: modelHealth,
          lastCheck: new Date()
        };
      }

      if (modelHealth.accuracy < 0.5) {
        return {
          status: 'warning',
          message: 'Low model accuracy',
          details: modelHealth,
          lastCheck: new Date()
        };
      }

      return {
        status: 'healthy',
        message: 'Model system operating normally',
        details: modelHealth,
        lastCheck: new Date()
      };
    } catch (error: any) {
      return {
        status: 'critical',
        message: `Model system error: ${error.message}`,
        lastCheck: new Date()
      };
    }
  }

  /**
   * Check scheduling loop health
   */
  async checkSchedulingLoop(): Promise<HealthStatus> {
    try {
      const redisPrefix = process.env.REDIS_PREFIX || 'app:';
      
      // Check last post time
      const lastPostKey = `${redisPrefix}state:last_post_time`;
      const lastPostTime = await redisManager.get(lastPostKey);
      
      if (lastPostTime) {
        const hoursAgo = (Date.now() - parseInt(lastPostTime)) / (1000 * 60 * 60);
        
        if (hoursAgo > 6) {
          return {
            status: 'warning',
            message: `No posts in ${hoursAgo.toFixed(1)} hours`,
            details: { lastPostTime: new Date(parseInt(lastPostTime)) },
            lastCheck: new Date()
          };
        }
      }

      // Check rate limit counters
      const hour = new Date().toISOString().substring(0, 13);
      const hourKey = `${redisPrefix}rate_limit:posting:${hour}`;
      const postsThisHour = await redisManager.get(hourKey);
      
      return {
        status: 'healthy',
        message: 'Scheduling loop operating normally',
        details: {
          postsThisHour: parseInt(postsThisHour || '0'),
          lastPostTime: lastPostTime ? new Date(parseInt(lastPostTime)) : null
        },
        lastCheck: new Date()
      };
    } catch (error: any) {
      return {
        status: 'warning',
        message: `Scheduling check error: ${error.message}`,
        lastCheck: new Date()
      };
    }
  }

  /**
   * Get queue depths
   */
  async getQueueDepths(): Promise<Record<string, number>> {
    try {
      const depths: Record<string, number> = {};
      
      depths.candidates = await redisManager.getQueueDepth('candidates') || 0;
      depths.pending_posts = await redisManager.getQueueDepth('pending_posts') || 0;
      depths.analytics_sync = await redisManager.getQueueDepth('analytics_sync') || 0;
      depths.audit_log = await redisManager.getQueueDepth('audit_log') || 0;
      
      return depths;
    } catch (error: any) {
      console.error('Failed to get queue depths:', error.message);
      return {};
    }
  }

  /**
   * Get rate limit status
   */
  async getRateLimits(): Promise<Record<string, number>> {
    try {
      const redisPrefix = process.env.REDIS_PREFIX || 'app:';
      const hour = new Date().toISOString().substring(0, 13);
      const limits: Record<string, number> = {};
      
      const hourKey = `${redisPrefix}rate_limit:posting:${hour}`;
      limits.postsThisHour = parseInt(await redisManager.get(hourKey) || '0');
      
      return limits;
    } catch (error: any) {
      console.error('Failed to get rate limits:', error.message);
      return {};
    }
  }

  /**
   * Comprehensive system health check
   */
  async getSystemHealth(): Promise<SystemHealth> {
    console.log('🏥 Running comprehensive health check...');
    
    // Run all component checks in parallel
    const [
      redis,
      database,
      candidateQueue,
      banditSystem,
      modelSystem,
      schedulingLoop
    ] = await Promise.all([
      this.checkRedis(),
      this.checkDatabase(),
      this.checkCandidateQueue(),
      this.checkBanditSystem(),
      this.checkModelSystem(),
      this.checkSchedulingLoop()
    ]);

    // Get metrics
    const [queueDepths, rateLimits] = await Promise.all([
      this.getQueueDepths(),
      this.getRateLimits()
    ]);

    // Get additional metrics
    let lastPostTime: Date | null = null;
    let banditArms = 0;
    
    try {
      const redisPrefix = process.env.REDIS_PREFIX || 'app:';
      const lastPostKey = `${redisPrefix}state:last_post_time`;
      const lastPostData = await redisManager.get(lastPostKey);
      if (lastPostData) {
        lastPostTime = new Date(parseInt(lastPostData));
      }

      const banditReport = await this.banditManager.getPerformanceReport();
      banditArms = banditReport.system.totalArms;
    } catch (error: any) {
      console.error('Failed to get additional metrics:', error.message);
    }

    // Determine overall status
    const components = { redis, database, candidateQueue, banditSystem, modelSystem, schedulingLoop };
    const criticalCount = Object.values(components).filter(c => c.status === 'critical').length;
    const warningCount = Object.values(components).filter(c => c.status === 'warning').length;

    let overallStatus: 'healthy' | 'warning' | 'critical';
    let overallMessage: string;

    if (criticalCount > 0) {
      overallStatus = 'critical';
      overallMessage = `${criticalCount} critical issue(s) detected`;
    } else if (warningCount > 0) {
      overallStatus = 'warning';
      overallMessage = `${warningCount} warning(s) detected`;
    } else {
      overallStatus = 'healthy';
      overallMessage = 'All systems operational';
    }

    return {
      overall: {
        status: overallStatus,
        message: overallMessage,
        lastCheck: new Date()
      },
      components,
      metrics: {
        queueDepths,
        rateLimits,
        lastPostTime,
        banditArms,
        systemUptime: process.uptime()
      }
    };
  }

  /**
   * Print one-line health status
   */
  async printHealthStatus(): Promise<void> {
    try {
      const health = await this.getSystemHealth();
      const status = health.overall.status.toUpperCase();
      const timestamp = new Date().toISOString();
      
      // Build status components
      const components = [];
      
      // Redis
      const redisStatus = health.components.redis.status === 'healthy' ? '✅' : '❌';
      components.push(`Redis:${redisStatus}`);
      
      // Database
      const dbStatus = health.components.database.status === 'healthy' ? '✅' : '❌';
      components.push(`DB:${dbStatus}`);
      
      // Queue depths
      const candidateDepth = health.metrics.queueDepths.candidates || 0;
      components.push(`Queue:${candidateDepth}`);
      
      // Bandit arms
      components.push(`Bandits:${health.metrics.banditArms}`);
      
      // Last post
      if (health.metrics.lastPostTime) {
        const hoursAgo = (Date.now() - health.metrics.lastPostTime.getTime()) / (1000 * 60 * 60);
        components.push(`LastPost:${hoursAgo.toFixed(1)}h`);
      } else {
        components.push('LastPost:none');
      }
      
      // Rate limits
      const postsThisHour = health.metrics.rateLimits.postsThisHour || 0;
      components.push(`Posts/h:${postsThisHour}`);

      console.log(`[${timestamp}] xBOT Health: ${status} | ${components.join(' | ')} | ${health.overall.message}`);
      
      // Print warnings/errors if any
      Object.entries(health.components).forEach(([name, component]) => {
        if (component.status !== 'healthy') {
          console.log(`  ⚠️  ${name}: ${component.message}`);
        }
      });
      
    } catch (error: any) {
      console.log(`[${new Date().toISOString()}] xBOT Health: CRITICAL | Health check failed: ${error.message}`);
    }
  }

  /**
   * Get detailed health report
   */
  async getDetailedReport(): Promise<string> {
    const health = await this.getSystemHealth();
    const lines = [];
    
    lines.push('🏥 xBOT Learning Engine v2 Health Report');
    lines.push('=========================================');
    lines.push('');
    
    // Overall status
    const statusIcon = health.overall.status === 'healthy' ? '✅' : 
                      health.overall.status === 'warning' ? '⚠️' : '❌';
    lines.push(`Overall Status: ${statusIcon} ${health.overall.status.toUpperCase()}`);
    lines.push(`Message: ${health.overall.message}`);
    lines.push(`Last Check: ${health.overall.lastCheck.toISOString()}`);
    lines.push('');
    
    // Component status
    lines.push('Component Status:');
    Object.entries(health.components).forEach(([name, component]) => {
      const icon = component.status === 'healthy' ? '✅' : 
                   component.status === 'warning' ? '⚠️' : '❌';
      lines.push(`  ${icon} ${name}: ${component.message}`);
    });
    lines.push('');
    
    // Metrics
    lines.push('System Metrics:');
    lines.push(`  Queue Depths: ${JSON.stringify(health.metrics.queueDepths)}`);
    lines.push(`  Rate Limits: ${JSON.stringify(health.metrics.rateLimits)}`);
    lines.push(`  Bandit Arms: ${health.metrics.banditArms}`);
    lines.push(`  System Uptime: ${(health.metrics.systemUptime / 3600).toFixed(1)}h`);
    
    if (health.metrics.lastPostTime) {
      const hoursAgo = (Date.now() - health.metrics.lastPostTime.getTime()) / (1000 * 60 * 60);
      lines.push(`  Last Post: ${hoursAgo.toFixed(1)}h ago (${health.metrics.lastPostTime.toISOString()})`);
    } else {
      lines.push('  Last Post: None recorded');
    }
    
    lines.push('');
    lines.push(`Report generated: ${new Date().toISOString()}`);
    
    return lines.join('\n');
  }
}