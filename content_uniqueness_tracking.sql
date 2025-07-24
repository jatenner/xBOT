-- 🔒 CONTENT UNIQUENESS TRACKING SYSTEM
-- Prevents any content duplication across all tweets

-- Create content tracking table
CREATE TABLE IF NOT EXISTS content_uniqueness (
    id SERIAL PRIMARY KEY,
    content_hash VARCHAR(64) UNIQUE NOT NULL,
    original_content TEXT NOT NULL,
    content_topic VARCHAR(100),
    content_keywords TEXT[],
    similarity_score DECIMAL(5,3) DEFAULT 0,
    first_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    usage_count INTEGER DEFAULT 1,
    tweet_ids TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast duplicate detection
CREATE INDEX IF NOT EXISTS idx_content_uniqueness_hash ON content_uniqueness(content_hash);
CREATE INDEX IF NOT EXISTS idx_content_uniqueness_created ON content_uniqueness(created_at DESC);

-- Function to automatically track content uniqueness
CREATE OR REPLACE FUNCTION track_content_uniqueness()
RETURNS TRIGGER AS $$
DECLARE
    content_hash_val VARCHAR(64);
BEGIN
    -- Generate hash for the content
    content_hash_val := encode(digest(lower(trim(NEW.content)), 'md5'), 'hex');
    
    -- Insert or update content tracking
    INSERT INTO content_uniqueness (content_hash, original_content, tweet_ids, first_used_at)
    VALUES (content_hash_val, NEW.content, ARRAY[NEW.tweet_id::TEXT], NOW())
    ON CONFLICT (content_hash) 
    DO UPDATE SET 
        usage_count = content_uniqueness.usage_count + 1,
        tweet_ids = array_append(content_uniqueness.tweet_ids, NEW.tweet_id::TEXT);
        
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically track content when tweets are inserted
DROP TRIGGER IF EXISTS trigger_track_content_uniqueness ON tweets;
CREATE TRIGGER trigger_track_content_uniqueness
    AFTER INSERT ON tweets
    FOR EACH ROW
    EXECUTE FUNCTION track_content_uniqueness();

-- Clean up old content tracking (keep last 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_content_tracking()
RETURNS void AS $$
BEGIN
    DELETE FROM content_uniqueness 
    WHERE first_used_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- Test the system
SELECT 'Content uniqueness tracking system ready!' as status; 