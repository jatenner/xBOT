-- api_usage table with UUID primary key for production
-- Migration: 20250911_0100_api_usage_uuid.sql
-- Compatible with: Supabase Transaction Pooler

BEGIN;

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create api_usage table with UUID primary key
CREATE TABLE IF NOT EXISTS public.api_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event TEXT NOT NULL,
    cost_cents INTEGER NOT NULL DEFAULT 0,
    meta JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Handle existing table with different schema
DO $$
BEGIN
    -- Check if table exists with old schema and migrate if needed
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'api_usage' 
        AND table_schema = 'public'
    ) THEN
        -- Add missing columns if they don't exist
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'api_usage' 
            AND column_name = 'event'
        ) THEN
            -- Map old 'intent' column to new 'event' column
            IF EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'api_usage' 
                AND column_name = 'intent'
            ) THEN
                ALTER TABLE public.api_usage RENAME COLUMN intent TO event;
            ELSE
                ALTER TABLE public.api_usage ADD COLUMN event TEXT;
                UPDATE public.api_usage SET event = 'migrated' WHERE event IS NULL;
                ALTER TABLE public.api_usage ALTER COLUMN event SET NOT NULL;
            END IF;
        END IF;

        -- Add cost_cents column (convert from cost_usd if exists)
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'api_usage' 
            AND column_name = 'cost_cents'
        ) THEN
            IF EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'api_usage' 
                AND column_name = 'cost_usd'
            ) THEN
                ALTER TABLE public.api_usage ADD COLUMN cost_cents INTEGER;
                UPDATE public.api_usage SET cost_cents = ROUND(cost_usd * 100);
                ALTER TABLE public.api_usage ALTER COLUMN cost_cents SET NOT NULL;
                ALTER TABLE public.api_usage ALTER COLUMN cost_cents SET DEFAULT 0;
            ELSE
                ALTER TABLE public.api_usage ADD COLUMN cost_cents INTEGER NOT NULL DEFAULT 0;
            END IF;
        END IF;

        -- Ensure meta column exists with proper default
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'api_usage' 
            AND column_name = 'meta'
        ) THEN
            ALTER TABLE public.api_usage ADD COLUMN meta JSONB NOT NULL DEFAULT '{}'::jsonb;
        END IF;

        -- Ensure created_at exists
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'api_usage' 
            AND column_name = 'created_at'
        ) THEN
            ALTER TABLE public.api_usage ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
        END IF;

        RAISE NOTICE 'api_usage table schema updated to new format';
    END IF;
END $$;

-- Create optimized indexes
CREATE INDEX IF NOT EXISTS idx_api_usage_created_at ON public.api_usage(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_usage_event ON public.api_usage(event);
CREATE INDEX IF NOT EXISTS idx_api_usage_meta_gin ON public.api_usage USING GIN(meta);
-- Create index with date truncation (PostgreSQL requires IMMUTABLE functions)
CREATE INDEX IF NOT EXISTS idx_api_usage_cost_date ON public.api_usage(created_at, cost_cents);
-- Enable Row Level Security
ALTER TABLE public.api_usage ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies to ensure clean setup
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT policyname FROM pg_policies 
        WHERE tablename = 'api_usage' AND schemaname = 'public'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(pol.policyname) || ' ON public.api_usage';
    END LOOP;
END $$;

-- Create required policies
CREATE POLICY "api_usage_all" ON public.api_usage 
FOR ALL TO authenticated
USING (true) 
WITH CHECK (true);

CREATE POLICY "api_usage_service" ON public.api_usage 
FOR ALL TO service_role
USING (true) 
WITH CHECK (true);

-- Grant comprehensive permissions
GRANT ALL ON public.api_usage TO authenticated;
GRANT ALL ON public.api_usage TO service_role;
GRANT ALL ON public.api_usage TO postgres;

-- Set ownership
ALTER TABLE public.api_usage OWNER TO postgres;

-- Add documentation
COMMENT ON TABLE public.api_usage IS 'API usage tracking with cost in cents and flexible metadata';
COMMENT ON COLUMN public.api_usage.event IS 'Event type or category (e.g., content_generation, ai_decision)';
COMMENT ON COLUMN public.api_usage.cost_cents IS 'Cost in cents (100 = $1.00) for precise budget tracking';
COMMENT ON COLUMN public.api_usage.meta IS 'Flexible JSON metadata for additional context';

-- PostgREST schema reload notification
NOTIFY pgrst, 'reload schema';

-- Verification test
DO $$
DECLARE
    test_id UUID;
    test_count INTEGER;
BEGIN
    -- Test insert
    INSERT INTO public.api_usage (event, cost_cents, meta, model)
    VALUES ('migration_test', 0, '{"test": true, "migration": "20250911_0100_api_usage_uuid"}', 'test-migration')
    RETURNING id INTO test_id;
    
    -- Test select
    SELECT COUNT(*) INTO test_count 
    FROM public.api_usage 
    WHERE id = test_id;    
    IF test_count = 1 THEN
        RAISE NOTICE 'SUCCESS: api_usage table verification passed (UUID: %)', test_id;
        -- Clean up test record
        DELETE FROM public.api_usage WHERE id = test_id;
    ELSE
        RAISE EXCEPTION 'FAILURE: api_usage table verification failed';
    END IF;
END $$;

COMMIT;
