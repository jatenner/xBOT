/**
 * 🧪 REDIS SMOKE TEST
 * Verify cache set/get works with no warnings
 */

import { getRedisSafeClient } from '../lib/redisSafe';

export class RedisSmokeTest {
  private redis = getRedisSafeClient();

  /**
   * 🧪 RUN REDIS SMOKE TEST
   */
  async runSmokeTest(): Promise<{
    passed: boolean;
    results: Array<{
      test: string;
      status: 'PASS' | 'FAIL';
      details?: string;
    }>;
    summary: string;
  }> {
    console.log('🧪 REDIS_SMOKE_TEST: Testing cache operations...');
    
    const results: Array<{
      test: string;
      status: 'PASS' | 'FAIL';
      details?: string;
    }> = [];

    // Test 1: Basic connectivity
    try {
      const pingResult = await this.redis.ping();
      results.push({
        test: 'Redis Connectivity',
        status: pingResult.includes('PONG') ? 'PASS' : 'FAIL',
        details: pingResult
      });
      console.log(`✅ PING: ${pingResult}`);
    } catch (error) {
      results.push({
        test: 'Redis Connectivity',
        status: 'FAIL',
        details: error instanceof Error ? error.message : String(error)
      });
      console.error(`❌ PING: ${error}`);
    }

    // Test 2: String set/get with TTL
    try {
      const testKey = `test:smoke:${Date.now()}`;
      const testValue = 'smoke_test_value';
      
      await this.redis.set(testKey, testValue, 60); // 60 second TTL
      const retrieved = await this.redis.get(testKey);
      
      if (retrieved === testValue) {
        results.push({
          test: 'String Set/Get with TTL',
          status: 'PASS',
          details: `Set and retrieved: ${testValue}`
        });
        console.log(`✅ STRING: Set/Get successful`);
      } else {
        results.push({
          test: 'String Set/Get with TTL',
          status: 'FAIL',
          details: `Expected: ${testValue}, Got: ${retrieved}`
        });
        console.error(`❌ STRING: Expected ${testValue}, got ${retrieved}`);
      }

      // Cleanup
      await this.redis.del(testKey);
    } catch (error) {
      results.push({
        test: 'String Set/Get with TTL',
        status: 'FAIL',
        details: error instanceof Error ? error.message : String(error)
      });
      console.error(`❌ STRING: ${error}`);
    }

    // Test 3: JSON set/get
    try {
      const testKey = `test:json:${Date.now()}`;
      const testData = {
        megaPrompt: 'MEGAPROMPT_V1',
        quality: 95,
        factSource: 'Harvard Medical School',
        timestamp: new Date().toISOString()
      };
      
      await this.redis.setJSON(testKey, testData, 60);
      const retrieved = await this.redis.getJSON(testKey);
      
      if (retrieved && JSON.stringify(retrieved) === JSON.stringify(testData)) {
        results.push({
          test: 'JSON Set/Get',
          status: 'PASS',
          details: `JSON roundtrip successful`
        });
        console.log(`✅ JSON: Set/Get successful`);
      } else {
        results.push({
          test: 'JSON Set/Get',
          status: 'FAIL',
          details: `JSON mismatch`
        });
        console.error(`❌ JSON: Data mismatch`);
      }

      // Cleanup
      await this.redis.del(testKey);
    } catch (error) {
      results.push({
        test: 'JSON Set/Get',
        status: 'FAIL',
        details: error instanceof Error ? error.message : String(error)
      });
      console.error(`❌ JSON: ${error}`);
    }

    // Test 4: Numeric operations
    try {
      const testKey = `test:counter:${Date.now()}`;
      
      // Test incr
      const count1 = await this.redis.incr(testKey);
      const count2 = await this.redis.incr(testKey);
      
      // Test incrByFloat
      const float1 = await this.redis.incrByFloat(`${testKey}:float`, 2.5);
      const float2 = await this.redis.incrByFloat(`${testKey}:float`, 1.5);
      
      if (count1 === 1 && count2 === 2 && float1 === 2.5 && float2 === 4.0) {
        results.push({
          test: 'Numeric Operations',
          status: 'PASS',
          details: `Counters: ${count1} -> ${count2}, Float: ${float1} -> ${float2}`
        });
        console.log(`✅ NUMERIC: Increment operations successful`);
      } else {
        results.push({
          test: 'Numeric Operations',
          status: 'FAIL',
          details: `Unexpected counter values`
        });
        console.error(`❌ NUMERIC: Counter values incorrect`);
      }

      // Cleanup
      await this.redis.del(testKey);
      await this.redis.del(`${testKey}:float`);
    } catch (error) {
      results.push({
        test: 'Numeric Operations',
        status: 'FAIL',
        details: error instanceof Error ? error.message : String(error)
      });
      console.error(`❌ NUMERIC: ${error}`);
    }

    // Test 5: TTL operations
    try {
      const testKey = `test:ttl:${Date.now()}`;
      
      await this.redis.set(testKey, 'test_ttl', 5); // 5 second TTL
      const ttl = await this.redis.ttl(testKey);
      const exists = await this.redis.exists(testKey);
      
      if (ttl > 0 && ttl <= 5 && exists === 1) {
        results.push({
          test: 'TTL Operations',
          status: 'PASS',
          details: `TTL: ${ttl}s, Exists: ${exists}`
        });
        console.log(`✅ TTL: Operations successful (${ttl}s remaining)`);
      } else {
        results.push({
          test: 'TTL Operations',
          status: 'FAIL',
          details: `TTL: ${ttl}, Exists: ${exists}`
        });
        console.error(`❌ TTL: Unexpected values`);
      }

      // Cleanup
      await this.redis.del(testKey);
    } catch (error) {
      results.push({
        test: 'TTL Operations',
        status: 'FAIL',
        details: error instanceof Error ? error.message : String(error)
      });
      console.error(`❌ TTL: ${error}`);
    }

    // Test 6: Memory stats (cloud-safe)
    try {
      const memStats = await this.redis.getMemoryStats();
      
      if (memStats.used_memory_human && memStats.used_memory >= 0) {
        results.push({
          test: 'Memory Stats (Cloud-Safe)',
          status: 'PASS',
          details: `Memory: ${memStats.used_memory_human}, Mode: ${this.redis.isFallbackMode() ? 'fallback' : 'redis'}`
        });
        console.log(`✅ MEMORY: Stats retrieved (${memStats.used_memory_human})`);
      } else {
        results.push({
          test: 'Memory Stats (Cloud-Safe)',
          status: 'FAIL',
          details: `Invalid memory stats`
        });
        console.error(`❌ MEMORY: Invalid stats`);
      }
    } catch (error) {
      results.push({
        test: 'Memory Stats (Cloud-Safe)',
        status: 'FAIL',
        details: error instanceof Error ? error.message : String(error)
      });
      console.error(`❌ MEMORY: ${error}`);
    }

    // Check connection mode
    const isConnected = this.redis.isConnected();
    const isFallbackMode = this.redis.isFallbackMode();
    
    console.log(`🔌 CONNECTION_STATUS: Connected: ${isConnected}, Fallback: ${isFallbackMode}`);

    // Calculate results
    const passCount = results.filter(r => r.status === 'PASS').length;
    const failCount = results.filter(r => r.status === 'FAIL').length;
    const passed = passCount === results.length;
    
    const summary = `Redis Smoke Test: ${passCount}/${results.length} passed ${isConnected ? '(Redis)' : '(Fallback)'}`;

    console.log(`\n🧪 REDIS_SMOKE_TEST_COMPLETE:`);
    console.log(`✅ Passed: ${passCount}`);
    console.log(`❌ Failed: ${failCount}`);
    console.log(`🔌 Mode: ${isConnected ? 'Redis Connected' : 'Fallback Mode'}`);
    console.log(`📊 Result: ${passed ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}`);

    return {
      passed,
      results,
      summary
    };
  }

  /**
   * 🎯 QUICK CONNECTIVITY CHECK
   */
  async quickCheck(): Promise<{
    connected: boolean;
    fallbackMode: boolean;
    status: string;
  }> {
    try {
      const pingResult = await this.redis.ping();
      const connected = this.redis.isConnected();
      const fallbackMode = this.redis.isFallbackMode();
      
      return {
        connected,
        fallbackMode,
        status: pingResult
      };
    } catch (error) {
      return {
        connected: false,
        fallbackMode: true,
        status: `Error: ${error instanceof Error ? error.message : error}`
      };
    }
  }
}

// Export singleton for testing
export const redisSmokeTest = new RedisSmokeTest();
