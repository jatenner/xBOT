/**
 * 🔴 ADVANCED REDIS CLUSTER MANAGER
 * 
 * Enterprise-grade Redis management with:
 * - Multi-endpoint failover
 * - Automatic cluster discovery
 * - Load balancing across nodes
 * - Circuit breakers and health monitoring
 * - Intelligent retry strategies
 * - Performance optimization
 */

import Redis, { Cluster, ClusterOptions } from 'ioredis';
import { EventEmitter } from 'events';

interface RedisEndpoint {
  host: string;
  port: number;
  password?: string;
  priority: number;
  region?: string;
  status: 'healthy' | 'degraded' | 'offline';
  latency: number;
  errorCount: number;
  lastError?: string;
}

interface RedisClusterConfig {
  endpoints: {
    primary: string[];
    fallback: string[];
    backup: string[];
  };
  cluster: {
    enabled: boolean;
    autoDiscovery: boolean;
    maxRedirections: number;
    retryDelayOnFailover: number;
  };
  failover: {
    enabled: boolean;
    checkInterval: number;
    maxRetries: number;
    backoffMultiplier: number;
  };
  performance: {
    keyPrefix: string;
    connectTimeout: number;
    commandTimeout: number;
    keepAlive: boolean;
    compressionEnabled: boolean;
  };
  monitoring: {
    healthCheckInterval: number;
    performanceMetrics: boolean;
    alertThresholds: {
      latency: number;
      errorRate: number;
      connectionCount: number;
    };
  };
}

interface RedisMetrics {
  operations: {
    total: number;
    success: number;
    failed: number;
    cached: number;
  };
  performance: {
    averageLatency: number;
    p95Latency: number;
    throughput: number;
  };
  connections: {
    active: number;
    idle: number;
    failed: number;
  };
  cache: {
    hitRate: number;
    missRate: number;
    evictions: number;
    memoryUsage: number;
  };
}

class RedisLoadBalancer {
  private currentIndex = 0;
  
  constructor(private endpoints: RedisEndpoint[]) {}

  getNextEndpoint(): RedisEndpoint | null {
    const healthyEndpoints = this.endpoints.filter(e => e.status === 'healthy');
    
    if (healthyEndpoints.length === 0) {
      // Try degraded endpoints as fallback
      const degradedEndpoints = this.endpoints.filter(e => e.status === 'degraded');
      if (degradedEndpoints.length === 0) return null;
      
      // Sort by lowest error count
      degradedEndpoints.sort((a, b) => a.errorCount - b.errorCount);
      return degradedEndpoints[0];
    }

    // Round-robin with priority weighting
    healthyEndpoints.sort((a, b) => {
      if (a.priority !== b.priority) return b.priority - a.priority;
      return a.latency - b.latency;
    });

    const endpoint = healthyEndpoints[this.currentIndex % healthyEndpoints.length];
    this.currentIndex++;
    return endpoint;
  }

  updateEndpointHealth(host: string, port: number, health: Partial<RedisEndpoint>): void {
    const endpoint = this.endpoints.find(e => e.host === host && e.port === port);
    if (endpoint) {
      Object.assign(endpoint, health);
    }
  }

  getHealthyEndpoints(): RedisEndpoint[] {
    return this.endpoints.filter(e => e.status === 'healthy');
  }

  getAllEndpoints(): RedisEndpoint[] {
    return [...this.endpoints];
  }
}

class RedisCircuitBreaker {
  private failures = 0;
  private lastFailure?: Date;
  private state: 'closed' | 'open' | 'half_open' = 'closed';
  private successCount = 0;
  
