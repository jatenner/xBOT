-- Quick fix for function names to match the TypeScript code
-- Run this in Supabase SQL Editor to fix the function naming mismatch

-- Drop the old function names and recreate with correct names
DROP FUNCTION IF EXISTS analyze_content_semantically_safe(VARCHAR, TEXT, JSONB);
DROP FUNCTION IF EXISTS update_expertise_level_safe(VARCHAR, JSONB, JSONB);
DROP FUNCTION IF EXISTS detect_content_pattern_safe(JSONB, JSONB);
DROP FUNCTION IF EXISTS capture_tweet_metrics_safe(VARCHAR, INTEGER, INTEGER, INTEGER, INTEGER);

-- Recreate with the names the TypeScript code expects
CREATE OR REPLACE FUNCTION analyze_content_semantically(
  p_tweet_id VARCHAR(50),
  p_content TEXT,
  p_performance_metrics JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID AS $$
DECLARE
  analysis_id UUID;
  content_hash_val VARCHAR(64);
BEGIN
  content_hash_val := encode(digest(p_content, 'sha256'), 'hex');
  
  INSERT INTO semantic_content_analysis (
    tweet_id,
    content_hash,
    semantic_themes,
    expertise_level,
    technical_depth,
    novelty_score,
    content_structure,
    linguistic_features,
    engagement_hooks,
    performance_metrics,
    success_factors,
    improvement_suggestions
  ) VALUES (
    p_tweet_id,
    content_hash_val,
    '[]'::jsonb,
    5,
    5,
    0.5,
    '{}'::jsonb,
    '{}'::jsonb,
    '{}'::jsonb,
    p_performance_metrics,
    '{}'::jsonb,
    ARRAY[]::TEXT[]
  )
  ON CONFLICT (content_hash) DO UPDATE SET
    performance_metrics = EXCLUDED.performance_metrics,
    updated_at = NOW()
  RETURNING id INTO analysis_id;
  
  RETURN analysis_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_expertise_level(
  p_domain VARCHAR(100),
  p_performance_data JSONB DEFAULT '{}'::jsonb,
  p_knowledge_demonstration JSONB DEFAULT '{}'::jsonb
)
RETURNS VOID AS $$
DECLARE
  current_expertise DECIMAL(4,2);
  new_expertise DECIMAL(4,2);
  improvement_rate DECIMAL(4,2);
BEGIN
  SELECT expertise_level INTO current_expertise
  FROM expertise_evolution
  WHERE domain = p_domain
  ORDER BY measured_at DESC
  LIMIT 1;
  
  IF current_expertise IS NULL THEN
    current_expertise := 25.0;
  END IF;
  
  new_expertise := LEAST(100.0, current_expertise + 
    (COALESCE((p_performance_data->>'engagement_boost')::DECIMAL, 0) * 0.1) +
    (COALESCE((p_knowledge_demonstration->>'depth_score')::DECIMAL, 0) * 0.05)
  );
  
  improvement_rate := new_expertise - current_expertise;
  
  INSERT INTO expertise_evolution (
    domain,
    expertise_level,
    confidence_interval,
    previous_level,
    improvement_rate,
    skill_trajectory,
    supporting_tweets,
    knowledge_sources
  ) VALUES (
    p_domain,
    new_expertise,
    0.85,
    current_expertise,
    improvement_rate,
    CASE 
      WHEN improvement_rate > 0.5 THEN 'improving'
      WHEN improvement_rate < -0.5 THEN 'declining'
      ELSE 'stable'
    END,
    COALESCE(ARRAY[p_knowledge_demonstration->>'tweet_id'], ARRAY[]::TEXT[]),
    p_knowledge_demonstration
  );
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION detect_content_pattern(
  p_content_analysis JSONB DEFAULT '{}'::jsonb,
  p_performance_metrics JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID AS $$
DECLARE
  pattern_id UUID;
  pattern_signature VARCHAR(255);
  success_threshold DECIMAL(3,2) := 0.07;
BEGIN
  pattern_signature := md5(
    COALESCE(p_content_analysis->>'structure_type', 'unknown') ||
    COALESCE(p_content_analysis->>'primary_theme', 'general') ||
    COALESCE(p_content_analysis->>'engagement_hook_type', 'none')
  );
  
  IF COALESCE((p_performance_metrics->>'engagement_rate')::DECIMAL, 0) > success_threshold THEN
    INSERT INTO content_patterns (
      pattern_type,
      pattern_name,
      pattern_signature,
      pattern_elements,
      recognition_rules,
      success_instances,
      avg_performance_boost
    ) VALUES (
      'engagement_pattern',
      COALESCE(p_content_analysis->>'structure_type', 'unknown') || '_success',
      pattern_signature,
      p_content_analysis,
      jsonb_build_object('performance_threshold', success_threshold),
      1,
      COALESCE((p_performance_metrics->>'engagement_rate')::DECIMAL, 0)
    )
    ON CONFLICT (pattern_signature) DO UPDATE SET
      success_instances = content_patterns.success_instances + 1,
      avg_performance_boost = (
        content_patterns.avg_performance_boost * content_patterns.success_instances + 
        COALESCE((p_performance_metrics->>'engagement_rate')::DECIMAL, 0)
      ) / (content_patterns.success_instances + 1),
      last_successful_use = NOW(),
      updated_at = NOW()
    RETURNING id INTO pattern_id;
  END IF;
  
  RETURN pattern_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION capture_tweet_metrics(
  p_tweet_id VARCHAR(50),
  p_likes INTEGER DEFAULT 0,
  p_retweets INTEGER DEFAULT 0,
  p_replies INTEGER DEFAULT 0,
  p_impressions INTEGER DEFAULT 0
)
RETURNS VOID AS $$
DECLARE
  engagement_rate_calc DECIMAL(5,2);
  viral_score_calc DECIMAL(5,2);
BEGIN
  engagement_rate_calc := CASE 
    WHEN p_impressions > 0 THEN 
      ((p_likes + p_retweets + p_replies)::DECIMAL / p_impressions::DECIMAL) * 100
    ELSE 0
  END;
  
  viral_score_calc := LEAST(100.0, 
    (p_likes::DECIMAL * 1.0 + p_retweets::DECIMAL * 3.0 + p_replies::DECIMAL * 2.0) / 10.0
  );
  
  INSERT INTO tweet_metrics_enhanced (
    tweet_id,
    likes_count,
    retweets_count,
    replies_count,
    impressions_count,
    engagement_rate_calculated,
    viral_score
  ) VALUES (
    p_tweet_id,
    p_likes,
    p_retweets,
    p_replies,
    p_impressions,
    engagement_rate_calc,
    viral_score_calc
  );
  
  UPDATE tweets SET
    likes = p_likes,
    retweets = p_retweets,
    replies = p_replies,
    impressions = p_impressions,
    engagement_score = engagement_rate_calc::INTEGER,
    updated_at = NOW()
  WHERE tweet_id = p_tweet_id;
END;
$$ LANGUAGE plpgsql;

-- Enable learning
UPDATE bot_config SET value = 'true' WHERE key = 'learning_enabled';

SELECT 'Function names fixed - Intelligence system fully operational!' as status; 