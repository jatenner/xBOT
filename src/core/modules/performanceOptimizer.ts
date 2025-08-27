/**
 * ⚡ PERFORMANCE OPTIMIZER MODULE
 * 
 * Extracted from autonomousPostingEngine.ts to handle performance optimization
 * Addresses OpenAI API bottlenecks and browser automation performance issues
 */

import { performance } from 'perf_hooks';

export interface PerformanceMetrics {
  executionTime: number;
  memoryUsage: NodeJS.MemoryUsage;
  apiCalls: {
    openai: { count: number; totalTime: number; avgTime: number };
    database: { count: number; totalTime: number; avgTime: number };
    browser: { count: number; totalTime: number; avgTime: number };
  };
  errors: {
    count: number;
    types: Record<string, number>;
  };
}

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

export class PerformanceOptimizer {
  private static instance: PerformanceOptimizer;
  private metrics: PerformanceMetrics;
  private cache: Map<string, CacheEntry<any>> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes default

  private constructor() {
    this.resetMetrics();
    this.startMetricsCollection();
  }

  public static getInstance(): PerformanceOptimizer {
    if (!PerformanceOptimizer.instance) {
      PerformanceOptimizer.instance = new PerformanceOptimizer();
    }
    return PerformanceOptimizer.instance;
  }

  /**
   * 📊 Measure execution time of any async function
   */
  public async measureExecution<T>(
    fn: () => Promise<T>,
    category: 'openai' | 'database' | 'browser',
    label: string
  ): Promise<T> {
    const startTime = performance.now();
    const startMemory = process.memoryUsage();
    
    try {
      console.log(`⏱️ PERFORMANCE_START: ${label}`);
      const result = await fn();
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Update metrics
      this.updateMetrics(category, duration);
      
      // Log performance
      this.logPerformance(label, duration, startMemory);
      
      return result;
      
    } catch (error: any) {
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Track error
      this.trackError(error, category);
      
      console.error(`❌ PERFORMANCE_ERROR: ${label} failed after ${duration.toFixed(2)}ms - ${error.message}`);
      throw error;
    }
  }

  /**
   * 💾 Intelligent caching system for OpenAI API calls
   */
  public async withCache<T>(
    key: string,
    fn: () => Promise<T>,
    ttl: number = this.CACHE_TTL
  ): Promise<T> {
    // Check cache first
    const cached = this.getFromCache<T>(key);
    if (cached) {
      console.log(`💾 CACHE_HIT: ${key}`);
      return cached;
    }
    
    // Execute function and cache result
    console.log(`🔄 CACHE_MISS: ${key} - executing function`);
    const result = await fn();
    
    this.setCache(key, result, ttl);
    return result;
  }

  /**
   * 🚀 Optimize OpenAI API calls with batching and caching
   */
  public async optimizeOpenAICall<T>(
    prompt: string,
    fn: () => Promise<T>,
    cacheKey?: string
  ): Promise<T> {
    const key = cacheKey || this.generateCacheKey(prompt);
    
    return await this.measureExecution(
      () => this.withCache(key, fn, 10 * 60 * 1000), // 10 minute cache for OpenAI
      'openai',
      `OpenAI: ${prompt.substring(0, 50)}...`
    );
  }

  /**
   * 🌐 Optimize browser automation operations
   */
  public async optimizeBrowserOperation<T>(
    operation: string,
    fn: () => Promise<T>
  ): Promise<T> {
    return await this.measureExecution(
      async () => {
        // Add small delay to prevent rate limiting
        await this.intelligentDelay(operation);
        return await fn();
      },
      'browser',
      `Browser: ${operation}`
    );
  }

  /**
   * 🗄️ Optimize database operations
   */
  public async optimizeDatabaseOperation<T>(
    query: string,
    fn: () => Promise<T>
  ): Promise<T> {
    return await this.measureExecution(
      fn,
      'database',
      `Database: ${query}`
    );
  }

  /**
   * ⏳ Intelligent delay system
   */
  private async intelligentDelay(operation: string): Promise<void> {
    const baseDelay = 100; // 100ms base delay
    const recentErrors = this.getRecentErrors('browser');
    
    // Increase delay if there are recent errors (exponential backoff)
    const errorMultiplier = Math.min(Math.pow(2, recentErrors), 8); // Max 8x delay
    const delay = baseDelay * errorMultiplier;
    
    if (delay > baseDelay) {
      console.log(`⏳ INTELLIGENT_DELAY: ${operation} delayed ${delay}ms due to ${recentErrors} recent errors`);
    }
    
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * 📊 Get current performance metrics
   */
  public getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  /**
   * 📈 Get performance recommendations
   */
  public getRecommendations(): string[] {
    const recommendations: string[] = [];
    const metrics = this.metrics;
    
    // OpenAI optimization recommendations
    if (metrics.apiCalls.openai.avgTime > 5000) {
      recommendations.push('🤖 OpenAI API calls are slow (>5s avg) - consider caching or request optimization');
    }
    
    if (metrics.apiCalls.openai.count > 100) {
      recommendations.push('🤖 High OpenAI API usage - implement request batching');
    }
    
    // Browser optimization recommendations
    if (metrics.apiCalls.browser.avgTime > 10000) {
      recommendations.push('🌐 Browser operations are slow (>10s avg) - consider parallel execution');
    }
    
    // Database optimization recommendations  
    if (metrics.apiCalls.database.avgTime > 1000) {
      recommendations.push('🗄️ Database queries are slow (>1s avg) - check indexes and query optimization');
    }
    
    // Error rate recommendations
    const totalCalls = metrics.apiCalls.openai.count + metrics.apiCalls.database.count + metrics.apiCalls.browser.count;
    const errorRate = totalCalls > 0 ? metrics.errors.count / totalCalls : 0;
    
    if (errorRate > 0.1) {
      recommendations.push(`🚨 High error rate (${(errorRate * 100).toFixed(1)}%) - investigate error handling`);
    }
    
    // Memory recommendations
    const currentMemory = process.memoryUsage();
    if (currentMemory.heapUsed > 500 * 1024 * 1024) { // 500MB
      recommendations.push('💾 High memory usage detected - consider memory optimization');
    }
    
    return recommendations;
  }

  /**
   * 🧹 Clean up caches and reset metrics
   */
  public cleanup(): void {
    // Clean expired cache entries
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.timestamp + entry.ttl) {
        this.cache.delete(key);
      }
    }
    