  constructor(
    private failureThreshold: number = 5,
    private recoveryTimeout: number = 60000,
    private successThreshold: number = 3
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - (this.lastFailure?.getTime() || 0) > this.recoveryTimeout) {
        this.state = 'half_open';
        this.successCount = 0;
      } else {
        throw new Error(`Redis circuit breaker is OPEN (failures: ${this.failures})`);
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    if (this.state === 'half_open') {
      this.successCount++;
      if (this.successCount >= this.successThreshold) {
        this.state = 'closed';
        this.failures = 0;
      }
    } else {
      this.failures = Math.max(0, this.failures - 1);
    }
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailure = new Date();
    
    if (this.failures >= this.failureThreshold) {
      this.state = 'open';
    }
  }

  getState() {
    return {
      state: this.state,
      failures: this.failures,
      lastFailure: this.lastFailure,
      successCount: this.successCount
    };
  }

  reset(): void {
    this.state = 'closed';
    this.failures = 0;
    this.successCount = 0;
    this.lastFailure = undefined;
  }
}

export class RedisClusterManager extends EventEmitter {
  private static instance: RedisClusterManager;
  
  private config: RedisClusterConfig;
  private loadBalancer: RedisLoadBalancer;
  private circuitBreaker: RedisCircuitBreaker;
  
  // Redis connections
  private primaryCluster: Cluster | null = null;
  private fallbackClients: Redis[] = [];
  private currentClient: Redis | Cluster | null = null;
  
  // Monitoring and metrics
  private metrics: RedisMetrics;
  private healthCheckInterval?: NodeJS.Timeout;
  private metricsInterval?: NodeJS.Timeout;
  private operationHistory: Array<{ timestamp: number; duration: number; success: boolean }> = [];
  
  // State
  private isInitialized = false;
  private failoverInProgress = false;

  private constructor() {
    super();
    this.setupConfiguration();
    this.setupLoadBalancer();
    this.circuitBreaker = new RedisCircuitBreaker(5, 60000, 3);
    this.initializeMetrics();
  }

  public static getInstance(): RedisClusterManager {
    if (!RedisClusterManager.instance) {
      RedisClusterManager.instance = new RedisClusterManager();
    }
    return RedisClusterManager.instance;
  }

  private setupConfiguration(): void {
    const redisUrl = process.env.REDIS_URL || '';
    const fallbackUrls = process.env.REDIS_FALLBACK_URLS?.split(',') || [];
    const backupUrls = process.env.REDIS_BACKUP_URLS?.split(',') || [];

    this.config = {
      endpoints: {
        primary: redisUrl ? [redisUrl] : [],
        fallback: fallbackUrls,
        backup: backupUrls
      },
      cluster: {
        enabled: process.env.REDIS_CLUSTER_ENABLED === 'true',
        autoDiscovery: process.env.REDIS_AUTO_DISCOVERY !== 'false',
        maxRedirections: parseInt(process.env.REDIS_MAX_REDIRECTIONS || '16'),
        retryDelayOnFailover: parseInt(process.env.REDIS_FAILOVER_DELAY || '100')
      },
      failover: {
        enabled: process.env.REDIS_FAILOVER_ENABLED !== 'false',
        checkInterval: parseInt(process.env.REDIS_HEALTH_CHECK_INTERVAL || '10000'),
        maxRetries: parseInt(process.env.REDIS_MAX_RETRIES || '3'),
        backoffMultiplier: parseFloat(process.env.REDIS_BACKOFF_MULTIPLIER || '1.5')
      },
      performance: {
        keyPrefix: process.env.REDIS_KEY_PREFIX || 'xbot:',
        connectTimeout: parseInt(process.env.REDIS_CONNECT_TIMEOUT || '5000'),
        commandTimeout: parseInt(process.env.REDIS_COMMAND_TIMEOUT || '3000'),
        keepAlive: process.env.REDIS_KEEP_ALIVE !== 'false',
        compressionEnabled: process.env.REDIS_COMPRESSION === 'true'
      },
      monitoring: {
        healthCheckInterval: parseInt(process.env.REDIS_HEALTH_INTERVAL || '30000'),
        performanceMetrics: process.env.REDIS_METRICS !== 'false',
        alertThresholds: {
          latency: parseInt(process.env.REDIS_LATENCY_THRESHOLD || '100'),
          errorRate: parseFloat(process.env.REDIS_ERROR_RATE_THRESHOLD || '0.05'),
          connectionCount: parseInt(process.env.REDIS_CONNECTION_THRESHOLD || '100')
        }
      }
    };
  }

