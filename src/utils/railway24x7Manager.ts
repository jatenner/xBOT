/**
 * 🚄 RAILWAY 24/7 OPERATION MANAGER
 * 
 * Ensures the bot runs continuously on Railway without any interruptions.
 * Implements aggressive keep-alive, monitoring, and recovery systems.
 */

import { SupabaseService } from './supabaseClient';
import { EmergencyBudgetLockdown } from './emergencyBudgetLockdown';

interface Railway24x7Status {
  uptime_seconds: number;
  memory_usage_mb: number;
  cpu_usage_percent: number;
  health_check_count: number;
  last_recovery_time?: Date;
  recovery_count: number;
  status: 'healthy' | 'warning' | 'recovering' | 'critical';
  keep_alive_active: boolean;
  railway_optimized: boolean;
}

export class Railway24x7Manager {
  private static instance: Railway24x7Manager;
  private startTime: Date = new Date();
  private healthCheckCount: number = 0;
  private recoveryCount: number = 0;
  private keepAliveInterval: NodeJS.Timeout | null = null;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private memoryCleanupInterval: NodeJS.Timeout | null = null;
  private lastRecoveryTime?: Date;
  private supabaseService: SupabaseService;

  private constructor() {
    this.supabaseService = new SupabaseService();
    this.initializeRailway24x7();
  }

  static getInstance(): Railway24x7Manager {
    if (!Railway24x7Manager.instance) {
      Railway24x7Manager.instance = new Railway24x7Manager();
    }
    return Railway24x7Manager.instance;
  }

  /**
   * 🚀 INITIALIZE 24/7 RAILWAY OPERATION
   */
  private async initializeRailway24x7(): Promise<void> {
    console.log('🚄 === RAILWAY 24/7 MANAGER INITIALIZING ===');
    
    // Start aggressive keep-alive system
    this.startKeepAliveSystem();
    
    // Start continuous monitoring
    this.startContinuousMonitoring();
    
    // Start memory management
    this.startMemoryManagement();
    
    // Setup Railway-specific error handling
    this.setupRailwayErrorHandling();
    
    console.log('✅ Railway 24/7 Manager: ACTIVE');
    console.log('🎯 Target: ZERO downtime, ZERO interruptions');
    console.log('🛡️ Keep-alive: ENABLED');
    console.log('📊 Monitoring: CONTINUOUS');
    console.log('🧹 Memory management: ACTIVE');
  }

  /**
   * ⚡ AGGRESSIVE KEEP-ALIVE SYSTEM
   */
  private startKeepAliveSystem(): void {
    console.log('⚡ Starting aggressive keep-alive system...');
    
    // Keep-alive ping every 30 seconds
    this.keepAliveInterval = setInterval(async () => {
      try {
        this.healthCheckCount++;
        
        // Ping health endpoint internally
        const status = await this.getSystemStatus();
        
        // Log periodic status (every 10 minutes)
        if (this.healthCheckCount % 20 === 0) {
          console.log(`⚡ Keep-alive ping #${this.healthCheckCount} - Status: ${status.status}`);
          console.log(`📊 Uptime: ${Math.floor(status.uptime_seconds / 3600)}h ${Math.floor((status.uptime_seconds % 3600) / 60)}m`);
        }
        
        // Trigger self-healing if needed
        if (status.status === 'critical') {
          await this.triggerEmergencyRecovery();
        }
        
      } catch (error) {
        console.error('❌ Keep-alive error:', error);
        this.recoveryCount++;
      }
    }, 30000); // Every 30 seconds
  }

