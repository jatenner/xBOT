-- Create rejected_drafts table for quality gate tracking
-- Run this in Supabase SQL Editor

-- First, drop table if it exists to start fresh
DROP TABLE IF EXISTS rejected_drafts;

-- Create the table
CREATE TABLE rejected_drafts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content TEXT NOT NULL,
    rejection_reason TEXT NOT NULL,
    quality_metrics JSONB,
    rejected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    content_type VARCHAR(50) DEFAULT 'tweet',
    readability_score DECIMAL(5,2),
    fact_count INTEGER,
    source_credibility DECIMAL(3,2),
    character_count INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes (run these after table is created)
-- CREATE INDEX IF NOT EXISTS idx_rejected_drafts_rejected_at ON rejected_drafts(rejected_at);
-- CREATE INDEX IF NOT EXISTS idx_rejected_drafts_rejection_reason ON rejected_drafts(rejection_reason); 