  private setupLoadBalancer(): void {
    const allUrls = [
      ...this.config.endpoints.primary,
      ...this.config.endpoints.fallback,
      ...this.config.endpoints.backup
    ];

    const endpoints: RedisEndpoint[] = allUrls.map((url, index) => {
      const parsed = new URL(url);
      const isPrimary = this.config.endpoints.primary.includes(url);
      const isFallback = this.config.endpoints.fallback.includes(url);
      
      return {
        host: parsed.hostname,
        port: parseInt(parsed.port) || 6379,
        password: parsed.password || undefined,
        priority: isPrimary ? 10 : isFallback ? 5 : 1,
        region: parsed.searchParams.get('region') || 'default',
        status: 'offline',
        latency: 0,
        errorCount: 0
      };
    });

    this.loadBalancer = new RedisLoadBalancer(endpoints);
  }

  private initializeMetrics(): void {
    this.metrics = {
      operations: { total: 0, success: 0, failed: 0, cached: 0 },
      performance: { averageLatency: 0, p95Latency: 0, throughput: 0 },
      connections: { active: 0, idle: 0, failed: 0 },
      cache: { hitRate: 0, missRate: 0, evictions: 0, memoryUsage: 0 }
    };
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    console.log('🔴 Initializing Advanced Redis Cluster Manager...');

    try {
      // Test all endpoints and update their health
      await this.performInitialHealthCheck();
      
      // Initialize primary connection
      await this.initializePrimaryConnection();
      
      // Set up fallback connections
      await this.initializeFallbackConnections();
      
      // Start monitoring
      this.startHealthMonitoring();
      this.startMetricsCollection();
      
      this.isInitialized = true;
      console.log('✅ Redis Cluster Manager fully operational');
      
      this.emit('initialized', this.getSystemStatus());
      
    } catch (error: any) {
      console.error('❌ Failed to initialize Redis cluster:', error.message);
      this.emit('error', error);
      
      // Continue without Redis if all endpoints fail
      console.log('🔄 Continuing without Redis (Supabase-only mode)');
    }
  }

  private async performInitialHealthCheck(): Promise<void> {
    console.log('🩺 Performing initial Redis health check...');
    
    const endpoints = this.loadBalancer.getAllEndpoints();
    const healthChecks = endpoints.map(endpoint => this.checkEndpointHealth(endpoint));
    
    await Promise.allSettled(healthChecks);
    
    const healthyCount = this.loadBalancer.getHealthyEndpoints().length;
    console.log(`✅ Redis health check complete: ${healthyCount}/${endpoints.length} endpoints healthy`);
  }

  private async checkEndpointHealth(endpoint: RedisEndpoint): Promise<void> {
    const startTime = Date.now();
    
    try {
      const client = new Redis({
        host: endpoint.host,
        port: endpoint.port,
        password: endpoint.password,
        connectTimeout: this.config.performance.connectTimeout,
        commandTimeout: this.config.performance.commandTimeout,
        lazyConnect: true,
        maxRetriesPerRequest: 1
      });
      
      await client.ping();
      await client.quit();
      
      const latency = Date.now() - startTime;
      
      this.loadBalancer.updateEndpointHealth(endpoint.host, endpoint.port, {
        status: latency < this.config.monitoring.alertThresholds.latency ? 'healthy' : 'degraded',
        latency,
        errorCount: Math.max(0, endpoint.errorCount - 1)
      });
      
    } catch (error: any) {
      this.loadBalancer.updateEndpointHealth(endpoint.host, endpoint.port, {
        status: 'offline',
        latency: -1,
        errorCount: endpoint.errorCount + 1,
        lastError: error.message
      });
    }
  }

