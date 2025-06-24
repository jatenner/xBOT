-- Advanced Optimization Schema
-- Support for content caching, batching, and performance tracking

-- Content Cache Table
CREATE TABLE IF NOT EXISTS content_cache (
  id VARCHAR(50) PRIMARY KEY,
  content_type VARCHAR(50) NOT NULL,
  content TEXT NOT NULL,
  keywords TEXT[] DEFAULT '{}',
  usage_count INTEGER DEFAULT 0,
  last_used TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  quality_score DECIMAL(3,2) DEFAULT 0.80,
  engagement_score DECIMAL(3,2),
  template_used VARCHAR(50),
  source_agent VARCHAR(50)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_content_cache_type ON content_cache(content_type);
CREATE INDEX IF NOT EXISTS idx_content_cache_quality ON content_cache(quality_score);
CREATE INDEX IF NOT EXISTS idx_content_cache_usage ON content_cache(usage_count);
CREATE INDEX IF NOT EXISTS idx_content_cache_last_used ON content_cache(last_used);

-- Batch Processing Log
CREATE TABLE IF NOT EXISTS batch_processing_log (
  id SERIAL PRIMARY KEY,
  batch_id VARCHAR(50) NOT NULL,
  request_count INTEGER NOT NULL,
  processing_time_ms INTEGER,
  tokens_used INTEGER,
  cost_saved DECIMAL(8,4),
  success_count INTEGER,
  error_count INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Performance Metrics
CREATE TABLE IF NOT EXISTS optimization_metrics (
  id SERIAL PRIMARY KEY,
  metric_type VARCHAR(50) NOT NULL, -- 'api_calls', 'cost_savings', 'cache_hits', etc.
  metric_value DECIMAL(10,4) NOT NULL,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Template Performance Tracking
CREATE TABLE IF NOT EXISTS template_performance (
  id SERIAL PRIMARY KEY,
  template_category VARCHAR(50) NOT NULL,
  usage_count INTEGER DEFAULT 0,
  avg_engagement DECIMAL(5,2),
  success_rate DECIMAL(3,2),
  last_used TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Emergency Fallback Usage
CREATE TABLE IF NOT EXISTS emergency_fallback_log (
  id SERIAL PRIMARY KEY,
  fallback_type VARCHAR(50) NOT NULL,
  trigger_reason VARCHAR(100),
  content_generated TEXT,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cost Optimization Tracking
CREATE TABLE IF NOT EXISTS cost_optimization_daily (
  date DATE PRIMARY KEY,
  original_estimated_cost DECIMAL(8,4),
  actual_cost DECIMAL(8,4),
  savings_amount DECIMAL(8,4),
  savings_percentage DECIMAL(5,2),
  api_calls_original INTEGER,
  api_calls_actual INTEGER,
  cache_hit_rate DECIMAL(3,2),
  batch_efficiency DECIMAL(3,2),
  emergency_fallback_usage INTEGER DEFAULT 0
);

-- Image usage tracking table
CREATE TABLE IF NOT EXISTS image_usage_history (
    id SERIAL PRIMARY KEY,
    image_id VARCHAR(255) NOT NULL,
    image_url TEXT NOT NULL,
    source VARCHAR(50) NOT NULL, -- 'pexels', 'unsplash', 'fallback'
    usage_count INTEGER DEFAULT 1,
    last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    first_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    search_terms TEXT[], -- Keywords used to find this image
    tweet_id VARCHAR(255), -- Associated tweet ID if available
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_image_usage_image_id ON image_usage_history(image_id);
CREATE INDEX IF NOT EXISTS idx_image_usage_last_used ON image_usage_history(last_used_at);
CREATE INDEX IF NOT EXISTS idx_image_usage_source ON image_usage_history(source);
CREATE INDEX IF NOT EXISTS idx_image_usage_count ON image_usage_history(usage_count);

-- News sources tracking table for multi-API redundancy
CREATE TABLE IF NOT EXISTS news_source_health (
    id SERIAL PRIMARY KEY,
    api_name VARCHAR(50) NOT NULL, -- 'newsapi', 'guardian', 'mediastack', 'newsdata'
    daily_usage_count INTEGER DEFAULT 0,
    daily_limit INTEGER NOT NULL,
    last_reset_date DATE DEFAULT CURRENT_DATE,
    last_successful_call TIMESTAMP WITH TIME ZONE,
    last_error_message TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert initial API configurations
INSERT INTO news_source_health (api_name, daily_limit) VALUES 
    ('newsapi', 90),
    ('guardian', 1000),
    ('mediastack', 900),
    ('newsdata', 180)
ON CONFLICT (api_name) DO UPDATE SET
    daily_limit = EXCLUDED.daily_limit,
    updated_at = NOW();

-- Create unique constraint for API names
CREATE UNIQUE INDEX IF NOT EXISTS idx_news_source_api_name ON news_source_health(api_name);

-- Function to update image usage
CREATE OR REPLACE FUNCTION update_image_usage(
    p_image_id VARCHAR(255),
    p_image_url TEXT,
    p_source VARCHAR(50),
    p_search_terms TEXT[] DEFAULT NULL,
    p_tweet_id VARCHAR(255) DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
    INSERT INTO image_usage_history (
        image_id, image_url, source, usage_count, search_terms, tweet_id, last_used_at, first_used_at
    ) VALUES (
        p_image_id, p_image_url, p_source, 1, p_search_terms, p_tweet_id, NOW(), NOW()
    )
    ON CONFLICT (image_id) DO UPDATE SET
        usage_count = image_usage_history.usage_count + 1,
        last_used_at = NOW(),
        search_terms = COALESCE(p_search_terms, image_usage_history.search_terms),
        tweet_id = COALESCE(p_tweet_id, image_usage_history.tweet_id),
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to get least used images
CREATE OR REPLACE FUNCTION get_least_used_images(
    p_source VARCHAR(50) DEFAULT NULL,
    p_limit INTEGER DEFAULT 10
) RETURNS TABLE (
    image_id VARCHAR(255),
    image_url TEXT,
    source VARCHAR(50),
    usage_count INTEGER,
    last_used_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        h.image_id,
        h.image_url,
        h.source,
        h.usage_count,
        h.last_used_at
    FROM image_usage_history h
    WHERE (p_source IS NULL OR h.source = p_source)
    ORDER BY h.usage_count ASC, h.last_used_at ASC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to reset daily API usage counts
CREATE OR REPLACE FUNCTION reset_daily_api_usage() RETURNS VOID AS $$
BEGIN
    UPDATE news_source_health 
    SET 
        daily_usage_count = 0,
        last_reset_date = CURRENT_DATE,
        updated_at = NOW()
    WHERE last_reset_date < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql;

-- Function to increment API usage
CREATE OR REPLACE FUNCTION increment_api_usage(
    p_api_name VARCHAR(50),
    p_success BOOLEAN DEFAULT true,
    p_error_message TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
    current_usage INTEGER;
    usage_limit INTEGER;
BEGIN
    -- Reset daily counts if needed
    PERFORM reset_daily_api_usage();
    
    -- Get current usage and limit
    SELECT daily_usage_count, daily_limit 
    INTO current_usage, usage_limit
    FROM news_source_health 
    WHERE api_name = p_api_name;
    
    -- Check if we can make the request
    IF current_usage >= usage_limit THEN
        RETURN FALSE;
    END IF;
    
    -- Increment usage count
    UPDATE news_source_health 
    SET 
        daily_usage_count = daily_usage_count + 1,
        last_successful_call = CASE WHEN p_success THEN NOW() ELSE last_successful_call END,
        last_error_message = CASE WHEN NOT p_success THEN p_error_message ELSE NULL END,
        updated_at = NOW()
    WHERE api_name = p_api_name;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- View for API usage monitoring
CREATE OR REPLACE VIEW api_usage_status AS
SELECT 
    api_name,
    daily_usage_count,
    daily_limit,
    ROUND((daily_usage_count::DECIMAL / daily_limit * 100), 2) as usage_percentage,
    (daily_limit - daily_usage_count) as remaining_calls,
    last_successful_call,
    last_error_message,
    is_active,
    last_reset_date
FROM news_source_health
ORDER BY usage_percentage DESC;

-- View for image usage analytics
CREATE OR REPLACE VIEW image_usage_analytics AS
SELECT 
    source,
    COUNT(*) as total_images,
    AVG(usage_count) as avg_usage_count,
    MAX(usage_count) as max_usage_count,
    MIN(usage_count) as min_usage_count,
    COUNT(*) FILTER (WHERE last_used_at > NOW() - INTERVAL '7 days') as used_last_week,
    COUNT(*) FILTER (WHERE last_used_at > NOW() - INTERVAL '1 day') as used_today
FROM image_usage_history
GROUP BY source
ORDER BY total_images DESC;

-- Cleanup Functions
CREATE OR REPLACE FUNCTION cleanup_old_cache() RETURNS void AS $$
BEGIN
  -- Remove content used more than max limit or older than 30 days
  DELETE FROM content_cache 
  WHERE usage_count >= 5 
     OR created_at < NOW() - INTERVAL '30 days';
  
  -- Remove old logs older than 90 days
  DELETE FROM batch_processing_log 
  WHERE created_at < NOW() - INTERVAL '90 days';
  
  DELETE FROM emergency_fallback_log 
  WHERE created_at < NOW() - INTERVAL '90 days';
  
  -- Keep only last 180 days of metrics
  DELETE FROM optimization_metrics 
  WHERE created_at < NOW() - INTERVAL '180 days';
END;
$$ LANGUAGE plpgsql;

-- Auto-cleanup trigger (runs daily)
CREATE OR REPLACE FUNCTION schedule_cleanup() RETURNS trigger AS $$
BEGIN
  -- This would be called by a cron job or scheduler
  PERFORM cleanup_old_cache();
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Views for easy metrics access

-- Daily optimization summary
CREATE OR REPLACE VIEW daily_optimization_summary AS
SELECT 
  date,
  original_estimated_cost,
  actual_cost,
  savings_amount,
  savings_percentage,
  api_calls_original,
  api_calls_actual,
  ROUND((api_calls_original - api_calls_actual)::DECIMAL / api_calls_original * 100, 2) as api_reduction_percentage,
  cache_hit_rate,
  batch_efficiency,
  emergency_fallback_usage
FROM cost_optimization_daily
ORDER BY date DESC;

-- Cache performance view
CREATE OR REPLACE VIEW cache_performance AS
SELECT 
  content_type,
  COUNT(*) as total_items,
  AVG(usage_count) as avg_usage,
  AVG(quality_score) as avg_quality,
  AVG(engagement_score) as avg_engagement,
  MAX(last_used) as most_recent_use
FROM content_cache
GROUP BY content_type
ORDER BY total_items DESC;

-- Template effectiveness view
CREATE OR REPLACE VIEW template_effectiveness AS
SELECT 
  template_category,
  usage_count,
  avg_engagement,
  success_rate,
  CASE 
    WHEN success_rate >= 0.8 AND avg_engagement >= 3.0 THEN 'Excellent'
    WHEN success_rate >= 0.6 AND avg_engagement >= 2.0 THEN 'Good' 
    WHEN success_rate >= 0.4 THEN 'Fair'
    ELSE 'Needs Improvement'
  END as performance_rating,
  last_used
FROM template_performance
ORDER BY avg_engagement DESC, success_rate DESC;

-- Batch efficiency view  
CREATE OR REPLACE VIEW batch_efficiency AS
SELECT 
  DATE(created_at) as date,
  COUNT(*) as total_batches,
  AVG(request_count) as avg_requests_per_batch,
  AVG(processing_time_ms) as avg_processing_time,
  SUM(cost_saved) as total_cost_saved,
  AVG(CASE WHEN error_count = 0 THEN 1.0 ELSE 0.0 END) as success_rate
FROM batch_processing_log
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Insert initial optimization tracking record
INSERT INTO cost_optimization_daily (
  date, 
  original_estimated_cost, 
  actual_cost, 
  savings_amount, 
  savings_percentage,
  api_calls_original,
  api_calls_actual,
  cache_hit_rate,
  batch_efficiency
) VALUES (
  CURRENT_DATE,
  50.00, -- Original daily cost
  2.00,  -- Optimized daily cost  
  48.00, -- Savings amount
  96.00, -- Savings percentage
  200,   -- Original API calls
  15,    -- Optimized API calls
  0.75,  -- Cache hit rate estimate
  0.80   -- Batch efficiency estimate
) ON CONFLICT (date) DO NOTHING;

-- Comments for documentation
COMMENT ON TABLE content_cache IS 'Stores cached content to reduce API calls';
COMMENT ON TABLE batch_processing_log IS 'Tracks batch processing performance and savings';
COMMENT ON TABLE optimization_metrics IS 'General optimization metrics tracking';
COMMENT ON TABLE template_performance IS 'Tracks how well different content templates perform';
COMMENT ON TABLE emergency_fallback_log IS 'Logs when emergency fallback content is used';
COMMENT ON TABLE cost_optimization_daily IS 'Daily summary of cost optimizations and savings'; 