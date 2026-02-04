-- =====================================================================================
-- AUTHORITATIVE SCHEMA - Single Source of Truth
-- This migration establishes the CORRECT schema that all code should expect
-- Created: 2025-10-19
-- Purpose: Fix schema inconsistencies, add foreign keys, standardize column names
-- =====================================================================================
-- Note: Migration runner handles transactions automatically; no top-level BEGIN/COMMIT needed

-- =====================================================================================
-- 1. CONTENT_METADATA - Content queue and planning
-- =====================================================================================

-- Drop deprecated/redundant columns if they exist (only if it's a table, not a view)
-- NOTE: Column drops are DISABLED to avoid view errors in production
-- These columns (generated_at, decision_timestamp, thread_parts) are deprecated but
-- cannot be dropped from views. They will be ignored if content_metadata is a view.
-- TODO: Re-enable column drops once content_metadata is confirmed to be a table in all environments
-- Column drops removed entirely to prevent parse-time validation errors

-- Ensure all required columns exist with correct types (only if it's a table)
DO $$
BEGIN
  -- Check if content_metadata is a base table
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
    AND c.relname = 'content_metadata'
    AND c.relkind = 'r'
  ) THEN
    -- Core columns
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public'
        AND table_name = 'content_metadata' 
        AND column_name = 'id'
      ) THEN
        EXECUTE 'ALTER TABLE public.content_metadata ADD COLUMN id BIGSERIAL PRIMARY KEY';
      END IF;
    EXCEPTION 
      WHEN SQLSTATE '42809' THEN
        RAISE NOTICE 'Skipping ADD COLUMN id: relation is a view/materialized view';
      WHEN OTHERS THEN
        RAISE NOTICE 'Could not add id column: %', SQLERRM;
    END;
    
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public'
        AND table_name = 'content_metadata' 
        AND column_name = 'decision_id'
      ) THEN
        EXECUTE 'ALTER TABLE public.content_metadata ADD COLUMN decision_id UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE';
      END IF;
    EXCEPTION 
      WHEN SQLSTATE '42809' THEN
        RAISE NOTICE 'Skipping ADD COLUMN decision_id: relation is a view/materialized view';
      WHEN OTHERS THEN
        RAISE NOTICE 'Could not add decision_id column: %', SQLERRM;
    END;
    
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public'
        AND table_name = 'content_metadata' 
        AND column_name = 'created_at'
      ) THEN
        EXECUTE 'ALTER TABLE public.content_metadata ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()';
      END IF;
    EXCEPTION 
      WHEN SQLSTATE '42809' THEN
        RAISE NOTICE 'Skipping ADD COLUMN created_at: relation is a view/materialized view';
      WHEN OTHERS THEN
        RAISE NOTICE 'Could not add created_at column: %', SQLERRM;
    END;
    
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public'
        AND table_name = 'content_metadata' 
        AND column_name = 'updated_at'
      ) THEN
        EXECUTE 'ALTER TABLE public.content_metadata ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()';
      END IF;
    EXCEPTION 
      WHEN SQLSTATE '42809' THEN
        RAISE NOTICE 'Skipping ADD COLUMN updated_at: relation is a view/materialized view';
      WHEN OTHERS THEN
        RAISE NOTICE 'Could not add updated_at column: %', SQLERRM;
    END;
  ELSE
    RAISE NOTICE 'Skipping column additions: content_metadata is not a base table (likely a view)';
  END IF;
END $$;

