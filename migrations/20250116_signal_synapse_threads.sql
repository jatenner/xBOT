-- Signal_Synapse thread generation and tracking tables
-- Created: 2025-01-16
-- Purpose: Store structured health thread data with learning metrics

-- Table for storing generated Signal_Synapse thread data
CREATE TABLE IF NOT EXISTS signal_synapse_threads (
    id SERIAL PRIMARY KEY,
    topic TEXT NOT NULL,
    hook_type TEXT NOT NULL CHECK (hook_type IN ('stat', 'myth_bust', 'how_to', 'story')),
    cta TEXT NOT NULL CHECK (cta IN ('follow_for_series', 'reply_with_goal', 'bookmark_checklist')),
    hashtags TEXT[] DEFAULT '{}',
    source_urls TEXT[] NOT NULL,
    tags TEXT[] NOT NULL,
    predicted_scores JSONB NOT NULL,
    content_notes TEXT NOT NULL,
    tweets TEXT[] NOT NULL,
    tweet_count INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table for storing Signal_Synapse posting data with opportunity context
CREATE TABLE IF NOT EXISTS signal_synapse_posting_data (
    id SERIAL PRIMARY KEY,
    topic TEXT NOT NULL,
    hook_type TEXT NOT NULL,
    cta TEXT NOT NULL,
    hashtags TEXT[] DEFAULT '{}',
    source_urls TEXT[] NOT NULL,
    tags TEXT[] NOT NULL,
    predicted_scores JSONB NOT NULL,
    content_notes TEXT NOT NULL,
    tweets TEXT[] NOT NULL,
    tweet_count INTEGER NOT NULL,
    opportunity_score NUMERIC,
    opportunity_reason TEXT,
    posted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_signal_synapse_threads_topic ON signal_synapse_threads(topic);
CREATE INDEX IF NOT EXISTS idx_signal_synapse_threads_hook_type ON signal_synapse_threads(hook_type);
CREATE INDEX IF NOT EXISTS idx_signal_synapse_threads_created_at ON signal_synapse_threads(created_at);

CREATE INDEX IF NOT EXISTS idx_signal_synapse_posting_topic ON signal_synapse_posting_data(topic);
CREATE INDEX IF NOT EXISTS idx_signal_synapse_posting_hook_type ON signal_synapse_posting_data(hook_type);
CREATE INDEX IF NOT EXISTS idx_signal_synapse_posting_posted_at ON signal_synapse_posting_data(posted_at);

-- RLS policies (if RLS is enabled)
DO $$
BEGIN
    -- Enable RLS if it exists and is not already enabled
    IF EXISTS (
        SELECT 1 FROM pg_tables 
        WHERE tablename = 'signal_synapse_threads' 
        AND schemaname = 'public'
    ) THEN
        ALTER TABLE signal_synapse_threads ENABLE ROW LEVEL SECURITY;
        
        -- Create policy for authenticated users (service role)
        CREATE POLICY IF NOT EXISTS "Service role access" ON signal_synapse_threads
            FOR ALL USING (auth.role() = 'service_role' OR auth.role() = 'authenticated');
    END IF;

    IF EXISTS (
        SELECT 1 FROM pg_tables 
        WHERE tablename = 'signal_synapse_posting_data' 
        AND schemaname = 'public'
    ) THEN
        ALTER TABLE signal_synapse_posting_data ENABLE ROW LEVEL SECURITY;
        
        -- Create policy for authenticated users (service role)
        CREATE POLICY IF NOT EXISTS "Service role access" ON signal_synapse_posting_data
            FOR ALL USING (auth.role() = 'service_role' OR auth.role() = 'authenticated');
    END IF;
EXCEPTION WHEN OTHERS THEN
    -- Ignore RLS errors if RLS is not available
    NULL;
END $$;

-- Comments for documentation
COMMENT ON TABLE signal_synapse_threads IS 'Stores Signal_Synapse health threads with structured JSON format and learning metrics';
COMMENT ON TABLE signal_synapse_posting_data IS 'Stores Signal_Synapse posting data with opportunity context for performance analysis';

COMMENT ON COLUMN signal_synapse_threads.predicted_scores IS 'JSON object with hook_clarity, novelty, evidence, cta_strength scores (0-100)';
COMMENT ON COLUMN signal_synapse_threads.tweets IS 'Array of tweet texts in posting order';
COMMENT ON COLUMN signal_synapse_threads.source_urls IS 'Array of credible source URLs (CDC, NIH, WHO, etc.)';
COMMENT ON COLUMN signal_synapse_threads.tags IS 'Array of 3-6 single-word topic tags';