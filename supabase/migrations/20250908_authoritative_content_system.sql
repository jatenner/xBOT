-- ================================================================
-- AUTHORITATIVE CONTENT SYSTEM MIGRATION
-- Fixes content quality issues and adds missing columns
-- Date: 2025-09-08
-- ================================================================

-- Add missing 'approved' column to posts table
ALTER TABLE posts ADD COLUMN IF NOT EXISTS approved BOOLEAN DEFAULT true;

-- Add missing columns for content quality scoring
ALTER TABLE posts ADD COLUMN IF NOT EXISTS rejection_reasons TEXT[] DEFAULT '{}';
ALTER TABLE posts ADD COLUMN IF NOT EXISTS hook_type VARCHAR(50) DEFAULT 'contrarian';
ALTER TABLE posts ADD COLUMN IF NOT EXISTS evidence_quality INTEGER DEFAULT 0;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS authority_score INTEGER DEFAULT 0;

-- Update scores column to include new scoring criteria if it's JSONB
-- (Safe operation - only adds new fields, doesn't overwrite existing)
UPDATE posts 
SET scores = scores || jsonb_build_object(
  'authorityScore', COALESCE((scores->>'authorityScore')::int, 70),
  'evidenceScore', COALESCE((scores->>'evidenceScore')::int, 60),
  'hookScore', COALESCE((scores->>'hookScore')::int, 50),
  'clarityScore', COALESCE((scores->>'clarityScore')::int, 75)
)
WHERE scores IS NOT NULL AND jsonb_typeof(scores) = 'object';

-- Create rejected_posts table if it doesn't exist
CREATE TABLE IF NOT EXISTS rejected_posts (
  id BIGSERIAL PRIMARY KEY,
  content TEXT NOT NULL,
  format VARCHAR(20) NOT NULL CHECK (format IN ('single', 'thread')),
  topic VARCHAR(255),
  scores JSONB DEFAULT '{}',
  rejection_reasons TEXT[] NOT NULL DEFAULT '{}',
  rejected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  request_context JSONB DEFAULT '{}'
);

-- Create content_performance_insights table for caching
CREATE TABLE IF NOT EXISTS content_performance_insights (
  id BIGSERIAL PRIMARY KEY,
  insight_type VARCHAR(100) NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '24 hours')
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_posts_approved ON posts(approved);
CREATE INDEX IF NOT EXISTS idx_posts_authority_score ON posts(authority_score);
CREATE INDEX IF NOT EXISTS idx_posts_created_at_desc ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rejected_posts_rejected_at ON rejected_posts(rejected_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_insights_type ON content_performance_insights(insight_type);
CREATE INDEX IF NOT EXISTS idx_content_insights_expires ON content_performance_insights(expires_at);

-- Update RLS policies for new tables
ALTER TABLE rejected_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_performance_insights ENABLE ROW LEVEL SECURITY;

-- RLS policies for service role access
CREATE POLICY IF NOT EXISTS "Service role can manage rejected_posts" ON rejected_posts
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY IF NOT EXISTS "Service role can manage content_insights" ON content_performance_insights
  FOR ALL USING (auth.role() = 'service_role');

-- Add a function to clean up expired insights
CREATE OR REPLACE FUNCTION cleanup_expired_insights()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM content_performance_insights 
  WHERE expires_at < NOW();
END;
$$;

-- Add comment documenting the authoritative content system
COMMENT ON TABLE posts IS 'Main posts table with authoritative content scoring';
COMMENT ON TABLE rejected_posts IS 'Posts rejected by quality gates for learning';
COMMENT ON TABLE content_performance_insights IS 'Cached performance data for content optimization';

COMMENT ON COLUMN posts.approved IS 'Whether content passed authoritative quality gates';
COMMENT ON COLUMN posts.rejection_reasons IS 'Reasons content was initially rejected (if any)';
COMMENT ON COLUMN posts.authority_score IS 'Expert authority level score (0-100)';
COMMENT ON COLUMN posts.evidence_quality IS 'Research evidence quality score (0-100)';
COMMENT ON COLUMN posts.hook_type IS 'Type of hook used (contrarian, research_reveal, myth_buster)';

-- Insert initial authoritative content configuration
INSERT INTO content_performance_insights (insight_type, data) 
VALUES (
  'authoritative_config',
  jsonb_build_object(
    'personal_language_blocked', true,
    'minimum_authority_score', 70,
    'minimum_evidence_score', 60,
    'minimum_overall_score', 70,
    'banned_phrases', ARRAY[
      'I tried', 'my experience', 'worked for me', 'my friend', 'a friend told me',
      'personally', 'in my opinion', 'I found', 'I discovered', 'my results'
    ],
    'required_elements', ARRAY[
      'specific research citations', 'numerical data', 'expert terminology',
      'third-person perspective', 'evidence-based claims'
    ],
    'last_updated', NOW()
  )
) ON CONFLICT DO NOTHING;

-- Notification that migration completed
SELECT 'Authoritative Content System migration completed successfully' AS status;
