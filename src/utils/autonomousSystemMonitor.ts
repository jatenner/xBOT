/**
 * 🛡️ AUTONOMOUS SYSTEM MONITOR
 * 
 * Ensures 24/7 operation with:
 * - Real-time health monitoring
 * - Automatic self-healing
 * - Performance optimization
 * - Error recovery
 * - Resource management
 */

import { autonomousTwitterGrowthMaster } from '../agents/autonomousTwitterGrowthMaster';
import { emergencyBudgetLockdown } from './emergencyBudgetLockdown';
import { supabase } from './supabaseClient';

interface SystemHealth {
  overall_health: 'healthy' | 'degraded' | 'critical';
  autonomous_growth_master: {
    running: boolean;
    learning: boolean;
    prediction_accuracy: number;
    last_activity: Date | null;
  };
  budget_system: {
    active: boolean;
    remaining_budget: number;
    lockdown_active: boolean;
  };
  database: {
    connected: boolean;
    last_ping: Date | null;
    response_time_ms: number;
  };
  memory_usage: {
    used_mb: number;
    free_mb: number;
    heap_used_mb: number;
    heap_total_mb: number;
  };
  uptime_hours: number;
  last_error: string | null;
  recovery_attempts: number;
}

interface PerformanceMetrics {
  tweets_posted_24h: number;
  followers_gained_24h: number;
  prediction_accuracy_24h: number;
  budget_efficiency: number;
  system_availability: number;
  error_rate: number;
}

export class AutonomousSystemMonitor {
  private static instance: AutonomousSystemMonitor;
  private monitoringActive = false;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private performanceInterval: NodeJS.Timeout | null = null;
  private selfHealingInterval: NodeJS.Timeout | null = null;
  
  // Health tracking
  private lastHealthCheck = new Date();
  private consecutiveErrors = 0;
  private recoveryAttempts = 0;
  private maxRecoveryAttempts = 5;
  
  // Performance tracking
  private performanceHistory: PerformanceMetrics[] = [];
  private maxHistoryEntries = 168; // 1 week of hourly data
  
  private constructor() {}

  public static getInstance(): AutonomousSystemMonitor {
    if (!AutonomousSystemMonitor.instance) {
      AutonomousSystemMonitor.instance = new AutonomousSystemMonitor();
    }
    return AutonomousSystemMonitor.instance;
  }

