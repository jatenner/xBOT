-- Idempotent migration to seed optimal_posting_windows table
-- This ensures the table exists and has default data to prevent PGRST116 errors

-- Create table if it doesn't exist (idempotent)
CREATE TABLE IF NOT EXISTS optimal_posting_windows (
    id SERIAL PRIMARY KEY,
    day_of_week INTEGER NOT NULL, -- 1=Monday, 2=Tuesday, ..., 7=Sunday
    window_start INTEGER NOT NULL, -- Hour (0-23)
    window_end INTEGER NOT NULL, -- Hour (0-23)
    avg_engagement DECIMAL(5,4) DEFAULT 0.1,
    effectiveness_score DECIMAL(5,4) DEFAULT 0.1,
    confidence DECIMAL(5,4) DEFAULT 0.33,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(day_of_week, window_start)
);

-- Enable RLS
ALTER TABLE optimal_posting_windows ENABLE ROW LEVEL SECURITY;

-- Create policy for service role access
DROP POLICY IF EXISTS "Service role can manage optimal_posting_windows" ON optimal_posting_windows;
CREATE POLICY "Service role can manage optimal_posting_windows" 
ON optimal_posting_windows FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);

-- Create policy for authenticated users
DROP POLICY IF EXISTS "Authenticated users can read optimal_posting_windows" ON optimal_posting_windows;
CREATE POLICY "Authenticated users can read optimal_posting_windows" 
ON optimal_posting_windows FOR SELECT 
TO authenticated 
USING (true);

-- Seed default engagement windows (idempotent)
-- High engagement times: 9am, 12pm, 6pm across all days
INSERT INTO optimal_posting_windows (day_of_week, window_start, window_end, avg_engagement, effectiveness_score, confidence)
VALUES 
    -- Monday
    (1, 9, 10, 0.15, 0.20, 0.75),   -- 9am peak
    (1, 12, 13, 0.18, 0.25, 0.80),  -- 12pm peak  
    (1, 18, 19, 0.16, 0.22, 0.70),  -- 6pm peak
    -- Tuesday  
    (2, 9, 10, 0.16, 0.21, 0.76),
    (2, 12, 13, 0.19, 0.26, 0.82),
    (2, 18, 19, 0.17, 0.23, 0.71),
    -- Wednesday
    (3, 9, 10, 0.17, 0.22, 0.77),
    (3, 12, 13, 0.20, 0.27, 0.83),
    (3, 18, 19, 0.18, 0.24, 0.72),
    -- Thursday
    (4, 9, 10, 0.18, 0.23, 0.78),
    (4, 12, 13, 0.21, 0.28, 0.84),
    (4, 18, 19, 0.19, 0.25, 0.73),
    -- Friday
    (5, 9, 10, 0.19, 0.24, 0.79),
    (5, 12, 13, 0.22, 0.29, 0.85),
    (5, 17, 18, 0.20, 0.26, 0.74),  -- Friday evening starts earlier
    -- Saturday
    (6, 10, 11, 0.14, 0.18, 0.65),  -- Weekend patterns different
    (6, 14, 15, 0.16, 0.20, 0.67),
    (6, 19, 20, 0.15, 0.19, 0.66),
    -- Sunday
    (7, 11, 12, 0.13, 0.17, 0.63),
    (7, 15, 16, 0.15, 0.19, 0.65),
    (7, 19, 20, 0.14, 0.18, 0.64)
ON CONFLICT (day_of_week, window_start) DO UPDATE SET
    window_end = EXCLUDED.window_end,
    avg_engagement = EXCLUDED.avg_engagement,
    effectiveness_score = EXCLUDED.effectiveness_score,
    confidence = EXCLUDED.confidence,
    updated_at = NOW();

-- Log completion marker for verification
DO $$
BEGIN
    RAISE NOTICE 'DB_SEEDED_DEFAULT_WINDOWS: % engagement windows created/updated', 
        (SELECT COUNT(*) FROM optimal_posting_windows);
END $$;