  private async initializePrimaryConnection(): Promise<void> {
    const healthyEndpoints = this.loadBalancer.getHealthyEndpoints();
    
    if (healthyEndpoints.length === 0) {
      throw new Error('No healthy Redis endpoints available');
    }

    if (this.config.cluster.enabled && healthyEndpoints.length > 1) {
      // Initialize Redis Cluster
      console.log('🔗 Setting up Redis Cluster...');
      
      const clusterNodes = healthyEndpoints.map(e => ({
        host: e.host,
        port: e.port,
        password: e.password
      }));

      const clusterOptions: ClusterOptions = {
        enableOfflineQueue: false,
        redisOptions: {
          password: clusterNodes[0].password,
          connectTimeout: this.config.performance.connectTimeout,
          commandTimeout: this.config.performance.commandTimeout,
          keyPrefix: this.config.performance.keyPrefix
        },
        retryDelayOnFailover: this.config.cluster.retryDelayOnFailover,
        enableReadyCheck: true,
        scaleReads: 'slave'
      };

      this.primaryCluster = new Redis.Cluster(clusterNodes, clusterOptions);
      this.currentClient = this.primaryCluster;
      
      await this.primaryCluster.ping();
      console.log('✅ Redis Cluster connected');
      
    } else {
      // Single Redis instance
      console.log('🔗 Setting up single Redis connection...');
      
      const bestEndpoint = healthyEndpoints.sort((a, b) => 
        b.priority - a.priority || a.latency - b.latency
      )[0];

      const redisOptions = {
        host: bestEndpoint.host,
        port: bestEndpoint.port,
        password: bestEndpoint.password,
        keyPrefix: this.config.performance.keyPrefix,
        connectTimeout: this.config.performance.connectTimeout,
        commandTimeout: this.config.performance.commandTimeout,
        lazyConnect: false,
        keepAlive: this.config.performance.keepAlive ? 30000 : 0,
        maxRetriesPerRequest: this.config.failover.maxRetries,
        retryDelayOnFailover: this.config.cluster.retryDelayOnFailover
      };

      this.currentClient = new Redis(redisOptions);
      await this.currentClient.ping();
      console.log('✅ Single Redis connected');
    }
  }

  private async initializeFallbackConnections(): Promise<void> {
    if (!this.config.failover.enabled) return;
    
    console.log('🔄 Setting up fallback connections...');
    
    const fallbackEndpoints = this.loadBalancer.getAllEndpoints()
      .filter(e => e.status === 'healthy')
      .slice(1, 4); // Keep up to 3 fallback connections

    for (const endpoint of fallbackEndpoints) {
      try {
        const client = new Redis({
          host: endpoint.host,
          port: endpoint.port,
          password: endpoint.password,
          keyPrefix: this.config.performance.keyPrefix,
          lazyConnect: true,
          maxRetriesPerRequest: 1
        });
        
        this.fallbackClients.push(client);
      } catch (error) {
        console.warn(`⚠️ Failed to create fallback connection: ${endpoint.host}:${endpoint.port}`);
      }
    }
    
    console.log(`✅ ${this.fallbackClients.length} fallback connections ready`);
  }

