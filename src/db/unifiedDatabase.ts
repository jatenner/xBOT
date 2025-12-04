/**
 * 🗄️ UNIFIED DATABASE INTERFACE
 * 
 * Single source of truth for ALL database operations
 * Wraps existing pgClient and supabaseClient (doesn't rebuild)
 * 
 * FEATURES:
 * - Unified interface for PostgreSQL and Supabase
 * - Circuit breaker to prevent cascading failures
 * - Health checks
 * - Connection pooling (uses existing pgClient pool)
 */

import { Pool, PoolClient } from 'pg';
import { SupabaseClient } from '@supabase/supabase-js';
import { makePgPool } from './pgClient';
import { getSupabaseClient } from './index';

export interface ResourceBudget {
  maxConnections: number;
  timeout: number;
}

export class UnifiedDatabase {
  private static instance: UnifiedDatabase;
  private pgPool: Pool;
  private supabase: SupabaseClient;
  private circuitBreaker: {
    failures: number;
    lastFailure: Date | null;
    isOpen: boolean;
    openUntil: Date | null;
  } = {
    failures: 0,
    lastFailure: null,
    isOpen: false,
    openUntil: null
  };
  
  // Circuit breaker configuration
  private readonly CIRCUIT_BREAKER_THRESHOLD = 5;
  private readonly CIRCUIT_BREAKER_TIMEOUT_MS = 60000; // 1 minute
  
  private constructor() {
    // Use existing implementations (don't rebuild)
    this.pgPool = makePgPool();
    this.supabase = getSupabaseClient();
  }
  
  public static getInstance(): UnifiedDatabase {
    if (!UnifiedDatabase.instance) {
      UnifiedDatabase.instance = new UnifiedDatabase();
    }
    return UnifiedDatabase.instance;
  }
  
  /**
   * Execute PostgreSQL query
   */
  async query<T = any>(sql: string, params?: any[]): Promise<T[]> {
    // Check circuit breaker
    if (this.circuitBreaker.isOpen) {
      const now = new Date();
      if (this.circuitBreaker.openUntil && now < this.circuitBreaker.openUntil) {
        throw new Error(`Database circuit breaker is open (resets at ${this.circuitBreaker.openUntil.toISOString()})`);
      } else {
        // Timeout expired, attempt reset
        this.circuitBreaker.isOpen = false;
        this.circuitBreaker.failures = 0;
      }
    }
    
    try {
      const result = await this.pgPool.query(sql, params);
      // Success - reset failure count
      this.circuitBreaker.failures = 0;
      return result.rows as T[];
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }
  
  /**
   * Get Supabase query builder (for Supabase operations)
   */
  from<T = any>(table: string): ReturnType<SupabaseClient['from']> {
    return this.supabase.from(table) as any;
  }
  
  /**
   * Health check - verify database connectivity
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.pgPool.query('SELECT 1');
      return true;
    } catch (error) {
      console.error('[UNIFIED_DATABASE] Health check failed:', error instanceof Error ? error.message : String(error));
      return false;
    }
  }
  
  /**
   * Get PostgreSQL connection (for transactions)
   */
  async getConnection(): Promise<PoolClient> {
    if (this.circuitBreaker.isOpen) {
      throw new Error('Database circuit breaker is open');
    }
    
    try {
      const client = await this.pgPool.connect();
      return client;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }
  
  /**
   * Release PostgreSQL connection
   */
  async releaseConnection(client: PoolClient): Promise<void> {
    client.release();
  }
  
  /**
   * Get Supabase client (for direct access if needed)
   */
  getSupabaseClient(): SupabaseClient {
    return this.supabase;
  }
  
  /**
   * Get PostgreSQL pool (for direct access if needed)
   */
  getPgPool(): Pool {
    return this.pgPool;
  }
  
  /**
   * Record failure and update circuit breaker
   */
  private recordFailure(): void {
    this.circuitBreaker.failures++;
    this.circuitBreaker.lastFailure = new Date();
    
    if (this.circuitBreaker.failures >= this.CIRCUIT_BREAKER_THRESHOLD) {
      this.circuitBreaker.isOpen = true;
      this.circuitBreaker.openUntil = new Date(Date.now() + this.CIRCUIT_BREAKER_TIMEOUT_MS);
      
      console.error(`[UNIFIED_DATABASE] Circuit breaker OPEN after ${this.circuitBreaker.failures} failures`);
      console.error(`[UNIFIED_DATABASE] Will reset at ${this.circuitBreaker.openUntil.toISOString()}`);
      
      // Auto-reset after timeout
      setTimeout(() => {
        if (this.circuitBreaker.openUntil && new Date() >= this.circuitBreaker.openUntil) {
          console.log('[UNIFIED_DATABASE] Circuit breaker reset - attempting recovery');
          this.circuitBreaker.isOpen = false;
          this.circuitBreaker.failures = 0;
        }
      }, this.CIRCUIT_BREAKER_TIMEOUT_MS);
    }
  }
  
  /**
   * Get circuit breaker status
   */
  getCircuitBreakerStatus(): {
    isOpen: boolean;
    failures: number;
    openUntil: Date | null;
  } {
    return {
      isOpen: this.circuitBreaker.isOpen,
      failures: this.circuitBreaker.failures,
      openUntil: this.circuitBreaker.openUntil
    };
  }
}

// Export singleton instance
export const unifiedDatabase = UnifiedDatabase.getInstance();

