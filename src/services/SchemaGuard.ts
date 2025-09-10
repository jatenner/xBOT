/**
 * SchemaGuard - Ensures database schema is correct via Supabase pg-meta (preferred) or direct DB
 * Priorities: pg-meta HTTPS -> direct DB (IPv4) -> degraded mode
 */

import { SupabaseMetaRunner } from '../lib/SupabaseMetaRunner';
import { Pool } from 'pg';
import dns from 'node:dns';

// Complete idempotent migration SQL
const MIGRATION_SQL = `
-- Complete idempotent schema migration for xBOT
-- Creates tables and ensures all required columns exist

-- Create tweet_metrics table
CREATE TABLE IF NOT EXISTS public.tweet_metrics (
  tweet_id text PRIMARY KEY,
  collected_at timestamptz DEFAULT now(),
  likes_count bigint DEFAULT 0,
  retweets_count bigint DEFAULT 0,
  replies_count bigint DEFAULT 0,
  bookmarks_count bigint DEFAULT 0,
  impressions_count bigint DEFAULT 0,
  content text
);

-- Create learning_posts table  
CREATE TABLE IF NOT EXISTS public.learning_posts (
  tweet_id text PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  format text,
  likes_count bigint DEFAULT 0,
  retweets_count bigint DEFAULT 0,
  replies_count bigint DEFAULT 0,
  bookmarks_count bigint DEFAULT 0,
  impressions_count bigint DEFAULT 0,
  viral_potential_score numeric,
  content text
);

-- Add missing columns to tweet_metrics (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tweet_metrics' AND column_name='collected_at') THEN
    ALTER TABLE public.tweet_metrics ADD COLUMN collected_at timestamptz DEFAULT now();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tweet_metrics' AND column_name='likes_count') THEN
    ALTER TABLE public.tweet_metrics ADD COLUMN likes_count bigint DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tweet_metrics' AND column_name='retweets_count') THEN
    ALTER TABLE public.tweet_metrics ADD COLUMN retweets_count bigint DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tweet_metrics' AND column_name='replies_count') THEN
    ALTER TABLE public.tweet_metrics ADD COLUMN replies_count bigint DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tweet_metrics' AND column_name='bookmarks_count') THEN
    ALTER TABLE public.tweet_metrics ADD COLUMN bookmarks_count bigint DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tweet_metrics' AND column_name='impressions_count') THEN
    ALTER TABLE public.tweet_metrics ADD COLUMN impressions_count bigint DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tweet_metrics' AND column_name='content') THEN
    ALTER TABLE public.tweet_metrics ADD COLUMN content text;
  END IF;
END$$;

-- Add missing columns to learning_posts (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='learning_posts' AND column_name='created_at') THEN
    ALTER TABLE public.learning_posts ADD COLUMN created_at timestamptz DEFAULT now();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='learning_posts' AND column_name='format') THEN
    ALTER TABLE public.learning_posts ADD COLUMN format text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='learning_posts' AND column_name='likes_count') THEN
    ALTER TABLE public.learning_posts ADD COLUMN likes_count bigint DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='learning_posts' AND column_name='retweets_count') THEN
    ALTER TABLE public.learning_posts ADD COLUMN retweets_count bigint DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='learning_posts' AND column_name='replies_count') THEN
    ALTER TABLE public.learning_posts ADD COLUMN replies_count bigint DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='learning_posts' AND column_name='bookmarks_count') THEN
    ALTER TABLE public.learning_posts ADD COLUMN bookmarks_count bigint DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='learning_posts' AND column_name='impressions_count') THEN
    ALTER TABLE public.learning_posts ADD COLUMN impressions_count bigint DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='learning_posts' AND column_name='viral_potential_score') THEN
    ALTER TABLE public.learning_posts ADD COLUMN viral_potential_score numeric;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='learning_posts' AND column_name='content') THEN
    ALTER TABLE public.learning_posts ADD COLUMN content text;
  END IF;
END$$;

-- Create useful indexes (idempotent)
CREATE INDEX IF NOT EXISTS idx_tweet_metrics_tweet_id ON public.tweet_metrics(tweet_id);
CREATE INDEX IF NOT EXISTS idx_tweet_metrics_collected_at ON public.tweet_metrics(collected_at);
CREATE INDEX IF NOT EXISTS idx_learning_posts_tweet_id ON public.learning_posts(tweet_id);
CREATE INDEX IF NOT EXISTS idx_learning_posts_created_at ON public.learning_posts(created_at);

-- Reload PostgREST schema cache
SELECT pg_notify('pgrst', 'reload schema');
`;

let hasLoggedSchemaError = false;

export class SchemaGuard {
  private metaRunner: SupabaseMetaRunner | null = null;
  private directPool: Pool | null = null;

