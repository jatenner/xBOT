-- Daily progress tracking for follower acquisition goal
CREATE TABLE IF NOT EXISTS daily_progress (
    date DATE PRIMARY KEY DEFAULT CURRENT_DATE,
    followers_count INTEGER DEFAULT 0,
    tweets_posted INTEGER DEFAULT 0,
    total_impressions BIGINT DEFAULT 0,
    total_engagement INTEGER DEFAULT 0,
    success_rate NUMERIC(5,2) DEFAULT 0,
    f_per_1k NUMERIC(8,2) DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for efficient querying
CREATE INDEX IF NOT EXISTS idx_daily_progress_date ON daily_progress(date DESC);

-- Seed today's baseline (adjust followers_count to actual current value)
INSERT INTO daily_progress (date, followers_count, notes)
VALUES (CURRENT_DATE, 0, 'Baseline measurement - start of 10 follower challenge')
ON CONFLICT (date) DO NOTHING; 