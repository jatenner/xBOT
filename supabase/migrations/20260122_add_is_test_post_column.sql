-- =====================================================================================
-- ADD is_test_post COLUMN TO content_metadata
-- Purpose: Separate test posts from production posts
-- Date: 2026-01-22
-- =====================================================================================

BEGIN;

-- Add is_test_post column with default false (fail-closed: treat missing as PROD)
ALTER TABLE content_metadata
ADD COLUMN IF NOT EXISTS is_test_post BOOLEAN NOT NULL DEFAULT false;

-- Create index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_content_metadata_is_test_post 
ON content_metadata (is_test_post) 
WHERE is_test_post = true;

-- Add comment for documentation
COMMENT ON COLUMN content_metadata.is_test_post IS 
'Flag to separate test posts from production. Test posts are blocked by default unless ALLOW_TEST_POSTS=true env var is set.';

COMMIT;
