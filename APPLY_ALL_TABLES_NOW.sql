-- ============================================================================
-- COMPLETE SCHEMA - ALL CRITICAL TABLES FOR xBOT
-- Paste this ENTIRE file into: https://supabase.com/dashboard/project/qtgjmaelglghnlahqpbl/sql
-- ============================================================================

-- 1. POSTED DECISIONS (Twitter posts)
CREATE TABLE IF NOT EXISTS posted_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id TEXT UNIQUE NOT NULL,
  tweet_id TEXT UNIQUE,
  content TEXT NOT NULL,
  posted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  likes INTEGER,
  retweets INTEGER,
  replies INTEGER,
  views INTEGER,
  bookmarks INTEGER,
  engagement_rate DECIMAL,
  predicted_followers INTEGER,
  predicted_engagement_rate DECIMAL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_posted_decisions_posted_at ON posted_decisions(posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_posted_decisions_tweet_id ON posted_decisions(tweet_id);

-- 2. CONTENT METADATA (Generated content)
CREATE TABLE IF NOT EXISTS content_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id TEXT UNIQUE NOT NULL,
  decision_type TEXT,
  content TEXT NOT NULL,
  bandit_arm TEXT,
  timing_arm TEXT,
  scheduled_at TIMESTAMP WITH TIME ZONE,
  quality_score DECIMAL,
  predicted_er DECIMAL,
  topic_cluster TEXT,
  generation_source TEXT,
  status TEXT DEFAULT 'queued',
  features JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_content_metadata_status ON content_metadata(status);
CREATE INDEX IF NOT EXISTS idx_content_metadata_scheduled_at ON content_metadata(scheduled_at);

-- 3. UNIFIED OUTCOMES (Real Twitter metrics - collected via scraping)
CREATE TABLE IF NOT EXISTS unified_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id TEXT NOT NULL,
  tweet_id TEXT,
  likes INTEGER DEFAULT 0,
  retweets INTEGER DEFAULT 0,
  replies INTEGER DEFAULT 0,
  views INTEGER DEFAULT 0,
  bookmarks INTEGER DEFAULT 0,
  engagement_rate DECIMAL,
  collection_phase TEXT, -- 'T+1h', 'T+24h', 'T+48h'
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_unified_outcomes_decision_id ON unified_outcomes(decision_id);
CREATE INDEX IF NOT EXISTS idx_unified_outcomes_tweet_id ON unified_outcomes(tweet_id);
CREATE INDEX IF NOT EXISTS idx_unified_outcomes_timestamp ON unified_outcomes(timestamp DESC);

-- 4. FOLLOWER ATTRIBUTION (Track follower growth per post)
CREATE TABLE IF NOT EXISTS follower_attribution (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id TEXT UNIQUE NOT NULL,
  post_id TEXT NOT NULL,
  followers_before INTEGER,
  followers_2h_after INTEGER,
  followers_24h_after INTEGER,
  followers_48h_after INTEGER,
  attributed_followers INTEGER DEFAULT 0,
  posted_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_follower_attribution_decision_id ON follower_attribution(decision_id);
CREATE INDEX IF NOT EXISTS idx_follower_attribution_posted_at ON follower_attribution(posted_at DESC);

-- 5. LEARNING DATA (System intelligence - what's working)
CREATE TABLE IF NOT EXISTS learning_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id TEXT NOT NULL,
  generator_type TEXT,
  topic TEXT,
  content_format TEXT,
  hook_type TEXT,
  viral_score INTEGER,
  follower_gain INTEGER DEFAULT 0,
  engagement_rate DECIMAL,
  likes INTEGER DEFAULT 0,
  retweets INTEGER DEFAULT 0,
  replies INTEGER DEFAULT 0,
  views INTEGER DEFAULT 0,
  quality_score DECIMAL,
  success_score DECIMAL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_learning_data_post_id ON learning_data(post_id);
CREATE INDEX IF NOT EXISTS idx_learning_data_generator_type ON learning_data(generator_type);
CREATE INDEX IF NOT EXISTS idx_learning_data_success_score ON learning_data(success_score DESC);

-- 6. POST ATTRIBUTION (For follower growth algorithms)
CREATE TABLE IF NOT EXISTS post_attribution (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id TEXT UNIQUE NOT NULL,
  decision_id TEXT,
  followers_before INTEGER,
  followers_2h_after INTEGER,
  followers_24h_after INTEGER,
  followers_48h_after INTEGER,
  followers_gained INTEGER DEFAULT 0,
  posted_at TIMESTAMP WITH TIME ZONE NOT NULL,
  last_check TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_post_attribution_post_id ON post_attribution(post_id);
CREATE INDEX IF NOT EXISTS idx_post_attribution_posted_at ON post_attribution(posted_at DESC);

-- 7. HOOK PERFORMANCE (Track which hooks get followers)
CREATE TABLE IF NOT EXISTS hook_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hook_id TEXT,
  hook_text TEXT NOT NULL,
  generation INTEGER DEFAULT 0,
  uses INTEGER DEFAULT 0,
  total_followers INTEGER DEFAULT 0,
  avg_followers_per_use DECIMAL,
  success_rate DECIMAL,
  last_used TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hook_performance_success_rate ON hook_performance(success_rate DESC);

-- 8. TOPIC PERFORMANCE (Track which topics get followers)
CREATE TABLE IF NOT EXISTS topic_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic TEXT UNIQUE NOT NULL,
  uses INTEGER DEFAULT 0,
  total_followers INTEGER DEFAULT 0,
  avg_followers_per_use DECIMAL,
  conversion_rate DECIMAL,
  last_used TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_topic_performance_conversion_rate ON topic_performance(conversion_rate DESC);

-- 9. GENERATOR PERFORMANCE (Track which AI generators get followers)
CREATE TABLE IF NOT EXISTS generator_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  generator_name TEXT UNIQUE NOT NULL,
  uses INTEGER DEFAULT 0,
  total_followers INTEGER DEFAULT 0,
  avg_followers_per_use DECIMAL,
  success_rate DECIMAL,
  last_used TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_generator_performance_success_rate ON generator_performance(success_rate DESC);

-- 10. META INSIGHTS (Cross-pattern learning)
CREATE TABLE IF NOT EXISTS meta_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  insight_type TEXT NOT NULL,
  pattern TEXT NOT NULL,
  confidence DECIMAL,
  impact_score DECIMAL,
  evidence JSONB,
  auto_applied BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meta_insights_impact_score ON meta_insights(impact_score DESC);

-- 11. AB TEST RESULTS (Systematic testing)
CREATE TABLE IF NOT EXISTS ab_test_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id TEXT NOT NULL,
  variant TEXT NOT NULL,
  metric TEXT NOT NULL,
  value DECIMAL,
  sample_size INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ab_test_results_test_id ON ab_test_results(test_id);

-- 12. PREDICTOR MODELS (ML predictions)
CREATE TABLE IF NOT EXISTS predictor_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_type TEXT NOT NULL,
  coefficients JSONB NOT NULL,
  accuracy DECIMAL,
  sample_size INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_predictor_models_model_type ON predictor_models(model_type);
CREATE INDEX IF NOT EXISTS idx_predictor_models_updated_at ON predictor_models(updated_at DESC);

-- 13. FOLLOWER PREDICTIONS (Track prediction accuracy)
CREATE TABLE IF NOT EXISTS follower_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id TEXT UNIQUE NOT NULL,
  predicted_followers INTEGER,
  confidence DECIMAL,
  actual_followers INTEGER,
  prediction_error DECIMAL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_follower_predictions_decision_id ON follower_predictions(decision_id);

-- ============================================================================
-- ✅ COMPLETE! All critical tables created.
-- ============================================================================

-- Verify tables were created
SELECT 
  schemaname, 
  tablename 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN (
    'posted_decisions',
    'content_metadata',
    'unified_outcomes',
    'follower_attribution',
    'learning_data',
    'post_attribution',
    'hook_performance',
    'topic_performance',
    'generator_performance',
    'meta_insights',
    'ab_test_results',
    'predictor_models',
    'follower_predictions'
  )
ORDER BY tablename;

-- COMPLETE SCHEMA - ALL CRITICAL TABLES FOR xBOT
-- Paste this ENTIRE file into: https://supabase.com/dashboard/project/qtgjmaelglghnlahqpbl/sql
-- ============================================================================

-- 1. POSTED DECISIONS (Twitter posts)
CREATE TABLE IF NOT EXISTS posted_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id TEXT UNIQUE NOT NULL,
  tweet_id TEXT UNIQUE,
  content TEXT NOT NULL,
  posted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  likes INTEGER,
  retweets INTEGER,
  replies INTEGER,
  views INTEGER,
  bookmarks INTEGER,
  engagement_rate DECIMAL,
  predicted_followers INTEGER,
  predicted_engagement_rate DECIMAL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_posted_decisions_posted_at ON posted_decisions(posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_posted_decisions_tweet_id ON posted_decisions(tweet_id);

-- 2. CONTENT METADATA (Generated content)
CREATE TABLE IF NOT EXISTS content_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id TEXT UNIQUE NOT NULL,
  decision_type TEXT,
  content TEXT NOT NULL,
  bandit_arm TEXT,
  timing_arm TEXT,
  scheduled_at TIMESTAMP WITH TIME ZONE,
  quality_score DECIMAL,
  predicted_er DECIMAL,
  topic_cluster TEXT,
  generation_source TEXT,
  status TEXT DEFAULT 'queued',
  features JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_content_metadata_status ON content_metadata(status);
CREATE INDEX IF NOT EXISTS idx_content_metadata_scheduled_at ON content_metadata(scheduled_at);

-- 3. UNIFIED OUTCOMES (Real Twitter metrics - collected via scraping)
CREATE TABLE IF NOT EXISTS unified_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id TEXT NOT NULL,
  tweet_id TEXT,
  likes INTEGER DEFAULT 0,
  retweets INTEGER DEFAULT 0,
  replies INTEGER DEFAULT 0,
  views INTEGER DEFAULT 0,
  bookmarks INTEGER DEFAULT 0,
  engagement_rate DECIMAL,
  collection_phase TEXT, -- 'T+1h', 'T+24h', 'T+48h'
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_unified_outcomes_decision_id ON unified_outcomes(decision_id);
CREATE INDEX IF NOT EXISTS idx_unified_outcomes_tweet_id ON unified_outcomes(tweet_id);
CREATE INDEX IF NOT EXISTS idx_unified_outcomes_timestamp ON unified_outcomes(timestamp DESC);

-- 4. FOLLOWER ATTRIBUTION (Track follower growth per post)
CREATE TABLE IF NOT EXISTS follower_attribution (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id TEXT UNIQUE NOT NULL,
  post_id TEXT NOT NULL,
  followers_before INTEGER,
  followers_2h_after INTEGER,
  followers_24h_after INTEGER,
  followers_48h_after INTEGER,
  attributed_followers INTEGER DEFAULT 0,
  posted_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_follower_attribution_decision_id ON follower_attribution(decision_id);
CREATE INDEX IF NOT EXISTS idx_follower_attribution_posted_at ON follower_attribution(posted_at DESC);

-- 5. LEARNING DATA (System intelligence - what's working)
CREATE TABLE IF NOT EXISTS learning_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id TEXT NOT NULL,
  generator_type TEXT,
  topic TEXT,
  content_format TEXT,
  hook_type TEXT,
  viral_score INTEGER,
  follower_gain INTEGER DEFAULT 0,
  engagement_rate DECIMAL,
  likes INTEGER DEFAULT 0,
  retweets INTEGER DEFAULT 0,
  replies INTEGER DEFAULT 0,
  views INTEGER DEFAULT 0,
  quality_score DECIMAL,
  success_score DECIMAL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_learning_data_post_id ON learning_data(post_id);
CREATE INDEX IF NOT EXISTS idx_learning_data_generator_type ON learning_data(generator_type);
CREATE INDEX IF NOT EXISTS idx_learning_data_success_score ON learning_data(success_score DESC);

-- 6. POST ATTRIBUTION (For follower growth algorithms)
CREATE TABLE IF NOT EXISTS post_attribution (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id TEXT UNIQUE NOT NULL,
  decision_id TEXT,
  followers_before INTEGER,
  followers_2h_after INTEGER,
  followers_24h_after INTEGER,
  followers_48h_after INTEGER,
  followers_gained INTEGER DEFAULT 0,
  posted_at TIMESTAMP WITH TIME ZONE NOT NULL,
  last_check TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_post_attribution_post_id ON post_attribution(post_id);
CREATE INDEX IF NOT EXISTS idx_post_attribution_posted_at ON post_attribution(posted_at DESC);

-- 7. HOOK PERFORMANCE (Track which hooks get followers)
CREATE TABLE IF NOT EXISTS hook_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hook_id TEXT,
  hook_text TEXT NOT NULL,
  generation INTEGER DEFAULT 0,
  uses INTEGER DEFAULT 0,
  total_followers INTEGER DEFAULT 0,
  avg_followers_per_use DECIMAL,
  success_rate DECIMAL,
  last_used TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hook_performance_success_rate ON hook_performance(success_rate DESC);

-- 8. TOPIC PERFORMANCE (Track which topics get followers)
CREATE TABLE IF NOT EXISTS topic_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic TEXT UNIQUE NOT NULL,
  uses INTEGER DEFAULT 0,
  total_followers INTEGER DEFAULT 0,
  avg_followers_per_use DECIMAL,
  conversion_rate DECIMAL,
  last_used TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_topic_performance_conversion_rate ON topic_performance(conversion_rate DESC);

-- 9. GENERATOR PERFORMANCE (Track which AI generators get followers)
CREATE TABLE IF NOT EXISTS generator_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  generator_name TEXT UNIQUE NOT NULL,
  uses INTEGER DEFAULT 0,
  total_followers INTEGER DEFAULT 0,
  avg_followers_per_use DECIMAL,
  success_rate DECIMAL,
  last_used TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_generator_performance_success_rate ON generator_performance(success_rate DESC);

-- 10. META INSIGHTS (Cross-pattern learning)
CREATE TABLE IF NOT EXISTS meta_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  insight_type TEXT NOT NULL,
  pattern TEXT NOT NULL,
  confidence DECIMAL,
  impact_score DECIMAL,
  evidence JSONB,
  auto_applied BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meta_insights_impact_score ON meta_insights(impact_score DESC);

-- 11. AB TEST RESULTS (Systematic testing)
CREATE TABLE IF NOT EXISTS ab_test_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id TEXT NOT NULL,
  variant TEXT NOT NULL,
  metric TEXT NOT NULL,
  value DECIMAL,
  sample_size INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ab_test_results_test_id ON ab_test_results(test_id);

-- 12. PREDICTOR MODELS (ML predictions)
CREATE TABLE IF NOT EXISTS predictor_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_type TEXT NOT NULL,
  coefficients JSONB NOT NULL,
  accuracy DECIMAL,
  sample_size INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_predictor_models_model_type ON predictor_models(model_type);
CREATE INDEX IF NOT EXISTS idx_predictor_models_updated_at ON predictor_models(updated_at DESC);

-- 13. FOLLOWER PREDICTIONS (Track prediction accuracy)
CREATE TABLE IF NOT EXISTS follower_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id TEXT UNIQUE NOT NULL,
  predicted_followers INTEGER,
  confidence DECIMAL,
  actual_followers INTEGER,
  prediction_error DECIMAL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_follower_predictions_decision_id ON follower_predictions(decision_id);

-- ============================================================================
-- ✅ COMPLETE! All critical tables created.
-- ============================================================================

-- Verify tables were created
SELECT 
  schemaname, 
  tablename 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN (
    'posted_decisions',
    'content_metadata',
    'unified_outcomes',
    'follower_attribution',
    'learning_data',
    'post_attribution',
    'hook_performance',
    'topic_performance',
    'generator_performance',
    'meta_insights',
    'ab_test_results',
    'predictor_models',
    'follower_predictions'
  )
ORDER BY tablename;

-- COMPLETE SCHEMA - ALL CRITICAL TABLES FOR xBOT
-- Paste this ENTIRE file into: https://supabase.com/dashboard/project/qtgjmaelglghnlahqpbl/sql
-- ============================================================================

-- 1. POSTED DECISIONS (Twitter posts)
CREATE TABLE IF NOT EXISTS posted_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id TEXT UNIQUE NOT NULL,
  tweet_id TEXT UNIQUE,
  content TEXT NOT NULL,
  posted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  likes INTEGER,
  retweets INTEGER,
  replies INTEGER,
  views INTEGER,
  bookmarks INTEGER,
  engagement_rate DECIMAL,
  predicted_followers INTEGER,
  predicted_engagement_rate DECIMAL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_posted_decisions_posted_at ON posted_decisions(posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_posted_decisions_tweet_id ON posted_decisions(tweet_id);

-- 2. CONTENT METADATA (Generated content)
CREATE TABLE IF NOT EXISTS content_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id TEXT UNIQUE NOT NULL,
  decision_type TEXT,
  content TEXT NOT NULL,
  bandit_arm TEXT,
  timing_arm TEXT,
  scheduled_at TIMESTAMP WITH TIME ZONE,
  quality_score DECIMAL,
  predicted_er DECIMAL,
  topic_cluster TEXT,
  generation_source TEXT,
  status TEXT DEFAULT 'queued',
  features JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_content_metadata_status ON content_metadata(status);
CREATE INDEX IF NOT EXISTS idx_content_metadata_scheduled_at ON content_metadata(scheduled_at);

-- 3. UNIFIED OUTCOMES (Real Twitter metrics - collected via scraping)
CREATE TABLE IF NOT EXISTS unified_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id TEXT NOT NULL,
  tweet_id TEXT,
  likes INTEGER DEFAULT 0,
  retweets INTEGER DEFAULT 0,
  replies INTEGER DEFAULT 0,
  views INTEGER DEFAULT 0,
  bookmarks INTEGER DEFAULT 0,
  engagement_rate DECIMAL,
  collection_phase TEXT, -- 'T+1h', 'T+24h', 'T+48h'
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_unified_outcomes_decision_id ON unified_outcomes(decision_id);
CREATE INDEX IF NOT EXISTS idx_unified_outcomes_tweet_id ON unified_outcomes(tweet_id);
CREATE INDEX IF NOT EXISTS idx_unified_outcomes_timestamp ON unified_outcomes(timestamp DESC);

-- 4. FOLLOWER ATTRIBUTION (Track follower growth per post)
CREATE TABLE IF NOT EXISTS follower_attribution (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id TEXT UNIQUE NOT NULL,
  post_id TEXT NOT NULL,
  followers_before INTEGER,
  followers_2h_after INTEGER,
  followers_24h_after INTEGER,
  followers_48h_after INTEGER,
  attributed_followers INTEGER DEFAULT 0,
  posted_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_follower_attribution_decision_id ON follower_attribution(decision_id);
CREATE INDEX IF NOT EXISTS idx_follower_attribution_posted_at ON follower_attribution(posted_at DESC);

-- 5. LEARNING DATA (System intelligence - what's working)
CREATE TABLE IF NOT EXISTS learning_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id TEXT NOT NULL,
  generator_type TEXT,
  topic TEXT,
  content_format TEXT,
  hook_type TEXT,
  viral_score INTEGER,
  follower_gain INTEGER DEFAULT 0,
  engagement_rate DECIMAL,
  likes INTEGER DEFAULT 0,
  retweets INTEGER DEFAULT 0,
  replies INTEGER DEFAULT 0,
  views INTEGER DEFAULT 0,
  quality_score DECIMAL,
  success_score DECIMAL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_learning_data_post_id ON learning_data(post_id);
CREATE INDEX IF NOT EXISTS idx_learning_data_generator_type ON learning_data(generator_type);
CREATE INDEX IF NOT EXISTS idx_learning_data_success_score ON learning_data(success_score DESC);

-- 6. POST ATTRIBUTION (For follower growth algorithms)
CREATE TABLE IF NOT EXISTS post_attribution (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id TEXT UNIQUE NOT NULL,
  decision_id TEXT,
  followers_before INTEGER,
  followers_2h_after INTEGER,
  followers_24h_after INTEGER,
  followers_48h_after INTEGER,
  followers_gained INTEGER DEFAULT 0,
  posted_at TIMESTAMP WITH TIME ZONE NOT NULL,
  last_check TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_post_attribution_post_id ON post_attribution(post_id);
CREATE INDEX IF NOT EXISTS idx_post_attribution_posted_at ON post_attribution(posted_at DESC);

-- 7. HOOK PERFORMANCE (Track which hooks get followers)
CREATE TABLE IF NOT EXISTS hook_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hook_id TEXT,
  hook_text TEXT NOT NULL,
  generation INTEGER DEFAULT 0,
  uses INTEGER DEFAULT 0,
  total_followers INTEGER DEFAULT 0,
  avg_followers_per_use DECIMAL,
  success_rate DECIMAL,
  last_used TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hook_performance_success_rate ON hook_performance(success_rate DESC);

-- 8. TOPIC PERFORMANCE (Track which topics get followers)
CREATE TABLE IF NOT EXISTS topic_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic TEXT UNIQUE NOT NULL,
  uses INTEGER DEFAULT 0,
  total_followers INTEGER DEFAULT 0,
  avg_followers_per_use DECIMAL,
  conversion_rate DECIMAL,
  last_used TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_topic_performance_conversion_rate ON topic_performance(conversion_rate DESC);

-- 9. GENERATOR PERFORMANCE (Track which AI generators get followers)
CREATE TABLE IF NOT EXISTS generator_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  generator_name TEXT UNIQUE NOT NULL,
  uses INTEGER DEFAULT 0,
  total_followers INTEGER DEFAULT 0,
  avg_followers_per_use DECIMAL,
  success_rate DECIMAL,
  last_used TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_generator_performance_success_rate ON generator_performance(success_rate DESC);

-- 10. META INSIGHTS (Cross-pattern learning)
CREATE TABLE IF NOT EXISTS meta_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  insight_type TEXT NOT NULL,
  pattern TEXT NOT NULL,
  confidence DECIMAL,
  impact_score DECIMAL,
  evidence JSONB,
  auto_applied BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meta_insights_impact_score ON meta_insights(impact_score DESC);

-- 11. AB TEST RESULTS (Systematic testing)
CREATE TABLE IF NOT EXISTS ab_test_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id TEXT NOT NULL,
  variant TEXT NOT NULL,
  metric TEXT NOT NULL,
  value DECIMAL,
  sample_size INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ab_test_results_test_id ON ab_test_results(test_id);

-- 12. PREDICTOR MODELS (ML predictions)
CREATE TABLE IF NOT EXISTS predictor_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_type TEXT NOT NULL,
  coefficients JSONB NOT NULL,
  accuracy DECIMAL,
  sample_size INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_predictor_models_model_type ON predictor_models(model_type);
CREATE INDEX IF NOT EXISTS idx_predictor_models_updated_at ON predictor_models(updated_at DESC);

-- 13. FOLLOWER PREDICTIONS (Track prediction accuracy)
CREATE TABLE IF NOT EXISTS follower_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id TEXT UNIQUE NOT NULL,
  predicted_followers INTEGER,
  confidence DECIMAL,
  actual_followers INTEGER,
  prediction_error DECIMAL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_follower_predictions_decision_id ON follower_predictions(decision_id);

-- ============================================================================
-- ✅ COMPLETE! All critical tables created.
-- ============================================================================

-- Verify tables were created
SELECT 
  schemaname, 
  tablename 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN (
    'posted_decisions',
    'content_metadata',
    'unified_outcomes',
    'follower_attribution',
    'learning_data',
    'post_attribution',
    'hook_performance',
    'topic_performance',
    'generator_performance',
    'meta_insights',
    'ab_test_results',
    'predictor_models',
    'follower_predictions'
  )
ORDER BY tablename;

