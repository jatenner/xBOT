-- 🔧 FIX POST_HISTORY MISSING COLUMNS
-- ===================================
-- Based on error logs and comparison with tweets table structure
-- This adds the missing columns that are causing storage failures

-- Add missing columns to post_history table
ALTER TABLE post_history 
ADD COLUMN IF NOT EXISTS content_type VARCHAR(100) DEFAULT 'text',
ADD COLUMN IF NOT EXISTS posting_strategy VARCHAR(50) DEFAULT 'balanced',
ADD COLUMN IF NOT EXISTS success_metrics JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS learning_signals JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS engagement_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS viral_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS follower_impact INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS quality_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS ai_optimized BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS performance_prediction NUMERIC DEFAULT 0.5,
ADD COLUMN IF NOT EXISTS topic_category VARCHAR(100),
ADD COLUMN IF NOT EXISTS content_format VARCHAR(50) DEFAULT 'text',
ADD COLUMN IF NOT EXISTS posting_context JSONB DEFAULT '{}';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_post_history_content_type ON post_history(content_type);
CREATE INDEX IF NOT EXISTS idx_post_history_posting_strategy ON post_history(posting_strategy);
CREATE INDEX IF NOT EXISTS idx_post_history_posted_at ON post_history(posted_at);

-- Add helpful comments
COMMENT ON COLUMN post_history.content_type IS 'Type of content: text, thread, poll, etc.';
COMMENT ON COLUMN post_history.posting_strategy IS 'Strategy used for this post';
COMMENT ON COLUMN post_history.success_metrics IS 'Success metrics for this post';
COMMENT ON COLUMN post_history.learning_signals IS 'AI learning signals extracted';
COMMENT ON COLUMN post_history.posting_context IS 'Context and metadata about posting';

-- Show completion message
SELECT 'Post history table updated successfully - added missing columns for analytics' as status;