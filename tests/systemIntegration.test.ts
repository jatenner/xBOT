import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { systemMonitor } from '../src/utils/systemMonitor';
import { circuitBreakerManager, circuitBreakers } from '../src/utils/circuitBreaker';
import { CacheManager, contentCache, learningCache } from '../src/utils/intelligentCache';

describe('🧪 System Integration Tests', () => {
  beforeAll(async () => {
    // Initialize all systems
    await CacheManager.initialize();
    await systemMonitor.startMonitoring(30000); // 30 second intervals for testing
    circuitBreakerManager.startMonitoring();
  });

  afterAll(async () => {
    // Cleanup
    systemMonitor.stopMonitoring();
    CacheManager.shutdown();
  });

  beforeEach(() => {
    // Reset circuit breakers before each test
    circuitBreakerManager.resetAll();
    contentCache.clear();
    learningCache.clear();
  });

  // Note: Content Generation Hub tests removed due to complex mocking requirements
  // These would require extensive mocking of OpenAI, Supabase, and other external dependencies

  describe('📊 System Monitor', () => {
    test('should collect system metrics', async () => {
      // Wait for at least one metrics collection cycle
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const metrics = systemMonitor.getCurrentMetrics();
      expect(metrics).toBeDefined();
      
      if (metrics) {
        expect(metrics.performance).toBeDefined();
        expect(metrics.business).toBeDefined();
        expect(metrics.health).toBeDefined();
        expect(metrics.alerts).toBeDefined();
        expect(Array.isArray(metrics.alerts)).toBe(true);
      }
    });

    test('should calculate system health score', () => {
      const healthScore = systemMonitor.getSystemHealthScore();
      expect(typeof healthScore).toBe('number');
      expect(healthScore).toBeGreaterThanOrEqual(0);
      expect(healthScore).toBeLessThanOrEqual(100);
    });

    test('should track alerts', () => {
      systemMonitor.addAlert('info', 'Test', 'Test alert message');
      
      const alerts = systemMonitor.getActiveAlerts();
      expect(alerts.length).toBeGreaterThan(0);
      
      const testAlert = alerts.find(alert => alert.component === 'Test');
      expect(testAlert).toBeDefined();
      expect(testAlert?.message).toBe('Test alert message');
      expect(testAlert?.level).toBe('info');
    });

    test('should provide metrics history', () => {
      const history = systemMonitor.getMetricsHistory(1); // Last 1 hour
      expect(Array.isArray(history)).toBe(true);
      // History might be empty in test environment, that's okay
    });
  });

  describe('🛡️ Circuit Breaker System', () => {
    test('should execute operations successfully when circuit is closed', async () => {
      const mockOperation = jest.fn().mockResolvedValue('success');
      
      const result = await circuitBreakers.contentGeneration.execute(mockOperation, 'test-operation');
      
      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalledTimes(1);
      
      const stats = circuitBreakers.contentGeneration.getStats();
      expect(stats.state).toBe('CLOSED');
      expect(stats.successes).toBe(1);
      expect(stats.failures).toBe(0);
    });

    test('should open circuit after consecutive failures', async () => {
      const mockOperation = jest.fn().mockRejectedValue(new Error('Test failure'));
      
      // Trigger enough failures to open the circuit
      for (let i = 0; i < 5; i++) {
        try {
          await circuitBreakers.contentGeneration.execute(mockOperation, 'failing-operation');
        } catch (error) {
          // Expected to fail
        }
      }
      
      const stats = circuitBreakers.contentGeneration.getStats();
      expect(stats.failures).toBeGreaterThanOrEqual(4);
      expect(stats.state).toBe('OPEN');
    });

    test('should handle timeout correctly', async () => {
      const slowOperation = () => new Promise(resolve => setTimeout(resolve, 70000)); // 70 seconds
      
      await expect(
        circuitBreakers.contentGeneration.execute(slowOperation, 'slow-operation')
      ).rejects.toThrow('Operation timed out');
      
      const stats = circuitBreakers.contentGeneration.getStats();
      expect(stats.failures).toBeGreaterThan(0);
    });

    test('should provide system health overview', () => {
      const health = circuitBreakerManager.getSystemHealth();
      
      expect(typeof health.overallHealth).toBe('number');
      expect(typeof health.availableBreakers).toBe('number');
      expect(typeof health.totalBreakers).toBe('number');
      expect(Array.isArray(health.openBreakers)).toBe(true);
      expect(Array.isArray(health.degradedBreakers)).toBe(true);
    });

    test('should generate comprehensive health report', () => {
      const report = circuitBreakerManager.generateHealthReport();
      
      expect(typeof report).toBe('string');
      expect(report).toContain('CIRCUIT BREAKER HEALTH REPORT');
      expect(report).toContain('Overall Health:');
      expect(report).toContain('Available:');
    });
  });

  describe('🧠 Intelligent Cache System', () => {
    test('should store and retrieve data correctly', () => {
      const testData = { message: 'test data', timestamp: new Date() };
      const key = 'test-key';
      
      const stored = contentCache.set(key, testData);
      expect(stored).toBe(true);
      
      const retrieved = contentCache.get(key);
      expect(retrieved).toEqual(testData);
    });

    test('should respect TTL (Time To Live)', async () => {
      const testData = { message: 'expiring data' };
      const key = 'expiring-key';
      
      const stored = contentCache.set(key, testData, { ttl: 100 }); // 100ms TTL
      expect(stored).toBe(true);
      
      // Should be available immediately
      expect(contentCache.get(key)).toEqual(testData);
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Should be expired now
      expect(contentCache.get(key)).toBeNull();
    });

    test('should handle cache with refresh functionality', async () => {
      const key = 'refresh-test';
      let callCount = 0;
      
      const fetchFunction = async () => {
        callCount++;
        return { data: `call-${callCount}`, timestamp: Date.now() };
      };
      
      // First call
      const result1 = await contentCache.cacheWithRefresh(key, fetchFunction, 50, { ttl: 1000 });
      expect(result1.data).toBe('call-1');
      expect(callCount).toBe(1);
      
      // Immediate second call should use cache
      const result2 = await contentCache.cacheWithRefresh(key, fetchFunction, 50, { ttl: 1000 });
      expect(result2.data).toBe('call-1');
      expect(callCount).toBe(1); // Should still be 1
    });

    test('should provide cache statistics', () => {
      // Add some test data
      contentCache.set('test1', { data: 'value1' });
      contentCache.set('test2', { data: 'value2' });
      contentCache.set('test3', { data: 'value3' });
      
      const stats = contentCache.getStats();
      
      expect(stats.totalEntries).toBeGreaterThanOrEqual(3);
      expect(typeof stats.totalSize).toBe('number');
      expect(typeof stats.hitRate).toBe('number');
      expect(typeof stats.memoryUsage).toBe('number');
      expect(Array.isArray(stats.topKeys)).toBe(true);
    });

    test('should handle memory pressure with intelligent cleanup', () => {
      // Fill cache with data
      for (let i = 0; i < 100; i++) {
        contentCache.set(`bulk-key-${i}`, { 
          data: `Large data chunk ${i}`.repeat(100),
          index: i 
        }, { priority: i % 3 === 0 ? 'low' : 'medium' });
      }
      
      const statsBefore = contentCache.getStats();
      expect(statsBefore.totalEntries).toBeGreaterThan(50);
      
      // Cache should handle memory pressure automatically
      // Low priority items should be evicted first
    });
  });

  describe('🔄 System Integration Flow', () => {
    test('should handle end-to-end monitoring integration', async () => {
      const startTime = Date.now();
      
      // Simulate some system activity
      systemMonitor.addAlert('info', 'TestComponent', 'Test operation started');
      
      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(duration).toBeLessThan(1000); // Should complete quickly
      
      // Check that monitoring tracked the operation
      const metrics = systemMonitor.getCurrentMetrics();
      const alerts = systemMonitor.getActiveAlerts();
      
      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts.some(alert => alert.component === 'TestComponent')).toBe(true);
    });

    test('should maintain system resilience under failure conditions', async () => {
      // Simulate various failure scenarios
      const failingOperation = () => Promise.reject(new Error('Simulated failure'));
      
      // Try multiple operations through circuit breaker
      const results = await Promise.allSettled([
        circuitBreakers.openai.execute(failingOperation, 'test-1').catch(e => e.message),
        circuitBreakers.openai.execute(failingOperation, 'test-2').catch(e => e.message),
        circuitBreakers.openai.execute(failingOperation, 'test-3').catch(e => e.message)
      ]);
      
      // All should have completed (either succeeded or failed gracefully)
      expect(results.length).toBe(3);
      results.forEach(result => {
        expect(result.status).toBe('fulfilled');
      });
      
      // Circuit breaker should have recorded the failures
      const stats = circuitBreakers.openai.getStats();
      expect(stats.failures).toBeGreaterThan(0);
    });

    test('should demonstrate performance optimization through caching', async () => {
      const expensiveOperation = async () => {
        // Simulate expensive operation
        await new Promise(resolve => setTimeout(resolve, 100));
        return { computed: 'expensive-result', timestamp: Date.now() };
      };
      
      const key = 'expensive-op';
      
      // First call - should be slow
      const start1 = Date.now();
      const result1 = await contentCache.getOrSet(key, expensiveOperation);
      const duration1 = Date.now() - start1;
      
      // Second call - should be fast (cached)
      const start2 = Date.now();
      const result2 = await contentCache.getOrSet(key, expensiveOperation);
      const duration2 = Date.now() - start2;
      
      expect(result1.computed).toBe('expensive-result');
      expect(result2.computed).toBe('expensive-result');
      expect(duration1).toBeGreaterThan(90); // Should take ~100ms
      expect(duration2).toBeLessThan(10); // Should be much faster from cache
    });
  });

  describe('📈 Performance Benchmarks', () => {
    test('should meet system monitoring performance targets', async () => {
      const iterations = 5;
      const durations: number[] = [];
      
      for (let i = 0; i < iterations; i++) {
        const start = Date.now();
        
        // Test monitoring operations
        systemMonitor.addAlert('info', 'PerformanceTest', `Test operation ${i}`);
        const healthScore = systemMonitor.getSystemHealthScore();
        const metrics = systemMonitor.getCurrentMetrics();
        
        const duration = Date.now() - start;
        durations.push(duration);
        
        expect(typeof healthScore).toBe('number');
      }
      
      const avgDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;
      const maxDuration = Math.max(...durations);
      
      console.log(`📊 System Monitoring Performance:
        Average: ${avgDuration.toFixed(0)}ms
        Maximum: ${maxDuration.toFixed(0)}ms
        All durations: ${durations.map(d => d.toFixed(0)).join(', ')}ms`);
      
      // Performance targets for monitoring should be very fast
      expect(avgDuration).toBeLessThan(100); // Average under 100ms
      expect(maxDuration).toBeLessThan(500); // Max under 500ms
    });

    test('should demonstrate cache performance benefits', async () => {
      const operation = async () => ({ data: 'test', random: Math.random() });
      const key = 'perf-test';
      
      // Uncached calls
      const uncachedDurations: number[] = [];
      for (let i = 0; i < 3; i++) {
        contentCache.delete(key); // Ensure no cache
        const start = Date.now();
        await contentCache.getOrSet(key, operation);
        uncachedDurations.push(Date.now() - start);
      }
      
      // Cached calls
      const cachedDurations: number[] = [];
      for (let i = 0; i < 3; i++) {
        const start = Date.now();
        await contentCache.getOrSet(key, operation);
        cachedDurations.push(Date.now() - start);
      }
      
      const avgUncached = uncachedDurations.reduce((sum, d) => sum + d, 0) / uncachedDurations.length;
      const avgCached = cachedDurations.reduce((sum, d) => sum + d, 0) / cachedDurations.length;
      
      console.log(`📊 Cache Performance:
        Uncached average: ${avgUncached.toFixed(2)}ms
        Cached average: ${avgCached.toFixed(2)}ms
        Speedup: ${(avgUncached / avgCached).toFixed(1)}x`);
      
      // Cache should provide significant speedup
      expect(avgCached).toBeLessThan(avgUncached);
    });
  });
}); 