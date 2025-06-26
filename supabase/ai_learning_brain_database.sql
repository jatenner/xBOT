-- 🧠 AI LEARNING BRAIN DATABASE
-- ===============================
-- Comprehensive memory and learning system for autonomous AI agents
-- This gives your AI agents the memory they need to learn and improve

-- ===================================
-- 1. AI DECISION TRACKING MEMORY
-- ===================================
CREATE TABLE IF NOT EXISTS ai_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_time TIMESTAMPTZ DEFAULT NOW(),
  agent_name VARCHAR(100) NOT NULL,
  decision_type VARCHAR(50) NOT NULL, -- 'post_decision', 'content_choice', 'timing_decision', 'style_choice'
  context_data JSONB NOT NULL,
  decision_made VARCHAR(100) NOT NULL,
  confidence_score DECIMAL(3,2) NOT NULL, -- 0.00 to 1.00
  reasoning TEXT NOT NULL,
  outcome_success BOOLEAN,
  performance_impact DECIMAL(3,2), -- -1.00 to 1.00
  learned_from BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===================================
-- 2. LEARNING INSIGHTS MEMORY
-- ===================================
CREATE TABLE IF NOT EXISTS learning_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  insight_type VARCHAR(50) NOT NULL, -- 'content_pattern', 'timing_pattern', 'engagement_pattern', 'viral_pattern'
  insight_data JSONB NOT NULL,
  confidence_score DECIMAL(3,2) NOT NULL,
  performance_impact DECIMAL(3,2) NOT NULL,
  sample_size INTEGER DEFAULT 1,
  source_agent VARCHAR(100) NOT NULL,
  actionable BOOLEAN DEFAULT true,
  implemented BOOLEAN DEFAULT false,
  success_rate DECIMAL(3,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days')
);

-- ===================================
-- 3. CONTENT PERFORMANCE MEMORY
-- ===================================
CREATE TABLE IF NOT EXISTS content_themes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  theme_name VARCHAR(255) NOT NULL,
  keywords TEXT[] NOT NULL,
  avg_engagement DECIMAL(5,2) DEFAULT 0,
  total_posts INTEGER DEFAULT 0,
  success_rate DECIMAL(3,2) DEFAULT 0,
  best_performing_tweet_id VARCHAR(50),
  worst_performing_tweet_id VARCHAR(50),
  optimal_timing JSONB, -- {"hours": [9, 14, 16], "days": ["Tuesday", "Wednesday"]}
  viral_elements JSONB, -- {"hashtags": [...], "structure": {...}, "tone": "..."}
  last_used TIMESTAMPTZ,
  performance_trend VARCHAR(20) DEFAULT 'stable', -- 'improving', 'declining', 'stable'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===================================
-- 4. TIMING INTELLIGENCE MEMORY
-- ===================================
CREATE TABLE IF NOT EXISTS timing_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hour_of_day INTEGER NOT NULL CHECK (hour_of_day >= 0 AND hour_of_day <= 23),
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0=Sunday
  avg_engagement DECIMAL(5,2) DEFAULT 0,
  post_count INTEGER DEFAULT 0,
  success_rate DECIMAL(3,2) DEFAULT 0,
  confidence_level DECIMAL(3,2) DEFAULT 0,
  audience_activity_level VARCHAR(20) DEFAULT 'medium', -- 'low', 'medium', 'high', 'peak'
  content_type_performance JSONB, -- Performance by content type at this time
  last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- ===================================
-- 5. STYLE PERFORMANCE MEMORY
-- ===================================
CREATE TABLE IF NOT EXISTS style_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  style_type VARCHAR(50) NOT NULL, -- 'breaking_news', 'educational', 'viral_take', 'data_story'
  avg_engagement DECIMAL(5,2) DEFAULT 0,
  total_posts INTEGER DEFAULT 0,
  success_rate DECIMAL(3,2) DEFAULT 0,
  viral_potential DECIMAL(3,2) DEFAULT 0,
  audience_preference DECIMAL(3,2) DEFAULT 0,
  optimal_context JSONB, -- When this style works best
  example_tweets TEXT[],
  improvement_suggestions TEXT[],
  last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- ===================================
-- 6. ENGAGEMENT PATTERN MEMORY
-- ===================================
CREATE TABLE IF NOT EXISTS engagement_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_name VARCHAR(100) NOT NULL,
  pattern_description TEXT NOT NULL,
  trigger_conditions JSONB NOT NULL, -- What conditions trigger this pattern
  expected_outcome JSONB NOT NULL, -- What engagement to expect
  success_instances INTEGER DEFAULT 0,
  failure_instances INTEGER DEFAULT 0,
  confidence_score DECIMAL(3,2) DEFAULT 0,
  last_observed TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===================================