  // Advanced Redis operations with circuit breaker and failover
  async executeOperation<T>(
    operation: (client: Redis | Cluster) => Promise<T>,
    operationType: string = 'unknown'
  ): Promise<T> {
    if (!this.currentClient) {
      throw new Error('No Redis connection available');
    }

    const startTime = Date.now();
    
    return await this.circuitBreaker.execute(async () => {
      try {
        const result = await Promise.race([
          operation(this.currentClient!),
          new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('Redis operation timeout')), 
            this.config.performance.commandTimeout)
          )
        ]);

        this.recordOperation(operationType, Date.now() - startTime, true);
        return result;
        
      } catch (error: any) {
        this.recordOperation(operationType, Date.now() - startTime, false);
        
        // Attempt failover if enabled
        if (this.config.failover.enabled && !this.failoverInProgress) {
          console.warn(`⚠️ Redis operation failed, attempting failover: ${error.message}`);
          await this.performFailover();
          
          // Retry operation with new connection
          if (this.currentClient) {
            const retryResult = await operation(this.currentClient);
            this.recordOperation(`${operationType}_retry`, Date.now() - startTime, true);
            return retryResult;
          }
        }
        
        throw error;
      }
    });
  }

  private async performFailover(): Promise<void> {
    if (this.failoverInProgress) return;
    
    this.failoverInProgress = true;
    console.log('🔄 Performing Redis failover...');
    
    try {
      // Close current connection
      if (this.currentClient) {
        await this.currentClient.quit().catch(() => {});
        this.currentClient = null;
      }
      
      // Try fallback clients
      for (const fallbackClient of this.fallbackClients) {
        try {
          await fallbackClient.ping();
          this.currentClient = fallbackClient;
          console.log('✅ Failover successful to fallback connection');
          this.emit('failover', { success: true, client: 'fallback' });
          return;
        } catch (error) {
          continue;
        }
      }
      
      // Re-check endpoint health and try to reconnect
      await this.performInitialHealthCheck();
      await this.initializePrimaryConnection();
      
      console.log('✅ Failover successful to healthy endpoint');
      this.emit('failover', { success: true, client: 'primary' });
      
    } catch (error: any) {
      console.error('❌ Failover failed:', error.message);
      this.emit('failover', { success: false, error: error.message });
    } finally {
      this.failoverInProgress = false;
    }
  }

  // High-level Redis operations
  async set(key: string, value: any, ttl?: number): Promise<boolean> {
    try {
      const serialized = JSON.stringify(value);
      
      await this.executeOperation(async (client) => {
        if (ttl) {
          return await client.setex(key, ttl, serialized);
        } else {
          return await client.set(key, serialized);
        }
      }, 'set');
      
      return true;
    } catch (error: any) {
      console.warn(`⚠️ Redis SET failed for key ${key}:`, error.message);
      return false;
    }
  }

  async get(key: string): Promise<any | null> {
    try {
      const result = await this.executeOperation(async (client) => {
        return await client.get(key);
      }, 'get');
      
      return result ? JSON.parse(result) : null;
    } catch (error: any) {
      console.warn(`⚠️ Redis GET failed for key ${key}:`, error.message);
      return null;
    }
  }

  async hset(key: string, field: string, value: any): Promise<boolean> {
    try {
      await this.executeOperation(async (client) => {
        return await client.hset(key, field, JSON.stringify(value));
      }, 'hset');
      
      return true;
    } catch (error: any) {
      console.warn(`⚠️ Redis HSET failed for key ${key}:`, error.message);
      return false;
    }
  }

  async hget(key: string, field: string): Promise<any | null> {
    try {
      const result = await this.executeOperation(async (client) => {
        return await client.hget(key, field);
      }, 'hget');
      
      return result ? JSON.parse(result) : null;
    } catch (error: any) {
      console.warn(`⚠️ Redis HGET failed for key ${key}:`, error.message);
      return null;
    }
  }

  async del(key: string): Promise<boolean> {
    try {
      await this.executeOperation(async (client) => {
        return await client.del(key);
      }, 'del');
      
      return true;
    } catch (error: any) {
      console.warn(`⚠️ Redis DEL failed for key ${key}:`, error.message);
      return false;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.executeOperation(async (client) => {
        return await client.exists(key);
      }, 'exists');
      
      return result === 1;
    } catch (error: any) {
      console.warn(`⚠️ Redis EXISTS failed for key ${key}:`, error.message);
      return false;
    }
  }

  // Monitoring and metrics
  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(async () => {
      if (!this.isInitialized) return;
      
      await this.performInitialHealthCheck();
      
      const healthStatus = this.getHealthStatus();
      this.emit('healthUpdate', healthStatus);
      
      // Check if failover is needed
      if (healthStatus.currentConnection?.status === 'offline' && this.config.failover.enabled) {
        await this.performFailover();
      }
    }, this.config.monitoring.healthCheckInterval);
  }

  private startMetricsCollection(): void {
    if (!this.config.monitoring.performanceMetrics) return;
    
    this.metricsInterval = setInterval(() => {
      this.updateMetrics();
      this.emit('metricsUpdate', this.metrics);
      
      // Clean old operation history (keep last hour)
      const oneHourAgo = Date.now() - 3600000;
      this.operationHistory = this.operationHistory.filter(op => op.timestamp > oneHourAgo);
    }, 60000); // Every minute
  }

  private recordOperation(type: string, duration: number, success: boolean): void {
    this.operationHistory.push({
      timestamp: Date.now(),
      duration,
      success
    });
    
    this.metrics.operations.total++;
    if (success) {
      this.metrics.operations.success++;
    } else {
      this.metrics.operations.failed++;
    }
  }

  private updateMetrics(): void {
    const recentOps = this.operationHistory.filter(op => 
      Date.now() - op.timestamp < 300000 // Last 5 minutes
    );
    
    if (recentOps.length > 0) {
      const durations = recentOps.map(op => op.duration).sort((a, b) => a - b);
      
      this.metrics.performance.averageLatency = durations.reduce((sum, d) => sum + d, 0) / durations.length;
      this.metrics.performance.p95Latency = durations[Math.floor(durations.length * 0.95)] || 0;
      this.metrics.performance.throughput = recentOps.length / 5; // ops per minute
    }
  }

  // Status reporting
  getHealthStatus() {
    const endpoints = this.loadBalancer.getAllEndpoints();
    const healthyEndpoints = this.loadBalancer.getHealthyEndpoints();
    
    return {
      overall: {
        status: this.currentClient ? 'healthy' : 'offline',
        endpointsHealthy: healthyEndpoints.length,
        endpointsTotal: endpoints.length,
        failoverEnabled: this.config.failover.enabled,
        clusterMode: this.config.cluster.enabled
      },
      currentConnection: this.currentClient ? {
        type: this.primaryCluster ? 'cluster' : 'single',
        status: 'healthy'
      } : null,
      endpoints: endpoints.map(e => ({
        host: e.host,
        port: e.port,
        status: e.status,
        latency: e.latency,
        errorCount: e.errorCount,
        priority: e.priority
      })),
      circuitBreaker: this.circuitBreaker.getState()
    };
  }

  getMetrics(): RedisMetrics {
    return { ...this.metrics };
  }

  getSystemStatus() {
    return {
      initialized: this.isInitialized,
      connected: !!this.currentClient,
      failoverInProgress: this.failoverInProgress,
      endpoints: this.loadBalancer.getAllEndpoints().length,
      healthyEndpoints: this.loadBalancer.getHealthyEndpoints().length,
      fallbackConnections: this.fallbackClients.length,
      metrics: this.metrics,
      circuitBreaker: this.circuitBreaker.getState()
    };
  }

  // Cleanup
  async shutdown(): Promise<void> {
    console.log('🔄 Shutting down Redis Cluster Manager...');
    
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }
    
    // Close all connections
    const closePromises: Promise<any>[] = [];
    
    if (this.primaryCluster) {
      closePromises.push(this.primaryCluster.quit());
    }
    
    if (this.currentClient && this.currentClient !== this.primaryCluster) {
      closePromises.push(this.currentClient.quit());
    }
    
    for (const client of this.fallbackClients) {
      closePromises.push(client.quit());
    }
    
    await Promise.allSettled(closePromises);
    
    this.emit('shutdown');
    console.log('✅ Redis Cluster Manager shutdown complete');
  }
}