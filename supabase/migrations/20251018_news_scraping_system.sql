-- News Scraping System Tables
-- Stores scraped Twitter news, curated analysis, and trending topics

-- Table 1: Scraped News (Raw Data)
CREATE TABLE IF NOT EXISTS health_news_scraped (
  id BIGSERIAL PRIMARY KEY,
  tweet_id TEXT UNIQUE NOT NULL,
  tweet_text TEXT NOT NULL,
  tweet_url TEXT,
  author_username TEXT NOT NULL,
  author_display_name TEXT,
  author_followers INTEGER DEFAULT 0,
  author_verified BOOLEAN DEFAULT false,
  likes_count INTEGER DEFAULT 0,
  retweets_count INTEGER DEFAULT 0,
  replies_count INTEGER DEFAULT 0,
  posted_at TIMESTAMP NOT NULL,
  scraped_at TIMESTAMP DEFAULT NOW(),
  study_urls TEXT[],
  source_type TEXT CHECK (source_type IN ('news_outlet', 'health_account', 'influencer', 'viral_trend')),
  viral_score INTEGER DEFAULT 0,
  freshness_score INTEGER DEFAULT 0,
  analyzed BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for scraped news
CREATE INDEX IF NOT EXISTS idx_health_news_scraped_freshness 
ON health_news_scraped(freshness_score DESC);

CREATE INDEX IF NOT EXISTS idx_health_news_scraped_viral 
ON health_news_scraped(viral_score DESC);

CREATE INDEX IF NOT EXISTS idx_health_news_scraped_source 
ON health_news_scraped(source_type);

CREATE INDEX IF NOT EXISTS idx_health_news_scraped_posted 
ON health_news_scraped(posted_at DESC);

CREATE INDEX IF NOT EXISTS idx_health_news_scraped_analyzed 
ON health_news_scraped(analyzed) WHERE analyzed = false;

-- Table 2: Curated News (AI-Analyzed)
CREATE TABLE IF NOT EXISTS health_news_curated (
  id TEXT PRIMARY KEY,
  original_tweet_id TEXT REFERENCES health_news_scraped(tweet_id),
  topic TEXT NOT NULL,
  headline TEXT NOT NULL,
  key_claim TEXT NOT NULL,
  source_credibility TEXT CHECK (source_credibility IN ('high', 'medium', 'low')),
  study_url TEXT,
  viral_score INTEGER DEFAULT 0,
  freshness_score INTEGER DEFAULT 0,
  trending BOOLEAN DEFAULT false,
  used_in_post TEXT, -- Reference to post that used this news
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for curated news
CREATE INDEX IF NOT EXISTS idx_health_news_curated_topic 
ON health_news_curated(topic);

CREATE INDEX IF NOT EXISTS idx_health_news_curated_freshness 
ON health_news_curated(freshness_score DESC);

CREATE INDEX IF NOT EXISTS idx_health_news_curated_credibility 
ON health_news_curated(source_credibility);

CREATE INDEX IF NOT EXISTS idx_health_news_curated_unused 
ON health_news_curated(used_in_post) WHERE used_in_post IS NULL;

CREATE INDEX IF NOT EXISTS idx_health_news_curated_trending 
ON health_news_curated(trending) WHERE trending = true;

-- Table 3: Trending Topics
CREATE TABLE IF NOT EXISTS trending_topics (
  id BIGSERIAL PRIMARY KEY,
  topic TEXT UNIQUE NOT NULL,
  mention_count_today INTEGER DEFAULT 0,
  mention_count_yesterday INTEGER DEFAULT 0,
  trend_score DECIMAL(5,2) DEFAULT 1.0,
  viral_posts TEXT[],
  last_updated TIMESTAMP DEFAULT NOW()
);

-- Indexes for trending topics
CREATE INDEX IF NOT EXISTS idx_trending_topics_score 
ON trending_topics(trend_score DESC);

CREATE INDEX IF NOT EXISTS idx_trending_topics_updated 
ON trending_topics(last_updated DESC);

-- Table 4: News Usage Tracking
CREATE TABLE IF NOT EXISTS news_usage_log (
  id BIGSERIAL PRIMARY KEY,
  news_id TEXT REFERENCES health_news_curated(id),
  post_id TEXT,
  decision_id TEXT,
  used_at TIMESTAMP DEFAULT NOW()
);

-- Index for usage tracking
CREATE INDEX IF NOT EXISTS idx_news_usage_log_post 
ON news_usage_log(post_id);

-- Cleanup function: Remove old scraped news (> 7 days)
CREATE OR REPLACE FUNCTION cleanup_old_scraped_news()
RETURNS void AS $$
BEGIN
  DELETE FROM health_news_scraped
  WHERE scraped_at < NOW() - INTERVAL '7 days'
  AND analyzed = true;
END;
$$ LANGUAGE plpgsql;

-- Cleanup function: Remove old curated news (> 14 days or used)
CREATE OR REPLACE FUNCTION cleanup_old_curated_news()
RETURNS void AS $$
BEGIN
  DELETE FROM health_news_curated
  WHERE (
    created_at < NOW() - INTERVAL '14 days'
    OR used_in_post IS NOT NULL
  );
END;
$$ LANGUAGE plpgsql;

-- Function to get fresh news by topic
CREATE OR REPLACE FUNCTION get_fresh_news_by_topic(
  p_topic TEXT,
  p_min_freshness INTEGER DEFAULT 60,
  p_limit INTEGER DEFAULT 5
)
RETURNS TABLE (
  id TEXT,
  headline TEXT,
  key_claim TEXT,
  study_url TEXT,
  viral_score INTEGER,
  freshness_score INTEGER,
  source_credibility TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    nc.id,
    nc.headline,
    nc.key_claim,
    nc.study_url,
    nc.viral_score,
    nc.freshness_score,
    nc.source_credibility
  FROM health_news_curated nc
  WHERE nc.topic = p_topic
  AND nc.freshness_score >= p_min_freshness
  AND nc.used_in_post IS NULL
  ORDER BY nc.viral_score DESC, nc.freshness_score DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE health_news_scraped IS 'Raw scraped Twitter news about health topics';
COMMENT ON TABLE health_news_curated IS 'AI-analyzed and curated health news for content generation';
COMMENT ON TABLE trending_topics IS 'Real-time trending health topics based on mention frequency';
COMMENT ON TABLE news_usage_log IS 'Tracks which news items have been used in posts';

