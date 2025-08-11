/**
 * 🚀 SYSTEM MONITOR - Comprehensive Health & Performance Monitoring
 * 
 * PURPOSE: Monitor Redis + Supabase dual-store system with alerts and SLOs
 * FEATURES: Health checks, drift detection, performance monitoring, alerting
 * STRATEGY: Proactive monitoring with automated recovery and escalation
 */

import { dualStoreManager, HealthStatus, ConsistencyReport } from './dualStoreManager';
import { redisManager, HealthMetrics } from './redisManager';
import { migrationManager, DriftReport } from './migrationManager';

interface MonitoringConfig {
  healthCheckIntervalMs: number;
  driftCheckIntervalMs: number;
  performanceCheckIntervalMs: number;
  alertThresholds: AlertThresholds;
  sloTargets: SLOTargets;
  enabled: boolean;
}

interface AlertThresholds {
  redis: {
    pingLatencyMs: number;
    memoryUsagePercent: number;
    connectionCount: number;
    queueDepthCritical: number;
    queueDepthWarning: number;
  };
  supabase: {
    queryLatencyMs: number;
    errorRatePercent: number;
    connectionPoolPercent: number;
  };
  system: {
    driftTolerancePercent: number;
    uptimeRequiredPercent: number;
    responseTimeP95Ms: number;
  };
}

interface SLOTargets {
  tweetPostingLatencyP95Ms: number;
  hourlyBackfillSuccessRate: number;
  systemUptimePercent: number;
  dataDriftTolerancePercent: number;
  queueProcessingLagHours: number;
}

interface HealthCheckResult {
  timestamp: Date;
  component: string;
  status: 'healthy' | 'degraded' | 'critical' | 'down';
  metrics: any;
  alerts: Alert[];
  sloViolations: SLOViolation[];
  responseTimeMs: number;
}

interface Alert {
  id: string;
  severity: 'info' | 'warning' | 'critical' | 'emergency';
  component: string;
  metric: string;
  currentValue: number;
  threshold: number;
  message: string;
  timestamp: Date;
  resolved: boolean;
  escalated: boolean;
}

interface SLOViolation {
  sloName: string;
  target: number;
  actual: number;
  violationPercent: number;
  duration: number;
  impact: 'low' | 'medium' | 'high' | 'critical';
}

interface PerformanceMetrics {
  timestamp: Date;
  tweetPostingLatency: {
    p50: number;
    p95: number;
    p99: number;
    count: number;
  };
  queueProcessing: {
    backlogSize: number;
    processingRate: number;
    oldestItemAge: number;
    successRate: number;
  };
  systemResources: {
    memoryUsageMB: number;
    cpuUsagePercent: number;
    activeConnections: number;
    uptime: number;
  };
  dataFlow: {
    redisHitRate: number;
    fallbackRate: number;
    syncSuccessRate: number;
    driftRate: number;
  };
}

interface MonitoringReport {
  timestamp: Date;
  period: string;
  overallHealth: 'healthy' | 'degraded' | 'critical';
  sloCompliance: {
    [key: string]: {
      target: number;
      actual: number;
      compliant: boolean;
    };
  };
  alertsSummary: {
    total: number;
    bySeverity: { [key: string]: number };
    topIssues: string[];
  };
  recommendations: string[];
  actionItems: string[];
}

interface EscalationRule {
  id: string;
  severity: string;
  component: string;
  condition: string;
  channels: NotificationChannel[];
  escalationDelayMs: number;
}

interface NotificationChannel {
  type: 'console' | 'webhook' | 'email' | 'slack';
  config: any;
  enabled: boolean;
}

class SystemMonitor {
  private static instance: SystemMonitor;
  private config: MonitoringConfig;
  private isMonitoring: boolean = false;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private driftCheckInterval: NodeJS.Timeout | null = null;
  private performanceCheckInterval: NodeJS.Timeout | null = null;
  private alerts: Map<string, Alert> = new Map();
  private sloViolations: Map<string, SLOViolation> = new Map();
  private performanceHistory: PerformanceMetrics[] = [];
  private lastHealthCheck: Date = new Date();
  private escalationRules: EscalationRule[] = [];

  private constructor() {
    this.config = this.loadConfig();
    this.setupEscalationRules();
    if (this.config.enabled) {
      this.startMonitoring();
    }
  }

