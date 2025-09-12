import { createClient } from '@supabase/supabase-js';
import { Pool } from 'pg';
import { DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from '../config/env';

let supabaseClient: ReturnType<typeof createClient> | null = null;
let pgPool: Pool | null = null;

/**
 * Get Supabase client with proper error handling
 */
export function getSupabaseClient() {
  if (!supabaseClient && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  }
  
  if (!supabaseClient) {
    throw new Error('Supabase client not configured. Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  }
  
  return supabaseClient;
}

/**
 * Get PostgreSQL pool for direct queries
 */
export function getPgPool(): Pool {
  if (!pgPool) {
    // Import from centralized PG connection
    const { pgPool: centralPool } = require('./pg');
    pgPool = centralPool;
    
    // Log connection status
    console.log('DB_POOLER: Using centralized PG pool with sslmode=require');
  }

  return pgPool;
}

/**
 * Safe database query with error handling
 */
export async function safeQuery<T = any>(
  query: string, 
  params: any[] = []
): Promise<{ data: T[] | null; error: string | null }> {
  try {
    const pool = getPgPool();
    const result = await pool.query(query, params);
    return { data: result.rows, error: null };
  } catch (error) {
    console.error('Database query error:', error);
    return { 
      data: null, 
      error: error instanceof Error ? error.message : 'Unknown database error' 
    };
  }
}

/**
 * Safe Supabase operation with error handling
 */
export async function safeSupabaseQuery<T = any>(
  operation: () => Promise<any>
): Promise<{ data: T | null; error: string | null }> {
  try {
    const result = await operation();
    
    if (result.error) {
      console.error('Supabase operation error:', result.error);
      return { data: null, error: result.error.message };
    }
    
    return { data: result.data, error: null };
  } catch (error) {
    console.error('Supabase operation exception:', error);
    return { 
      data: null, 
      error: error instanceof Error ? error.message : 'Unknown Supabase error' 
    };
  }
}

/**
 * Store tweet metrics safely
 */
export async function storeTweetMetrics(metrics: {
  tweet_id: string;
  root_tweet_id?: string;
  thread_position?: number;
  content?: string;
  likes_count?: number;
  retweets_count?: number;
  replies_count?: number;
  impressions_count?: number;
  quality_score?: number;
  topic?: string;
  learning_metadata?: any;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const client = getSupabaseClient();
    
    const { error } = await client
      .from('tweet_metrics')
      .upsert({
        ...metrics,
        last_updated: new Date().toISOString(),
        latest_metrics_at: new Date().toISOString()
      }, {
        onConflict: 'tweet_id'
      });

    if (error) {
      console.error('Failed to store tweet metrics:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Exception storing tweet metrics:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Store learning post data safely (backward compatibility)
 */
export async function storeLearningPost(data: {
  content: string;
  tweet_id?: string;
  topic?: string;
  likes?: number;
  retweets?: number;
  replies?: number;
  impressions?: number;
  quality_score?: number;
  learning_metadata?: any;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const client = getSupabaseClient();
    
    const { error } = await client
      .from('learning_posts')
      .insert({
        content: data.content,
        tweet_id: data.tweet_id,
        topic: data.topic,
        likes: data.likes || 0,
        retweets: data.retweets || 0,
        replies: data.replies || 0,
        impressions: data.impressions || 0,
        quality_score: data.quality_score,
        learning_metadata: data.learning_metadata || {},
        posted_at: new Date().toISOString()
      });

    if (error) {
      console.error('Failed to store learning post:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Exception storing learning post:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Health check for database connections
 */
export async function checkDatabaseHealth(): Promise<{
  supabase: boolean;
  postgres: boolean;
  errors: string[];
}> {
  const errors: string[] = [];
  let supabaseOk = false;
  let postgresOk = false;

  // Test Supabase
  try {
    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      const client = getSupabaseClient();
      const { error } = await client.from('learning_posts').select('id').limit(1);
      supabaseOk = !error;
      if (error) errors.push(`Supabase: ${error.message}`);
    } else {
      errors.push('Supabase: Missing configuration');
    }
  } catch (error) {
    errors.push(`Supabase: ${error}`);
  }

  // Test PostgreSQL
  try {
    if (DATABASE_URL) {
      const pool = getPgPool();
      await pool.query('SELECT 1');
      postgresOk = true;
    } else {
      errors.push('PostgreSQL: Missing DATABASE_URL');
    }
  } catch (error) {
    errors.push(`PostgreSQL: ${error}`);
  }

  return { supabase: supabaseOk, postgres: postgresOk, errors };
}

/**
 * Graceful shutdown
 */
export async function closeDatabaseConnections(): Promise<void> {
  try {
    if (pgPool) {
      await pgPool.end();
      pgPool = null;
    }
    // Supabase client doesn't need explicit closing
    supabaseClient = null;
  } catch (error) {
    console.error('Error closing database connections:', error);
  }
}
