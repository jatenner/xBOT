#!/usr/bin/env tsx
"use strict";
/**
 * CLI tool to run schema migration via Supabase Meta API
 * Usage: npm run migrate:meta
 */
Object.defineProperty(exports, "__esModule", { value: true });
const SupabaseMetaRunner_1 = require("../src/lib/SupabaseMetaRunner");
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
async function main() {
    console.log('🔧 META_MIGRATION: Starting schema migration via Supabase Meta API');
    try {
        const runner = new SupabaseMetaRunner_1.SupabaseMetaRunner();
        if (!runner.isAvailable()) {
            console.error('❌ META_MIGRATION: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
            process.exit(1);
        }
        console.log('🔍 META_MIGRATION: Testing connection...');
        const testResult = await runner.testConnection();
        if (!testResult.success) {
            console.error('❌ META_MIGRATION: Connection test failed:', testResult.error);
            process.exit(1);
        }
        console.log('✅ META_MIGRATION: Connection OK, running migration...');
        const migrationResult = await runner.execSql(MIGRATION_SQL);
        if (!migrationResult.success) {
            console.error('❌ META_MIGRATION: Migration failed:', migrationResult.error);
            process.exit(1);
        }
        console.log('✅ META_MIGRATION: Schema migration completed successfully');
        console.log('🔄 META_MIGRATION: PostgREST schema cache reloaded');
    }
    catch (error) {
        console.error('❌ META_MIGRATION: Unexpected error:', error.message);
        process.exit(1);
    }
}
if (require.main === module) {
    main();
}
//# sourceMappingURL=run-meta-migration.js.map