-- Create content_metadata table for content generation and reply system
-- This table stores all generated content before posting

CREATE TABLE IF NOT EXISTS content_metadata (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    decision_id UUID UNIQUE NOT NULL,
    content TEXT NOT NULL,
    decision_type TEXT NOT NULL CHECK (decision_type IN ('single', 'thread', 'reply')),
    
    -- Content metadata
    topic TEXT,
    topic_cluster TEXT,
    hook_pattern TEXT,
    generator_used TEXT,
    
    -- Reply-specific fields
    target_tweet_id TEXT,
    target_tweet_content TEXT,
    estimated_reach INTEGER DEFAULT 0,
    
    -- Posting status
    posted_at TIMESTAMP WITH TIME ZONE,
    tweet_id TEXT,
    tweet_url TEXT,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- JSON for additional data
    metadata JSONB DEFAULT '{}'
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_content_metadata_decision_type ON content_metadata(decision_type);
CREATE INDEX IF NOT EXISTS idx_content_metadata_posted_at ON content_metadata(posted_at);
CREATE INDEX IF NOT EXISTS idx_content_metadata_created_at ON content_metadata(created_at);
CREATE INDEX IF NOT EXISTS idx_content_metadata_generator_used ON content_metadata(generator_used);
CREATE INDEX IF NOT EXISTS idx_content_metadata_target_tweet_id ON content_metadata(target_tweet_id);
CREATE INDEX IF NOT EXISTS idx_content_metadata_topic_cluster ON content_metadata(topic_cluster);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_content_metadata_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER trigger_update_content_metadata_updated_at
    BEFORE UPDATE ON content_metadata
    FOR EACH ROW
    EXECUTE FUNCTION update_content_metadata_updated_at();

-- Add comments
COMMENT ON TABLE content_metadata IS 'Stores all generated content (posts and replies) before posting';
COMMENT ON COLUMN content_metadata.decision_id IS 'Unique identifier for the content decision';
COMMENT ON COLUMN content_metadata.content IS 'The actual content text';
COMMENT ON COLUMN content_metadata.decision_type IS 'Type of content: single, thread, or reply';
COMMENT ON COLUMN content_metadata.topic IS 'Topic of the content';
COMMENT ON COLUMN content_metadata.topic_cluster IS 'Topic cluster category';
COMMENT ON COLUMN content_metadata.hook_pattern IS 'Hook pattern used';
COMMENT ON COLUMN content_metadata.generator_used IS 'Content generator used (e.g., coach, thought_leader, contrarian)';
COMMENT ON COLUMN content_metadata.target_tweet_id IS 'Target tweet ID for replies';
COMMENT ON COLUMN content_metadata.target_tweet_content IS 'Content of the target tweet being replied to';
COMMENT ON COLUMN content_metadata.estimated_reach IS 'Estimated reach for the content';
COMMENT ON COLUMN content_metadata.posted_at IS 'When the content was posted to Twitter';
COMMENT ON COLUMN content_metadata.tweet_id IS 'Twitter tweet ID after posting';
COMMENT ON COLUMN content_metadata.tweet_url IS 'Twitter URL after posting';
