-- BASELINE MIGRATION: Core 5-table foundation
-- Safe for production - idempotent, additive-only, handles legacy schemas

BEGIN;

-- Set conservative timeouts
SET lock_timeout = '10s';
SET statement_timeout = '30s';

-- Create core tables (IF NOT EXISTS for safety)

-- 1. TWEETS TABLE
CREATE TABLE IF NOT EXISTS tweets (
    id BIGSERIAL PRIMARY KEY,
    tweet_id TEXT UNIQUE NOT NULL,
    content TEXT NOT NULL,
    posted_at TIMESTAMPTZ DEFAULT NOW(),
    platform TEXT DEFAULT 'twitter',
    metadata JSONB DEFAULT '{}'::JSONB,
    analytics JSONB DEFAULT '{}'::JSONB
);

-- 2. BOT_CONFIG TABLE (handle legacy column names)
DO $$
BEGIN
    -- Create table if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'bot_config' AND table_schema = 'public') THEN
        CREATE TABLE bot_config (
            id BIGSERIAL PRIMARY KEY,
            environment TEXT DEFAULT 'production',
            config_key TEXT NOT NULL,
            config_value JSONB NOT NULL DEFAULT '{}'::JSONB,
            metadata JSONB DEFAULT '{}'::JSONB,
            updated_at TIMESTAMPTZ DEFAULT NOW()
        );
    END IF;

    -- Handle legacy column names (key/value -> config_key/config_value)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bot_config' AND column_name = 'key') 
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bot_config' AND column_name = 'config_key') THEN
        ALTER TABLE bot_config RENAME COLUMN "key" TO config_key;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bot_config' AND column_name = 'value') 
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bot_config' AND column_name = 'config_value') THEN
        ALTER TABLE bot_config RENAME COLUMN "value" TO config_value;
    END IF;

    -- Ensure environment column exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bot_config' AND column_name = 'environment') THEN
        ALTER TABLE bot_config ADD COLUMN environment TEXT DEFAULT 'production';
    END IF;

    -- Ensure metadata column exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bot_config' AND column_name = 'metadata') THEN
        ALTER TABLE bot_config ADD COLUMN metadata JSONB DEFAULT '{}'::JSONB;
    END IF;

    -- Ensure updated_at column exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bot_config' AND column_name = 'updated_at') THEN
        ALTER TABLE bot_config ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
END $$;

-- 3. DAILY_SUMMARIES TABLE
CREATE TABLE IF NOT EXISTS daily_summaries (
    day DATE NOT NULL,
    summary_type TEXT NOT NULL,
    environment TEXT DEFAULT 'production',
    metrics JSONB DEFAULT '{}'::JSONB,
    metadata JSONB DEFAULT '{}'::JSONB,
    PRIMARY KEY(day, summary_type, environment)
);

-- 4. AUDIT_LOG TABLE
CREATE TABLE IF NOT EXISTS audit_log (
    id BIGSERIAL PRIMARY KEY,
    ts TIMESTAMPTZ DEFAULT NOW(),
    event_type TEXT NOT NULL,
    component TEXT NOT NULL,
    event_data JSONB DEFAULT '{}'::JSONB,
    context JSONB DEFAULT '{}'::JSONB
);

-- 5. SYSTEM_HEALTH TABLE
CREATE TABLE IF NOT EXISTS system_health (
    id BIGSERIAL PRIMARY KEY,
    ts TIMESTAMPTZ DEFAULT NOW(),
    component TEXT NOT NULL,
    status TEXT NOT NULL,
    metrics JSONB DEFAULT '{}'::JSONB,
    details JSONB DEFAULT '{}'::JSONB
);

-- Create unique constraint for bot_config (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bot_config_env_key_unique') THEN
        ALTER TABLE bot_config ADD CONSTRAINT bot_config_env_key_unique UNIQUE (environment, config_key);
    END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_tweets_posted_at ON tweets(posted_at);
CREATE INDEX IF NOT EXISTS idx_tweets_platform ON tweets(platform);
CREATE INDEX IF NOT EXISTS idx_audit_log_ts ON audit_log(ts);
CREATE INDEX IF NOT EXISTS idx_audit_log_component ON audit_log(component);
CREATE INDEX IF NOT EXISTS idx_system_health_ts ON system_health(ts);
CREATE INDEX IF NOT EXISTS idx_system_health_component ON system_health(component);

COMMIT;