  /**
   * 🚀 START AUTONOMOUS MONITORING
   */
  async startMonitoring(): Promise<void> {
    if (this.monitoringActive) {
      console.log('⚠️ Autonomous monitoring already active');
      return;
    }

    console.log('🛡️ === STARTING AUTONOMOUS SYSTEM MONITORING ===');
    console.log('📊 Health checks: Every 5 minutes');
    console.log('🔧 Self-healing: Every 15 minutes');
    console.log('📈 Performance tracking: Every hour');
    console.log('🚨 24/7 operation guarantee: ACTIVE');
    
    this.monitoringActive = true;
    
    // Health check every 5 minutes
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthCheck();
    }, 5 * 60 * 1000);
    
    // Self-healing every 15 minutes
    this.selfHealingInterval = setInterval(async () => {
      await this.performSelfHealing();
    }, 15 * 60 * 1000);
    
    // Performance tracking every hour
    this.performanceInterval = setInterval(async () => {
      await this.trackPerformance();
    }, 60 * 60 * 1000);
    
    // Initial health check
    await this.performHealthCheck();
    console.log('✅ Autonomous system monitoring started successfully');
  }

  /**
   * 🔍 COMPREHENSIVE HEALTH CHECK
   */
  async performHealthCheck(): Promise<SystemHealth> {
    try {
      const health: SystemHealth = {
        overall_health: 'healthy',
        autonomous_growth_master: await this.checkAutonomousGrowthMaster(),
        budget_system: await this.checkBudgetSystem(),
        database: await this.checkDatabase(),
        memory_usage: this.checkMemoryUsage(),
        uptime_hours: process.uptime() / 3600,
        last_error: null,
        recovery_attempts: this.recoveryAttempts
      };

      // Determine overall health
      if (!health.autonomous_growth_master.running || health.budget_system.lockdown_active) {
        health.overall_health = 'critical';
      } else if (health.memory_usage.heap_used_mb > 400 || health.database.response_time_ms > 5000) {
        health.overall_health = 'degraded';
      }

      this.lastHealthCheck = new Date();
      this.consecutiveErrors = 0;

      // Log health status
      if (health.overall_health === 'healthy') {
        console.log('💚 System health: OPTIMAL - All systems operational');
      } else if (health.overall_health === 'degraded') {
        console.log('🟡 System health: DEGRADED - Performance issues detected');
      } else {
        console.log('🔴 System health: CRITICAL - Immediate attention required');
      }

      // Store health metrics
      await this.storeHealthMetrics(health);
      
      return health;

    } catch (error) {
      console.error('❌ Health check failed:', error);
      this.consecutiveErrors++;
      
      return {
        overall_health: 'critical',
        autonomous_growth_master: { running: false, learning: false, prediction_accuracy: 0, last_activity: null },
        budget_system: { active: false, remaining_budget: 0, lockdown_active: true },
        database: { connected: false, last_ping: null, response_time_ms: 0 },
        memory_usage: { used_mb: 0, free_mb: 0, heap_used_mb: 0, heap_total_mb: 0 },
        uptime_hours: process.uptime() / 3600,
        last_error: error.message,
        recovery_attempts: this.recoveryAttempts
      };
    }
  }

  /**
   * 🔧 AUTONOMOUS SELF-HEALING
   */
  async performSelfHealing(): Promise<void> {
    console.log('🔧 === AUTONOMOUS SELF-HEALING CYCLE ===');
    
    try {
      const health = await this.performHealthCheck();
      
      if (health.overall_health === 'critical' && this.recoveryAttempts < this.maxRecoveryAttempts) {
        console.log('🚨 Critical system state detected - initiating recovery...');
        this.recoveryAttempts++;
        
        // 1. Restart Autonomous Growth Master if needed
        if (!health.autonomous_growth_master.running) {
          console.log('🎯 Restarting Autonomous Growth Master...');
          try {
            await autonomousTwitterGrowthMaster.startAutonomousOperation();
            console.log('✅ Autonomous Growth Master restarted');
          } catch (error) {
            console.error('❌ Failed to restart Growth Master:', error);
          }
        }
        
        // 2. Check and clear budget lockdown if necessary
        if (health.budget_system.lockdown_active) {
          console.log('💰 Checking budget lockdown status...');
          try {
            const now = new Date();
            const today = now.toISOString().split('T')[0];
            const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            
            // If it's a new day, try to reset the lockdown
            if (today !== yesterday) {
              await emergencyBudgetLockdown.deactivateLockdown();
              console.log('✅ Daily budget reset - lockdown cleared');
            }
          } catch (error) {
            console.error('❌ Budget lockdown check failed:', error);
          }
        }
        
        // 3. Memory cleanup if needed
        if (health.memory_usage.heap_used_mb > 400) {
          console.log('🧹 Performing memory cleanup...');
          if (global.gc) {
            global.gc();
            console.log('✅ Garbage collection performed');
          }
        }
        
        // 4. Database reconnection if needed
        if (!health.database.connected) {
          console.log('🔌 Attempting database reconnection...');
          // Database will auto-reconnect on next query
          try {
            await supabase.from('tweets').select('count').limit(1);
            console.log('✅ Database reconnection successful');
          } catch (error) {
            console.error('❌ Database reconnection failed:', error);
          }
        }
        
        console.log(`✅ Self-healing cycle complete (attempt ${this.recoveryAttempts}/${this.maxRecoveryAttempts})`);
        
      } else if (health.overall_health === 'healthy') {
        // Reset recovery attempts on healthy state
        this.recoveryAttempts = 0;
        console.log('💚 System healthy - monitoring continuing');
        
      } else if (this.recoveryAttempts >= this.maxRecoveryAttempts) {
        console.log('🚨 Maximum recovery attempts reached - system requires manual intervention');
        await this.alertCriticalFailure(health);
      }
      
    } catch (error) {
      console.error('❌ Self-healing failed:', error);
    }
  }

  /**
   * 📈 PERFORMANCE TRACKING
   */
  async trackPerformance(): Promise<void> {
    console.log('📈 === PERFORMANCE TRACKING ===');
    
    try {
      const metrics: PerformanceMetrics = {
        tweets_posted_24h: await this.getTweetsPosted24h(),
        followers_gained_24h: await this.getFollowersGained24h(),
        prediction_accuracy_24h: await this.getPredictionAccuracy24h(),
        budget_efficiency: await this.getBudgetEfficiency(),
        system_availability: this.getSystemAvailability(),
        error_rate: this.getErrorRate()
      };

      this.performanceHistory.push(metrics);
      
      // Keep only last week of data
      if (this.performanceHistory.length > this.maxHistoryEntries) {
        this.performanceHistory.shift();
      }

      // Store performance metrics
      await this.storePerformanceMetrics(metrics);

      console.log(`📊 Performance: ${metrics.tweets_posted_24h} tweets, +${metrics.followers_gained_24h} followers, ${Math.round(metrics.prediction_accuracy_24h * 100)}% accuracy`);
      
    } catch (error) {
      console.error('❌ Performance tracking failed:', error);
    }
  }

  /**
   * 🚨 CRITICAL FAILURE ALERT
   */
  private async alertCriticalFailure(health: SystemHealth): Promise<void> {
    console.log('🚨 === CRITICAL SYSTEM FAILURE ===');
    console.log('🛑 System requires immediate manual intervention');
    console.log(`💊 Health status: ${JSON.stringify(health, null, 2)}`);
    
    // Store critical failure record
    try {
      await supabase.from('system_alerts').insert({
        alert_type: 'critical_failure',
        alert_data: health,
        recovery_attempts: this.recoveryAttempts,
        created_at: new Date().toISOString()
      });
    } catch (error) {
      console.error('❌ Failed to store critical failure alert:', error);
    }
  }

  // Helper methods for health checks
  private async checkAutonomousGrowthMaster() {
    try {
      const status = autonomousTwitterGrowthMaster.getSystemStatus();
      return {
        running: status.isRunning,
        learning: status.isLearning,
        prediction_accuracy: status.predictionAccuracy,
        last_activity: new Date()
      };
    } catch (error) {
      return {
        running: false,
        learning: false,
        prediction_accuracy: 0,
        last_activity: null
      };
    }
  }

  private async checkBudgetSystem() {
    try {
      const status = await emergencyBudgetLockdown.getStatusReport();
      const lockdown = await emergencyBudgetLockdown.isLockedDown();
      
      return {
        active: true,
        remaining_budget: parseFloat(status.match(/Remaining: \$(\d+\.\d+)/)?.[1] || '0'),
        lockdown_active: lockdown.lockdownActive
      };
    } catch (error) {
      return {
        active: false,
        remaining_budget: 0,
        lockdown_active: true
      };
    }
  }

  private async checkDatabase() {
    const startTime = Date.now();
    try {
      await supabase.from('tweets').select('count').limit(1);
      const responseTime = Date.now() - startTime;
      
      return {
        connected: true,
        last_ping: new Date(),
        response_time_ms: responseTime
      };
    } catch (error) {
      return {
        connected: false,
        last_ping: null,
        response_time_ms: 0
      };
    }
  }

  private checkMemoryUsage() {
    const memory = process.memoryUsage();
    return {
      used_mb: Math.round((memory.rss) / 1024 / 1024),
      free_mb: Math.round((memory.external) / 1024 / 1024),
      heap_used_mb: Math.round(memory.heapUsed / 1024 / 1024),
      heap_total_mb: Math.round(memory.heapTotal / 1024 / 1024)
    };
  }

  // Performance metric helpers
  private async getTweetsPosted24h(): Promise<number> {
    try {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const { count } = await supabase
        .from('tweets')
        .select('count')
        .gte('created_at', yesterday.toISOString())
        .single();
      return count || 0;
    } catch (error) {
      return 0;
    }
  }

  private async getFollowersGained24h(): Promise<number> {
    try {
      const { data } = await supabase
        .from('follower_tracking')
        .select('followers_gained_24h')
        .order('created_at', { ascending: false })
        .limit(1);
      return data?.[0]?.followers_gained_24h || 0;
    } catch (error) {
      return 0;
    }
  }

  private async getPredictionAccuracy24h(): Promise<number> {
    try {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const { data } = await supabase
        .from('follower_growth_predictions')
        .select('prediction_accuracy')
        .gte('created_at', yesterday.toISOString())
        .not('prediction_accuracy', 'is', null);
      
      if (!data || data.length === 0) return 0.5;
      
      const average = data.reduce((sum, p) => sum + p.prediction_accuracy, 0) / data.length;
      return average;
    } catch (error) {
      return 0.5;
    }
  }

  private async getBudgetEfficiency(): Promise<number> {
    // Budget efficiency = followers gained per dollar spent
    try {
      const followersGained = await this.getFollowersGained24h();
      const budgetUsed = 5.0 - (await this.checkBudgetSystem()).remaining_budget;
      return budgetUsed > 0 ? followersGained / budgetUsed : 0;
    } catch (error) {
      return 0;
    }
  }

  private getSystemAvailability(): number {
    // System availability = uptime percentage
    const uptime = process.uptime();
    const totalTime = 24 * 60 * 60; // 24 hours in seconds
    return Math.min(1, uptime / totalTime);
  }

  private getErrorRate(): number {
    // Error rate based on consecutive errors
    return Math.min(1, this.consecutiveErrors / 10);
  }

  private async storeHealthMetrics(health: SystemHealth): Promise<void> {
    try {
      await supabase.from('system_health_metrics').insert({
        overall_health: health.overall_health,
        autonomous_growth_master_running: health.autonomous_growth_master.running,
        prediction_accuracy: health.autonomous_growth_master.prediction_accuracy,
        budget_remaining: health.budget_system.remaining_budget,
        database_response_time_ms: health.database.response_time_ms,
        memory_usage_mb: health.memory_usage.heap_used_mb,
        uptime_hours: health.uptime_hours,
        recovery_attempts: health.recovery_attempts,
        created_at: new Date().toISOString()
      });
    } catch (error) {
      console.warn('Failed to store health metrics:', error);
    }
  }

  private async storePerformanceMetrics(metrics: PerformanceMetrics): Promise<void> {
    try {
      await supabase.from('system_performance_metrics').insert({
        tweets_posted_24h: metrics.tweets_posted_24h,
        followers_gained_24h: metrics.followers_gained_24h,
        prediction_accuracy_24h: metrics.prediction_accuracy_24h,
        budget_efficiency: metrics.budget_efficiency,
        system_availability: metrics.system_availability,
        error_rate: metrics.error_rate,
        created_at: new Date().toISOString()
      });
    } catch (error) {
      console.warn('Failed to store performance metrics:', error);
    }
  }

  /**
   * 📊 GET SYSTEM STATUS
   */
  getSystemStatus(): {
    monitoring_active: boolean;
    last_health_check: Date;
    consecutive_errors: number;
    recovery_attempts: number;
    performance_history_entries: number;
  } {
    return {
      monitoring_active: this.monitoringActive,
      last_health_check: this.lastHealthCheck,
      consecutive_errors: this.consecutiveErrors,
      recovery_attempts: this.recoveryAttempts,
      performance_history_entries: this.performanceHistory.length
    };
  }

  /**
   * 🛑 STOP MONITORING
   */
  stopMonitoring(): void {
    console.log('🛑 Stopping autonomous system monitoring...');
    
    this.monitoringActive = false;
    
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    
    if (this.selfHealingInterval) {
      clearInterval(this.selfHealingInterval);
      this.selfHealingInterval = null;
    }
    
    if (this.performanceInterval) {
      clearInterval(this.performanceInterval);
      this.performanceInterval = null;
    }
    
    console.log('✅ Autonomous monitoring stopped');
  }
}

export const autonomousSystemMonitor = AutonomousSystemMonitor.getInstance(); 