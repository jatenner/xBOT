/**
 * Safe Supabase Database Operations for xBOT
 * Structured error handling and RLS validation
 */

import { createClient } from '@supabase/supabase-js';

export interface SafeInsertResult<T = any> {
  data: T[] | null;
  error: Error | null;
  success: boolean;
}

export interface DbConfig {
  supabaseUrl: string;
  supabaseKey: string;
  tables: {
    posts: string;
    metrics: string;
    rejected_posts: string;
    patterns: string;
    topics: string;
  };
}

export class SafeDatabase {
  private client: any;
  private config: DbConfig;

  constructor(config?: Partial<DbConfig>) {
    this.config = {
      supabaseUrl: process.env.SUPABASE_URL!,
      supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
      tables: {
        posts: 'posts',
        metrics: 'metrics', 
        rejected_posts: 'rejected_posts',
        patterns: 'patterns',
        topics: 'topics'
      },
      ...config
    };

    if (!this.config.supabaseUrl || !this.config.supabaseKey) {
      throw new Error('Missing Supabase configuration: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    }

    // Verify we're using service role key (should start with 'eyJ' when base64 decoded)
    if (!this.config.supabaseKey.startsWith('eyJ')) {
      console.warn('⚠️ DB_SAFE: Key may not be service role - server operations may fail');
    }

    this.client = createClient(this.config.supabaseUrl, this.config.supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    console.log('✅ DB_SAFE: Database client initialized with service role');
  }

  /**
   * IRON-CLAD NULL-SAFE insert - guards against error?.message?.includes(...) when error is undefined
   */
  async safeInsert(table: string, payload: Record<string, any>) {
    try {
      if (!table || typeof table !== 'string') {
        console.warn('DB_SAFE: invalid table arg', { table });
        return;
      }
      // Robust payload validation - prevent undefined crashes
      if (!payload || typeof payload !== 'object') {
        console.warn('DB_SAFE: invalid payload type', { payloadType: typeof payload });
        return;
      }
      
      const payloadKeys = Object.keys(payload);
      if (payloadKeys.length === 0) {
        console.warn('DB_SAFE: empty payload, skip', { table });
        return;
      }
      
      const { data, error } = await this.client.from(table).insert(payload);
      if (error) {
        // Safe error message extraction - handle undefined/null errors
        const msg = (error && typeof error === 'object' && 'message' in error) 
          ? String(error.message) 
          : String(error || 'Unknown error');
          
        console.error('DB_SAFE: Insert error', {
          table,
          payloadKeys,
          message: msg
        });
      }
      return data;
    } catch (e: any) {
      // Safe exception handling
      const msg = (e && typeof e === 'object' && 'message' in e) 
        ? String(e.message) 
        : String(e || 'Unknown exception');
      console.error('DB_SAFE: Exception during insert', { table, message: msg });
      return;
    }
  }

  /**
   * Safe wrapper for async operations with error handling
   */
  static async safeInsert<T>(fn: () => Promise<T>): Promise<T | null> {
    try {
      return await fn();
    } catch (e: any) {
      const msg = e?.message || String(e);
      console.warn('DB_SAFE: Insert error', { error: e, message: msg });
      throw e;
    }
  }

  /**
   * Safe select with error handling
   */
  async safeSelect<T = any>(
    table: string, 
    columns = '*', 
    filters?: Record<string, any>,
    options?: { limit?: number; orderBy?: string; ascending?: boolean }
  ): Promise<SafeInsertResult<T>> {
    try {
      let query = this.client.from(table).select(columns);

      // Apply filters
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          query = query.eq(key, value);
        });
      }

      // Apply options
      if (options?.orderBy) {
        query = query.order(options.orderBy, { ascending: options.ascending ?? false });
      }
      
      if (options?.limit) {
        query = query.limit(options.limit);
      }

      const { data, error } = await query;
      
      if (error) {
        console.error(`❌ DB_SAFE: Select failed for table ${table}: ${error.message}`);
        throw new Error(`Database select failed for ${table}: ${error.message}`);
      }

      return {
        data,
        error: null,
        success: true
      };

    } catch (error) {
      const dbError = error instanceof Error ? error : new Error(String(error));
      
      return {
        data: null,
        error: dbError,
        success: false
      };
    }
  }

