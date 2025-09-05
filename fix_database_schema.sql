-- Fix missing database columns for enhanced functionality

-- Add missing columns to learning_posts table
ALTER TABLE learning_posts 
ADD COLUMN IF NOT EXISTS coherence_score NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS completeness_score NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS thread_parts INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS total_thread_tweets INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS successful_thread_parts INTEGER DEFAULT 1;

-- Add missing columns to tweet_analytics/tweet_metrics table
ALTER TABLE tweet_analytics 
ADD COLUMN IF NOT EXISTS latest_metrics_at TIMESTAMPTZ DEFAULT NOW();

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_learning_posts_coherence ON learning_posts(coherence_score);
CREATE INDEX IF NOT EXISTS idx_learning_posts_completeness ON learning_posts(completeness_score);
CREATE INDEX IF NOT EXISTS idx_tweet_analytics_latest ON tweet_analytics(latest_metrics_at);

-- Ensure proper permissions
GRANT ALL ON learning_posts TO authenticated;
GRANT ALL ON tweet_analytics TO authenticated;
