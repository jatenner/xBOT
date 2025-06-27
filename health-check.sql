-- health-check.sql
DO $$
DECLARE
  table_exists boolean;
  col_exists boolean;
  row_count integer;
  failed_checks text[] := '{}';
BEGIN
  
  -- Check tweet_metrics table
  SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'tweet_metrics' AND table_schema = 'public') INTO table_exists;
  IF NOT table_exists THEN
    failed_checks := array_append(failed_checks, 'tweet_metrics table missing');
  ELSE
    SELECT COUNT(*) FROM tweet_metrics INTO row_count;
    RAISE NOTICE '✅ tweet_metrics | % rows', row_count;
    
    -- Check required columns (matching actual structure)
    SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'tweet_metrics' AND column_name = 'tweet_id' AND data_type = 'bigint') INTO col_exists;
    IF NOT col_exists THEN failed_checks := array_append(failed_checks, 'tweet_metrics.tweet_id missing/wrong type'); END IF;
    
    SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'tweet_metrics' AND column_name = 'captured_at' AND data_type LIKE 'timestamp%') INTO col_exists;
    IF NOT col_exists THEN failed_checks := array_append(failed_checks, 'tweet_metrics.captured_at missing/wrong type'); END IF;
    
    SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'tweet_metrics' AND column_name = 'json_payload' AND data_type = 'jsonb') INTO col_exists;
    IF NOT col_exists THEN failed_checks := array_append(failed_checks, 'tweet_metrics.json_payload missing/wrong type'); END IF;
  END IF;

  -- Check bot_dashboard table  
  SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'bot_dashboard' AND table_schema = 'public') INTO table_exists;
  IF NOT table_exists THEN
    failed_checks := array_append(failed_checks, 'bot_dashboard table missing');
  ELSE
    SELECT COUNT(*) FROM bot_dashboard INTO row_count;
    RAISE NOTICE '✅ bot_dashboard | % rows', row_count;
    
    -- Check required columns (matching actual structure)
    SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'bot_dashboard' AND column_name = 'date' AND data_type = 'date') INTO col_exists;
    IF NOT col_exists THEN failed_checks := array_append(failed_checks, 'bot_dashboard.date missing/wrong type'); END IF;
    
    SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'bot_dashboard' AND column_name = 'planned_posts_json' AND data_type = 'jsonb') INTO col_exists;
    IF NOT col_exists THEN failed_checks := array_append(failed_checks, 'bot_dashboard.planned_posts_json missing/wrong type'); END IF;
  END IF;

  -- Check other required tables (existence only)
  SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'tweets' AND table_schema = 'public') INTO table_exists;
  IF NOT table_exists THEN
    failed_checks := array_append(failed_checks, 'tweets table missing');
  ELSE
    SELECT COUNT(*) FROM tweets INTO row_count;
    RAISE NOTICE '✅ tweets | % rows', row_count;
  END IF;

  SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'tweet_topics' AND table_schema = 'public') INTO table_exists;
  IF NOT table_exists THEN
    failed_checks := array_append(failed_checks, 'tweet_topics table missing');
  ELSE
    SELECT COUNT(*) FROM tweet_topics INTO row_count;
    RAISE NOTICE '✅ tweet_topics | % rows', row_count;
  END IF;

  SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'tweet_images' AND table_schema = 'public') INTO table_exists;
  IF NOT table_exists THEN
    failed_checks := array_append(failed_checks, 'tweet_images table missing');
  ELSE
    SELECT COUNT(*) FROM tweet_images INTO row_count;
    RAISE NOTICE '✅ tweet_images | % rows', row_count;
  END IF;

  -- Final check
  IF array_length(failed_checks, 1) > 0 THEN
    RAISE EXCEPTION '🚨 Database health check FAILED: %', array_to_string(failed_checks, ', ');
  ELSE
    RAISE NOTICE '✅ Database health check PASSED';
  END IF;
  
END $$; 