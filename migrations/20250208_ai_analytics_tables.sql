-- 🧠 AI ANALYTICS SYSTEM DATABASE SCHEMA
-- Tables for intelligent decision engine and real-time analytics

-- AI Twitter Analytics Table
CREATE TABLE IF NOT EXISTS ai_twitter_analytics (
  id SERIAL PRIMARY KEY,
  hour_of_day INTEGER NOT NULL CHECK (hour_of_day >= 0 AND hour_of_day <= 23),
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  likes INTEGER DEFAULT 0,
  retweets INTEGER DEFAULT 0,
  replies INTEGER DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  followers_gained INTEGER DEFAULT 0,
  content_type TEXT NOT NULL,
  voice_style TEXT NOT NULL,
  engagement_rate DECIMAL(5,2) DEFAULT 0,
  follower_conversion_rate DECIMAL(5,2) DEFAULT 0,
  trending_topics TEXT[] DEFAULT '{}',
  optimal_posting_window BOOLEAN DEFAULT FALSE,
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Real-Time Post Analytics Table
CREATE TABLE IF NOT EXISTS real_time_post_analytics (
  id SERIAL PRIMARY KEY,
  tweet_id TEXT UNIQUE NOT NULL,
  content TEXT NOT NULL,
  content_type TEXT NOT NULL,
  voice_style TEXT NOT NULL,
  likes INTEGER DEFAULT 0,
  retweets INTEGER DEFAULT 0,
  replies INTEGER DEFAULT 0,
  views INTEGER DEFAULT 0,
  engagement_rate DECIMAL(5,2) DEFAULT 0,
  follower_conversion_rate DECIMAL(5,2) DEFAULT 0,
  viral_coefficient DECIMAL(5,2) DEFAULT 0,
  posted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  analyzed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Trending Topics Analysis Table
CREATE TABLE IF NOT EXISTS trending_topics_analysis (
  id SERIAL PRIMARY KEY,
  topic TEXT NOT NULL,
  volume INTEGER DEFAULT 0,
  health_relevance_score INTEGER DEFAULT 0 CHECK (health_relevance_score >= 0 AND health_relevance_score <= 100),
  competition_level DECIMAL(5,2) DEFAULT 0,
  opportunity_window_minutes INTEGER DEFAULT 0,
  suggested_content_angle TEXT,
  detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Audience Activity Data Table
CREATE TABLE IF NOT EXISTS audience_activity_data (
  id SERIAL PRIMARY KEY,
  hour_of_day INTEGER NOT NULL CHECK (hour_of_day >= 0 AND hour_of_day <= 23),
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  active_followers_estimate INTEGER DEFAULT 0,
  engagement_multiplier DECIMAL(5,2) DEFAULT 1.0,
  optimal_content_types TEXT[] DEFAULT '{}',
  competition_accounts_active INTEGER DEFAULT 0,
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- AI Decision History Table
CREATE TABLE IF NOT EXISTS ai_decision_history (
  id SERIAL PRIMARY KEY,
  decision_type TEXT CHECK (decision_type IN ('timing', 'content', 'voice_style', 'engagement')) NOT NULL,
  recommendation TEXT NOT NULL,
  confidence_score INTEGER DEFAULT 0 CHECK (confidence_score >= 0 AND confidence_score <= 100),
  reasoning TEXT,
  data_inputs JSONB,
  actual_outcome JSONB,
  prediction_accuracy DECIMAL(5,2),
  decision_made_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  outcome_recorded_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Content Performance Predictions Table
CREATE TABLE IF NOT EXISTS content_performance_predictions (
  id SERIAL PRIMARY KEY,
  content_hash TEXT NOT NULL,
  content_type TEXT NOT NULL,
  voice_style TEXT NOT NULL,
  topic TEXT,
  predicted_engagement DECIMAL(5,2) DEFAULT 0,
  predicted_followers INTEGER DEFAULT 0,
  predicted_viral_score DECIMAL(5,2) DEFAULT 0,
  actual_engagement DECIMAL(5,2),
  actual_followers INTEGER,
  actual_viral_score DECIMAL(5,2),
  prediction_accuracy DECIMAL(5,2),
  confidence_score INTEGER DEFAULT 0,
  predicted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  measured_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Optimal Timing Patterns Table
CREATE TABLE IF NOT EXISTS optimal_timing_patterns (
  id SERIAL PRIMARY KEY,
  hour_of_day INTEGER NOT NULL CHECK (hour_of_day >= 0 AND hour_of_day <= 23),
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  content_type TEXT NOT NULL,
  average_engagement DECIMAL(5,2) DEFAULT 0,
  average_followers_gained DECIMAL(5,2) DEFAULT 0,
  sample_size INTEGER DEFAULT 0,
  confidence_level DECIMAL(5,2) DEFAULT 0,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(hour_of_day, day_of_week, content_type)
);

-- Content Diversity Tracking Table
CREATE TABLE IF NOT EXISTS content_diversity_tracking (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  content_type TEXT NOT NULL,
  voice_style TEXT NOT NULL,
  usage_count INTEGER DEFAULT 0,
  performance_score DECIMAL(5,2) DEFAULT 0,
  diversity_penalty DECIMAL(5,2) DEFAULT 0,
  optimal_usage_target INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(date, content_type, voice_style)
);

-- AI Learning Insights Table
CREATE TABLE IF NOT EXISTS ai_learning_insights (
  id SERIAL PRIMARY KEY,
  insight_type TEXT CHECK (insight_type IN ('timing_pattern', 'content_performance', 'audience_behavior', 'trending_opportunity')) NOT NULL,
  insight_summary TEXT NOT NULL,
  confidence_score INTEGER DEFAULT 0 CHECK (confidence_score >= 0 AND confidence_score <= 100),
  supporting_data JSONB,
  actionable_recommendations TEXT[],
  impact_potential TEXT CHECK (impact_potential IN ('low', 'medium', 'high', 'critical')) DEFAULT 'medium',
  discovered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  applied_at TIMESTAMP WITH TIME ZONE,
  results_measured_at TIMESTAMP WITH TIME ZONE,
  effectiveness_score DECIMAL(5,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_ai_analytics_hour_day ON ai_twitter_analytics(hour_of_day, day_of_week);
CREATE INDEX IF NOT EXISTS idx_ai_analytics_content ON ai_twitter_analytics(content_type, voice_style);
CREATE INDEX IF NOT EXISTS idx_ai_analytics_engagement ON ai_twitter_analytics(engagement_rate DESC);
CREATE INDEX IF NOT EXISTS idx_ai_analytics_recorded_at ON ai_twitter_analytics(recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_post_analytics_tweet_id ON real_time_post_analytics(tweet_id);
CREATE INDEX IF NOT EXISTS idx_post_analytics_content_type ON real_time_post_analytics(content_type);
CREATE INDEX IF NOT EXISTS idx_post_analytics_engagement ON real_time_post_analytics(engagement_rate DESC);
CREATE INDEX IF NOT EXISTS idx_post_analytics_posted_at ON real_time_post_analytics(posted_at DESC);

CREATE INDEX IF NOT EXISTS idx_trending_topics_relevance ON trending_topics_analysis(health_relevance_score DESC);
CREATE INDEX IF NOT EXISTS idx_trending_topics_opportunity ON trending_topics_analysis(opportunity_window_minutes ASC);
CREATE INDEX IF NOT EXISTS idx_trending_topics_detected_at ON trending_topics_analysis(detected_at DESC);

CREATE INDEX IF NOT EXISTS idx_audience_activity_hour_day ON audience_activity_data(hour_of_day, day_of_week);
CREATE INDEX IF NOT EXISTS idx_audience_activity_multiplier ON audience_activity_data(engagement_multiplier DESC);
CREATE INDEX IF NOT EXISTS idx_audience_activity_recorded_at ON audience_activity_data(recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_decisions_type ON ai_decision_history(decision_type);
CREATE INDEX IF NOT EXISTS idx_ai_decisions_confidence ON ai_decision_history(confidence_score DESC);
CREATE INDEX IF NOT EXISTS idx_ai_decisions_made_at ON ai_decision_history(decision_made_at DESC);

CREATE INDEX IF NOT EXISTS idx_predictions_content_type ON content_performance_predictions(content_type, voice_style);
CREATE INDEX IF NOT EXISTS idx_predictions_accuracy ON content_performance_predictions(prediction_accuracy DESC);
CREATE INDEX IF NOT EXISTS idx_predictions_predicted_at ON content_performance_predictions(predicted_at DESC);

CREATE INDEX IF NOT EXISTS idx_timing_patterns_hour_day ON optimal_timing_patterns(hour_of_day, day_of_week);
CREATE INDEX IF NOT EXISTS idx_timing_patterns_content ON optimal_timing_patterns(content_type);
CREATE INDEX IF NOT EXISTS idx_timing_patterns_engagement ON optimal_timing_patterns(average_engagement DESC);

CREATE INDEX IF NOT EXISTS idx_diversity_date_content ON content_diversity_tracking(date, content_type);
CREATE INDEX IF NOT EXISTS idx_diversity_performance ON content_diversity_tracking(performance_score DESC);

CREATE INDEX IF NOT EXISTS idx_learning_insights_type ON ai_learning_insights(insight_type);
CREATE INDEX IF NOT EXISTS idx_learning_insights_impact ON ai_learning_insights(impact_potential);
CREATE INDEX IF NOT EXISTS idx_learning_insights_discovered_at ON ai_learning_insights(discovered_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE ai_twitter_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE real_time_post_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE trending_topics_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE audience_activity_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_decision_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_performance_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE optimal_timing_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_diversity_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_learning_insights ENABLE ROW LEVEL SECURITY;

-- Create policies for all operations
CREATE POLICY "Allow all operations" ON ai_twitter_analytics FOR ALL USING (true);
CREATE POLICY "Allow all operations" ON real_time_post_analytics FOR ALL USING (true);
CREATE POLICY "Allow all operations" ON trending_topics_analysis FOR ALL USING (true);
CREATE POLICY "Allow all operations" ON audience_activity_data FOR ALL USING (true);
CREATE POLICY "Allow all operations" ON ai_decision_history FOR ALL USING (true);
CREATE POLICY "Allow all operations" ON content_performance_predictions FOR ALL USING (true);
CREATE POLICY "Allow all operations" ON optimal_timing_patterns FOR ALL USING (true);
CREATE POLICY "Allow all operations" ON content_diversity_tracking FOR ALL USING (true);
CREATE POLICY "Allow all operations" ON ai_learning_insights FOR ALL USING (true);

-- Insert initial timing patterns based on general social media best practices
INSERT INTO optimal_timing_patterns (hour_of_day, day_of_week, content_type, average_engagement, sample_size, confidence_level) VALUES
-- Monday patterns
(8, 1, 'myth_busting', 85.0, 10, 75.0),
(12, 1, 'personal_discovery', 75.0, 10, 70.0),
(17, 1, 'counterintuitive_insight', 90.0, 10, 80.0),
(20, 1, 'story_insight', 80.0, 10, 75.0),

-- Tuesday patterns  
(9, 2, 'practical_experiment', 80.0, 10, 70.0),
(13, 2, 'myth_busting', 88.0, 10, 85.0),
(18, 2, 'counterintuitive_insight', 85.0, 10, 80.0),
(21, 2, 'curious_observation', 75.0, 10, 70.0),

-- Wednesday patterns
(10, 3, 'counterintuitive_insight', 92.0, 10, 90.0),
(14, 3, 'practical_experiment', 78.0, 10, 75.0),
(19, 3, 'myth_busting', 87.0, 10, 85.0),

-- Thursday patterns
(11, 4, 'personal_discovery', 83.0, 10, 80.0),
(15, 4, 'story_insight', 79.0, 10, 75.0),
(20, 4, 'counterintuitive_insight', 89.0, 10, 85.0),

-- Friday patterns
(12, 5, 'curious_observation', 76.0, 10, 70.0),
(16, 5, 'practical_experiment', 81.0, 10, 75.0),
(19, 5, 'myth_busting', 84.0, 10, 80.0),

-- Saturday patterns
(10, 6, 'story_insight', 82.0, 10, 75.0),
(14, 6, 'personal_discovery', 77.0, 10, 70.0),
(18, 6, 'counterintuitive_insight', 85.0, 10, 80.0),

-- Sunday patterns
(11, 0, 'practical_experiment', 78.0, 10, 70.0),
(15, 0, 'curious_observation', 73.0, 10, 65.0),
(19, 0, 'story_insight', 80.0, 10, 75.0)

ON CONFLICT (hour_of_day, day_of_week, content_type) DO NOTHING;

-- Insert initial diversity targets for today
INSERT INTO content_diversity_tracking (date, content_type, voice_style, usage_count, optimal_usage_target) VALUES
(CURRENT_DATE, 'myth_busting', 'medical_authority', 0, 3),
(CURRENT_DATE, 'myth_busting', 'controversy_starter', 0, 4),
(CURRENT_DATE, 'counterintuitive_insight', 'expensive_insider', 0, 3),
(CURRENT_DATE, 'counterintuitive_insight', 'conspiracy_revealer', 0, 2),
(CURRENT_DATE, 'personal_discovery', 'results_driven_experimenter', 0, 3),
(CURRENT_DATE, 'personal_discovery', 'medical_authority', 0, 2),
(CURRENT_DATE, 'practical_experiment', 'results_driven_experimenter', 0, 4),
(CURRENT_DATE, 'story_insight', 'expensive_insider', 0, 2),
(CURRENT_DATE, 'curious_observation', 'medical_authority', 0, 2)

ON CONFLICT (date, content_type, voice_style) DO NOTHING;

COMMIT;
