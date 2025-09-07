-- 🚀 AGGRESSIVE SYSTEMS DATABASE SCHEMA
-- Tables for high-performance posting, engagement, and monitoring

-- System Performance Metrics Table
CREATE TABLE IF NOT EXISTS system_performance_metrics (
  id SERIAL PRIMARY KEY,
  memory_usage_mb INTEGER NOT NULL,
  database_response_time_ms INTEGER DEFAULT 0,
  posting_success_rate DECIMAL(5,2) DEFAULT 95.0,
  content_generation_time_ms INTEGER DEFAULT 0,
  system_health TEXT CHECK (system_health IN ('excellent', 'good', 'warning', 'critical')) DEFAULT 'good',
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Aggressive Posts Table
CREATE TABLE IF NOT EXISTS aggressive_posts (
  id SERIAL PRIMARY KEY,
  content TEXT NOT NULL,
  content_type TEXT NOT NULL,
  voice_style TEXT NOT NULL,
  predicted_viral_score INTEGER DEFAULT 0,
  predicted_follower_potential INTEGER DEFAULT 0,
  human_voice_score INTEGER DEFAULT 85,
  actual_likes INTEGER DEFAULT 0,
  actual_retweets INTEGER DEFAULT 0,
  actual_replies INTEGER DEFAULT 0,
  followers_gained INTEGER DEFAULT 0,
  posting_strategy TEXT DEFAULT 'aggressive_scheduled',
  posted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Engagement Records Table
CREATE TABLE IF NOT EXISTS engagement_records (
  id SERIAL PRIMARY KEY,
  target_username TEXT NOT NULL,
  target_tweet_content TEXT,
  reply_content TEXT NOT NULL,
  reply_strategy TEXT NOT NULL,
  predicted_engagement INTEGER DEFAULT 0,
  actual_likes INTEGER DEFAULT 0,
  actual_replies INTEGER DEFAULT 0,
  target_follower_count INTEGER DEFAULT 0,
  followers_gained_from_engagement INTEGER DEFAULT 0,
  engagement_posted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Posting Metrics Table
CREATE TABLE IF NOT EXISTS posting_metrics (
  id SERIAL PRIMARY KEY,
  date DATE UNIQUE NOT NULL DEFAULT CURRENT_DATE,
  posts_count INTEGER DEFAULT 0,
  success_rate DECIMAL(5,2) DEFAULT 90.0,
  average_engagement DECIMAL(5,2) DEFAULT 25.0,
  follower_growth_rate DECIMAL(5,2) DEFAULT 5.0,
  aggressive_posting_active BOOLEAN DEFAULT FALSE,
  last_post_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Human Voice Patterns Table (for HumanVoiceEngine)
CREATE TABLE IF NOT EXISTS human_voice_patterns (
  id SERIAL PRIMARY KEY,
  pattern_type TEXT CHECK (pattern_type IN ('opener', 'transition', 'insight', 'story', 'question', 'observation')) NOT NULL,
  text_pattern TEXT NOT NULL,
  style TEXT CHECK (style IN ('curious_observer', 'experienced_friend', 'truth_revealer', 'practical_experimenter', 'myth_buster', 'story_teller')) NOT NULL,
  usage_count INTEGER DEFAULT 0,
  performance_score DECIMAL(5,2) DEFAULT 50.0,
  last_used TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Content Types Table (for DiverseContentGenerator)
CREATE TABLE IF NOT EXISTS content_types (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  description TEXT NOT NULL,
  example_openers TEXT[] DEFAULT '{}',
  optimal_hours INTEGER[] DEFAULT '{}',
  base_viral_potential INTEGER DEFAULT 75,
  recent_usage_count INTEGER DEFAULT 0,
  performance_score DECIMAL(5,2) DEFAULT 50.0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Learning Metrics Table (for DataDrivenLearner)
CREATE TABLE IF NOT EXISTS learning_metrics (
  id SERIAL PRIMARY KEY,
  content_pattern TEXT NOT NULL,
  performance_score DECIMAL(5,2) DEFAULT 50.0,
  follower_conversion_rate DECIMAL(5,2) DEFAULT 2.0,
  pattern_type TEXT CHECK (pattern_type IN ('voice_style', 'content_type', 'hook_strategy')) NOT NULL,
  confidence_score DECIMAL(5,2) DEFAULT 50.0,
  sample_size INTEGER DEFAULT 1,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(content_pattern, pattern_type)
);

-- Content Performance History Table (for DataDrivenLearner)
CREATE TABLE IF NOT EXISTS content_performance_history (
  id SERIAL PRIMARY KEY,
  tweet_id TEXT,
  content_type TEXT NOT NULL,
  voice_style TEXT NOT NULL,
  hook_strategy TEXT NOT NULL,
  likes INTEGER DEFAULT 0,
  retweets INTEGER DEFAULT 0,
  replies INTEGER DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  followers_gained INTEGER DEFAULT 0,
  engagement_rate DECIMAL(5,2) DEFAULT 0,
  follower_conversion_rate DECIMAL(5,2) DEFAULT 0,
  viral_score DECIMAL(5,2) DEFAULT 0,
  posted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_system_metrics_recorded_at ON system_performance_metrics(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_aggressive_posts_posted_at ON aggressive_posts(posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_engagement_records_posted_at ON engagement_records(engagement_posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_posting_metrics_date ON posting_metrics(date DESC);
CREATE INDEX IF NOT EXISTS idx_voice_patterns_style ON human_voice_patterns(style);
CREATE INDEX IF NOT EXISTS idx_content_types_name ON content_types(name);
CREATE INDEX IF NOT EXISTS idx_learning_metrics_pattern_type ON learning_metrics(pattern_type, performance_score DESC);
CREATE INDEX IF NOT EXISTS idx_performance_history_posted_at ON content_performance_history(posted_at DESC);

-- Insert default content types
INSERT INTO content_types (name, description, example_openers, optimal_hours, base_viral_potential) VALUES
('personal_discovery', 'Share a personal realization or experiment result.', '{"Just realized...", "Tried this for 30 days..."}', '{8,9,10,18,19}', 85),
('counterintuitive_insight', 'Challenge a common belief with a surprising fact.', '{"Everyone thinks X, but...", "The truth about Y is..."}', '{11,12,13,20,21}', 90),
('practical_experiment', 'Describe a simple experiment and its actionable outcome.', '{"What if you tried X?", "I experimented with Y..."}', '{7,8,17,18}', 80),
('curious_observation', 'Pose a thoughtful question based on an observation.', '{"Anyone else notice...", "Been wondering why..."}', '{14,15,16}', 75),
('myth_busting', 'Debunk a popular health myth with evidence.', '{"Stop believing X...", "The myth of Y, debunked:"}', '{10,11,19,20}', 92),
('story_insight', 'Share a short, impactful story with a health lesson.', '{"A friend told me...", "This happened to me..."}', '{12,13,21,22}', 88)
ON CONFLICT (name) DO NOTHING;

-- Insert default voice patterns
INSERT INTO human_voice_patterns (pattern_type, text_pattern, style) VALUES
('opener', 'Just realized something weird about {topic}...', 'curious_observer'),
('opener', 'Tried this for 30 days and the results were insane:', 'practical_experimenter'),
('insight', 'Nobody talks about how {fact}. It explains why {consequence}.', 'truth_revealer'),
('question', 'Anyone else notice that {observation}? Been wondering why {reason}.', 'curious_observer'),
('story', 'I used to think {old_belief}, but then I discovered {new_insight}.', 'story_teller'),
('observation', 'It''s fascinating how {phenomenon} impacts {area}. Most people miss this.', 'experienced_friend'),
('transition', 'But here''s the kicker:', 'truth_revealer'),
('transition', 'Here''s where it gets interesting:', 'curious_observer'),
('insight', 'The science is clear: {data_point}. This means {implication}.', 'truth_revealer'),
('question', 'What are your thoughts on {topic}?', 'curious_observer')
ON CONFLICT DO NOTHING;

-- Insert default learning metrics
INSERT INTO learning_metrics (content_pattern, pattern_type, performance_score, confidence_score) VALUES
('curious_observer', 'voice_style', 75.0, 80.0),
('truth_revealer', 'voice_style', 85.0, 90.0),
('personal_discovery', 'content_type', 80.0, 85.0),
('myth_busting', 'content_type', 90.0, 95.0),
('curiosity_gap', 'hook_strategy', 75.0, 80.0),
('counterintuitive', 'hook_strategy', 85.0, 90.0)
ON CONFLICT (content_pattern, pattern_type) DO NOTHING;

-- Enable Row Level Security (RLS) for all tables
ALTER TABLE system_performance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE aggressive_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE engagement_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE posting_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE human_voice_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_performance_history ENABLE ROW LEVEL SECURITY;

-- Create policies to allow all operations (adjust based on your security needs)
CREATE POLICY "Allow all operations" ON system_performance_metrics FOR ALL USING (true);
CREATE POLICY "Allow all operations" ON aggressive_posts FOR ALL USING (true);
CREATE POLICY "Allow all operations" ON engagement_records FOR ALL USING (true);
CREATE POLICY "Allow all operations" ON posting_metrics FOR ALL USING (true);
CREATE POLICY "Allow all operations" ON human_voice_patterns FOR ALL USING (true);
CREATE POLICY "Allow all operations" ON content_types FOR ALL USING (true);
CREATE POLICY "Allow all operations" ON learning_metrics FOR ALL USING (true);
CREATE POLICY "Allow all operations" ON content_performance_history FOR ALL USING (true);

-- Create initial posting metrics record for today
INSERT INTO posting_metrics (date, posts_count, success_rate, aggressive_posting_active)
VALUES (CURRENT_DATE, 0, 95.0, true)
ON CONFLICT (date) DO UPDATE SET
aggressive_posting_active = true,
updated_at = NOW();

COMMIT;
