-- Fix posted_decisions view by adding generation_source to base table

-- Add generation_source to the base table
ALTER TABLE posted_tweets_comprehensive
ADD COLUMN IF NOT EXISTS generation_source TEXT DEFAULT 'real';

COMMENT ON COLUMN posted_tweets_comprehensive.generation_source IS 'Source of content generation: real=LLM, synthetic=fallback';

-- Recreate the view to include the new column
DROP VIEW IF EXISTS posted_decisions;

CREATE OR REPLACE VIEW posted_decisions AS
SELECT 
    id,
    tweet_id,
    decision_id,
    content,
    posted_at,
    created_at,
    decision_type,
    topic_cluster,
    target_tweet_id,
    target_username,
    bandit_arm,
    timing_arm,
    predicted_er,
    quality_score,
    generation_source  -- NEW COLUMN
FROM posted_tweets_comprehensive;

COMMENT ON VIEW posted_decisions IS 'View of posted tweets with generation source for learning system';

-- Grant permissions
GRANT SELECT ON posted_decisions TO anon, authenticated, service_role;

-- Verify
DO $$
DECLARE
  column_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'posted_decisions'
    AND column_name = 'generation_source'
  ) INTO column_exists;
  
  IF column_exists THEN
    RAISE NOTICE '✅ posted_decisions.generation_source now exists!';
  ELSE
    RAISE NOTICE '❌ posted_decisions.generation_source still missing';
  END IF;
END $$;

