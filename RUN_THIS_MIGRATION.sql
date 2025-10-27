-- Run this in Supabase SQL Editor
-- Dashboard: https://supabase.com/dashboard → Your Project → SQL Editor

ALTER TABLE content_metadata
ADD COLUMN IF NOT EXISTS topic_cluster VARCHAR(50),
ADD COLUMN IF NOT EXISTS angle_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS tone_is_singular BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS tone_cluster VARCHAR(50),
ADD COLUMN IF NOT EXISTS structural_type VARCHAR(50);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_content_metadata_clusters 
ON content_metadata(topic_cluster, angle_type, tone_cluster);

CREATE INDEX IF NOT EXISTS idx_content_metadata_learning
ON content_metadata(topic_cluster, actual_impressions, actual_likes)
WHERE actual_impressions IS NOT NULL;

