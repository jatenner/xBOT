-- xBOT Learning Engine V2 Smoke Test
-- Purpose: Verify database schema and basic functionality after migration

-- Test 1: Check basic connectivity
SELECT 1 as connectivity_test;

-- Test 2: Verify core tables exist
SELECT 
  COUNT(*) FILTER (WHERE table_name = 'tweets') as tweets_table,
  COUNT(*) FILTER (WHERE table_name = 'bot_config') as bot_config_table,
  COUNT(*) FILTER (WHERE table_name = 'daily_summaries') as daily_summaries_table,
  COUNT(*) FILTER (WHERE table_name = 'audit_log') as audit_log_table,
  COUNT(*) FILTER (WHERE table_name = 'system_health') as system_health_table
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('tweets', 'bot_config', 'daily_summaries', 'audit_log', 'system_health');

-- Test 3: Check learning_metadata column was added
SELECT 
  COUNT(*) as learning_metadata_column_exists
FROM information_schema.columns 
WHERE table_name = 'tweets' 
  AND column_name = 'learning_metadata' 
  AND table_schema = 'public';

-- Test 4: Verify analytics views were created
SELECT 
  COUNT(*) FILTER (WHERE table_name = 'vw_recent_posts') as vw_recent_posts,
  COUNT(*) FILTER (WHERE table_name = 'vw_topics_perf_7d') as vw_topics_perf_7d,
  COUNT(*) FILTER (WHERE table_name = 'vw_time_of_day_perf_7d') as vw_time_of_day_perf_7d,
  COUNT(*) FILTER (WHERE table_name = 'vw_learning_performance') as vw_learning_performance,
  COUNT(*) FILTER (WHERE table_name = 'vw_bandit_performance') as vw_bandit_performance,
  COUNT(*) FILTER (WHERE table_name = 'vw_content_sources_perf') as vw_content_sources_perf
FROM information_schema.views 
WHERE table_schema = 'public' 
  AND table_name LIKE 'vw_%';

-- Test 5: Check schema version in bot_config
SELECT 
  config_value->'version' as schema_version,
  config_value->'migration' as last_migration
FROM bot_config 
WHERE environment = 'staging' 
  AND config_key = 'schema_version'
LIMIT 1;

-- Test 6: Insert test data and read back
INSERT INTO tweets (tweet_id, content, metadata, learning_metadata) 
VALUES (
  'smoke_test_' || extract(epoch from now()),
  'Smoke test tweet for Learning Engine V2',
  '{"topic": "testing", "source": "smoke_test"}',
  '{"test": true, "timestamp": "' || now()::text || '"}'
) 
ON CONFLICT (tweet_id) DO NOTHING;

-- Test 7: Read from analytics views
SELECT COUNT(*) as total_recent_posts FROM vw_recent_posts LIMIT 1;

-- Test 8: Verify audit log has migration entry
SELECT 
  COUNT(*) as migration_audit_entries
FROM audit_log 
WHERE event_type = 'MIGRATION_COMPLETE' 
  AND component = 'learning_v2_analytics';

-- Summary
SELECT 
  'SMOKE TEST COMPLETE' as test_status,
  now() as completed_at,
  'Learning Engine V2 database schema verified' as message;