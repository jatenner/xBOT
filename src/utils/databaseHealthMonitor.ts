/**
 * 🔍 DATABASE HEALTH MONITOR
 * ==========================
 * Monitors both Supabase and Redis connections in real-time
 * Automatically switches between databases based on availability
 * Provides alerts when databases are down
 */

import { supabaseClient } from './supabaseClient';

interface DatabaseStatus {
  supabase: {
    available: boolean;
    latency: number | null;
    lastChecked: Date;
    error?: string;
  };
  redis: {
    available: boolean;
    latency: number | null;
    lastChecked: Date;
    error?: string;
  };
  mode: 'dual' | 'supabase_only' | 'redis_only' | 'offline';
}

export class DatabaseHealthMonitor {
  private static instance: DatabaseHealthMonitor;
  private status: DatabaseStatus;
  private monitorInterval: NodeJS.Timeout | null = null;
  private alertThreshold = 3; // Alert after 3 consecutive failures
  private consecutiveFailures = { supabase: 0, redis: 0 };

  private constructor() {
    this.status = {
      supabase: { available: false, latency: null, lastChecked: new Date() },
      redis: { available: false, latency: null, lastChecked: new Date() },
      mode: 'offline'
    };
  }

  static getInstance(): DatabaseHealthMonitor {
    if (!DatabaseHealthMonitor.instance) {
      DatabaseHealthMonitor.instance = new DatabaseHealthMonitor();
    }
    return DatabaseHealthMonitor.instance;
  }

