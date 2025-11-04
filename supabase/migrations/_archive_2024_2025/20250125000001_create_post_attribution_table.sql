-- Create post_attribution table for learning loops
-- This table stores performance metrics for each post

CREATE TABLE IF NOT EXISTS post_attribution (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tweet_id TEXT UNIQUE NOT NULL,
    posted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Performance metrics
    engagement_rate NUMERIC(5,4) DEFAULT 0,
    impressions INTEGER DEFAULT 0,
    followers_gained INTEGER DEFAULT 0,
    
    -- Content metadata for learning
    topic TEXT,
    hook_pattern TEXT,
    generator TEXT,
    format TEXT,
    
    -- Raw metrics
    likes INTEGER DEFAULT 0,
    retweets INTEGER DEFAULT 0,
    replies INTEGER DEFAULT 0,
    views INTEGER DEFAULT 0,
    
    -- Calculated fields
    engagement_score NUMERIC(8,4) DEFAULT 0,
    viral_potential NUMERIC(5,4) DEFAULT 0,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- JSON for additional data
    metadata JSONB DEFAULT '{}'
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_post_attribution_tweet_id ON post_attribution(tweet_id);
CREATE INDEX IF NOT EXISTS idx_post_attribution_posted_at ON post_attribution(posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_attribution_engagement_rate ON post_attribution(engagement_rate DESC);
CREATE INDEX IF NOT EXISTS idx_post_attribution_topic ON post_attribution(topic);
CREATE INDEX IF NOT EXISTS idx_post_attribution_hook_pattern ON post_attribution(hook_pattern);
CREATE INDEX IF NOT EXISTS idx_post_attribution_generator ON post_attribution(generator);

-- Add comments
COMMENT ON TABLE post_attribution IS 'Stores performance metrics for each post to feed learning loops';
COMMENT ON COLUMN post_attribution.engagement_rate IS 'Engagement rate as decimal (0.0-1.0)';
COMMENT ON COLUMN post_attribution.impressions IS 'Number of impressions/views';
COMMENT ON COLUMN post_attribution.followers_gained IS 'Net followers gained from this post';
COMMENT ON COLUMN post_attribution.topic IS 'Topic of the post for learning';
COMMENT ON COLUMN post_attribution.hook_pattern IS 'Hook pattern used for learning';
COMMENT ON COLUMN post_attribution.generator IS 'Content generator used (e.g., contrarian, storyteller)';
COMMENT ON COLUMN post_attribution.format IS 'Content format (single, thread, etc.)';

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_post_attribution_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER trigger_update_post_attribution_updated_at
    BEFORE UPDATE ON post_attribution
    FOR EACH ROW
    EXECUTE FUNCTION update_post_attribution_updated_at();
