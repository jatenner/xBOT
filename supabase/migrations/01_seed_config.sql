-- SEED CONFIG: Essential configuration with constraint-based upserts
-- Safe for production - uses proper ON CONFLICT handling

BEGIN;

-- Seed essential configuration using the unique constraint
INSERT INTO bot_config (environment, config_key, config_value, metadata, updated_at)
VALUES 
    (
        'production', 
        'schema_version', 
        jsonb_build_object(
            'version', '1.0.0',
            'migration', 'baseline',
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

-- Add staging environment configs (for testing)
INSERT INTO bot_config (environment, config_key, config_value, metadata, updated_at)
VALUES 
    (
        'staging', 
        'schema_version', 
        jsonb_build_object(
            'version', '1.0.0',
            'migration', 'baseline',
            'timestamp', NOW()::TEXT
        ),
        jsonb_build_object(
            'created_by', 'baseline_migration',
            'purpose', 'schema_tracking'
        ),
        NOW()
    ),
    (
        'staging',
        'redis_config',
        jsonb_build_object(
            'enabled', true,
            'ttl_default', 1800,
            'max_memory', '128mb',
            'eviction_policy', 'allkeys-lru'
        ),
        jsonb_build_object(
            'created_by', 'baseline_migration',
            'purpose', 'redis_hot_path'
        ),
        NOW()
    ),
    (
        'staging',
        'rate_limits',
        jsonb_build_object(
            'posts_per_hour', 6,
            'posts_per_day', 25,
            'api_calls_per_minute', 50,
            'emergency_brake', true
        ),
        jsonb_build_object(
            'created_by', 'baseline_migration',
            'purpose', 'twitter_compliance'
        ),
        NOW()
    ),
    (
        'staging',
        'feature_flags',
        jsonb_build_object(
            'autonomous_posting', false,
            'redis_dual_store', true,
            'analytics_collection', true,
            'growth_optimization', false
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

COMMIT;