-- Add tier pass counts and disallowed count to seed_account_stats
BEGIN;

-- Add tier pass columns if they don't exist
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='seed_account_stats' AND column_name='tier1_pass') THEN
        ALTER TABLE public.seed_account_stats ADD COLUMN tier1_pass INTEGER NOT NULL DEFAULT 0;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='seed_account_stats' AND column_name='tier2_pass') THEN
        ALTER TABLE public.seed_account_stats ADD COLUMN tier2_pass INTEGER NOT NULL DEFAULT 0;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='seed_account_stats' AND column_name='tier3_pass') THEN
        ALTER TABLE public.seed_account_stats ADD COLUMN tier3_pass INTEGER NOT NULL DEFAULT 0;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='seed_account_stats' AND column_name='disallowed_count') THEN
        ALTER TABLE public.seed_account_stats ADD COLUMN disallowed_count INTEGER NOT NULL DEFAULT 0;
    END IF;
END $$;

COMMIT;

