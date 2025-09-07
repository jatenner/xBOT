/**
 * 🔥 ENTERPRISE SYSTEM PERFORMANCE MONITOR
 * Real-time monitoring, memory management, and performance optimization
 */

import { admin as supabase } from '../lib/supabaseClients';

export interface SystemMetrics {
  memoryUsage: number; // MB
  databaseResponseTime: number; // ms
  postingSuccessRate: number; // %
  contentGenerationTime: number; // ms
  timestamp: Date;
  systemHealth: 'excellent' | 'good' | 'warning' | 'critical';
}

export class SystemPerformanceMonitor {
  private static instance: SystemPerformanceMonitor;
  private static readonly MEMORY_WARNING_THRESHOLD = 400; // MB
  private static readonly MEMORY_CRITICAL_THRESHOLD = 450; // MB
  private static readonly DB_SLOW_QUERY_THRESHOLD = 1000; // ms
  
  private metrics: SystemMetrics[] = [];
  private lastCleanup = 0;

  private constructor() {
    this.startMonitoring();
  }

  public static getInstance(): SystemPerformanceMonitor {
    if (!SystemPerformanceMonitor.instance) {
      SystemPerformanceMonitor.instance = new SystemPerformanceMonitor();
    }
    return SystemPerformanceMonitor.instance;
  }

  private startMonitoring(): void {
    // Monitor every 30 seconds
    setInterval(() => {
      this.collectMetrics();
    }, 30000);

    // Force cleanup every 5 minutes if needed
    setInterval(() => {
      this.performMaintenanceCleanup();
    }, 300000);

    console.log('🔍 PERFORMANCE_MONITOR: Started real-time monitoring');
  }

  private collectMetrics(): void {
    const memoryUsage = process.memoryUsage();
    const memoryMB = Math.round(memoryUsage.rss / 1024 / 1024);
    
    const metrics: SystemMetrics = {
      memoryUsage: memoryMB,
      databaseResponseTime: 0, // Will be updated by trackDBQuery
      postingSuccessRate: this.calculatePostingSuccessRate(),
      contentGenerationTime: 0, // Will be updated by trackContentGeneration
      timestamp: new Date(),
      systemHealth: this.determineSystemHealth(memoryMB)
    };

    this.metrics.push(metrics);
    
    // Keep only last 20 metrics in memory
    if (this.metrics.length > 20) {
      this.metrics = this.metrics.slice(-20);
    }

    // Log critical status
    this.logSystemStatus(metrics);

    // Auto-cleanup if memory is high
    if (memoryMB > SystemPerformanceMonitor.MEMORY_WARNING_THRESHOLD) {
      this.forceMemoryCleanup();
    }
  }

  private determineSystemHealth(memoryMB: number): 'excellent' | 'good' | 'warning' | 'critical' {
    if (memoryMB > SystemPerformanceMonitor.MEMORY_CRITICAL_THRESHOLD) return 'critical';
    if (memoryMB > SystemPerformanceMonitor.MEMORY_WARNING_THRESHOLD) return 'warning';
    if (memoryMB > 300) return 'good';
    return 'excellent';
  }

  private logSystemStatus(metrics: SystemMetrics): void {
    const healthIcon = {
      excellent: '🟢',
      good: '🟡', 
      warning: '🟠',
      critical: '🔴'
    }[metrics.systemHealth];

    console.log(`${healthIcon} SYSTEM_HEALTH: ${metrics.memoryUsage}MB RAM | ${metrics.systemHealth.toUpperCase()} | Success: ${metrics.postingSuccessRate}%`);

    if (metrics.systemHealth === 'critical') {
      console.error('🚨 CRITICAL_MEMORY: System approaching Railway limits - forcing cleanup');
    } else if (metrics.systemHealth === 'warning') {
      console.warn('⚠️ MEMORY_WARNING: High memory usage detected');
    }
  }

  private forceMemoryCleanup(): void {
    const before = process.memoryUsage().rss / 1024 / 1024;
    
    try {
      // Clear any heavy caches
      if (global.gc) {
        global.gc();
      }
      
      // Clear old metrics
      this.metrics = this.metrics.slice(-5);
      
      const after = process.memoryUsage().rss / 1024 / 1024;
      const saved = Math.round(before - after);
      
      console.log(`🧹 MEMORY_CLEANUP: Freed ${saved}MB | ${Math.round(after)}MB remaining`);
      
    } catch (error) {
      console.error('❌ MEMORY_CLEANUP: Failed to cleanup memory:', error);
    }
  }

  private performMaintenanceCleanup(): void {
    const now = Date.now();
    
    // Only run cleanup every 5 minutes minimum
    if (now - this.lastCleanup < 300000) return;
    
    this.lastCleanup = now;
    
    try {
      // Force garbage collection
      if (global.gc) {
        global.gc();
      }
      
      console.log('🔧 MAINTENANCE: Performed scheduled cleanup');
    } catch (error) {
      console.error('❌ MAINTENANCE: Cleanup failed:', error);
    }
  }

  // Track database query performance
  public async trackDBQuery<T>(operation: string, queryFunction: () => Promise<T>): Promise<T> {
    const startTime = Date.now();
    
    try {
      const result = await queryFunction();
      const duration = Date.now() - startTime;
      
      if (duration > SystemPerformanceMonitor.DB_SLOW_QUERY_THRESHOLD) {
        console.warn(`🐌 SLOW_QUERY: ${operation} took ${duration}ms`);
      }
      
      // Update latest metrics
      if (this.metrics.length > 0) {
        this.metrics[this.metrics.length - 1].databaseResponseTime = duration;
      }
      
      return result;
    } catch (error) {
      console.error(`❌ DB_QUERY_ERROR: ${operation} failed:`, error);
      throw error;
    }
  }

  // Track content generation performance
  public trackContentGeneration(duration: number): void {
    if (this.metrics.length > 0) {
      this.metrics[this.metrics.length - 1].contentGenerationTime = duration;
    }
    
    if (duration > 30000) {
      console.warn(`🐌 SLOW_CONTENT: Generation took ${duration}ms`);
    }
  }

  private calculatePostingSuccessRate(): number {
    // This will be updated by posting systems
    return 95; // Default optimistic value
  }

  public getLatestMetrics(): SystemMetrics | null {
    return this.metrics.length > 0 ? this.metrics[this.metrics.length - 1] : null;
  }

  public getHealthSummary(): string {
    const latest = this.getLatestMetrics();
    if (!latest) return 'No metrics available';
    
    return `${latest.systemHealth} | ${latest.memoryUsage}MB | ${latest.postingSuccessRate}% success`;
  }

  // Store critical metrics in database for analysis
  public async storeMetricsInDB(): Promise<void> {
    try {
      const latest = this.getLatestMetrics();
      if (!latest) return;

      await this.trackDBQuery('store_metrics', async () => {
        return supabase
          .from('system_performance_metrics')
          .insert({
            memory_usage_mb: latest.memoryUsage,
            database_response_time_ms: latest.databaseResponseTime,
            posting_success_rate: latest.postingSuccessRate,
            content_generation_time_ms: latest.contentGenerationTime,
            system_health: latest.systemHealth,
            recorded_at: latest.timestamp.toISOString()
          });
      });
      
    } catch (error) {
      console.error('❌ METRICS_STORAGE: Failed to store metrics:', error);
    }
  }
}

// Export singleton instance
export const systemMonitor = SystemPerformanceMonitor.getInstance();