  /**
   * 🚀 Start continuous health monitoring
   */
  startMonitoring(intervalMs: number = 30000): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
    }

    console.log('🔍 Starting database health monitoring...');
    
    // Initial check
    this.performHealthCheck();

    // Schedule regular checks
    this.monitorInterval = setInterval(() => {
      this.performHealthCheck();
    }, intervalMs);
  }

  /**
   * 🩺 Perform comprehensive health check
   */
  private async performHealthCheck(): Promise<void> {
    console.log('🩺 Performing database health check...');

    // Check Supabase
    await this.checkSupabase();
    
    // Check Redis
    await this.checkRedis();

    // Determine operating mode
    this.updateOperatingMode();

    // Log status
    this.logHealthStatus();

    // Check for alerts
    this.checkAlerts();
  }

  /**
   * 🗄️ Check Supabase connection and latency
   */
  private async checkSupabase(): Promise<void> {
    const startTime = Date.now();
    
    try {
      const { data, error } = await supabaseClient.supabase
        ?.from('bot_config')
        .select('count', { count: 'exact', head: true });

      const latency = Date.now() - startTime;

      if (error) {
        throw new Error(error.message);
      }

      this.status.supabase = {
        available: true,
        latency,
        lastChecked: new Date(),
        error: undefined
      };
      
      this.consecutiveFailures.supabase = 0;
      
    } catch (error) {
      this.status.supabase = {
        available: false,
        latency: null,
        lastChecked: new Date(),
        error: error.message
      };
      
      this.consecutiveFailures.supabase++;
    }
  }

  /**
   * 🚀 Check Redis connection and latency
   */
  private async checkRedis(): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Try to get Redis client from the database layer
      const { getRedisClient } = await import('../lib/db');
      const redis = await getRedisClient();

      if (!redis) {
        throw new Error('Redis client not available');
      }

      // Test Redis with a ping
      const result = await redis.ping();
      const latency = Date.now() - startTime;

      if (result !== 'PONG') {
        throw new Error('Redis ping failed');
      }

      this.status.redis = {
        available: true,
        latency,
        lastChecked: new Date(),
        error: undefined
      };
      
      this.consecutiveFailures.redis = 0;
      
    } catch (error) {
      this.status.redis = {
        available: false,
        latency: null,
        lastChecked: new Date(),
        error: error.message
      };
      
      this.consecutiveFailures.redis++;
    }
  }

  /**
   * 🎯 Determine optimal operating mode
   */
  private updateOperatingMode(): void {
    const { supabase, redis } = this.status;

    if (redis.available && supabase.available) {
      this.status.mode = 'dual';
    } else if (supabase.available) {
      this.status.mode = 'supabase_only';
    } else if (redis.available) {
      this.status.mode = 'redis_only';
    } else {
      this.status.mode = 'offline';
    }
  }

  /**
   * 📊 Log current health status
   */
  private logHealthStatus(): void {
    const { supabase, redis, mode } = this.status;
    
    console.log('📊 === DATABASE HEALTH STATUS ===');
    console.log(`   Mode: ${mode.toUpperCase()}`);
    console.log(`   Supabase: ${supabase.available ? '✅' : '❌'} ${supabase.latency}ms`);
    console.log(`   Redis: ${redis.available ? '✅' : '❌'} ${redis.latency}ms`);
    
    if (!supabase.available) {
      console.log(`   Supabase Error: ${supabase.error}`);
    }
    
    if (!redis.available) {
      console.log(`   Redis Error: ${redis.error}`);
    }
  }

  /**
   * 🚨 Check for alert conditions
   */
  private checkAlerts(): void {
    // Alert on consecutive Supabase failures
    if (this.consecutiveFailures.supabase >= this.alertThreshold) {
      console.log(`🚨 ALERT: Supabase has failed ${this.consecutiveFailures.supabase} consecutive times!`);
      console.log(`   Last error: ${this.status.supabase.error}`);
    }

    // Alert on consecutive Redis failures
    if (this.consecutiveFailures.redis >= this.alertThreshold) {
      console.log(`🚨 ALERT: Redis has failed ${this.consecutiveFailures.redis} consecutive times!`);
      console.log(`   Last error: ${this.status.redis.error}`);
    }

    // Alert on complete database failure
    if (this.status.mode === 'offline') {
      console.log('🚨 CRITICAL: All databases are offline! System operating in emergency mode.');
    }
  }

  /**
   * 📋 Get current database status
   */
  getStatus(): DatabaseStatus {
    return { ...this.status };
  }

  /**
   * 🛑 Stop health monitoring
   */
  stopMonitoring(): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
      console.log('🛑 Database health monitoring stopped');
    }
  }

  /**
   * 🔧 Force health check (for manual diagnostics)
   */
  async forceHealthCheck(): Promise<DatabaseStatus> {
    await this.performHealthCheck();
    return this.getStatus();
  }

  /**
   * 🎯 Check if dual database mode is actually working
   */
  async verifyDualDatabaseMode(): Promise<{
    redisDetected: boolean;
    redisConnected: boolean;
    supabaseConnected: boolean;
    environmentVars: {
      REDIS_URL: boolean;
      USE_SUPABASE_ONLY: string;
    };
  }> {
    console.log('🔍 Verifying dual database mode configuration...');

    const verification = {
      redisDetected: !!process.env.REDIS_URL,
      redisConnected: false,
      supabaseConnected: false,
      environmentVars: {
        REDIS_URL: !!process.env.REDIS_URL,
        USE_SUPABASE_ONLY: process.env.USE_SUPABASE_ONLY || 'false'
      }
    };

    // Test Redis connection
    try {
      const { getRedisClient } = await import('../lib/db');
      const redis = await getRedisClient();
      if (redis) {
        await redis.ping();
        verification.redisConnected = true;
      }
    } catch (error) {
      console.log('❌ Redis verification failed:', error.message);
    }

    // Test Supabase connection
    try {
      const { data } = await supabaseClient.supabase
        ?.from('bot_config')
        .select('count', { count: 'exact', head: true });
      verification.supabaseConnected = true;
    } catch (error) {
      console.log('❌ Supabase verification failed:', error.message);
    }

    console.log('📋 Dual Database Verification:', verification);
    return verification;
  }
}

// Export singleton instance
export const databaseHealthMonitor = DatabaseHealthMonitor.getInstance();