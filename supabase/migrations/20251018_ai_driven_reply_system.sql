-- AI-Driven Reply System Tables
-- Creates tables for account discovery, scoring, and learning

-- Discovered Accounts Table
CREATE TABLE IF NOT EXISTS discovered_accounts (
  id BIGSERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  follower_count INTEGER DEFAULT 0,
  following_count INTEGER DEFAULT 0,
  tweet_count INTEGER DEFAULT 0,
  bio TEXT,
  verified BOOLEAN DEFAULT false,
  discovery_method TEXT CHECK (discovery_method IN ('hashtag', 'network', 'content', 'follower_overlap')),
  discovery_date TIMESTAMP DEFAULT NOW(),
  
  -- Quality scores (0-100)
  quality_score INTEGER DEFAULT 0,
  engagement_score INTEGER DEFAULT 0,
  content_score INTEGER DEFAULT 0,
  audience_relevance INTEGER DEFAULT 0,
  growth_score INTEGER DEFAULT 0,
  final_score INTEGER DEFAULT 0,
  
  last_scored TIMESTAMP,
  last_updated TIMESTAMP DEFAULT NOW(),
  
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_discovered_accounts_final_score 
ON discovered_accounts(final_score DESC);

CREATE INDEX IF NOT EXISTS idx_discovered_accounts_username 
ON discovered_accounts(username);

-- Reply Learning Insights Table
CREATE TABLE IF NOT EXISTS reply_learning_insights (
  id BIGSERIAL PRIMARY KEY,
  insight_type TEXT CHECK (insight_type IN ('generator', 'timing', 'target', 'topic')),
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  confidence DECIMAL(3,2) DEFAULT 0.0, -- 0.00-1.00
  sample_size INTEGER DEFAULT 0,
  discovered_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(insight_type, key)
);

CREATE INDEX IF NOT EXISTS idx_reply_insights_type 
ON reply_learning_insights(insight_type);

CREATE INDEX IF NOT EXISTS idx_reply_insights_confidence 
ON reply_learning_insights(confidence DESC);

-- Function to clean old discovered accounts (keep top 1000)
CREATE OR REPLACE FUNCTION cleanup_old_discovered_accounts()
RETURNS void AS $$
BEGIN
  DELETE FROM discovered_accounts
  WHERE id NOT IN (
    SELECT id FROM discovered_accounts
    ORDER BY final_score DESC, last_updated DESC
    LIMIT 1000
  );
END;
$$ LANGUAGE plpgsql;

-- Function placeholder for creating discovered_accounts if called from code
CREATE OR REPLACE FUNCTION create_discovered_accounts_table_if_not_exists()
RETURNS void AS $$
BEGIN
  -- Table is already created above, this is just for compatibility
  NULL;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE discovered_accounts IS 'AI-discovered target accounts for reply system';
COMMENT ON TABLE reply_learning_insights IS 'Learning insights from reply performance analysis';

