-- 20250911_0100_api_usage_uuid.sql
-- Purpose: Ensure api_usage table exists with UUID PK, safe defaults, indexes
-- Compatible with Supabase + Transaction Pooler; idempotent.

-- Enable UUID generation (pgcrypto) if not already present
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO
$$
DECLARE
  col_type text;
  pk_name text;
BEGIN
  -- 1) Create table if it doesn't exist (with correct shape)
  IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'api_usage'
  ) THEN
    CREATE TABLE public.api_usage (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      created_at timestamptz NOT NULL DEFAULT now(),
      model text,
      tokens integer,
      cost numeric(12,4)
    );
  END IF;

  -- 2) Ensure id column exists
  IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='api_usage' AND column_name='id'
  ) THEN
    ALTER TABLE public.api_usage
      ADD COLUMN id uuid DEFAULT gen_random_uuid();
  END IF;

  -- 3) Normalize id to UUID type (handles legacy int/text ids)
  SELECT data_type INTO col_type
  FROM information_schema.columns
  WHERE table_schema='public' AND table_name='api_usage' AND column_name='id';

  IF col_type IS NULL THEN
    -- Shouldn't happen due to step 2, but guard anyway
    ALTER TABLE public.api_usage
      ADD COLUMN id uuid DEFAULT gen_random_uuid();
    col_type := 'uuid';
  END IF;

  IF col_type <> 'uuid' THEN
    -- Add a new UUID column, backfill with gen_random_uuid(), then swap
    ALTER TABLE public.api_usage
      ADD COLUMN id_uuid uuid DEFAULT gen_random_uuid();

    -- Only fill where NULL (shouldn't be needed, but safe)
    UPDATE public.api_usage SET id_uuid = COALESCE(id_uuid, gen_random_uuid());

    -- Drop existing PK if any
    SELECT tc.constraint_name INTO pk_name
    FROM information_schema.table_constraints tc
    WHERE tc.table_schema='public'
      AND tc.table_name='api_usage'
      AND tc.constraint_type='PRIMARY KEY'
    LIMIT 1;

    IF pk_name IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.api_usage DROP CONSTRAINT %I', pk_name);
    END IF;

    -- Remove old id column and rename id_uuid -> id
    ALTER TABLE public.api_usage DROP COLUMN id;
    ALTER TABLE public.api_usage RENAME COLUMN id_uuid TO id;

    -- Recreate PK
    ALTER TABLE public.api_usage
      ALTER COLUMN id SET DEFAULT gen_random_uuid(),
      ALTER COLUMN id SET NOT NULL;

    ALTER TABLE public.api_usage
      ADD PRIMARY KEY (id);
  ELSE
    -- Ensure constraints/defaults are present in case they were missing
    -- (not all ALTERs support IF EXISTS/IF NOT EXISTS, so guard)
    BEGIN
      ALTER TABLE public.api_usage
        ALTER COLUMN id SET DEFAULT gen_random_uuid();
    EXCEPTION WHEN others THEN
      -- ignore if already set
    END;

    BEGIN
      ALTER TABLE public.api_usage
        ALTER COLUMN id SET NOT NULL;
    EXCEPTION WHEN others THEN
      -- ignore if already not null
    END;

    -- Ensure there is a primary key on id
    SELECT tc.constraint_name INTO pk_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.table_schema = kcu.table_schema
    WHERE tc.table_schema='public'
      AND tc.table_name='api_usage'
      AND tc.constraint_type='PRIMARY KEY'
      AND kcu.column_name='id'
    LIMIT 1;

    IF pk_name IS NULL THEN
      ALTER TABLE public.api_usage ADD PRIMARY KEY (id);
    END IF;
  END IF;

  -- 4) Make sure common columns exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='api_usage' AND column_name='created_at'
  ) THEN
    ALTER TABLE public.api_usage ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='api_usage' AND column_name='model'
  ) THEN
    ALTER TABLE public.api_usage ADD COLUMN model text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='api_usage' AND column_name='tokens'
  ) THEN
    ALTER TABLE public.api_usage ADD COLUMN tokens integer;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='api_usage' AND column_name='cost'
  ) THEN
    ALTER TABLE public.api_usage ADD COLUMN cost numeric(12,4);
  END IF;

  -- 5) Helpful indexes (idempotent with IF NOT EXISTS)
  CREATE INDEX IF NOT EXISTS idx_api_usage_created_at ON public.api_usage(created_at);
  CREATE INDEX IF NOT EXISTS idx_api_usage_model ON public.api_usage(model);

END
$$;