-- Essential indexes for content_metadata (only if it's a table)
DO $$
BEGIN
  -- Check if content_metadata is a base table
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
    AND c.relname = 'content_metadata'
    AND c.relkind = 'r'
  ) THEN
    BEGIN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_content_metadata_status_scheduled 
        ON public.content_metadata(status, scheduled_at) WHERE status = ''queued''';
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not create status_scheduled index: %', SQLERRM;
    END;
    
    BEGIN
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_content_metadata_posted_at 
        ON %I.%I(posted_at) WHERE posted_at IS NOT NULL', 'public', 'content_metadata');
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not create posted_at index: %', SQLERRM;
    END;
    
    BEGIN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_content_metadata_created_at 
        ON public.content_metadata(created_at DESC)';
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not create created_at index: %', SQLERRM;
    END;
  ELSE
    RAISE NOTICE 'Skipping index creation: content_metadata is not a base table (likely a view)';
  END IF;
END $$;

-- =====================================================================================
-- 2. POSTED_DECISIONS - Successfully posted content
-- =====================================================================================

-- Ensure posted_decisions has proper structure (only if it's a table, not a view)
DO $$
BEGIN
  -- Check if posted_decisions is a base table
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
    AND c.relname = 'posted_decisions'
    AND c.relkind = 'r'
  ) THEN
    -- Only add column if it doesn't exist
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public'
        AND table_name = 'posted_decisions' 
        AND column_name = 'created_at'
      ) THEN
        EXECUTE format('ALTER TABLE %I.%I ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()', 'public', 'posted_decisions');
      END IF;
    EXCEPTION 
      WHEN SQLSTATE '42809' THEN
        RAISE NOTICE 'Skipping ADD COLUMN created_at: relation is a view/materialized view';
      WHEN OTHERS THEN
        RAISE NOTICE 'Could not add created_at column to posted_decisions: %', SQLERRM;
    END;
  ELSE
    RAISE NOTICE 'Skipping ALTER TABLE: posted_decisions is not a base table (likely a view)';
  END IF;
END $$;

-- Essential indexes for posted_decisions (only if it's a table, not a view)
DO $$
BEGIN
  -- Check if posted_decisions is a base table
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
    AND c.relname = 'posted_decisions'
    AND c.relkind = 'r'
  ) THEN
    -- Create index on the table
    BEGIN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_posted_decisions_created_at 
        ON public.posted_decisions(created_at DESC)';
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not create index on posted_decisions: %', SQLERRM;
    END;
  ELSE
    RAISE NOTICE 'Skipping index creation: posted_decisions is not a base table (likely a view)';
  END IF;
END $$;

-- =====================================================================================
-- 3. OUTCOMES - Tweet performance metrics with FOREIGN KEY
-- =====================================================================================

-- Ensure outcomes has all required columns (outcomes should be a table, but guard anyway)
DO $$
BEGIN
  -- Add quote_tweets as alias for quotes if missing
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public'
      AND table_name = 'outcomes' 
      AND column_name = 'quote_tweets'
    ) THEN
      EXECUTE format('ALTER TABLE %I.%I ADD COLUMN IF NOT EXISTS quote_tweets INTEGER DEFAULT 0', 'public', 'outcomes');
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not add quote_tweets column: %', SQLERRM;
  END;
  
  -- Add views if missing
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public'
      AND table_name = 'outcomes' 
      AND column_name = 'views'
    ) THEN
      EXECUTE format('ALTER TABLE %I.%I ADD COLUMN IF NOT EXISTS views INTEGER DEFAULT 0', 'public', 'outcomes');
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not add views column: %', SQLERRM;
  END;
  
  -- Add profile_clicks if missing
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public'
      AND table_name = 'outcomes' 
      AND column_name = 'profile_clicks'
    ) THEN
      EXECUTE format('ALTER TABLE %I.%I ADD COLUMN IF NOT EXISTS profile_clicks INTEGER DEFAULT 0', 'public', 'outcomes');
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not add profile_clicks column: %', SQLERRM;
  END;
  
  -- Ensure created_at exists
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public'
      AND table_name = 'outcomes' 
      AND column_name = 'created_at'
    ) THEN
      EXECUTE format('ALTER TABLE %I.%I ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()', 'public', 'outcomes');
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not add created_at column: %', SQLERRM;
  END;
END $$;

-- 🔥 CRITICAL: Add foreign key to posted_decisions (only if it's a table)
DO $$ 
BEGIN
  -- Check if posted_decisions is a base table (foreign keys can only reference tables, not views)
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
    AND c.relname = 'posted_decisions'
    AND c.relkind = 'r'
  ) THEN
    -- First check if the foreign key already exists
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE constraint_name = 'fk_outcomes_posted_decisions'
      AND table_schema = 'public'
      AND table_name = 'outcomes'
    ) THEN
      -- Add foreign key constraint
      BEGIN
        EXECUTE 'ALTER TABLE public.outcomes
          ADD CONSTRAINT fk_outcomes_posted_decisions
          FOREIGN KEY (decision_id)
          REFERENCES public.posted_decisions(decision_id)
          ON DELETE CASCADE';
        
        RAISE NOTICE '✅ Added foreign key: outcomes.decision_id → posted_decisions.decision_id';
      EXCEPTION 
        WHEN foreign_key_violation THEN
          RAISE NOTICE '⚠️ Cannot add foreign key: Some outcomes.decision_id values do not exist in posted_decisions';
        WHEN OTHERS THEN
          RAISE NOTICE '⚠️ Foreign key creation skipped: %', SQLERRM;
      END;
    ELSE
      RAISE NOTICE '✓ Foreign key already exists: outcomes.decision_id → posted_decisions.decision_id';
    END IF;
  ELSE
    RAISE NOTICE '⚠️ Skipping foreign key: posted_decisions is not a base table (likely a view). Foreign keys cannot reference views.';
  END IF;
END $$;

-- Essential indexes for outcomes (outcomes should be a table, but guard anyway)
DO $$
BEGIN
  BEGIN
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_outcomes_created_at ON %I.%I(created_at DESC)', 'public', 'outcomes');
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not create idx_outcomes_created_at: %', SQLERRM;
  END;
  
  BEGIN
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_outcomes_collected_at ON %I.%I(collected_at DESC) WHERE collected_at IS NOT NULL', 'public', 'outcomes');
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not create idx_outcomes_collected_at: %', SQLERRM;
  END;
END $$;

-- =====================================================================================
-- 4. CREATE VIEW FOR EASY JOINS (What code actually wants)
-- =====================================================================================

-- Create view for easy joins (handle missing columns gracefully)
DO $$
BEGIN
  -- Check if generator_name column exists in posted_decisions
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'posted_decisions'
    AND column_name = 'generator_name'
  ) THEN
    -- Create view with generator_name
    EXECUTE '
    CREATE OR REPLACE VIEW content_with_outcomes AS
    SELECT 
      pd.decision_id,
      pd.tweet_id,
      pd.content,
      pd.decision_type,
      pd.generator_name,
      pd.posted_at,
      pd.created_at as decision_created_at,
      o.likes,
      o.retweets,
      o.replies,
      o.bookmarks,
      o.quotes,
      o.impressions,
      o.views,
      o.profile_clicks,
      o.engagement_rate,
      o.followers_gained,
      o.followers_before,
      o.followers_after,
      o.collected_at,
      o.collected_pass,
      o.data_source
    FROM posted_decisions pd
    LEFT JOIN outcomes o ON pd.decision_id = o.decision_id';
  ELSE
    -- Create view without generator_name
    EXECUTE '
    CREATE OR REPLACE VIEW content_with_outcomes AS
    SELECT 
      pd.decision_id,
      pd.tweet_id,
      pd.content,
      pd.decision_type,
      NULL::TEXT as generator_name,
      pd.posted_at,
      pd.created_at as decision_created_at,
      o.likes,
      o.retweets,
      o.replies,
      o.bookmarks,
      o.quotes,
      o.impressions,
      o.views,
      o.profile_clicks,
      o.engagement_rate,
      o.followers_gained,
      o.followers_before,
      o.followers_after,
      o.collected_at,
      o.collected_pass,
      o.data_source
    FROM posted_decisions pd
    LEFT JOIN outcomes o ON pd.decision_id = o.decision_id';
  END IF;
END $$;

-- Grant access to view
GRANT SELECT ON content_with_outcomes TO anon, authenticated;

-- =====================================================================================
-- 5. DOCUMENTATION
-- =====================================================================================

-- Comments (only if relations exist and are appropriate type)
-- NOTE: COMMENT statements are safe for both tables and views, so we can use them directly
DO $$
BEGIN
  -- Comment on content_metadata (works for both tables and views)
  BEGIN
    EXECUTE format('COMMENT ON TABLE %I.%I IS %L', 'public', 'content_metadata', 'Content queue - content waiting to be posted');
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not add comment to content_metadata: %', SQLERRM;
  END;
  
  -- Comment on posted_decisions (works for both tables and views)
  BEGIN
    EXECUTE format('COMMENT ON TABLE %I.%I IS %L', 'public', 'posted_decisions', 'Posted content - successfully published tweets');
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not add comment to posted_decisions: %', SQLERRM;
  END;
  
  -- Comment on outcomes (should be a table)
  BEGIN
    EXECUTE format('COMMENT ON TABLE %I.%I IS %L', 'public', 'outcomes', 'Performance metrics - scraped engagement data');
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not add comment to outcomes: %', SQLERRM;
  END;
  
  -- Comment on view
  BEGIN
    EXECUTE format('COMMENT ON VIEW %I.%I IS %L', 'public', 'content_with_outcomes', 'Convenience view joining posted_decisions with outcomes for easy querying');
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not add comment to content_with_outcomes: %', SQLERRM;
  END;
  
  -- Column comments (only if column exists)
  BEGIN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'content_metadata'
      AND column_name = 'created_at'
    ) THEN
      EXECUTE format('COMMENT ON COLUMN %I.%I.%I IS %L', 'public', 'content_metadata', 'created_at', 'When content was generated (use this instead of decision_timestamp or generated_at)');
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not add comment to content_metadata.created_at: %', SQLERRM;
  END;
  
  BEGIN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'posted_decisions'
      AND column_name = 'decision_id'
    ) THEN
      EXECUTE format('COMMENT ON COLUMN %I.%I.%I IS %L', 'public', 'posted_decisions', 'decision_id', 'Links to content_metadata.decision_id');
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not add comment to posted_decisions.decision_id: %', SQLERRM;
  END;
  
  BEGIN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'outcomes'
      AND column_name = 'decision_id'
    ) THEN
      EXECUTE format('COMMENT ON COLUMN %I.%I.%I IS %L', 'public', 'outcomes', 'decision_id', 'Links to posted_decisions.decision_id (foreign key enforced)');
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not add comment to outcomes.decision_id: %', SQLERRM;
  END;
  
  BEGIN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'outcomes'
      AND column_name = 'collected_pass'
    ) THEN
      EXECUTE format('COMMENT ON COLUMN %I.%I.%I IS %L', 'public', 'outcomes', 'collected_pass', '0=placeholder, 1=T+1h metrics, 2=T+24h final metrics');
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not add comment to outcomes.collected_pass: %', SQLERRM;
  END;
END $$;

-- =====================================================================================
-- Summary of changes:
-- ✅ Removed redundant columns (generated_at, decision_timestamp, thread_parts)
-- ✅ Standardized timestamp columns (created_at, updated_at, posted_at, collected_at)
-- ✅ Added foreign key constraint: outcomes.decision_id → posted_decisions.decision_id
-- ✅ Created content_with_outcomes view for easy JOINs
-- ✅ Added missing columns (quote_tweets, views, profile_clicks)
-- ✅ Added essential indexes for performance
-- ✅ Documented all tables and critical columns
-- =====================================================================================

