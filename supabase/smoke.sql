-- SMOKE TEST: Verify core functionality
-- Tests table existence, basic operations, and JSONB handling

\echo '=== SMOKE TEST: Starting core functionality verification ==='

-- Test 1: Verify core tables exist
\echo '1. Checking core tables...'
SELECT 
    table_name,
    'EXISTS' as status
FROM information_schema.tables 
WHERE table_name IN ('tweets', 'bot_config', 'daily_summaries', 'audit_log', 'system_health')
  AND table_schema = 'public'
ORDER BY table_name;

-- Test 2: Verify unique constraint on bot_config
\echo '2. Checking bot_config unique constraint...'
SELECT 
    conname as constraint_name,
    'EXISTS' as status
FROM pg_constraint 
WHERE conrelid = 'bot_config'::regclass 
  AND conname = 'bot_config_env_key_unique';

-- Test 3: Test basic insert into tweets table
\echo '3. Testing tweets table insert...'
INSERT INTO tweets (tweet_id, content, platform, metadata, analytics)
VALUES (
    'smoke_test_' || extract(epoch from now())::text,
    'Smoke test tweet - safe to delete',
    'test',
    jsonb_build_object('test', true, 'timestamp', now()::text),
    jsonb_build_object('likes', 0, 'retweets', 0)
) 
ON CONFLICT (tweet_id) DO UPDATE SET 
    content = EXCLUDED.content,
    posted_at = NOW()
RETURNING tweet_id, platform, 'INSERTED' as status;

-- Test 4: Test JSONB read from bot_config
\echo '4. Testing JSONB read from bot_config...'
SELECT 
    config_key,
    config_value->>'version' as version_field,
    metadata->>'purpose' as purpose_field,
    'JSONB_READ_SUCCESS' as status
FROM bot_config 
WHERE config_key = 'schema_version' 
  AND environment = 'production'
LIMIT 1;

-- Test 5: Test UPSERT into bot_config
\echo '5. Testing bot_config UPSERT...'
INSERT INTO bot_config (environment, config_key, config_value, metadata, updated_at)
VALUES (
    'staging',
    'smoke_test',
    jsonb_build_object(
        'test_run', true,
        'timestamp', NOW()::text,
        'version', '1.0.0'
    ),
    jsonb_build_object(
        'created_by', 'smoke_test',
        'purpose', 'verification'
    ),
    NOW()
)
ON CONFLICT ON CONSTRAINT bot_config_env_key_unique 
DO UPDATE SET 
    config_value = EXCLUDED.config_value,
    metadata = EXCLUDED.metadata,
    updated_at = NOW()
RETURNING config_key, environment, 'UPSERTED' as status;

-- Test 6: Verify row counts
\echo '6. Checking row counts...'
SELECT 'tweets' as table_name, count(*) as row_count FROM tweets
UNION ALL
SELECT 'bot_config', count(*) FROM bot_config
UNION ALL
SELECT 'audit_log', count(*) FROM audit_log
ORDER BY table_name;

-- Cleanup: Remove smoke test data
\echo '7. Cleaning up smoke test data...'
DELETE FROM tweets WHERE tweet_id LIKE 'smoke_test_%';
DELETE FROM bot_config WHERE config_key = 'smoke_test' AND environment = 'staging';

\echo '=== SMOKE TEST: Completed successfully ==='