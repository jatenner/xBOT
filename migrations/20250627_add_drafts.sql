-- Migration: Add drafts table for queuing tweets during rate limits
-- Date: 2025-06-27

-- Create drafts table for queued tweets
CREATE TABLE IF NOT EXISTS drafts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    content TEXT NOT NULL,
    source VARCHAR(100) NOT NULL DEFAULT 'unknown',
    priority VARCHAR(10) NOT NULL DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
    scheduled_for TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    media_urls TEXT[],
    alt_text TEXT[]
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_drafts_priority ON drafts (priority);
CREATE INDEX IF NOT EXISTS idx_drafts_created_at ON drafts (created_at);
CREATE INDEX IF NOT EXISTS idx_drafts_scheduled_for ON drafts (scheduled_for);
CREATE INDEX IF NOT EXISTS idx_drafts_source ON drafts (source);

-- Add comment
COMMENT ON TABLE drafts IS 'Queue for tweets to be posted when rate limits reset';
COMMENT ON COLUMN drafts.priority IS 'Priority level: high, medium, low';
COMMENT ON COLUMN drafts.source IS 'Source system that generated the tweet';
COMMENT ON COLUMN drafts.scheduled_for IS 'When to attempt posting this draft';
COMMENT ON COLUMN drafts.media_urls IS 'Array of media URLs to attach';
COMMENT ON COLUMN drafts.alt_text IS 'Array of alt text for media';

-- Grant permissions (adjust as needed for your setup)
-- ALTER TABLE drafts ENABLE ROW LEVEL SECURITY;
