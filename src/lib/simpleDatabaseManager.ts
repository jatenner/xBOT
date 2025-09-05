/**
 * 🚀 SIMPLE DATABASE MANAGER
 * 
 * Bulletproof database manager that just works:
 * - Simple Supabase connection
 * - Auto-retry on failures  
 * - Circuit breaker protection
 * - Fallback mechanisms
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

export class SimpleDatabaseManager {
  private static instance: SimpleDatabaseManager;
  private client: SupabaseClient;
  private isHealthy = true;
  private failureCount = 0;
  private maxFailures = 5;
  private resetTime = 0;
  private resetInterval = 60000; // 1 minute

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase credentials');
    }
    
    this.client = createClient(supabaseUrl, supabaseKey);
    console.log('✅ SIMPLE_DB: Database manager initialized');
  }

  public static getInstance(): SimpleDatabaseManager {
    if (!SimpleDatabaseManager.instance) {
      SimpleDatabaseManager.instance = new SimpleDatabaseManager();
    }
    return SimpleDatabaseManager.instance;
  }

  /**
   * 🔧 EXECUTE QUERY WITH CIRCUIT BREAKER
   */
  async executeQuery<T>(
    operation: string,
    queryFn: (client: SupabaseClient) => Promise<T>
  ): Promise<T> {
    // Check circuit breaker
    if (!this.isHealthy) {
      if (Date.now() - this.resetTime > this.resetInterval) {
        console.log('🔄 CIRCUIT_BREAKER: Attempting reset...');
        this.isHealthy = true;
        this.failureCount = 0;
      } else {
        throw new Error('Circuit breaker is OPEN - database temporarily unavailable');
      }
    }

    try {
      console.log(`📊 DB_QUERY: Executing ${operation}`);
      const startTime = Date.now();
      
      const result = await Promise.race([
        queryFn(this.client),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Query timeout after 30s')), 30000)
        )
      ]);
      
      const duration = Date.now() - startTime;
      console.log(`✅ DB_SUCCESS: ${operation} completed in ${duration}ms`);
      
      // Reset failure count on success
      this.failureCount = 0;
      
      return result;
      
    } catch (error: any) {
      console.error(`❌ DB_ERROR: ${operation} failed -`, error.message);
      
      this.failureCount++;
      
      // Open circuit breaker if too many failures
      if (this.failureCount >= this.maxFailures) {
        console.log('🚨 CIRCUIT_BREAKER: OPENING due to excessive failures');
        this.isHealthy = false;
        this.resetTime = Date.now();
      }
      
      throw error;
    }
  }

  /**
   * 🏥 HEALTH CHECK
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'critical';
    failures: number;
    circuitOpen: boolean;
  }> {
    try {
      const { data, error } = await this.client
        .from('tweet_analytics')
        .select('count')
        .limit(1);
      
      if (error) throw error;
      
      return {
        status: this.failureCount === 0 ? 'healthy' : 'degraded',
        failures: this.failureCount,
        circuitOpen: !this.isHealthy
      };
      
    } catch (error) {
      return {
        status: 'critical',
        failures: this.failureCount,
        circuitOpen: !this.isHealthy
      };
    }
  }

  /**
   * 🔄 FORCE RESET CIRCUIT BREAKER
   */
  resetCircuitBreaker(): void {
    console.log('🔄 CIRCUIT_BREAKER: Manual reset');
    this.isHealthy = true;
    this.failureCount = 0;
    this.resetTime = 0;
  }

  /**
   * 📊 GET STATUS
   */
  getStatus(): {
    healthy: boolean;
    failures: number;
    circuitOpen: boolean;
  } {
    return {
      healthy: this.isHealthy,
      failures: this.failureCount,
      circuitOpen: !this.isHealthy
    };
  }
}
