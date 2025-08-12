-- Smoke test for database connectivity and basic tables
SELECT current_database(), current_user, version() LIMIT 1;
SELECT COUNT(*) as tweet_count FROM tweets;
SELECT COUNT(*) as config_count FROM bot_config;
\echo "Smoke test completed successfully"
