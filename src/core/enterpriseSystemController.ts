/**
 * 🏢 ENTERPRISE SYSTEM CONTROLLER
 * 
 * Central orchestrator for all enterprise database systems:
 * - Advanced Database Manager
 * - Redis Cluster Manager  
 * - Migration Engine
 * - Monitoring System
 * - Performance Analytics
 * - Backup & Recovery
 */

import { EventEmitter } from 'events';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AdvancedDatabaseManager } from '../lib/advancedDatabaseManager';
import { RedisClusterManager } from '../lib/redisClusterManager';
import { MigrationEngine } from '../lib/migrationEngine';
import { DatabaseMonitoringSystem } from '../lib/databaseMonitoringSystem';

interface SystemHealth {
  overall: 'healthy' | 'degraded' | 'critical' | 'offline';
  components: {
    supabase: 'healthy' | 'degraded' | 'critical' | 'offline';
    redis: 'healthy' | 'degraded' | 'critical' | 'offline';
    monitoring: 'healthy' | 'degraded' | 'critical' | 'offline';
    migrations: 'healthy' | 'degraded' | 'critical' | 'offline';
  };
  metrics: {
    uptime: number;
    totalQueries: number;
    errorRate: number;
    averageLatency: number;
  };
  lastUpdate: Date;
}

interface SystemMetrics {
  performance: {
    queryThroughput: number;
    cacheHitRate: number;
    connectionPoolUsage: number;
    memoryUsage: number;
  };
  health: {
    serviceUptime: Record<string, number>;
    errorCounts: Record<string, number>;
    alertsActive: number;
  };
  optimization: {
    slowQueries: number;
    recommendationsCount: number;
    indexOptimizations: number;
  };
}

export class EnterpriseSystemController extends EventEmitter {
  private static instance: EnterpriseSystemController;
  
  // Core systems
  private supabase: SupabaseClient;
  private databaseManager: AdvancedDatabaseManager;
  private redisManager: RedisClusterManager;
  private migrationEngine: MigrationEngine;
  private monitoringSystem: DatabaseMonitoringSystem;
  
  // State
  private isInitialized = false;
  private startTime = Date.now();
  private systemHealth: SystemHealth;
  
  // Configuration
  private config = {
    autoMigrate: process.env.AUTO_MIGRATE_ON_STARTUP === 'true',
    enableMonitoring: process.env.ENABLE_DB_MONITORING !== 'false',
    enableBackups: process.env.ENABLE_AUTO_BACKUPS === 'true',
          healthCheckInterval: parseInt(process.env.SYSTEM_HEALTH_CHECK_INTERVAL || '300000'), // 5 minutes
  };

  private constructor() {
    super();
    this.initializeSupabase();
    this.initializeSystemHealth();
  }

  public static getInstance(): EnterpriseSystemController {
    if (!EnterpriseSystemController.instance) {
      EnterpriseSystemController.instance = new EnterpriseSystemController();
    }
    return EnterpriseSystemController.instance;
  }