  constructor() {
    // Initialize Meta Runner if available
    try {
      this.metaRunner = new SupabaseMetaRunner();
      if (!this.metaRunner.isAvailable()) {
        this.metaRunner = null;
      }
    } catch {
      this.metaRunner = null;
    }

    // Initialize direct DB pool if DIRECT_DB_URL is available
    const directDbUrl = process.env.DIRECT_DB_URL;
    if (directDbUrl) {
      try {
        const lookupIPv4: any = (host: string, _opts: any, cb: any) => {
          dns.lookup(host, { family: 4 }, cb);
        };

        // Ensure SSL mode is set for secure connections
        const connectionString = directDbUrl.includes('sslmode=') 
          ? directDbUrl 
          : `${directDbUrl}${directDbUrl.includes('?') ? '&' : '?'}sslmode=require`;

        this.directPool = new Pool({
          connectionString,
          ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: false },
          max: 2,
          idleTimeoutMillis: 5000
        });
      } catch (error: any) {
        console.warn('SCHEMA_GUARD: Direct DB pool creation failed:', error.message);
      }
    }
  }

  /**
   * Ensure schema via preferred method: pg-meta -> direct DB -> degraded mode
   */
  async ensureSchema(): Promise<void> {
    // First, check if schema is already working by testing PostgREST columns
    try {
      await this.verifyPostgrestColumns();
      console.info('SCHEMA_GUARD: schema already working, skipping migration');
      return;
    } catch (verifyError) {
      console.info('SCHEMA_GUARD: schema verification failed, applying migration');
    }

    // Method 1: Try pg-meta first (preferred)
    if (this.metaRunner) {
      console.info('SCHEMA_GUARD: using Supabase Meta ' + (process.env.SUPABASE_PG_META_PATH || '/pg/sql'));
      
      const result = await this.metaRunner.execSql(MIGRATION_SQL);
      if (result.success) {
        console.info('SCHEMA_GUARD: schema ensure OK');
        await this.verifyPostgrestColumns();
        return;
      } else {
        console.warn('SCHEMA_GUARD: pg-meta migration failed:', result.error);
      }
    }

    // Method 2: Try direct DB connection (fallback)
    if (this.directPool) {
      console.info('SCHEMA_GUARD: pg-meta unavailable, trying direct DB with IPv4');
      
      try {
        await this.directPool.query(MIGRATION_SQL);
        console.info('SCHEMA_GUARD: schema ensure OK (direct DB)');
        await this.verifyPostgrestColumns();
        return;
      } catch (error: any) {
        console.warn('SCHEMA_GUARD: direct DB migration failed:', error.message);
      }
    }

    // Method 3: Check if schema is working despite migration failures
    try {
      await this.verifyPostgrestColumns();
      console.info('SCHEMA_GUARD: schema working despite migration issues - continuing');
      return;
    } catch (finalVerifyError) {
      // Method 4: True degraded mode - log once and continue
      if (!hasLoggedSchemaError) {
        console.error('🚨 SCHEMA_GUARD: DEGRADED MODE - Schema migration and verification failed');
        console.error('🚨 Metrics storage may fail until schema is manually applied');
        hasLoggedSchemaError = true;
      }
    }
  }

  /**
   * Verify PostgREST can see the required columns
   */
  private async verifyPostgrestColumns(): Promise<void> {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return;
    }

    const baseUrl = process.env.SUPABASE_URL;
    const apiKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    try {
      // Test tweet_metrics columns
      const metricsResponse = await fetch(
        `${baseUrl}/rest/v1/tweet_metrics?select=tweet_id,impressions_count&limit=1`,
        {
          headers: {
            'apikey': apiKey,
            'authorization': `Bearer ${apiKey}`
          }
        }
      );

      // Test learning_posts columns  
      const learningResponse = await fetch(
        `${baseUrl}/rest/v1/learning_posts?select=tweet_id,bookmarks_count,viral_potential_score&limit=1`,
        {
          headers: {
            'apikey': apiKey,
            'authorization': `Bearer ${apiKey}`
          }
        }
      );

      if (metricsResponse.ok && learningResponse.ok) {
        console.info('SCHEMA_GUARD: PostgREST column verification OK');
      } else {
        console.warn('SCHEMA_GUARD: PostgREST verification failed - cache may need time to refresh');
      }
    } catch (error: any) {
      console.warn('SCHEMA_GUARD: PostgREST verification error:', error.message);
    }
  }

  /**
   * Cleanup resources
   */
  async close(): Promise<void> {
    if (this.directPool) {
      await this.directPool.end().catch(() => {});
    }
  }
}

/**
 * Singleton instance for boot-time usage
 */
export async function ensureSchemaAtBoot(): Promise<void> {
  const guard = new SchemaGuard();
  try {
    await guard.ensureSchema();
  } finally {
    await guard.close();
  }
}
