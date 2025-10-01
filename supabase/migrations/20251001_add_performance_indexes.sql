-- Performance Indexes for xBOT
-- Created: 2025-10-01
-- Purpose: Add missing indexes for improved query performance

-- Index on content_metadata for queue processing
CREATE INDEX IF NOT EXISTS idx_content_metadata_status_created 
ON content_metadata (status, created_at DESC);

-- Index on api_usage for cost tracking and analytics
CREATE INDEX IF NOT EXISTS idx_api_usage_created 
ON api_usage (created_at DESC);

-- Index on api_usage for daily aggregations
CREATE INDEX IF NOT EXISTS idx_api_usage_created_date 
ON api_usage (DATE(created_at));

-- Index on posted_decisions for outcome collection
CREATE INDEX IF NOT EXISTS idx_posted_decisions_posted_at 
ON posted_decisions (posted_at DESC);

-- Index on outcomes for learning queries
CREATE INDEX IF NOT EXISTS idx_outcomes_collected 
ON outcomes (simulated, collected_at DESC);

-- Composite index for content_metadata queue queries
CREATE INDEX IF NOT EXISTS idx_content_metadata_queue_ready 
ON content_metadata (status, generation_source, scheduled_at) 
WHERE status = 'queued' AND generation_source = 'real';

-- Add helpful comments
COMMENT ON INDEX idx_content_metadata_status_created IS 'Optimizes status-based queries with date ordering';
COMMENT ON INDEX idx_api_usage_created IS 'Optimizes API usage analytics and cost tracking';
COMMENT ON INDEX idx_content_metadata_queue_ready IS 'Partial index for posting queue queries';