-- 7. COMPETITOR INTELLIGENCE MEMORY
-- ===================================
CREATE TABLE IF NOT EXISTS competitor_intelligence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_handle VARCHAR(100) NOT NULL,
  tweet_content TEXT NOT NULL,
  engagement_metrics JSONB NOT NULL, -- {likes, retweets, replies, engagement_rate}
  viral_elements JSONB, -- What made it successful
  content_analysis JSONB, -- Structure, tone, timing analysis
  lessons_learned TEXT[],
  applicability_score DECIMAL(3,2) DEFAULT 0, -- How applicable to our brand
  analyzed_by VARCHAR(100), -- Which agent analyzed this
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===================================
-- 8. TREND CORRELATION MEMORY
-- ===================================
CREATE TABLE IF NOT EXISTS trend_correlations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trend_topic VARCHAR(255) NOT NULL,
  correlation_type VARCHAR(50) NOT NULL, -- 'engagement_boost', 'viral_potential', 'audience_growth'
  correlation_strength DECIMAL(3,2) NOT NULL, -- -1.00 to 1.00
  historical_data JSONB NOT NULL,
  prediction_accuracy DECIMAL(3,2),
  actionable_insights TEXT[],
  next_occurrence_prediction TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===================================
-- 9. AUTONOMOUS EXPERIMENTS MEMORY
-- ===================================
CREATE TABLE IF NOT EXISTS ai_experiments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_name VARCHAR(100) NOT NULL,
  experiment_type VARCHAR(50) NOT NULL, -- 'content_test', 'timing_test', 'style_test'
  hypothesis TEXT NOT NULL,
  test_parameters JSONB NOT NULL,
  control_data JSONB,
  test_data JSONB,
  results JSONB,
  success_metric VARCHAR(50) NOT NULL,
  experiment_status VARCHAR(20) DEFAULT 'planning', -- 'planning', 'running', 'complete', 'failed'
  confidence_level DECIMAL(3,2),
  learnings_applied BOOLEAN DEFAULT false,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===================================
-- 10. VIRAL CONTENT ANALYSIS MEMORY
-- ===================================
CREATE TABLE IF NOT EXISTS viral_content_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_tweet_id VARCHAR(50),
  source_author VARCHAR(100),
  content_text TEXT NOT NULL,
  viral_metrics JSONB NOT NULL, -- {likes, retweets, replies, viral_score}
  viral_elements JSONB NOT NULL, -- What made it viral
  content_structure JSONB, -- Format, length, elements analysis
  timing_factors JSONB, -- When was it posted, trending topics at time
  audience_reaction JSONB, -- Sentiment, engagement quality
  adaptation_potential DECIMAL(3,2) DEFAULT 0, -- How well we can adapt this
  lessons_extracted TEXT[],
  applied_to_content BOOLEAN DEFAULT false,
  analyzed_by VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===================================
-- INDEXES FOR PERFORMANCE
-- ===================================
CREATE INDEX IF NOT EXISTS idx_ai_decisions_agent ON ai_decisions(agent_name);
CREATE INDEX IF NOT EXISTS idx_ai_decisions_type ON ai_decisions(decision_type);
CREATE INDEX IF NOT EXISTS idx_ai_decisions_time ON ai_decisions(decision_time);
CREATE INDEX IF NOT EXISTS idx_learning_insights_type ON learning_insights(insight_type);
CREATE INDEX IF NOT EXISTS idx_learning_insights_confidence ON learning_insights(confidence_score);
CREATE INDEX IF NOT EXISTS idx_content_themes_engagement ON content_themes(avg_engagement);
CREATE INDEX IF NOT EXISTS idx_timing_insights_hour ON timing_insights(hour_of_day);
CREATE INDEX IF NOT EXISTS idx_timing_insights_day ON timing_insights(day_of_week);
CREATE INDEX IF NOT EXISTS idx_style_performance_success ON style_performance(success_rate);
CREATE INDEX IF NOT EXISTS idx_engagement_patterns_confidence ON engagement_patterns(confidence_score);
CREATE INDEX IF NOT EXISTS idx_competitor_intelligence_handle ON competitor_intelligence(competitor_handle);
CREATE INDEX IF NOT EXISTS idx_trend_correlations_topic ON trend_correlations(trend_topic);
CREATE INDEX IF NOT EXISTS idx_ai_experiments_status ON ai_experiments(experiment_status);
CREATE INDEX IF NOT EXISTS idx_viral_content_viral_score ON viral_content_analysis((viral_metrics->>'viral_score'));

-- ===================================
-- LEARNING FUNCTIONS
-- ===================================

