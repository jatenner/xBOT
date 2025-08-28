-- 🧠 ADAPTIVE GROWTH ENGINE: Database schema for A/B testing and learning
-- Creates tables for tracking growth experiments and optimizing follower acquisition

-- Growth experiments table - tracks A/B tests for optimal posting strategies
CREATE TABLE IF NOT EXISTS growth_experiments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  experiment_id TEXT UNIQUE NOT NULL,
  strategy TEXT NOT NULL CHECK (strategy IN ('frequency', 'timing', 'content_type', 'reply_strategy')),
  parameters JSONB NOT NULL DEFAULT '{}',
  start_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_date TIMESTAMPTZ,
  results JSONB NOT NULL DEFAULT '{
    "followersGained": 0,
    "engagementRate": 0,
    "reachExpansion": 0,
    "costPerFollower": 0
  }',
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'paused')),
  confidence DECIMAL(3,2) DEFAULT 0.0 CHECK (confidence >= 0 AND confidence <= 1),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Growth metrics table - daily tracking of follower growth
CREATE TABLE IF NOT EXISTS growth_metrics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL,
  followers_start INTEGER NOT NULL DEFAULT 0,
  followers_end INTEGER NOT NULL DEFAULT 0,
  followers_gained INTEGER GENERATED ALWAYS AS (followers_end - followers_start) STORED,
  posts_count INTEGER NOT NULL DEFAULT 0,
  replies_count INTEGER NOT NULL DEFAULT 0,
  engagement_rate DECIMAL(5,4) DEFAULT 0.0,
  reach_expansion DECIMAL(5,4) DEFAULT 0.0,
  optimal_hours INTEGER[] DEFAULT '{}',
  active_experiments TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(date)
);

-- Posting decisions table - tracks intelligent posting decisions
CREATE TABLE IF NOT EXISTS posting_decisions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  decision_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  should_post BOOLEAN NOT NULL,
  should_reply BOOLEAN NOT NULL,
  urgency TEXT NOT NULL CHECK (urgency IN ('low', 'medium', 'high', 'critical')),
  reason TEXT NOT NULL,
  current_strategy JSONB NOT NULL DEFAULT '{}',
  experiments_running TEXT[] DEFAULT '{}',
  action_taken BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reply targets table - tracks which accounts to target for replies
CREATE TABLE IF NOT EXISTS reply_targets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_username TEXT NOT NULL,
  follower_count INTEGER DEFAULT 0,
  engagement_rate DECIMAL(5,4) DEFAULT 0.0,
  niche_relevance DECIMAL(3,2) DEFAULT 0.0 CHECK (niche_relevance >= 0 AND niche_relevance <= 1),
  last_reply_date TIMESTAMPTZ,
  success_rate DECIMAL(3,2) DEFAULT 0.0 CHECK (success_rate >= 0 AND success_rate <= 1),
  priority_score DECIMAL(5,2) DEFAULT 0.0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(account_username)
);

-- Indexes for optimal performance
CREATE INDEX IF NOT EXISTS idx_growth_experiments_strategy ON growth_experiments(strategy);
CREATE INDEX IF NOT EXISTS idx_growth_experiments_status ON growth_experiments(status);
CREATE INDEX IF NOT EXISTS idx_growth_experiments_start_date ON growth_experiments(start_date);

CREATE INDEX IF NOT EXISTS idx_growth_metrics_date ON growth_metrics(date);
CREATE INDEX IF NOT EXISTS idx_growth_metrics_followers_gained ON growth_metrics(followers_gained);

CREATE INDEX IF NOT EXISTS idx_posting_decisions_timestamp ON posting_decisions(decision_timestamp);
CREATE INDEX IF NOT EXISTS idx_posting_decisions_should_post ON posting_decisions(should_post);

CREATE INDEX IF NOT EXISTS idx_reply_targets_priority ON reply_targets(priority_score DESC);
CREATE INDEX IF NOT EXISTS idx_reply_targets_active ON reply_targets(is_active);

-- Functions for automatic updating
CREATE OR REPLACE FUNCTION update_growth_experiment_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_reply_target_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for auto-updating timestamps
DROP TRIGGER IF EXISTS growth_experiments_updated_at ON growth_experiments;
CREATE TRIGGER growth_experiments_updated_at
  BEFORE UPDATE ON growth_experiments
  FOR EACH ROW
  EXECUTE FUNCTION update_growth_experiment_timestamp();

DROP TRIGGER IF EXISTS reply_targets_updated_at ON reply_targets;
CREATE TRIGGER reply_targets_updated_at
  BEFORE UPDATE ON reply_targets
  FOR EACH ROW
  EXECUTE FUNCTION update_reply_target_timestamp();

-- Initial data: Popular health/science accounts to target for replies
INSERT INTO reply_targets (account_username, follower_count, niche_relevance, priority_score) VALUES
  ('hubermanlab', 5000000, 1.0, 10.0),
  ('PeterAttiaMD', 1000000, 1.0, 9.5),
  ('tim_ferris', 2000000, 0.8, 9.0),
  ('DrRobertLustig', 500000, 1.0, 8.5),
  ('nutrition_stripped', 300000, 0.9, 8.0),
  ('RobertGreeneMD', 400000, 0.8, 7.5),
  ('drdavinlim', 200000, 1.0, 7.0),
  ('drmarkhyman', 800000, 0.9, 8.8)
ON CONFLICT (account_username) DO NOTHING;

-- Initial growth metrics entry for today (if not exists)
INSERT INTO growth_metrics (date, followers_start, posts_count, replies_count)
VALUES (CURRENT_DATE, 0, 0, 0)
ON CONFLICT (date) DO NOTHING;

-- View for easy experiment analysis
CREATE OR REPLACE VIEW experiment_performance AS
SELECT 
  experiment_id,
  strategy,
  parameters,
  EXTRACT(DAYS FROM COALESCE(end_date, NOW()) - start_date) as duration_days,
  (results->>'followersGained')::INTEGER as followers_gained,
  (results->>'engagementRate')::DECIMAL as engagement_rate,
  CASE 
    WHEN EXTRACT(DAYS FROM COALESCE(end_date, NOW()) - start_date) > 0 
    THEN (results->>'followersGained')::INTEGER / EXTRACT(DAYS FROM COALESCE(end_date, NOW()) - start_date)
    ELSE 0
  END as followers_per_day,
  confidence,
  status,
  start_date,
  end_date
FROM growth_experiments
ORDER BY followers_per_day DESC, confidence DESC;
