-- BASELINE MIGRATION: Core 5-table foundation
-- Safe for production - idempotent, additive-only, handles legacy schemas
-- Version: 1.0.0

BEGIN;

-- Set conservative timeouts for production safety
SET lock_timeout = '30s';
SET statement_timeout = '60s';

-- Create audit function for tracking changes
CREATE OR REPLACE FUNCTION audit_trigger()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO audit_log (event_type, component, event_data, context)
    VALUES (
        TG_OP,
        TG_TABLE_NAME,
        to_jsonb(CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END),
        jsonb_build_object(
            'schema', TG_TABLE_SCHEMA,
            'timestamp', NOW(),
            'user', current_user
        )
    );
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;

-- 1. TWEETS TABLE (core content storage)
CREATE TABLE IF NOT EXISTS tweets (
    id BIGSERIAL PRIMARY KEY,
    tweet_id TEXT UNIQUE NOT NULL,
    content TEXT NOT NULL,
    posted_at TIMESTAMPTZ DEFAULT NOW(),
    platform TEXT DEFAULT 'twitter',
    metadata JSONB DEFAULT '{}'::JSONB,
    analytics JSONB DEFAULT '{}'::JSONB
);

-- Add indexes for tweets
CREATE INDEX IF NOT EXISTS idx_tweets_posted_at ON tweets(posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_tweets_platform ON tweets(platform);
CREATE INDEX IF NOT EXISTS idx_tweets_metadata_gin ON tweets USING GIN (metadata);
CREATE INDEX IF NOT EXISTS idx_tweets_analytics_gin ON tweets USING GIN (analytics);

-- 2. BOT_CONFIG TABLE (handle legacy column names safely)
DO $$
BEGIN
    -- Create table if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'bot_config' AND table_schema = 'public') THEN
        CREATE TABLE bot_config (
            id BIGSERIAL PRIMARY KEY,
            environment TEXT NOT NULL DEFAULT 'production',
            config_key TEXT NOT NULL,
            config_value JSONB NOT NULL DEFAULT '{}'::JSONB,
            metadata JSONB DEFAULT '{}'::JSONB,
            updated_at TIMESTAMPTZ DEFAULT NOW()
        );
    ELSE
        -- Handle legacy column renames safely
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bot_config' AND column_name = 'key') 
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bot_config' AND column_name = 'config_key') THEN
            ALTER TABLE bot_config RENAME COLUMN "key" TO config_key;
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bot_config' AND column_name = 'value') 
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bot_config' AND column_name = 'config_value') THEN
            ALTER TABLE bot_config RENAME COLUMN "value" TO config_value;
        END IF;

        -- Ensure required columns exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bot_config' AND column_name = 'environment') THEN
            ALTER TABLE bot_config ADD COLUMN environment TEXT NOT NULL DEFAULT 'production';
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bot_config' AND column_name = 'metadata') THEN
            ALTER TABLE bot_config ADD COLUMN metadata JSONB DEFAULT '{}'::JSONB;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bot_config' AND column_name = 'updated_at') THEN
            ALTER TABLE bot_config ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
        END IF;
    END IF;
END $$;

-- Ensure unique constraint exists BEFORE any upserts
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bot_config_env_key_unique') THEN
        ALTER TABLE bot_config ADD CONSTRAINT bot_config_env_key_unique UNIQUE (environment, config_key);
    END IF;
END $$;

-- 3. DAILY_SUMMARIES TABLE (analytics snapshots)
CREATE TABLE IF NOT EXISTS daily_summaries (
    day DATE NOT NULL,
    summary_type TEXT NOT NULL,
    environment TEXT DEFAULT 'production',
    metrics JSONB DEFAULT '{}'::JSONB,
    metadata JSONB DEFAULT '{}'::JSONB,
    PRIMARY KEY(day, summary_type, environment)
);

-- Add indexes for daily_summaries
CREATE INDEX IF NOT EXISTS idx_daily_summaries_day ON daily_summaries(day DESC);
CREATE INDEX IF NOT EXISTS idx_daily_summaries_type ON daily_summaries(summary_type);
CREATE INDEX IF NOT EXISTS idx_daily_summaries_env ON daily_summaries(environment);