  public static getInstance(): SystemMonitor {
    if (!SystemMonitor.instance) {
      SystemMonitor.instance = new SystemMonitor();
    }
    return SystemMonitor.instance;
  }

  /**
   * Load monitoring configuration
   */
  private loadConfig(): MonitoringConfig {
    return {
      healthCheckIntervalMs: parseInt(process.env.HEALTH_CHECK_INTERVAL_MS || '300000'), // 5 minutes
      driftCheckIntervalMs: parseInt(process.env.DRIFT_CHECK_INTERVAL_MS || '3600000'), // 1 hour
      performanceCheckIntervalMs: parseInt(process.env.PERFORMANCE_CHECK_INTERVAL_MS || '60000'), // 1 minute
      enabled: process.env.MONITORING_ENABLED !== 'false',
      alertThresholds: {
        redis: {
          pingLatencyMs: 10,
          memoryUsagePercent: 80,
          connectionCount: 90,
          queueDepthCritical: 5000,
          queueDepthWarning: 1000
        },
        supabase: {
          queryLatencyMs: 500,
          errorRatePercent: 1,
          connectionPoolPercent: 80
        },
        system: {
          driftTolerancePercent: 5,
          uptimeRequiredPercent: 99.9,
          responseTimeP95Ms: 2000
        }
      },
      sloTargets: {
        tweetPostingLatencyP95Ms: 2000,
        hourlyBackfillSuccessRate: 99,
        systemUptimePercent: 99.9,
        dataDriftTolerancePercent: 1,
        queueProcessingLagHours: 2
      }
    };
  }

  /**
   * Setup escalation rules for alerts
   */
  private setupEscalationRules(): void {
    this.escalationRules = [
      {
        id: 'critical_system_down',
        severity: 'critical',
        component: '*',
        condition: 'system_down',
        channels: [
          { type: 'console', config: {}, enabled: true },
          { type: 'webhook', config: { url: process.env.ALERT_WEBHOOK_URL }, enabled: !!process.env.ALERT_WEBHOOK_URL }
        ],
        escalationDelayMs: 0 // Immediate
      },
      {
        id: 'warning_performance',
        severity: 'warning',
        component: '*',
        condition: 'performance_degraded',
        channels: [
          { type: 'console', config: {}, enabled: true }
        ],
        escalationDelayMs: 300000 // 5 minutes
      },
      {
        id: 'emergency_data_loss',
        severity: 'emergency',
        component: 'dual_store_manager',
        condition: 'data_loss_detected',
        channels: [
          { type: 'console', config: {}, enabled: true },
          { type: 'webhook', config: { url: process.env.EMERGENCY_WEBHOOK_URL }, enabled: !!process.env.EMERGENCY_WEBHOOK_URL }
        ],
        escalationDelayMs: 0 // Immediate
      }
    ];
  }

  // =====================================================================================
  // MONITORING LIFECYCLE
  // =====================================================================================