    console.log(`🧹 PERFORMANCE_CLEANUP: Removed ${this.cache.size} expired cache entries`);
  }

  /**
   * 📊 Generate performance report
   */
  public generateReport(): string {
    const metrics = this.metrics;
    const recommendations = this.getRecommendations();
    
    return `
📊 PERFORMANCE REPORT
==================
Execution Time: ${metrics.executionTime.toFixed(2)}ms

🤖 OpenAI API:
   Calls: ${metrics.apiCalls.openai.count}
   Total Time: ${metrics.apiCalls.openai.totalTime.toFixed(2)}ms
   Avg Time: ${metrics.apiCalls.openai.avgTime.toFixed(2)}ms

🗄️ Database:
   Calls: ${metrics.apiCalls.database.count}
   Total Time: ${metrics.apiCalls.database.totalTime.toFixed(2)}ms
   Avg Time: ${metrics.apiCalls.database.avgTime.toFixed(2)}ms

🌐 Browser:
   Calls: ${metrics.apiCalls.browser.count}
   Total Time: ${metrics.apiCalls.browser.totalTime.toFixed(2)}ms
   Avg Time: ${metrics.apiCalls.browser.avgTime.toFixed(2)}ms

🚨 Errors: ${metrics.errors.count}
   Types: ${Object.entries(metrics.errors.types).map(([type, count]) => `${type}(${count})`).join(', ')}

💾 Memory:
   RSS: ${(metrics.memoryUsage.rss / 1024 / 1024).toFixed(2)}MB
   Heap Used: ${(metrics.memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB
   Heap Total: ${(metrics.memoryUsage.heapTotal / 1024 / 1024).toFixed(2)}MB

🔧 RECOMMENDATIONS:
${recommendations.map(rec => `   ${rec}`).join('\n')}
    `.trim();
  }

  // Private helper methods
  private resetMetrics(): void {
    this.metrics = {
      executionTime: 0,
      memoryUsage: process.memoryUsage(),
      apiCalls: {
        openai: { count: 0, totalTime: 0, avgTime: 0 },
        database: { count: 0, totalTime: 0, avgTime: 0 },
        browser: { count: 0, totalTime: 0, avgTime: 0 }
      },
      errors: {
        count: 0,
        types: {}
      }
    };
  }

  private updateMetrics(category: 'openai' | 'database' | 'browser', duration: number): void {
    const categoryMetrics = this.metrics.apiCalls[category];
    categoryMetrics.count++;
    categoryMetrics.totalTime += duration;
    categoryMetrics.avgTime = categoryMetrics.totalTime / categoryMetrics.count;
  }

  private trackError(error: Error, category: string): void {
    this.metrics.errors.count++;
    const errorType = `${category}_${error.name}`;
    this.metrics.errors.types[errorType] = (this.metrics.errors.types[errorType] || 0) + 1;
  }

  private getRecentErrors(category: string): number {
    return Object.entries(this.metrics.errors.types)
      .filter(([type]) => type.startsWith(category))
      .reduce((sum, [, count]) => sum + count, 0);
  }

  private getFromCache<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    const now = Date.now();
    if (now > entry.timestamp + entry.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }

  private setCache<T>(key: string, data: T, ttl: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  private generateCacheKey(prompt: string): string {
    // Create deterministic cache key from prompt
    const hash = prompt
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .substring(0, 100);
    return `openai_${hash}`;
  }

  private logPerformance(label: string, duration: number, startMemory: NodeJS.MemoryUsage): void {
    const endMemory = process.memoryUsage();
    const memoryDiff = endMemory.heapUsed - startMemory.heapUsed;
    
    let logLevel = '✅';
    if (duration > 10000) logLevel = '🐌'; // Slow
    if (duration > 30000) logLevel = '🚨'; // Very slow
    
    console.log(`${logLevel} PERFORMANCE_END: ${label} - ${duration.toFixed(2)}ms (${memoryDiff > 0 ? '+' : ''}${(memoryDiff / 1024 / 1024).toFixed(2)}MB)`);
  }

  private startMetricsCollection(): void {
    // Update memory usage every 30 seconds
    setInterval(() => {
      this.metrics.memoryUsage = process.memoryUsage();
      
      // Cleanup expired cache entries
      this.cleanup();
    }, 30000);
  }
}
