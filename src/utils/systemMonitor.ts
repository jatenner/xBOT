import { supabaseClient } from './supabaseClient';
import { emergencyBudgetLockdown } from './emergencyBudgetLockdown';

export interface SystemMetrics {
  timestamp: Date;
  performance: {
    agentResponseTimes: Record<string, number>;
    memoryUsage: number;
    cpuUsage: number;
    databaseLatency: number;
    apiCallSuccess: number;
  };
  business: {
    postsToday: number;
    dailyFollowerGrowth: number;
    engagementRate: number;
    f1kMetric: number; // Followers per 1K impressions
    budgetUtilization: number;
  };
  health: {
    agentAvailability: Record<string, boolean>;
    errorRates: Record<string, number>;
    systemUptime: number;
    learningSystemHealth: number;
  };
  alerts: SystemAlert[];
}

export interface SystemAlert {
  id: string;
  level: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  component: string;
  timestamp: Date;
  resolved?: boolean;
  resolvedAt?: Date;
}

export interface PerformanceThresholds {
  agentResponseTime: number; // ms
  memoryUsage: number; // MB
  errorRate: number; // %
  budgetUtilization: number; // %
  minimumF1K: number; // followers per 1K impressions
}

/**
 * 📊 COMPREHENSIVE SYSTEM MONITOR
 * 
 * Real-time monitoring and alerting system for the xBOT infrastructure.
 * Tracks performance, business metrics, and system health.
 */
export class SystemMonitor {
  private metrics: SystemMetrics[] = [];
  private alerts: SystemAlert[] = [];
  private isMonitoring = false;
  private monitoringInterval: NodeJS.Timeout | null = null;
  
  private readonly thresholds: PerformanceThresholds = {
    agentResponseTime: 5000, // 5 seconds
    memoryUsage: 512, // 512 MB
    errorRate: 5, // 5%
    budgetUtilization: 90, // 90%
    minimumF1K: 2 // 2 followers per 1K impressions
  };

  private agentPerformance: Map<string, {
    totalCalls: number;
    successfulCalls: number;
    totalResponseTime: number;
    lastCall: Date;
  }> = new Map();

  constructor() {
    this.initializeMonitoring();
  }

