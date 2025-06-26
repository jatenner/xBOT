-- =====================================================
-- EMERGENCY FIX: Create missing api_usage_tracking table
-- =====================================================
-- Root cause: Real-Time Limits Intelligence Agent expects api_usage_tracking table
-- but Supabase only has api_usage and monthly_api_usage tables
-- This causes silent failures → false "17/17 available" readings → API spam

-- Create the missing api_usage_tracking table that our code expects
CREATE TABLE IF NOT EXISTS api_usage_tracking (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL,
    api_type VARCHAR(20) NOT NULL, -- 'twitter', 'openai', 'newsapi', 'pexels'
    tweets_posted INTEGER DEFAULT 0,
    reads_made INTEGER DEFAULT 0,
    requests_made INTEGER DEFAULT 0,
    tokens_used INTEGER DEFAULT 0,
    cost_incurred DECIMAL(10,4) DEFAULT 0,
    endpoint VARCHAR(100),
    response_code INTEGER,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_api_usage_tracking_date ON api_usage_tracking(date);
CREATE INDEX IF NOT EXISTS idx_api_usage_tracking_type ON api_usage_tracking(api_type);
CREATE INDEX IF NOT EXISTS idx_api_usage_tracking_date_type ON api_usage_tracking(date, api_type);

-- Create today's entries for all API types to prevent empty results
INSERT INTO api_usage_tracking (date, api_type, tweets_posted, reads_made) 
VALUES 
    (CURRENT_DATE, 'twitter', 0, 0),
    (CURRENT_DATE, 'openai', 0, 0),
    (CURRENT_DATE, 'newsapi', 0, 0),
    (CURRENT_DATE, 'pexels', 0, 0)
ON CONFLICT DO NOTHING;

-- Function to sync existing api_usage data into api_usage_tracking
CREATE OR REPLACE FUNCTION sync_api_usage_to_tracking()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    usage_row RECORD;
BEGIN
    -- Copy data from api_usage to api_usage_tracking
    FOR usage_row IN SELECT * FROM api_usage LOOP
        INSERT INTO api_usage_tracking (date, api_type, tweets_posted, reads_made)
        VALUES (usage_row.date, 'twitter', usage_row.writes, usage_row.reads)
        ON CONFLICT DO NOTHING;
    END LOOP;
    
    RAISE NOTICE 'Synced api_usage data to api_usage_tracking';
END;
$$;

-- Sync existing data
SELECT sync_api_usage_to_tracking();

-- Function to track Twitter API usage (replacement for missing functionality)
CREATE OR REPLACE FUNCTION track_twitter_usage(
    tweet_count INTEGER DEFAULT 1,
    read_count INTEGER DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO api_usage_tracking (date, api_type, tweets_posted, reads_made)
    VALUES (CURRENT_DATE, 'twitter', tweet_count, read_count)
    ON CONFLICT (date, api_type) 
    DO UPDATE SET 
        tweets_posted = api_usage_tracking.tweets_posted + tweet_count,
        reads_made = api_usage_tracking.reads_made + read_count,
        timestamp = NOW();
        
    -- Also update the legacy api_usage table for compatibility
    INSERT INTO api_usage (date, writes, reads)
    VALUES (CURRENT_DATE, tweet_count, read_count)
    ON CONFLICT (date)
    DO UPDATE SET 
        writes = api_usage.writes + tweet_count,
        reads = api_usage.reads + read_count;
END;
$$;

-- Function to track OpenAI API usage
CREATE OR REPLACE FUNCTION track_openai_usage(
    request_count INTEGER DEFAULT 1,
    token_count INTEGER DEFAULT 0,
    cost DECIMAL(10,4) DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO api_usage_tracking (date, api_type, requests_made, tokens_used, cost_incurred)
    VALUES (CURRENT_DATE, 'openai', request_count, token_count, cost)
    ON CONFLICT (date, api_type)
    DO UPDATE SET 
        requests_made = api_usage_tracking.requests_made + request_count,
        tokens_used = api_usage_tracking.tokens_used + token_count,
        cost_incurred = api_usage_tracking.cost_incurred + cost,
        timestamp = NOW();
END;
$$;

-- Enable Row Level Security
ALTER TABLE api_usage_tracking ENABLE ROW LEVEL SECURITY;

-- Create policy for service role access
CREATE POLICY "Enable all operations for service role" ON api_usage_tracking FOR ALL USING (true);

-- Create view for easy daily stats lookup (what the limits agent actually needs)
CREATE OR REPLACE VIEW daily_api_stats AS
SELECT 
    date,
    api_type,
    SUM(tweets_posted) as tweets,
    SUM(reads_made) as reads,
    SUM(requests_made) as requests,
    SUM(tokens_used) as tokens,
    SUM(cost_incurred) as cost
FROM api_usage_tracking
GROUP BY date, api_type;

COMMENT ON TABLE api_usage_tracking IS 'Tracks API usage for all services - required by Real-Time Limits Intelligence Agent';
COMMENT ON VIEW daily_api_stats IS 'Simplified daily stats view for limits intelligence queries';

SELECT 'api_usage_tracking table created successfully - Real-Time Limits Intelligence should now work!' as result; 