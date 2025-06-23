-- Migration: Add rejected_drafts table for quality gate tracking
-- Date: 2025-06-23
-- Purpose: Track tweets that failed quality gate for analysis and improvement

CREATE TABLE IF NOT EXISTS rejected_drafts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content TEXT NOT NULL,
    rejection_reason TEXT NOT NULL,
    quality_metrics JSONB,
    rejected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    content_type VARCHAR(50) DEFAULT 'tweet',
    
    -- Analysis fields
    readability_score DECIMAL(5,2),
    fact_count INTEGER,
    source_credibility DECIMAL(3,2),
    character_count INTEGER,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_rejected_drafts_rejected_at ON rejected_drafts(rejected_at);
CREATE INDEX IF NOT EXISTS idx_rejected_drafts_rejection_reason ON rejected_drafts(rejection_reason);

-- Add a trigger to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_rejected_drafts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_rejected_drafts_updated_at
    BEFORE UPDATE ON rejected_drafts
    FOR EACH ROW
    EXECUTE FUNCTION update_rejected_drafts_updated_at();

-- Add comments for documentation
COMMENT ON TABLE rejected_drafts IS 'Stores tweets that failed quality gate checks for analysis';
COMMENT ON COLUMN rejected_drafts.content IS 'The tweet content that was rejected';
COMMENT ON COLUMN rejected_drafts.rejection_reason IS 'Primary reason for rejection';
COMMENT ON COLUMN rejected_drafts.quality_metrics IS 'Full quality metrics JSON from quality gate';
COMMENT ON COLUMN rejected_drafts.readability_score IS 'Flesch Reading Ease score';
COMMENT ON COLUMN rejected_drafts.fact_count IS 'Number of facts detected in content';
COMMENT ON COLUMN rejected_drafts.source_credibility IS 'Source credibility score (0-1)'; 