-- 4. AUDIT_LOG TABLE (system events tracking)
CREATE TABLE IF NOT EXISTS audit_log (
    id BIGSERIAL PRIMARY KEY,
    ts TIMESTAMPTZ DEFAULT NOW(),
    event_type TEXT NOT NULL,
    component TEXT NOT NULL,
    event_data JSONB DEFAULT '{}'::JSONB,
    context JSONB DEFAULT '{}'::JSONB
);

-- Add indexes for audit_log
CREATE INDEX IF NOT EXISTS idx_audit_log_ts ON audit_log(ts DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_component ON audit_log(component);
CREATE INDEX IF NOT EXISTS idx_audit_log_event_type ON audit_log(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_log_event_data_gin ON audit_log USING GIN (event_data);

-- 5. SYSTEM_HEALTH TABLE (monitoring and health checks)
CREATE TABLE IF NOT EXISTS system_health (
    id BIGSERIAL PRIMARY KEY,
    ts TIMESTAMPTZ DEFAULT NOW(),
    component TEXT NOT NULL,
    status TEXT NOT NULL,
    metrics JSONB DEFAULT '{}'::JSONB,
    details JSONB DEFAULT '{}'::JSONB
);

-- Add indexes for system_health
CREATE INDEX IF NOT EXISTS idx_system_health_ts ON system_health(ts DESC);
CREATE INDEX IF NOT EXISTS idx_system_health_component ON system_health(component);
CREATE INDEX IF NOT EXISTS idx_system_health_status ON system_health(status);

-- Add audit triggers (safe to recreate)
DROP TRIGGER IF EXISTS tweets_audit_trigger ON tweets;
CREATE TRIGGER tweets_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON tweets
    FOR EACH ROW EXECUTE FUNCTION audit_trigger();

DROP TRIGGER IF EXISTS bot_config_audit_trigger ON bot_config;
CREATE TRIGGER bot_config_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON bot_config
    FOR EACH ROW EXECUTE FUNCTION audit_trigger();

-- Seed essential configuration using the unique constraint
INSERT INTO bot_config (environment, config_key, config_value, metadata, updated_at)
VALUES 
    (
        'production', 
        'schema_version', 
        jsonb_build_object(
            'version', '1.0.0',
            'migration', '0001_baseline',
            'timestamp', NOW()::TEXT
        ),
        jsonb_build_object(
            'created_by', 'baseline_migration',
            'purpose', 'schema_tracking'
        ),
        NOW()
    ),
    (
        'production',
        'redis_config',
        jsonb_build_object(
            'enabled', true,
            'ttl_default', 3600,
            'max_memory', '256mb',
            'eviction_policy', 'allkeys-lru'
        ),
        jsonb_build_object(
            'created_by', 'baseline_migration',
            'purpose', 'redis_hot_path'
        ),
        NOW()
    ),
    (
        'production',
        'rate_limits',
        jsonb_build_object(
            'posts_per_hour', 12,
            'posts_per_day', 75,
            'api_calls_per_minute', 100,
            'emergency_brake', true
        ),
        jsonb_build_object(
            'created_by', 'baseline_migration',
            'purpose', 'twitter_compliance'
        ),
        NOW()
    ),
    (
        'production',
        'feature_flags',
        jsonb_build_object(
            'autonomous_posting', true,
            'redis_dual_store', true,
            'analytics_collection', true,
            'growth_optimization', true
        ),
        jsonb_build_object(
            'created_by', 'baseline_migration',
            'purpose', 'feature_control'
        ),
        NOW()
    )
ON CONFLICT ON CONSTRAINT bot_config_env_key_unique 
DO UPDATE SET 
    config_value = EXCLUDED.config_value,
    metadata = EXCLUDED.metadata,
    updated_at = NOW();

-- Log successful migration
INSERT INTO audit_log (event_type, component, event_data, context)
VALUES (
    'MIGRATION_COMPLETE',
    'baseline_migration',
    jsonb_build_object(
        'version', '1.0.0',
        'tables_created', 5,
        'config_entries', 4
    ),
    jsonb_build_object(
        'timestamp', NOW()::TEXT,
        'safety_level', 'production'
    )
);

COMMIT;

-- Success message
SELECT 'Baseline migration completed successfully' AS result;