  private initializeSupabase(): void {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Supabase credentials not configured');
    }

    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }

  private initializeSystemHealth(): void {
    this.systemHealth = {
      overall: 'offline',
      components: {
        supabase: 'offline',
        redis: 'offline',
        monitoring: 'offline',
        migrations: 'offline'
      },
      metrics: {
        uptime: 0,
        totalQueries: 0,
        errorRate: 0,
        averageLatency: 0
      },
      lastUpdate: new Date()
    };
  }

  async initializeEnterpriseSystems(): Promise<void> {
    if (this.isInitialized) {
      console.log('✅ Enterprise systems already initialized');
      return;
    }

    console.log('🏢 Initializing Enterprise Database Systems...');
    console.log('='.repeat(60));

    let criticalError = false;

    try {
      // Step 1: Initialize Advanced Database Manager (CRITICAL)
      try {
        await this.initializeDatabaseManager();
      } catch (error: any) {
        console.error('❌ Database Manager initialization failed:', error.message);
        this.systemHealth.components.supabase = 'critical';
        criticalError = true;
      }
      
      // Step 2: Initialize Redis Cluster Manager (NON-CRITICAL)
      try {
        await this.initializeRedisManager();
      } catch (error: any) {
        console.warn('⚠️ Redis Manager initialization failed, continuing without Redis:', error.message);
        this.systemHealth.components.redis = 'offline';
      }
      
      // Step 3: Initialize Migration Engine (NON-CRITICAL)
      try {
        await this.initializeMigrationEngine();
      } catch (error: any) {
        console.warn('⚠️ Migration Engine initialization failed:', error.message);
        this.systemHealth.components.migrations = 'degraded';
      }
      
      // Step 4: Run migrations if configured (NON-CRITICAL)
      if (this.config.autoMigrate && this.migrationEngine) {
        await this.runMigrations();
      }
      
      // Step 5: Initialize Monitoring System (NON-CRITICAL)
      if (this.config.enableMonitoring) {
        try {
          await this.initializeMonitoring();
        } catch (error: any) {
          console.warn('⚠️ Monitoring initialization failed:', error.message);
          this.systemHealth.components.monitoring = 'degraded';
        }
      }
      
      // Step 6: Start system health monitoring
      this.startHealthMonitoring();
      
      // Check if we can proceed
      if (criticalError) {
        throw new Error('Critical database system failed - cannot proceed');
      }
      
      this.isInitialized = true;
      console.log('='.repeat(60));
      console.log('🎉 Enterprise Database Systems operational!');
      
      const status = this.getSystemStatus();
      console.log(`📊 System Health: ${status.health.overall}`);
      console.log(`📊 Components: Supabase(${status.health.components.supabase}), Redis(${status.health.components.redis}), Monitoring(${status.health.components.monitoring})`);
      
      this.emit('systemInitialized', status);
      
    } catch (error: any) {
      console.error('❌ Enterprise system initialization failed:', error.message);
      this.emit('systemError', error);
      
      // If critical systems failed, we can't proceed
      if (criticalError || error.message.includes('Critical')) {
        throw error;
      }
      
      // Otherwise, log warning but continue
      console.log('🔄 Continuing with degraded enterprise systems...');
      this.isInitialized = true;
    }
  }

  private async initializeDatabaseManager(): Promise<void> {
    console.log('🏗️ Initializing Advanced Database Manager...');
    
    this.databaseManager = AdvancedDatabaseManager.getInstance();
    
    // Set up event listeners
    this.databaseManager.on('initialized', () => {
      this.systemHealth.components.supabase = 'healthy';
      console.log('✅ Advanced Database Manager operational');
    });
    
    this.databaseManager.on('error', (error) => {
      this.systemHealth.components.supabase = 'critical';
      console.error('❌ Database Manager error:', error.message);
    });
    
    this.databaseManager.on('healthUpdate', (health) => {
      if (health.supabase?.status === 'critical') {
        this.systemHealth.components.supabase = 'critical';
      } else if (health.supabase?.status === 'degraded') {
        this.systemHealth.components.supabase = 'degraded';
      } else {
        this.systemHealth.components.supabase = 'healthy';
      }
    });

    await this.databaseManager.initialize();
  }

  private async initializeRedisManager(): Promise<void> {
    console.log('🔴 Initializing Redis Cluster Manager...');
    
    this.redisManager = RedisClusterManager.getInstance();
    
    // Set up event listeners
    this.redisManager.on('initialized', () => {
      this.systemHealth.components.redis = 'healthy';
      console.log('✅ Redis Cluster Manager operational');
    });
    
    this.redisManager.on('error', (error) => {
      this.systemHealth.components.redis = 'critical';
      console.warn('⚠️ Redis Manager error (continuing without Redis):', error.message);
    });
    
    this.redisManager.on('failover', (info) => {
      if (info.success) {
        console.log('🔄 Redis failover successful');
        this.systemHealth.components.redis = 'degraded';
      } else {
        console.error('❌ Redis failover failed');
        this.systemHealth.components.redis = 'critical';
      }
    });

    try {
      await this.redisManager.initialize();
    } catch (error) {
      console.warn('⚠️ Redis unavailable, continuing with Supabase-only mode');
      this.systemHealth.components.redis = 'offline';
    }
  }

  private async initializeMigrationEngine(): Promise<void> {
    console.log('🔄 Initializing Migration Engine...');
    
    this.migrationEngine = MigrationEngine.getInstance(this.supabase);
    
    // Set up event listeners
    this.migrationEngine.on('migrationsComplete', (results) => {
      console.log(`✅ Migrations completed: ${results.length} applied`);
      this.systemHealth.components.migrations = 'healthy';
    });
    
    this.migrationEngine.on('migrationError', (error) => {
      console.error('❌ Migration error:', error.message);
      this.systemHealth.components.migrations = 'critical';
    });

    await this.migrationEngine.initialize();
    this.systemHealth.components.migrations = 'healthy';
  }

  private async runMigrations(): Promise<void> {
    console.log('📋 Running database migrations...');
    
    try {
      const currentVersion = await this.migrationEngine.getCurrentVersion();
      console.log(`Current database version: ${currentVersion}`);
      
      const plan = await this.migrationEngine.createMigrationPlan();
      
      if (plan.totalMigrations > 0) {
        console.log(`🚀 Applying ${plan.totalMigrations} migrations...`);
        const results = await this.migrationEngine.executeMigrations(plan);
        
        const successful = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success).length;
        
        console.log(`✅ Migration results: ${successful} successful, ${failed} failed`);
        
        if (failed > 0) {
          this.systemHealth.components.migrations = 'critical';
          console.warn(`⚠️ ${failed} migrations failed, but continuing with available schema`);
          // Don't throw - let system continue with existing schema
        }
      } else {
        console.log('✅ Database is up to date');
      }
      
    } catch (error: any) {
      console.error('❌ Migration execution failed:', error.message);
      console.log('🔄 Continuing without migrations - manual migration required');
      this.systemHealth.components.migrations = 'degraded';
      // Don't throw - let system continue and user can run migrations manually
    }
  }

  private async initializeMonitoring(): Promise<void> {
    console.log('📊 Initializing Database Monitoring System...');
    
    const redis = this.redisManager.getSystemStatus().connected ? 
      await this.getRedisClient() : undefined;
    
    this.monitoringSystem = DatabaseMonitoringSystem.getInstance(this.supabase, redis);
    
    // Set up event listeners
    this.monitoringSystem.on('monitoringStarted', () => {
      this.systemHealth.components.monitoring = 'healthy';
      console.log('✅ Database monitoring active');
    });
    
    this.monitoringSystem.on('criticalAlert', (alert) => {
      console.error(`🚨 CRITICAL ALERT: ${alert.service} - ${alert.status.lastError}`);
      this.emit('criticalAlert', alert);
    });
    
    this.monitoringSystem.on('healthUpdate', (health) => {
      this.updateSystemHealthFromMonitoring(health);
    });
    
    this.monitoringSystem.on('metricsUpdate', (metrics) => {
      this.emit('metricsUpdate', metrics);
    });

    await this.monitoringSystem.startMonitoring();
  }

  private async getRedisClient(): Promise<any> {
    try {
      const redisStatus = this.redisManager.getSystemStatus();
      if (redisStatus.connected) {
        // Return a simplified interface for monitoring
        return {
          ping: () => this.redisManager.exists('ping_test'),
          info: () => Promise.resolve('# Server\nredis_version:6.0.0'),
        };
      }
    } catch (error) {
      // Redis not available
    }
    return undefined;
  }

  private updateSystemHealthFromMonitoring(health: Record<string, any>): void {
    if (health.supabase) {
      const status = health.supabase.status;
      this.systemHealth.components.supabase = status === 'healthy' ? 'healthy' :
        status === 'degraded' ? 'degraded' : 'critical';
    }
    
    if (health.redis) {
      const status = health.redis.status;
      this.systemHealth.components.redis = status === 'healthy' ? 'healthy' :
        status === 'degraded' ? 'degraded' : 
        status === 'offline' ? 'offline' : 'critical';
    }
    
    this.updateOverallHealth();
  }

  private updateOverallHealth(): void {
    const components = Object.values(this.systemHealth.components);
    
    if (components.includes('critical')) {
      this.systemHealth.overall = 'critical';
    } else if (components.includes('degraded')) {
      this.systemHealth.overall = 'degraded';
    } else if (components.every(c => c === 'healthy')) {
      this.systemHealth.overall = 'healthy';
    } else {
      this.systemHealth.overall = 'offline';
    }
    
    this.systemHealth.lastUpdate = new Date();
    this.systemHealth.metrics.uptime = Date.now() - this.startTime;
    
    this.emit('healthUpdate', this.systemHealth);
  }

  private startHealthMonitoring(): void {
    setInterval(() => {
      this.updateOverallHealth();
      
      // Emit comprehensive system status
      const status = this.getSystemStatus();
      this.emit('systemStatus', status);
      
    }, this.config.healthCheckInterval);
  }

  // Public API methods
  async executeDatabaseQuery<T>(
    operation: string,
    queryFn: (client: any) => Promise<T>,
    cacheKey?: string,
    cacheTtl?: number
  ): Promise<T> {
    if (!this.isInitialized) {
      throw new Error('Enterprise systems not initialized');
    }
    
    return await this.databaseManager.executeQuery(operation, queryFn, cacheKey, cacheTtl);
  }

  async cacheData(key: string, value: any, ttl = 300): Promise<boolean> {
    if (!this.isInitialized) return false;
    return await this.databaseManager.cacheSet(key, value, ttl);
  }

  async getCachedData(key: string): Promise<any | null> {
    if (!this.isInitialized) return null;
    return await this.databaseManager.cacheGet(key);
  }

  recordCustomMetric(metric: {
    metric: string;
    value: number;
    unit: string;
    tags?: Record<string, string>;
  }): void {
    if (!this.isInitialized || !this.monitoringSystem) return;
    
    this.monitoringSystem.addCustomMetric({
      timestamp: new Date(),
      source: 'application',
      ...metric,
      tags: metric.tags || {}
    });
  }

  getSystemHealth(): SystemHealth {
    return { ...this.systemHealth };
  }

  getSystemMetrics(): SystemMetrics | null {
    if (!this.isInitialized || !this.monitoringSystem) return null;
    
    const dashboardData = this.monitoringSystem.getDashboardData();
    const dbStatus = this.databaseManager.getSystemStatus();
    const redisStatus = this.redisManager.getSystemStatus();
    
    return {
      performance: {
        queryThroughput: dashboardData.metrics.throughput.reduce((sum, m) => sum + m.value, 0),
        cacheHitRate: dashboardData.optimization.totalQueries > 0 ? 
          (dashboardData.optimization.totalQueries - dashboardData.optimization.slowQueries) / 
          dashboardData.optimization.totalQueries : 0,
        connectionPoolUsage: dbStatus.supabase?.available ? 
          (dbStatus.supabase.total - dbStatus.supabase.available) / dbStatus.supabase.total : 0,
        memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024
      },
      health: {
        serviceUptime: {
          database: this.systemHealth.metrics.uptime,
          redis: redisStatus.connected ? this.systemHealth.metrics.uptime : 0,
          monitoring: this.config.enableMonitoring ? this.systemHealth.metrics.uptime : 0
        },
        errorCounts: {
          database: 0, // Would be tracked by monitoring
          redis: 0,
          application: 0
        },
        alertsActive: dashboardData.alerts.length
      },
      optimization: {
        slowQueries: dashboardData.optimization.slowQueries,
        recommendationsCount: dashboardData.optimization.topRecommendations.length,
        indexOptimizations: 0 // Would be calculated from recommendations
      }
    };
  }

  getSystemStatus(): {
    initialized: boolean;
    health: SystemHealth;
    metrics: SystemMetrics | null;
    components: {
      database: any;
      redis: any;
      monitoring: any;
      migrations: any;
    };
  } {
    return {
      initialized: this.isInitialized,
      health: this.getSystemHealth(),
      metrics: this.getSystemMetrics(),
      components: {
        database: this.databaseManager?.getSystemStatus(),
        redis: this.redisManager?.getSystemStatus(),
        monitoring: this.monitoringSystem ? {
          active: true,
          alerts: this.monitoringSystem.getActiveAlerts().length
        } : null,
        migrations: {
          available: !!this.migrationEngine
        }
      }
    };
  }

  async shutdown(): Promise<void> {
    console.log('🔄 Shutting down Enterprise Systems...');
    
    const shutdownPromises: Promise<void>[] = [];
    
    if (this.databaseManager) {
      shutdownPromises.push(this.databaseManager.shutdown());
    }
    
    if (this.redisManager) {
      shutdownPromises.push(this.redisManager.shutdown());
    }
    
    if (this.monitoringSystem) {
      shutdownPromises.push(this.monitoringSystem.stopMonitoring());
    }
    
    await Promise.allSettled(shutdownPromises);
    
    this.isInitialized = false;
    this.emit('systemShutdown');
    
    console.log('✅ Enterprise systems shutdown complete');
  }
}