  /**
   * Check RLS and permissions
   */
  async checkPermissions(): Promise<{
    canInsertPosts: boolean;
    canInsertMetrics: boolean;
    canInsertRejected: boolean;
    issues: string[];
  }> {
    const issues: string[] = [];
    let canInsertPosts = false;
    let canInsertMetrics = false;
    let canInsertRejected = false;

    console.log('🔍 DB_SAFE: Checking table permissions...');

    // Test posts table
    try {
      const testPost = {
        content: 'test_post_permission_check',
        format: 'single',
        topic: 'test',
        scores: { hookScore: 0, clarityScore: 0, noveltyScore: 0, structureScore: 0, overall: 0 },
        created_at: new Date().toISOString()
      };

      const { error } = await this.client
        .from(this.config.tables.posts)
        .insert(testPost)
        .select();

      if (error) {
        issues.push(`Posts table: ${error.message}`);
      } else {
        canInsertPosts = true;
        
        // Clean up test data
        await this.client
          .from(this.config.tables.posts)
          .delete()
          .eq('content', 'test_post_permission_check');
      }
    } catch (error) {
      issues.push(`Posts table exception: ${error instanceof Error ? error.message : error}`);
    }

    // Test metrics table
    try {
      const testMetric = {
        post_id: 'test_metric_check',
        likes: 0,
        reposts: 0,
        replies: 0,
        collected_at: new Date().toISOString()
      };

      const { error } = await this.client
        .from(this.config.tables.metrics)
        .insert(testMetric)
        .select();
      
      if (error) {
        issues.push(`Metrics table: ${error.message}`);
      } else {
        canInsertMetrics = true;
        
        // Clean up test data
        await this.client
          .from(this.config.tables.metrics)
          .delete()
          .eq('post_id', 'test_metric_check');
      }
    } catch (error) {
      issues.push(`Metrics table exception: ${error instanceof Error ? error.message : error}`);
    }

    // Test rejected_posts table
    try {
      const testRejected = {
        content: 'test_rejected_permission_check',
        rejection_reasons: ['test'],
        rejected_at: new Date().toISOString()
      };

      const { error } = await this.client
        .from(this.config.tables.rejected_posts)
        .insert(testRejected)
        .select();

      if (error) {
        issues.push(`Rejected posts table: ${error.message}`);
      } else {
        canInsertRejected = true;
        
        // Clean up test data
        await this.client
          .from(this.config.tables.rejected_posts)
          .delete()
          .eq('content', 'test_rejected_permission_check');
      }
    } catch (error) {
      issues.push(`Rejected posts table exception: ${error instanceof Error ? error.message : error}`);
    }

    const result = {
      canInsertPosts,
      canInsertMetrics, 
      canInsertRejected,
      issues
    };

    if (issues.length > 0) {
      console.warn('⚠️ DB_SAFE: Permission issues detected:');
      issues.forEach(issue => console.warn(`   • ${issue}`));
      console.warn('🔧 Fix: Enable service role bypass or relax RLS for these tables');
    } else {
      console.log('✅ DB_SAFE: All table permissions verified');
    }

    return result;
  }

  /**
   * Verify tables exist
   */
  async verifyTables(): Promise<{ exists: string[]; missing: string[] }> {
    const requiredTables = Object.values(this.config.tables);
    const exists: string[] = [];
    const missing: string[] = [];

    for (const table of requiredTables) {
      try {
        const { error } = await this.client
          .from(table)
          .select('*')
          .limit(1);

        if (error && error.message.includes('does not exist')) {
          missing.push(table);
        } else {
          exists.push(table);
        }
      } catch (error) {
        missing.push(table);
      }
    }

    if (missing.length > 0) {
      console.warn(`⚠️ DB_SAFE: Missing tables: ${missing.join(', ')}`);
      console.warn('🔧 Fix: Run database migrations or create tables manually');
    } else {
      console.log('✅ DB_SAFE: All required tables exist');
    }

    return { exists, missing };
  }

  /**
   * Health check for database
   */
  async healthCheck(): Promise<{
    connected: boolean;
    tablesExist: boolean;
    permissionsOk: boolean;
    details: any;
  }> {
    try {
      // Test basic connection
      const { data, error } = await this.client
        .from('information_schema.tables')
        .select('table_name')
        .limit(1);

      const connected = !error;
      
      if (!connected) {
        return {
          connected: false,
          tablesExist: false,
          permissionsOk: false,
          details: { error: error?.message }
        };
      }

      // Check tables
      const tableCheck = await this.verifyTables();
      const tablesExist = tableCheck.missing.length === 0;

      // Check permissions
      const permissionCheck = await this.checkPermissions();
      const permissionsOk = permissionCheck.issues.length === 0;

      return {
        connected,
        tablesExist,
        permissionsOk,
        details: {
          tables: tableCheck,
          permissions: permissionCheck
        }
      };

    } catch (error) {
      return {
        connected: false,
        tablesExist: false,
        permissionsOk: false,
        details: { 
          error: error instanceof Error ? error.message : String(error)
        }
      };
    }
  }

  /**
   * Get table name by key
   */
  getTableName(key: keyof DbConfig['tables']): string {
    return this.config.tables[key];
  }

  /**
   * Get raw client for advanced operations
   */
  getClient() {
    return this.client;
  }
}

// Singleton instance
let safeDatabaseInstance: SafeDatabase | null = null;

export function createSafeDatabase(config?: Partial<DbConfig>): SafeDatabase {
  if (!safeDatabaseInstance) {
    safeDatabaseInstance = new SafeDatabase(config);
  }
  return safeDatabaseInstance;
}

export function getSafeDatabase(): SafeDatabase {
  if (!safeDatabaseInstance) {
    safeDatabaseInstance = createSafeDatabase();
  }
  return safeDatabaseInstance;
}

export default createSafeDatabase;