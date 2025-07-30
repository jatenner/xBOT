-- 🔧 MINIMAL ENHANCED LEARNING SYSTEM FIX
-- Only creates what's absolutely essential, no complex constraints

-- 1. Add learning columns to existing tables if they don't exist
DO $$
BEGIN
    -- Add quality_score to existing posts table if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'posts' AND column_name = 'quality_score') THEN
        ALTER TABLE posts ADD COLUMN quality_score INTEGER DEFAULT 0;
    END IF;
    
    -- Add engagement tracking columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'posts' AND column_name = 'engagement_rate') THEN
        ALTER TABLE posts ADD COLUMN engagement_rate DECIMAL(5,4) DEFAULT 0;
    END IF;
    
    -- Add format tracking
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'posts' AND column_name = 'format_type') THEN
        ALTER TABLE posts ADD COLUMN format_type VARCHAR(50);
    END IF;
END $$;

-- 2. Create simple bandit table (no unique constraints)
CREATE TABLE IF NOT EXISTS simple_bandit_arms (
    id SERIAL PRIMARY KEY,
    format_name TEXT NOT NULL,
    format_description TEXT,
    success_count INTEGER DEFAULT 1,
    total_count INTEGER DEFAULT 2,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 3. Create simple learning data table
CREATE TABLE IF NOT EXISTS simple_learning_data (
    id SERIAL PRIMARY KEY,
    tweet_id TEXT,
    content_text TEXT,
    likes_count INTEGER DEFAULT 0,
    retweets_count INTEGER DEFAULT 0,
    replies_count INTEGER DEFAULT 0,
    post_hour INTEGER,
    post_day INTEGER,
    format_used TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 4. Clear and populate bandit data
DELETE FROM simple_bandit_arms;
INSERT INTO simple_bandit_arms (format_name, format_description, success_count, total_count) VALUES
    ('hook_value', 'Hook + Value format', 2, 3),
    ('fact_question', 'Fact + Question format', 1, 3),
    ('story_lesson', 'Story + Lesson format', 3, 4),
    ('tip_benefit', 'Tip + Benefit format', 2, 4),
    ('thread_deep', 'Thread format', 1, 2),
    ('quick_hack', 'Quick hack format', 2, 3);

-- 5. Create simple functions
CREATE OR REPLACE FUNCTION simple_engagement_score(likes INT, retweets INT, replies INT)
RETURNS INTEGER AS $$
BEGIN
    RETURN COALESCE(likes, 0) + (COALESCE(retweets, 0) * 2) + (COALESCE(replies, 0) * 3);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_best_format()
RETURNS TEXT AS $$
DECLARE
    best_format TEXT;
BEGIN
    SELECT format_name INTO best_format 
    FROM simple_bandit_arms 
    WHERE total_count > 0
    ORDER BY (success_count::DECIMAL / total_count) DESC 
    LIMIT 1;
    
    RETURN COALESCE(best_format, 'hook_value');
END;
$$ LANGUAGE plpgsql;

-- 6. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_simple_learning_created ON simple_learning_data (created_at);
CREATE INDEX IF NOT EXISTS idx_simple_bandit_format ON simple_bandit_arms (format_name);

-- Success message
SELECT 'Minimal Enhanced Learning System created successfully! ✅' AS status; 