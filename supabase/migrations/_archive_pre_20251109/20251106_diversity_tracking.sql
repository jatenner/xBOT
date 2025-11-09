-- Migration: Add diversity tracking columns
-- Created: 2025-11-06
-- Purpose: Track generator type, angle, complexity for content variety

-- Add diversity tracking columns to BASE TABLE
ALTER TABLE content_generation_metadata_comprehensive 
ADD COLUMN IF NOT EXISTS generator_type TEXT,
ADD COLUMN IF NOT EXISTS content_angle TEXT,
ADD COLUMN IF NOT EXISTS format_type TEXT CHECK (format_type IN ('single', 'thread')),
ADD COLUMN IF NOT EXISTS complexity_score INTEGER CHECK (complexity_score >= 1 AND complexity_score <= 10);

-- Add comments for documentation
COMMENT ON COLUMN content_generation_metadata_comprehensive.generator_type IS 'Which generator created this content (e.g., myth_buster, data_nerd, pop_culture_analyst)';
COMMENT ON COLUMN content_generation_metadata_comprehensive.content_angle IS 'The angle/approach used (e.g., mechanism, protocol, comparison, myth-bust)';
COMMENT ON COLUMN content_generation_metadata_comprehensive.format_type IS 'Single tweet or thread';
COMMENT ON COLUMN content_generation_metadata_comprehensive.complexity_score IS 'Content complexity/difficulty level (1=simple, 10=complex)';

-- Create indexes for diversity queries on BASE TABLE
CREATE INDEX IF NOT EXISTS idx_generator_recent 
ON content_generation_metadata_comprehensive(generator_type, posted_at DESC NULLS LAST)
WHERE posted_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_diversity_recent 
ON content_generation_metadata_comprehensive(posted_at DESC NULLS LAST)
WHERE posted_at IS NOT NULL;

-- Add generator type index for rotation tracking
CREATE INDEX IF NOT EXISTS idx_generator_posted
ON content_generation_metadata_comprehensive(generator_type) 
WHERE posted_at IS NOT NULL;

-- Performance index for topic lookups
CREATE INDEX IF NOT EXISTS idx_topic_recent
ON content_generation_metadata_comprehensive(raw_topic, posted_at DESC NULLS LAST)
WHERE posted_at IS NOT NULL;