  /**
   * 🚀 START MONITORING
   */
  async startMonitoring(intervalMs: number = 60000): Promise<void> {
    if (this.isMonitoring) {
      console.log('⚠️ SystemMonitor: Already monitoring');
      return;
    }

    console.log('📊 SystemMonitor: Starting comprehensive monitoring...');
    this.isMonitoring = true;
    
    // Immediate metrics collection
    await this.collectMetrics();
    
    // Set up interval monitoring
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.collectMetrics();
        await this.checkAlerts();
        await this.pruneOldData();
      } catch (error) {
        console.error('❌ SystemMonitor: Error during monitoring cycle:', error);
        this.addAlert('error', 'SystemMonitor', 'Monitoring cycle failed', error.message);
      }
    }, intervalMs);

    console.log(`✅ SystemMonitor: Active (${intervalMs}ms intervals)`);
  }

  /**
   * 📊 COLLECT COMPREHENSIVE METRICS
   */
  private async collectMetrics(): Promise<void> {
    const startTime = Date.now();

    try {
      // Collect all metrics in parallel for efficiency
      const [
        agentMetrics,
        businessMetrics,
        healthMetrics
      ] = await Promise.allSettled([
        this.collectAgentMetrics(),
        this.collectBusinessMetrics(),
        this.collectHealthMetrics()
      ]);

      const performance = agentMetrics.status === 'fulfilled' ? agentMetrics.value : {
        agentResponseTimes: {},
        memoryUsage: 0,
        cpuUsage: 0,
        databaseLatency: 0,
        apiCallSuccess: 0
      };

      const business = businessMetrics.status === 'fulfilled' ? businessMetrics.value : {
        postsToday: 0,
        dailyFollowerGrowth: 0,
        engagementRate: 0,
        f1kMetric: 0,
        budgetUtilization: 0
      };

      const health = healthMetrics.status === 'fulfilled' ? healthMetrics.value : {
        agentAvailability: {},
        errorRates: {},
        systemUptime: 0,
        learningSystemHealth: 0
      };

      const metrics: SystemMetrics = {
        timestamp: new Date(),
        performance,
        business,
        health,
        alerts: [...this.alerts].slice(-10) // Last 10 alerts
      };

      this.metrics.push(metrics);
      console.log(`📊 Metrics collected in ${Date.now() - startTime}ms`);

      // Store in database for persistence (async, non-blocking)
      this.storeMetricsAsync(metrics).catch(error => {
        console.warn('⚠️ Failed to store metrics in database:', error);
      });

    } catch (error) {
      console.error('❌ SystemMonitor: Failed to collect metrics:', error);
      this.addAlert('error', 'SystemMonitor', 'Metrics collection failed', error.message);
    }
  }

  /**
   * 🎯 COLLECT AGENT PERFORMANCE METRICS
   */
  private async collectAgentMetrics(): Promise<SystemMetrics['performance']> {
    const memoryUsage = process.memoryUsage();
    const heapUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);

    // Test database latency
    const dbStart = Date.now();
    try {
      await supabaseClient.supabase?.from('bot_config').select('key').limit(1);
    } catch (error) {
      // Database error handled separately
    }
    const databaseLatency = Date.now() - dbStart;

    // Calculate agent response times from performance tracking
    const agentResponseTimes: Record<string, number> = {};
    this.agentPerformance.forEach((perf, agent) => {
      if (perf.totalCalls > 0) {
        agentResponseTimes[agent] = Math.round(perf.totalResponseTime / perf.totalCalls);
      }
    });

    // Calculate overall API success rate
    let totalCalls = 0;
    let successfulCalls = 0;
    this.agentPerformance.forEach(perf => {
      totalCalls += perf.totalCalls;
      successfulCalls += perf.successfulCalls;
    });
    const apiCallSuccess = totalCalls > 0 ? Math.round((successfulCalls / totalCalls) * 100) : 100;

    return {
      agentResponseTimes,
      memoryUsage: heapUsedMB,
      cpuUsage: 0, // TODO: Implement CPU monitoring
      databaseLatency,
      apiCallSuccess
    };
  }

  /**
   * 📈 COLLECT BUSINESS METRICS
   */
  private async collectBusinessMetrics(): Promise<SystemMetrics['business']> {
    const today = new Date().toISOString().split('T')[0];

    try {
      // Get today's posts
      const { data: posts } = await supabaseClient.supabase
        ?.from('tweets')
        .select('likes, retweets, replies, impressions, new_followers')
        .gte('created_at', today)
        .order('created_at', { ascending: false }) || { data: [] };

      const postsToday = posts?.length || 0;
      
             if (posts && posts.length > 0) {
         // Calculate engagement metrics
         let totalEngagement = 0;
         let totalImpressions = 0;
         let totalFollowers = 0;
         
         posts.forEach((post: any) => {
           totalEngagement += (post.likes || 0) + (post.retweets || 0) + (post.replies || 0);
           totalImpressions += (post.impressions || 1000);
           totalFollowers += (post.new_followers || 0);
         });
        
        const engagementRate = totalImpressions > 0 ? (totalEngagement / totalImpressions) * 100 : 0;
        const f1kMetric = totalImpressions > 0 ? (totalFollowers * 1000) / totalImpressions : 0;

        // Get budget utilization
        const budgetStatus = await emergencyBudgetLockdown.getStatusReport();
        const budgetUtilization = budgetStatus.includes('$') ? 
          this.extractBudgetUtilization(budgetStatus) : 0;

        return {
          postsToday,
          dailyFollowerGrowth: totalFollowers,
          engagementRate: Math.round(engagementRate * 100) / 100,
          f1kMetric: Math.round(f1kMetric * 100) / 100,
          budgetUtilization
        };
      }

      return {
        postsToday: 0,
        dailyFollowerGrowth: 0,
        engagementRate: 0,
        f1kMetric: 0,
        budgetUtilization: 0
      };

    } catch (error) {
      console.warn('⚠️ Failed to collect business metrics:', error);
      return {
        postsToday: 0,
        dailyFollowerGrowth: 0,
        engagementRate: 0,
        f1kMetric: 0,
        budgetUtilization: 0
      };
    }
  }

  /**
   * 🩺 COLLECT HEALTH METRICS
   */
  private async collectHealthMetrics(): Promise<SystemMetrics['health']> {
    // Agent availability check
    const agentAvailability: Record<string, boolean> = {};
    const criticalAgents = [
      'ContentGenerationHub',
      'FollowerGrowthLearner',
      'StreamlinedPostAgent',
      'LegendaryAICoordinator'
    ];

    criticalAgents.forEach(agent => {
      agentAvailability[agent] = true; // TODO: Implement actual health checks
    });

    // Error rates calculation
    const errorRates: Record<string, number> = {};
    this.agentPerformance.forEach((perf, agent) => {
      if (perf.totalCalls > 0) {
        errorRates[agent] = Math.round(((perf.totalCalls - perf.successfulCalls) / perf.totalCalls) * 100);
      }
    });

    // System uptime (since monitoring started)
    const uptime = this.isMonitoring ? Date.now() - (this.metrics[0]?.timestamp.getTime() || Date.now()) : 0;
    const systemUptime = Math.round(uptime / 1000 / 60); // minutes

    // Learning system health
    const learningSystemHealth = await this.checkLearningSystemHealth();

    return {
      agentAvailability,
      errorRates,
      systemUptime,
      learningSystemHealth
    };
  }

  /**
   * 🚨 CHECK AND GENERATE ALERTS
   */
  private async checkAlerts(): Promise<void> {
    if (this.metrics.length === 0) return;

    const latest = this.metrics[this.metrics.length - 1];

    // Check performance thresholds
    Object.entries(latest.performance.agentResponseTimes).forEach(([agent, responseTime]) => {
      if (responseTime > this.thresholds.agentResponseTime) {
        this.addAlert('warning', agent, 'High response time', `${responseTime}ms (threshold: ${this.thresholds.agentResponseTime}ms)`);
      }
    });

    // Check memory usage
    if (latest.performance.memoryUsage > this.thresholds.memoryUsage) {
      this.addAlert('warning', 'System', 'High memory usage', `${latest.performance.memoryUsage}MB (threshold: ${this.thresholds.memoryUsage}MB)`);
    }

    // Check error rates
    Object.entries(latest.health.errorRates).forEach(([agent, errorRate]) => {
      if (errorRate > this.thresholds.errorRate) {
        this.addAlert('error', agent, 'High error rate', `${errorRate}% (threshold: ${this.thresholds.errorRate}%)`);
      }
    });

    // Check business metrics
    if (latest.business.f1kMetric < this.thresholds.minimumF1K && latest.business.postsToday > 0) {
      this.addAlert('warning', 'Business', 'Low follower growth', `F/1K: ${latest.business.f1kMetric} (threshold: ${this.thresholds.minimumF1K})`);
    }

    if (latest.business.budgetUtilization > this.thresholds.budgetUtilization) {
      this.addAlert('critical', 'Budget', 'High budget utilization', `${latest.business.budgetUtilization}% (threshold: ${this.thresholds.budgetUtilization}%)`);
    }
  }

  /**
   * 📊 PUBLIC MONITORING METHODS
   */
  
  // Track agent performance
  trackAgentCall(agentName: string, responseTime: number, success: boolean): void {
    const current = this.agentPerformance.get(agentName) || {
      totalCalls: 0,
      successfulCalls: 0,
      totalResponseTime: 0,
      lastCall: new Date()
    };

    current.totalCalls++;
    current.totalResponseTime += responseTime;
    current.lastCall = new Date();
    
    if (success) {
      current.successfulCalls++;
    }

    this.agentPerformance.set(agentName, current);
  }

  // Add custom alert
  addAlert(level: SystemAlert['level'], component: string, message: string, details?: string): void {
    const alert: SystemAlert = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      level,
      component,
      message: details ? `${message}: ${details}` : message,
      timestamp: new Date()
    };

    this.alerts.push(alert);
    console.log(`🚨 [${level.toUpperCase()}] ${component}: ${alert.message}`);

    // Keep only last 100 alerts
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(-100);
    }
  }

  // Get current metrics
  getCurrentMetrics(): SystemMetrics | null {
    return this.metrics.length > 0 ? this.metrics[this.metrics.length - 1] : null;
  }

  // Get metrics history
  getMetricsHistory(hours: number = 24): SystemMetrics[] {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    return this.metrics.filter(m => m.timestamp >= cutoff);
  }

  // Get active alerts
  getActiveAlerts(): SystemAlert[] {
    return this.alerts.filter(alert => !alert.resolved);
  }

  // Get system health score (0-100)
  getSystemHealthScore(): number {
    const latest = this.getCurrentMetrics();
    if (!latest) return 0;

    let score = 100;

    // Performance penalties
    if (latest.performance.memoryUsage > this.thresholds.memoryUsage) score -= 20;
    if (latest.performance.apiCallSuccess < 95) score -= 15;
    if (latest.performance.databaseLatency > 1000) score -= 10;

    // Business penalties
    if (latest.business.f1kMetric < this.thresholds.minimumF1K) score -= 20;
    if (latest.business.budgetUtilization > this.thresholds.budgetUtilization) score -= 15;

    // Health penalties
    const avgErrorRate = Object.values(latest.health.errorRates).reduce((sum, rate) => sum + rate, 0) / 
                         Math.max(Object.values(latest.health.errorRates).length, 1);
    if (avgErrorRate > this.thresholds.errorRate) score -= 20;

    return Math.max(0, score);
  }

  /**
   * 🔧 PRIVATE HELPER METHODS
   */
  
  private initializeMonitoring(): void {
    console.log('📊 SystemMonitor: Initialized with thresholds:', this.thresholds);
  }

  private async checkLearningSystemHealth(): Promise<number> {
    try {
      // Check if learning system is active
      const { data: learningConfig } = await supabaseClient.supabase
        ?.from('bot_config')
        .select('value')
        .eq('key', 'learning_enabled')
        .single() || { data: null };

      if (!learningConfig?.value?.enabled) return 0;

      // Check recent learning activity
      const recentLearning = await supabaseClient.supabase
        ?.from('bot_config')
        .select('updated_at')
        .like('key', '%learning%')
        .gte('updated_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      return recentLearning?.data?.length > 0 ? 100 : 50;
    } catch (error) {
      return 0;
    }
  }

  private extractBudgetUtilization(budgetStatus: string): number {
    const match = budgetStatus.match(/\$(\d+\.?\d*)/);
    if (match) {
      const spent = parseFloat(match[1]);
      return Math.round((spent / 3.00) * 100); // $3.00 daily limit
    }
    return 0;
  }

  private async storeMetricsAsync(metrics: SystemMetrics): Promise<void> {
    try {
      await supabaseClient.supabase?.from('system_metrics').insert({
        timestamp: metrics.timestamp.toISOString(),
        metrics_data: metrics,
        health_score: this.getSystemHealthScore()
      });
    } catch (error) {
      // Non-blocking - metrics storage failure shouldn't stop monitoring
      console.warn('⚠️ Failed to store metrics:', error);
    }
  }

  private pruneOldData(): void {
    // Keep only last 24 hours of metrics
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    this.metrics = this.metrics.filter(m => m.timestamp >= cutoff);
    
    // Keep only last 24 hours of alerts
    this.alerts = this.alerts.filter(a => a.timestamp >= cutoff);
  }

  /**
   * 🛑 STOP MONITORING
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.isMonitoring = false;
    console.log('📊 SystemMonitor: Stopped');
  }
}

// Export singleton instance
export const systemMonitor = new SystemMonitor(); 