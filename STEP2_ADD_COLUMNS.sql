-- 🎯 STEP 2: ADD MISSING COLUMNS SAFELY
-- ====================================
-- ONLY RUN AFTER STEP 1 WORKS

-- Add missing columns to tweets table
ALTER TABLE tweets ADD COLUMN IF NOT EXISTS content_type VARCHAR(50) DEFAULT 'health_content';
ALTER TABLE tweets ADD COLUMN IF NOT EXISTS posting_strategy VARCHAR(50) DEFAULT 'intelligent';
ALTER TABLE tweets ADD COLUMN IF NOT EXISTS viral_score INTEGER DEFAULT 5;
ALTER TABLE tweets ADD COLUMN IF NOT EXISTS posted_at TIMESTAMPTZ;

-- Add missing columns to quota tracking
ALTER TABLE twitter_quota_tracking ADD COLUMN IF NOT EXISTS current_strategy VARCHAR(20) DEFAULT 'balanced';
ALTER TABLE twitter_quota_tracking ADD COLUMN IF NOT EXISTS utilization_rate DECIMAL(5,2) DEFAULT 0.00;
ALTER TABLE twitter_quota_tracking ADD COLUMN IF NOT EXISTS total_engagement INTEGER DEFAULT 0;

-- Create additional tables
CREATE TABLE IF NOT EXISTS system_logs (
    id SERIAL PRIMARY KEY,
    action VARCHAR(100) NOT NULL,
    data JSONB DEFAULT '{}',
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    success BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS api_usage_tracking (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    api_type VARCHAR(50) NOT NULL,
    count INTEGER DEFAULT 0,
    cost DECIMAL(10,4) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(date, api_type)
);

SELECT 'STEP 2 COMPLETE - Columns added' as status; 