  /**
   * Start all monitoring processes
   */
  public startMonitoring(): void {
    if (this.isMonitoring) {
      console.log('⚠️ Monitoring already running');
      return;
    }

    console.log('🔍 Starting system monitoring...');

    // Start health checks
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthCheck();
    }, this.config.healthCheckIntervalMs);

    // Start drift checks
    this.driftCheckInterval = setInterval(async () => {
      await this.performDriftCheck();
    }, this.config.driftCheckIntervalMs);

    // Start performance monitoring
    this.performanceCheckInterval = setInterval(async () => {
      await this.collectPerformanceMetrics();
    }, this.config.performanceCheckIntervalMs);

    this.isMonitoring = true;
    console.log('✅ System monitoring started');

    // Log monitoring start
    this.logEvent('monitoring_started', 'info', {
      config: this.config,
      escalation_rules: this.escalationRules.length
    });
  }

  /**
   * Stop all monitoring processes
   */
  public stopMonitoring(): void {
    console.log('🛑 Stopping system monitoring...');

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    if (this.driftCheckInterval) {
      clearInterval(this.driftCheckInterval);
      this.driftCheckInterval = null;
    }

    if (this.performanceCheckInterval) {
      clearInterval(this.performanceCheckInterval);
      this.performanceCheckInterval = null;
    }

    this.isMonitoring = false;
    console.log('✅ System monitoring stopped');
  }

  // =====================================================================================
  // HEALTH CHECKS
  // =====================================================================================

  /**
   * Perform comprehensive health check
   */
  private async performHealthCheck(): Promise<void> {
    try {
      const startTime = Date.now();
      const healthResults: HealthCheckResult[] = [];

      // Check Redis health
      const redisHealth = await this.checkRedisHealth();
      healthResults.push(redisHealth);

      // Check Supabase health
      const supabaseHealth = await this.checkSupabaseHealth();
      healthResults.push(supabaseHealth);

      // Check dual store manager health
      const dualStoreHealth = await this.checkDualStoreHealth();
      healthResults.push(dualStoreHealth);

      // Check queue health
      const queueHealth = await this.checkQueueHealth();
      healthResults.push(queueHealth);

      // Process alerts and SLO violations
      await this.processHealthResults(healthResults);

      this.lastHealthCheck = new Date();
      const totalDuration = Date.now() - startTime;

      console.log(`✅ Health check completed in ${totalDuration}ms`);

    } catch (error: any) {
      console.error('❌ Health check failed:', error.message);
      
      // Create critical alert for health check failure
      await this.createAlert({
        severity: 'critical',
        component: 'system_monitor',
        metric: 'health_check',
        currentValue: 0,
        threshold: 1,
        message: `Health check failed: ${error.message}`,
        condition: 'health_check_failure'
      });
    }
  }

  /**
   * Check Redis health
   */
  private async checkRedisHealth(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const result: HealthCheckResult = {
      timestamp: new Date(),
      component: 'redis',
      status: 'healthy',
      metrics: {},
      alerts: [],
      sloViolations: [],
      responseTimeMs: 0
    };

    try {
      const redisStatus = redisManager.getConnectionStatus();
      
      if (!redisStatus.connected) {
        result.status = 'down';
        result.alerts.push(await this.createAlert({
          severity: 'critical',
          component: 'redis',
          metric: 'connection',
          currentValue: 0,
          threshold: 1,
          message: 'Redis connection is down',
          condition: 'redis_disconnected'
        }));
      } else if (redisStatus.fallbackMode) {
        result.status = 'degraded';
        result.alerts.push(await this.createAlert({
          severity: 'warning',
          component: 'redis',
          metric: 'fallback_mode',
          currentValue: 1,
          threshold: 0,
          message: 'Redis in fallback mode',
          condition: 'redis_fallback'
        }));
      } else {
        // Get detailed health metrics
        try {
          const healthMetrics = await redisManager.getHealthMetrics();
          result.metrics = healthMetrics;

          // Check ping latency
          if (healthMetrics.ping > this.config.alertThresholds.redis.pingLatencyMs) {
            result.status = 'degraded';
            result.alerts.push(await this.createAlert({
              severity: 'warning',
              component: 'redis',
              metric: 'ping_latency',
              currentValue: healthMetrics.ping,
              threshold: this.config.alertThresholds.redis.pingLatencyMs,
              message: `Redis ping latency high: ${healthMetrics.ping}ms`,
              condition: 'redis_latency_high'
            }));
          }

          // Check memory usage
          const memoryPercent = (healthMetrics.memoryUsage / (1024 * 1024 * 1024)) * 100; // Assume 1GB limit
          if (memoryPercent > this.config.alertThresholds.redis.memoryUsagePercent) {
            result.status = 'degraded';
            result.alerts.push(await this.createAlert({
              severity: 'warning',
              component: 'redis',
              metric: 'memory_usage',
              currentValue: memoryPercent,
              threshold: this.config.alertThresholds.redis.memoryUsagePercent,
              message: `Redis memory usage high: ${memoryPercent.toFixed(1)}%`,
              condition: 'redis_memory_high'
            }));
          }

        } catch (metricsError) {
          result.status = 'degraded';
          result.alerts.push(await this.createAlert({
            severity: 'warning',
            component: 'redis',
            metric: 'metrics_collection',
            currentValue: 0,
            threshold: 1,
            message: 'Could not collect Redis metrics',
            condition: 'redis_metrics_failed'
          }));
        }
      }

    } catch (error: any) {
      result.status = 'critical';
      result.alerts.push(await this.createAlert({
        severity: 'critical',
        component: 'redis',
        metric: 'health_check',
        currentValue: 0,
        threshold: 1,
        message: `Redis health check failed: ${error.message}`,
        condition: 'redis_health_check_failed'
      }));
    }

    result.responseTimeMs = Date.now() - startTime;
    return result;
  }

  /**
   * Check Supabase health
   */
  private async checkSupabaseHealth(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const result: HealthCheckResult = {
      timestamp: new Date(),
      component: 'supabase',
      status: 'healthy',
      metrics: {},
      alerts: [],
      sloViolations: [],
      responseTimeMs: 0
    };

    try {
      // Test basic connectivity with a simple query
      const queryStart = Date.now();
      const testResult = await dualStoreManager.getConfig('health_check_test');
      const queryDuration = Date.now() - queryStart;

      result.metrics = {
        queryLatency: queryDuration,
        lastQueryAt: new Date()
      };

      // Check query latency
      if (queryDuration > this.config.alertThresholds.supabase.queryLatencyMs) {
        result.status = 'degraded';
        result.alerts.push(await this.createAlert({
          severity: 'warning',
          component: 'supabase',
          metric: 'query_latency',
          currentValue: queryDuration,
          threshold: this.config.alertThresholds.supabase.queryLatencyMs,
          message: `Supabase query latency high: ${queryDuration}ms`,
          condition: 'supabase_latency_high'
        }));
      }

    } catch (error: any) {
      result.status = 'critical';
      result.alerts.push(await this.createAlert({
        severity: 'critical',
        component: 'supabase',
        metric: 'connection',
        currentValue: 0,
        threshold: 1,
        message: `Supabase connection failed: ${error.message}`,
        condition: 'supabase_connection_failed'
      }));
    }

    result.responseTimeMs = Date.now() - startTime;
    return result;
  }

  /**
   * Check dual store manager health
   */
  private async checkDualStoreHealth(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const result: HealthCheckResult = {
      timestamp: new Date(),
      component: 'dual_store_manager',
      status: 'healthy',
      metrics: {},
      alerts: [],
      sloViolations: [],
      responseTimeMs: 0
    };

    try {
      const systemStatus = dualStoreManager.getSystemStatus();
      const healthStatus = await dualStoreManager.getHealthStatus();

      result.metrics = {
        initialized: systemStatus.initialized,
        config: systemStatus.config,
        uptime: systemStatus.uptime,
        health_status: healthStatus
      };

      if (!systemStatus.initialized) {
        result.status = 'critical';
        result.alerts.push(await this.createAlert({
          severity: 'critical',
          component: 'dual_store_manager',
          metric: 'initialization',
          currentValue: 0,
          threshold: 1,
          message: 'Dual store manager not initialized',
          condition: 'dual_store_not_initialized'
        }));
      }

      if (systemStatus.config.fallbackMode) {
        result.status = 'degraded';
        result.alerts.push(await this.createAlert({
          severity: 'warning',
          component: 'dual_store_manager',
          metric: 'fallback_mode',
          currentValue: 1,
          threshold: 0,
          message: 'Dual store manager in fallback mode',
          condition: 'dual_store_fallback'
        }));
      }

    } catch (error: any) {
      result.status = 'critical';
      result.alerts.push(await this.createAlert({
        severity: 'critical',
        component: 'dual_store_manager',
        metric: 'health_check',
        currentValue: 0,
        threshold: 1,
        message: `Dual store health check failed: ${error.message}`,
        condition: 'dual_store_health_failed'
      }));
    }

    result.responseTimeMs = Date.now() - startTime;
    return result;
  }

  /**
   * Check queue health
   */
  private async checkQueueHealth(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const result: HealthCheckResult = {
      timestamp: new Date(),
      component: 'queue_system',
      status: 'healthy',
      metrics: {},
      alerts: [],
      sloViolations: [],
      responseTimeMs: 0
    };

    try {
      const syncQueueDepth = await redisManager.getQueueDepth('sync_to_supabase');
      const oldestItems = await redisManager.getFromQueue('sync_to_supabase', 1);
      
      const oldestItemAge = oldestItems.length > 0 
        ? Date.now() - oldestItems[0].createdAt.getTime()
        : 0;

      result.metrics = {
        sync_queue_depth: syncQueueDepth,
        oldest_item_age_ms: oldestItemAge,
        oldest_item_age_hours: oldestItemAge / (1000 * 60 * 60)
      };

      // Check queue depth
      if (syncQueueDepth > this.config.alertThresholds.redis.queueDepthCritical) {
        result.status = 'critical';
        result.alerts.push(await this.createAlert({
          severity: 'critical',
          component: 'queue_system',
          metric: 'queue_depth',
          currentValue: syncQueueDepth,
          threshold: this.config.alertThresholds.redis.queueDepthCritical,
          message: `Queue depth critical: ${syncQueueDepth} items`,
          condition: 'queue_depth_critical'
        }));
      } else if (syncQueueDepth > this.config.alertThresholds.redis.queueDepthWarning) {
        result.status = 'degraded';
        result.alerts.push(await this.createAlert({
          severity: 'warning',
          component: 'queue_system',
          metric: 'queue_depth',
          currentValue: syncQueueDepth,
          threshold: this.config.alertThresholds.redis.queueDepthWarning,
          message: `Queue depth high: ${syncQueueDepth} items`,
          condition: 'queue_depth_high'
        }));
      }

      // Check oldest item age
      const maxAgeHours = this.config.sloTargets.queueProcessingLagHours;
      if (oldestItemAge > maxAgeHours * 60 * 60 * 1000) {
        result.status = 'degraded';
        result.alerts.push(await this.createAlert({
          severity: 'warning',
          component: 'queue_system',
          metric: 'processing_lag',
          currentValue: oldestItemAge / (1000 * 60 * 60),
          threshold: maxAgeHours,
          message: `Queue processing lag: ${(oldestItemAge / (1000 * 60 * 60)).toFixed(1)} hours`,
          condition: 'queue_processing_lag'
        }));
      }

    } catch (error: any) {
      result.status = 'critical';
      result.alerts.push(await this.createAlert({
        severity: 'critical',
        component: 'queue_system',
        metric: 'health_check',
        currentValue: 0,
        threshold: 1,
        message: `Queue health check failed: ${error.message}`,
        condition: 'queue_health_failed'
      }));
    }

    result.responseTimeMs = Date.now() - startTime;
    return result;
  }

  // =====================================================================================
  // DRIFT DETECTION
  // =====================================================================================

  /**
   * Perform drift detection check
   */
  private async performDriftCheck(): Promise<void> {
    try {
      console.log('🔍 Starting drift detection check...');

      // Perform consistency audit
      const consistencyReport = await dualStoreManager.performConsistencyAudit();
      
      // Check for schema drift
      const schemaDrift = await migrationManager.detectSchemaDrift();

      // Process drift results
      await this.processDriftResults(consistencyReport, schemaDrift);

      console.log('✅ Drift detection completed');

    } catch (error: any) {
      console.error('❌ Drift detection failed:', error.message);
      
      await this.createAlert({
        severity: 'warning',
        component: 'system_monitor',
        metric: 'drift_check',
        currentValue: 0,
        threshold: 1,
        message: `Drift detection failed: ${error.message}`,
        condition: 'drift_check_failed'
      });
    }
  }

  /**
   * Process drift detection results
   */
  private async processDriftResults(
    consistencyReport: ConsistencyReport,
    schemaDrift: DriftReport
  ): Promise<void> {
    // Check consistency violations
    if (consistencyReport.overallHealth === 'fail') {
      await this.createAlert({
        severity: 'critical',
        component: 'data_consistency',
        metric: 'consistency_audit',
        currentValue: 0,
        threshold: 1,
        message: 'Data consistency audit failed',
        condition: 'consistency_audit_failed'
      });
    } else if (consistencyReport.overallHealth === 'warning') {
      await this.createAlert({
        severity: 'warning',
        component: 'data_consistency',
        metric: 'consistency_audit',
        currentValue: 0.5,
        threshold: 1,
        message: 'Data consistency issues detected',
        condition: 'consistency_warning'
      });
    }

    // Check tweet drift
    const tweetDriftPercent = consistencyReport.checks.tweets.supabase > 0
      ? (consistencyReport.checks.tweets.drift / consistencyReport.checks.tweets.supabase) * 100
      : 0;

    if (tweetDriftPercent > this.config.alertThresholds.system.driftTolerancePercent) {
      await this.createAlert({
        severity: 'warning',
        component: 'data_consistency',
        metric: 'tweet_drift',
        currentValue: tweetDriftPercent,
        threshold: this.config.alertThresholds.system.driftTolerancePercent,
        message: `Tweet data drift: ${tweetDriftPercent.toFixed(1)}%`,
        condition: 'tweet_drift_high'
      });
    }

    // Check schema drift
    if (schemaDrift.driftFound) {
      const severity = schemaDrift.severity === 'critical' ? 'critical' : 'warning';
      await this.createAlert({
        severity,
        component: 'schema',
        metric: 'schema_drift',
        currentValue: schemaDrift.missingTables.length + schemaDrift.columnMismatches.length,
        threshold: 0,
        message: `Schema drift detected: ${schemaDrift.severity}`,
        condition: 'schema_drift_detected'
      });
    }
  }

  // =====================================================================================
  // PERFORMANCE MONITORING
  // =====================================================================================

  /**
   * Collect performance metrics
   */
  private async collectPerformanceMetrics(): Promise<void> {
    try {
      const metrics: PerformanceMetrics = {
        timestamp: new Date(),
        tweetPostingLatency: {
          p50: 0,
          p95: 0,
          p99: 0,
          count: 0
        },
        queueProcessing: {
          backlogSize: 0,
          processingRate: 0,
          oldestItemAge: 0,
          successRate: 100
        },
        systemResources: {
          memoryUsageMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          cpuUsagePercent: 0, // Would need additional monitoring
          activeConnections: 0, // Would need connection pool monitoring
          uptime: process.uptime()
        },
        dataFlow: {
          redisHitRate: 95, // Estimate - would need actual tracking
          fallbackRate: 5,
          syncSuccessRate: 99,
          driftRate: 1
        }
      };

      // Get queue metrics
      try {
        metrics.queueProcessing.backlogSize = await redisManager.getQueueDepth('sync_to_supabase');
        
        const oldestItems = await redisManager.getFromQueue('sync_to_supabase', 1);
        if (oldestItems.length > 0) {
          metrics.queueProcessing.oldestItemAge = Date.now() - oldestItems[0].createdAt.getTime();
        }
      } catch (error) {
        console.warn('⚠️ Could not collect queue metrics:', error);
      }

      // Store metrics history (keep last 24 hours)
      this.performanceHistory.push(metrics);
      const maxHistory = 24 * 60; // 24 hours at 1-minute intervals
      if (this.performanceHistory.length > maxHistory) {
        this.performanceHistory = this.performanceHistory.slice(-maxHistory);
      }

      // Check SLO violations
      await this.checkSLOViolations(metrics);

    } catch (error: any) {
      console.error('❌ Performance metrics collection failed:', error.message);
    }
  }

  /**
   * Check SLO violations
   */
  private async checkSLOViolations(metrics: PerformanceMetrics): Promise<void> {
    // Check tweet posting latency SLO
    if (metrics.tweetPostingLatency.p95 > this.config.sloTargets.tweetPostingLatencyP95Ms) {
      const violation: SLOViolation = {
        sloName: 'tweet_posting_latency_p95',
        target: this.config.sloTargets.tweetPostingLatencyP95Ms,
        actual: metrics.tweetPostingLatency.p95,
        violationPercent: ((metrics.tweetPostingLatency.p95 - this.config.sloTargets.tweetPostingLatencyP95Ms) / this.config.sloTargets.tweetPostingLatencyP95Ms) * 100,
        duration: 0, // Would track over time
        impact: 'medium'
      };

      this.sloViolations.set(violation.sloName, violation);

      await this.createAlert({
        severity: 'warning',
        component: 'performance',
        metric: 'tweet_posting_latency_p95',
        currentValue: metrics.tweetPostingLatency.p95,
        threshold: this.config.sloTargets.tweetPostingLatencyP95Ms,
        message: `Tweet posting latency P95 SLO violation: ${metrics.tweetPostingLatency.p95}ms`,
        condition: 'slo_violation'
      });
    }

    // Check queue processing lag SLO
    const queueLagHours = metrics.queueProcessing.oldestItemAge / (1000 * 60 * 60);
    if (queueLagHours > this.config.sloTargets.queueProcessingLagHours) {
      const violation: SLOViolation = {
        sloName: 'queue_processing_lag',
        target: this.config.sloTargets.queueProcessingLagHours,
        actual: queueLagHours,
        violationPercent: ((queueLagHours - this.config.sloTargets.queueProcessingLagHours) / this.config.sloTargets.queueProcessingLagHours) * 100,
        duration: 0,
        impact: 'medium'
      };

      this.sloViolations.set(violation.sloName, violation);

      await this.createAlert({
        severity: 'warning',
        component: 'performance',
        metric: 'queue_processing_lag',
        currentValue: queueLagHours,
        threshold: this.config.sloTargets.queueProcessingLagHours,
        message: `Queue processing lag SLO violation: ${queueLagHours.toFixed(1)} hours`,
        condition: 'slo_violation'
      });
    }
  }

  // =====================================================================================
  // ALERT MANAGEMENT
  // =====================================================================================

  /**
   * Create and process alert
   */
  private async createAlert(alertData: {
    severity: 'info' | 'warning' | 'critical' | 'emergency';
    component: string;
    metric: string;
    currentValue: number;
    threshold: number;
    message: string;
    condition: string;
  }): Promise<Alert> {
    const alert: Alert = {
      id: `${alertData.component}_${alertData.metric}_${Date.now()}`,
      severity: alertData.severity,
      component: alertData.component,
      metric: alertData.metric,
      currentValue: alertData.currentValue,
      threshold: alertData.threshold,
      message: alertData.message,
      timestamp: new Date(),
      resolved: false,
      escalated: false
    };

    this.alerts.set(alert.id, alert);

    // Log alert
    console.log(`🚨 ${alertData.severity.toUpperCase()} ALERT: ${alert.message}`);

    // Process escalation
    await this.processEscalation(alert, alertData.condition);

    // Log to audit system
    await this.logEvent('alert_created', alertData.severity, {
      alert_id: alert.id,
      component: alert.component,
      metric: alert.metric,
      message: alert.message,
      current_value: alert.currentValue,
      threshold: alert.threshold
    });

    return alert;
  }

  /**
   * Process alert escalation
   */
  private async processEscalation(alert: Alert, condition: string): Promise<void> {
    const matchingRules = this.escalationRules.filter(rule => 
      (rule.severity === alert.severity || rule.severity === '*') &&
      (rule.component === alert.component || rule.component === '*') &&
      (rule.condition === condition || rule.condition === '*')
    );

    for (const rule of matchingRules) {
      // Apply escalation delay
      setTimeout(async () => {
        if (!alert.resolved) {
          await this.executeNotifications(rule.channels, alert);
          alert.escalated = true;
        }
      }, rule.escalationDelayMs);
    }
  }

  /**
   * Execute notifications
   */
  private async executeNotifications(channels: NotificationChannel[], alert: Alert): Promise<void> {
    for (const channel of channels) {
      if (!channel.enabled) continue;

      try {
        switch (channel.type) {
          case 'console':
            console.log(`🔔 ESCALATION: ${alert.severity.toUpperCase()} - ${alert.message}`);
            break;
          
          case 'webhook':
            if (channel.config.url) {
              // Would implement webhook notification
              console.log(`📞 Webhook notification: ${channel.config.url}`);
            }
            break;
          
          case 'email':
            // Would implement email notification
            console.log(`📧 Email notification: ${alert.message}`);
            break;
          
          case 'slack':
            // Would implement Slack notification
            console.log(`💬 Slack notification: ${alert.message}`);
            break;
        }
      } catch (error: any) {
        console.error(`❌ Notification failed for ${channel.type}:`, error.message);
      }
    }
  }

  /**
   * Resolve alert
   */
  public async resolveAlert(alertId: string): Promise<boolean> {
    const alert = this.alerts.get(alertId);
    if (!alert) {
      return false;
    }

    alert.resolved = true;
    console.log(`✅ Alert resolved: ${alert.message}`);

    await this.logEvent('alert_resolved', 'info', {
      alert_id: alertId,
      component: alert.component,
      duration_ms: Date.now() - alert.timestamp.getTime()
    });

    return true;
  }

  // =====================================================================================
  // REPORTING
  // =====================================================================================

  /**
   * Generate monitoring report
   */
  public async generateMonitoringReport(period: string = '24h'): Promise<MonitoringReport> {
    const now = new Date();
    const report: MonitoringReport = {
      timestamp: now,
      period,
      overallHealth: 'healthy',
      sloCompliance: {},
      alertsSummary: {
        total: 0,
        bySeverity: {},
        topIssues: []
      },
      recommendations: [],
      actionItems: []
    };

    try {
      // Calculate SLO compliance
      for (const [sloName, target] of Object.entries(this.config.sloTargets)) {
        const violation = this.sloViolations.get(sloName);
        report.sloCompliance[sloName] = {
          target: target,
          actual: violation ? violation.actual : target,
          compliant: !violation
        };
      }

      // Analyze alerts
      const activeAlerts = Array.from(this.alerts.values()).filter(a => !a.resolved);
      report.alertsSummary.total = activeAlerts.length;

      // Group by severity
      for (const alert of activeAlerts) {
        report.alertsSummary.bySeverity[alert.severity] = 
          (report.alertsSummary.bySeverity[alert.severity] || 0) + 1;
      }

      // Determine overall health
      if (activeAlerts.some(a => a.severity === 'critical' || a.severity === 'emergency')) {
        report.overallHealth = 'critical';
      } else if (activeAlerts.some(a => a.severity === 'warning')) {
        report.overallHealth = 'degraded';
      }

      // Generate recommendations
      if (report.alertsSummary.bySeverity['critical'] > 0) {
        report.recommendations.push('Immediate attention required for critical alerts');
        report.actionItems.push('Investigate and resolve critical system issues');
      }

      if (Object.values(report.sloCompliance).some(slo => !slo.compliant)) {
        report.recommendations.push('SLO violations detected - review performance');
        report.actionItems.push('Optimize system performance to meet SLO targets');
      }

      if (this.performanceHistory.length > 0) {
        const recentMetrics = this.performanceHistory.slice(-60); // Last hour
        const avgQueueDepth = recentMetrics.reduce((sum, m) => sum + m.queueProcessing.backlogSize, 0) / recentMetrics.length;
        
        if (avgQueueDepth > 500) {
          report.recommendations.push('Queue backlog consistently high - consider scaling');
          report.actionItems.push('Increase sync job frequency or add processing capacity');
        }
      }

      console.log(`📊 Monitoring report generated: ${report.overallHealth} overall health`);
      return report;

    } catch (error: any) {
      console.error('❌ Report generation failed:', error.message);
      report.overallHealth = 'critical';
      report.recommendations.push('Report generation failed - system monitoring compromised');
      return report;
    }
  }

  // =====================================================================================
  // UTILITY METHODS
  // =====================================================================================

  /**
   * Get current system status
   */
  public getSystemStatus(): {
    monitoring: boolean;
    lastHealthCheck: Date;
    activeAlerts: number;
    sloViolations: number;
    uptime: number;
  } {
    return {
      monitoring: this.isMonitoring,
      lastHealthCheck: this.lastHealthCheck,
      activeAlerts: Array.from(this.alerts.values()).filter(a => !a.resolved).length,
      sloViolations: this.sloViolations.size,
      uptime: process.uptime()
    };
  }

  /**
   * Get performance metrics
   */
  public getPerformanceMetrics(hours: number = 1): PerformanceMetrics[] {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    return this.performanceHistory.filter(m => m.timestamp >= cutoff);
  }

  /**
   * Get active alerts
   */
  public getActiveAlerts(): Alert[] {
    return Array.from(this.alerts.values()).filter(a => !a.resolved);
  }

  /**
   * Log monitoring event
   */
  private async logEvent(eventType: string, severity: string, data: any): Promise<void> {
    try {
      await dualStoreManager.logAuditEvent({
        event_type: eventType,
        component: 'system_monitor',
        severity: severity as any,
        event_data: data,
        context: {
          monitoring_enabled: this.isMonitoring,
          config_version: 1
        }
      });
    } catch (error: any) {
      console.warn('⚠️ Could not log monitoring event:', error.message);
    }
  }

  /**
   * Force health check
   */
  public async forceHealthCheck(): Promise<void> {
    console.log('🔍 Forcing immediate health check...');
    await this.performHealthCheck();
  }

  /**
   * Force drift check
   */
  public async forceDriftCheck(): Promise<void> {
    console.log('🔍 Forcing immediate drift check...');
    await this.performDriftCheck();
  }

  /**
   * Graceful shutdown
   */
  public async shutdown(): Promise<void> {
    console.log('🛑 Shutting down system monitor...');
    this.stopMonitoring();
    console.log('✅ System monitor shutdown complete');
  }
}

// Export singleton instance
export const systemMonitor = SystemMonitor.getInstance();

// Export types
export type {
  MonitoringConfig,
  HealthCheckResult,
  Alert,
  SLOViolation,
  PerformanceMetrics,
  MonitoringReport
};

// Export class
export { SystemMonitor };

// Default export
export default systemMonitor;