  /**
   * 📊 CONTINUOUS SYSTEM MONITORING
   */
  private startContinuousMonitoring(): void {
    console.log('📊 Starting continuous monitoring...');
    
    // Monitor every 5 minutes
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.performDeepHealthCheck();
      } catch (error) {
        console.error('❌ Monitoring error:', error);
      }
    }, 300000); // Every 5 minutes
  }

  /**
   * 🧹 PROACTIVE MEMORY MANAGEMENT
   */
  private startMemoryManagement(): void {
    console.log('🧹 Starting proactive memory management...');
    
    // Clean memory every 15 minutes
    this.memoryCleanupInterval = setInterval(() => {
      try {
        const memUsage = process.memoryUsage();
        const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
        
        if (heapUsedMB > 300) { // 300MB threshold
          console.log(`🧹 Memory cleanup triggered (${heapUsedMB.toFixed(1)}MB used)`);
          
          if (global.gc) {
            global.gc();
            const newMemUsage = process.memoryUsage();
            const newHeapUsedMB = newMemUsage.heapUsed / 1024 / 1024;
            console.log(`✅ Memory cleaned: ${heapUsedMB.toFixed(1)}MB → ${newHeapUsedMB.toFixed(1)}MB`);
          }
        }
      } catch (error) {
        console.error('❌ Memory cleanup error:', error);
      }
    }, 900000); // Every 15 minutes
  }

  /**
   * 🛡️ RAILWAY-SPECIFIC ERROR HANDLING
   */
  private setupRailwayErrorHandling(): void {
    // Handle Railway-specific signals
    process.on('SIGUSR1', () => {
      console.log('🚄 Railway SIGUSR1 received - continuing operation');
    });

    process.on('SIGUSR2', () => {
      console.log('🚄 Railway SIGUSR2 received - continuing operation');
    });

    // Prevent process exit on minor errors
    process.on('warning', (warning) => {
      console.warn(`⚠️ Process warning (non-fatal): ${warning.message}`);
    });

    // Handle Railway container restarts gracefully
    process.on('SIGTERM', () => {
      console.log('🚄 Railway SIGTERM received - graceful shutdown initiated');
      this.performGracefulShutdown();
    });
  }

  /**
   * 🔍 DEEP HEALTH CHECK
   */
  private async performDeepHealthCheck(): Promise<void> {
    console.log('🔍 === DEEP HEALTH CHECK ===');
    
    try {
      const status = await this.getSystemStatus();
      
      // Check uptime
      if (status.uptime_seconds > 86400) { // 24+ hours
        console.log(`�� Milestone: ${Math.floor(status.uptime_seconds / 86400)} days uptime!`);
      }
      
      // Check memory usage
      if (status.memory_usage_mb > 400) {
        console.log('⚠️ High memory usage detected - triggering cleanup');
        if (global.gc) global.gc();
      }
      
      // Check budget lockdown
      const budgetStatus = await EmergencyBudgetLockdown.isLockedDown();
      if (budgetStatus.lockdownActive) {
        console.log('💰 Budget lockdown active - checking for reset opportunity');
        await this.handleBudgetLockdown();
      }
      
      // Save status to database
      await this.saveStatusToDatabase(status);
      
      console.log(`✅ Deep health check complete - Status: ${status.status}`);
      
    } catch (error) {
      console.error('❌ Deep health check failed:', error);
      this.recoveryCount++;
    }
  }

  /**
   * 🚨 EMERGENCY RECOVERY
   */
  private async triggerEmergencyRecovery(): Promise<void> {
    console.log('🚨 === EMERGENCY RECOVERY TRIGGERED ===');
    
    this.lastRecoveryTime = new Date();
    this.recoveryCount++;
    
    try {
      // 1. Memory cleanup
      if (global.gc) {
        global.gc();
        console.log('✅ Emergency memory cleanup performed');
      }
      
      // 2. Reset budget lockdown if applicable
      await this.handleBudgetLockdown();
      
      // 3. Restart bot operations (if needed)
      console.log('🔄 Emergency recovery complete');
      
    } catch (error) {
      console.error('❌ Emergency recovery failed:', error);
    }
  }

  /**
   * 💰 HANDLE BUDGET LOCKDOWN
   */
  private async handleBudgetLockdown(): Promise<void> {
    try {
      const now = new Date();
      const currentUTC = now.getUTCHours();
      
      // Auto-reset at midnight UTC or if it's been 24+ hours
      if (currentUTC === 0 || (this.lastRecoveryTime && 
          (now.getTime() - this.lastRecoveryTime.getTime()) > 24 * 60 * 60 * 1000)) {
        
        console.log('💰 Attempting budget lockdown reset...');
        await EmergencyBudgetLockdown.deactivateLockdown();
        console.log('✅ Budget lockdown reset successful');
      }
    } catch (error) {
      console.error('❌ Budget lockdown handling failed:', error);
    }
  }

  /**
   * 📊 GET SYSTEM STATUS
   */
  async getSystemStatus(): Promise<Railway24x7Status> {
    const now = new Date();
    const uptimeSeconds = Math.floor((now.getTime() - this.startTime.getTime()) / 1000);
    const memUsage = process.memoryUsage();
    const memUsageMB = memUsage.heapUsed / 1024 / 1024;
    
    // Calculate CPU usage (simplified)
    const cpuUsage = process.cpuUsage();
    const cpuPercent = (cpuUsage.user + cpuUsage.system) / 1000000; // Convert to seconds
    
    // Determine status
    let status: Railway24x7Status['status'] = 'healthy';
    if (memUsageMB > 400) status = 'warning';
    if (memUsageMB > 500 || this.recoveryCount > 10) status = 'critical';
    if (this.lastRecoveryTime && (now.getTime() - this.lastRecoveryTime.getTime()) < 60000) {
      status = 'recovering';
    }

    return {
      uptime_seconds: uptimeSeconds,
      memory_usage_mb: memUsageMB,
      cpu_usage_percent: cpuPercent,
      health_check_count: this.healthCheckCount,
      last_recovery_time: this.lastRecoveryTime,
      recovery_count: this.recoveryCount,
      status,
      keep_alive_active: this.keepAliveInterval !== null,
      railway_optimized: true
    };
  }

  /**
   * 💾 SAVE STATUS TO DATABASE
   */
  private async saveStatusToDatabase(status: Railway24x7Status): Promise<void> {
    try {
      // Save to Supabase for monitoring
      await this.supabaseService.logEvent('railway_24x7_status', {
        uptime_seconds: status.uptime_seconds,
        memory_usage_mb: status.memory_usage_mb,
        health_check_count: status.health_check_count,
        recovery_count: status.recovery_count,
        status: status.status,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      // Don't log error to avoid spam - database logging is optional
    }
  }

  /**
   * 🛑 GRACEFUL SHUTDOWN
   */
  private performGracefulShutdown(): void {
    console.log('🛑 Railway 24/7 Manager: Graceful shutdown initiated');
    
    // Clear intervals
    if (this.keepAliveInterval) clearInterval(this.keepAliveInterval);
    if (this.monitoringInterval) clearInterval(this.monitoringInterval);
    if (this.memoryCleanupInterval) clearInterval(this.memoryCleanupInterval);
    
    // Log final status
    const uptimeSeconds = Math.floor((Date.now() - this.startTime.getTime()) / 1000);
    const uptimeHours = Math.floor(uptimeSeconds / 3600);
    const uptimeMinutes = Math.floor((uptimeSeconds % 3600) / 60);
    
    console.log(`📊 Final uptime: ${uptimeHours}h ${uptimeMinutes}m`);
    console.log(`⚡ Total health checks: ${this.healthCheckCount}`);
    console.log(`🔄 Total recoveries: ${this.recoveryCount}`);
    console.log('✅ Railway 24/7 Manager: Shutdown complete');
  }

  /**
   * 🎯 PUBLIC API FOR HEALTH ENDPOINTS
   */
  async getHealthSummary(): Promise<object> {
    const status = await this.getSystemStatus();
    return {
      railway_24x7: {
        status: status.status,
        uptime_hours: Math.floor(status.uptime_seconds / 3600),
        memory_usage_mb: Math.round(status.memory_usage_mb),
        health_checks: status.health_check_count,
        recoveries: status.recovery_count,
        keep_alive_active: status.keep_alive_active
      }
    };
  }
}

// Auto-initialize when imported
export const railway24x7Manager = Railway24x7Manager.getInstance();
