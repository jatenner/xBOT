-- Fix missing columns in posts table
-- Migration: 20250908_fix_posts_schema_columns

-- Add missing columns to posts table
ALTER TABLE posts 
ADD COLUMN IF NOT EXISTS engagement_metrics JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS request_context JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS scores JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS approved BOOLEAN DEFAULT false;

-- Add useful indexes for the new columns
CREATE INDEX IF NOT EXISTS idx_posts_approved ON posts (approved);
CREATE INDEX IF NOT EXISTS idx_posts_scores ON posts USING GIN (scores);

-- Update existing records to have default values
UPDATE posts 
SET 
  engagement_metrics = COALESCE(engagement_metrics, '{}'),
  request_context = COALESCE(request_context, '{}'),
  scores = COALESCE(scores, '{}'),
  approved = COALESCE(approved, false)
WHERE 
  engagement_metrics IS NULL 
  OR request_context IS NULL 
  OR scores IS NULL 
  OR approved IS NULL;