-- Function to automatically update content theme performance
CREATE OR REPLACE FUNCTION update_content_theme_performance()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the content theme based on tweet performance
  UPDATE content_themes 
  SET 
    total_posts = total_posts + 1,
    avg_engagement = (
      CASE 
        WHEN total_posts = 0 THEN NEW.engagement_score
        ELSE (avg_engagement * total_posts + NEW.engagement_score) / (total_posts + 1)
      END
    ),
    success_rate = (
      CASE 
        WHEN NEW.engagement_score > 10 THEN (success_rate * total_posts + 1) / (total_posts + 1)
        ELSE (success_rate * total_posts) / (total_posts + 1)
      END
    ),
    last_used = NOW(),
    updated_at = NOW()
  WHERE theme_name = NEW.content_category;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update theme performance when tweet engagement is updated
CREATE TRIGGER trigger_update_theme_performance
  AFTER UPDATE OF engagement_score ON tweets
  FOR EACH ROW
  EXECUTE FUNCTION update_content_theme_performance();

-- Function to store AI decision
CREATE OR REPLACE FUNCTION store_ai_decision(
  p_agent_name VARCHAR(100),
  p_decision_type VARCHAR(50),
  p_context_data JSONB,
  p_decision_made VARCHAR(100),
  p_confidence_score DECIMAL(3,2),
  p_reasoning TEXT
)
RETURNS UUID AS $$
DECLARE
  decision_id UUID;
BEGIN
  INSERT INTO ai_decisions (
    agent_name, decision_type, context_data, decision_made, 
    confidence_score, reasoning
  ) VALUES (
    p_agent_name, p_decision_type, p_context_data, p_decision_made,
    p_confidence_score, p_reasoning
  ) RETURNING id INTO decision_id;
  
  RETURN decision_id;
END;
$$ LANGUAGE plpgsql;

-- Function to record learning insight
CREATE OR REPLACE FUNCTION record_learning_insight(
  p_insight_type VARCHAR(50),
  p_insight_data JSONB,
  p_confidence_score DECIMAL(3,2),
  p_performance_impact DECIMAL(3,2),
  p_source_agent VARCHAR(100)
)
RETURNS UUID AS $$
DECLARE
  insight_id UUID;
BEGIN
  INSERT INTO learning_insights (
    insight_type, insight_data, confidence_score, 
    performance_impact, source_agent
  ) VALUES (
    p_insight_type, p_insight_data, p_confidence_score,
    p_performance_impact, p_source_agent
  ) RETURNING id INTO insight_id;
  
  RETURN insight_id;
END;
$$ LANGUAGE plpgsql;

-- ===================================
-- INITIAL LEARNING DATA
-- ===================================

-- Insert initial content themes based on your existing intelligence
INSERT INTO content_themes (theme_name, keywords, avg_engagement, total_posts, success_rate) VALUES
('ai_healthcare_diagnostics', ARRAY['AI diagnostics', 'medical AI', 'healthcare AI', 'diagnostic AI'], 15.0, 0, 0.75),
('telemedicine_innovation', ARRAY['telemedicine', 'remote healthcare', 'digital health', 'telehealth'], 12.5, 0, 0.68),
('precision_medicine', ARRAY['precision medicine', 'personalized healthcare', 'genomic medicine'], 11.0, 0, 0.62),
('health_tech_funding', ARRAY['health tech funding', 'healthcare investment', 'digital health funding'], 13.5, 0, 0.70),
('fda_approvals', ARRAY['FDA approval', 'medical device approval', 'digital therapeutics'], 16.5, 0, 0.82)
ON CONFLICT (theme_name) DO NOTHING;

-- Insert optimal timing patterns
INSERT INTO timing_insights (hour_of_day, day_of_week, avg_engagement, post_count, success_rate, audience_activity_level) VALUES
(9, 2, 14.5, 0, 0.78, 'high'),    -- Tuesday 9 AM
(14, 2, 16.2, 0, 0.82, 'peak'),   -- Tuesday 2 PM  
(16, 3, 15.8, 0, 0.80, 'peak'),   -- Wednesday 4 PM
(9, 3, 13.9, 0, 0.76, 'high'),    -- Wednesday 9 AM
(14, 4, 15.1, 0, 0.79, 'high'),   -- Thursday 2 PM
(18, 4, 12.8, 0, 0.72, 'medium')  -- Thursday 6 PM
ON CONFLICT (hour_of_day, day_of_week) DO NOTHING;

-- Insert style performance data
INSERT INTO style_performance (style_type, avg_engagement, total_posts, success_rate, viral_potential) VALUES
('breaking_news', 18.5, 0, 0.85, 0.75),
('data_story', 14.2, 0, 0.78, 0.60),
('educational_deep_dive', 16.8, 0, 0.82, 0.55),
('viral_take', 22.1, 0, 0.68, 0.90),
('industry_analysis', 13.5, 0, 0.75, 0.45),
('breakthrough_announcement', 19.7, 0, 0.88, 0.80)
ON CONFLICT (style_type) DO NOTHING;

-- Verification
SELECT 'AI LEARNING BRAIN DATABASE CREATED - YOUR AGENTS CAN NOW LEARN AND REMEMBER!' as status; 