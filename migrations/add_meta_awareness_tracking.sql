-- Migration: Add Meta-Awareness Tracking Columns
-- Purpose: Track which clusters/types AI samples from for learning

-- Add columns to content_metadata table
ALTER TABLE content_metadata
ADD COLUMN IF NOT EXISTS topic_cluster VARCHAR(50),
ADD COLUMN IF NOT EXISTS angle_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS tone_is_singular BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS tone_cluster VARCHAR(50),
ADD COLUMN IF NOT EXISTS structural_type VARCHAR(50);

-- Create index for cluster analysis queries
CREATE INDEX IF NOT EXISTS idx_content_metadata_clusters 
ON content_metadata(topic_cluster, angle_type, tone_cluster);

-- Create index for learning queries
CREATE INDEX IF NOT EXISTS idx_content_metadata_learning
ON content_metadata(topic_cluster, actual_impressions, actual_likes)
WHERE actual_impressions IS NOT NULL;

COMMENT ON COLUMN content_metadata.topic_cluster IS 'AI-reported cluster: educational, cultural, industry, controversial, media';
COMMENT ON COLUMN content_metadata.angle_type IS 'AI-reported angle type: mechanism, cultural, media, industry, etc';
COMMENT ON COLUMN content_metadata.tone_is_singular IS 'Whether tone is singular (true) or compound (false)';
COMMENT ON COLUMN content_metadata.tone_cluster IS 'AI-reported tone category: bold, neutral, warm, playful, thoughtful';
COMMENT ON COLUMN content_metadata.structural_type IS 'AI-reported structure: minimal, dense, chaotic, conversational, etc';

