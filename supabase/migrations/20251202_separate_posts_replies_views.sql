-- =====================================================
-- SEPARATE POSTS AND REPLIES VIEWS
-- Created: December 2, 2025
-- Purpose: Separate learning data for posts vs replies
-- =====================================================

-- Create view for posts only (singles + threads)
-- Based on content_with_outcomes but filtered to exclude replies
CREATE OR REPLACE VIEW posts_with_outcomes AS
SELECT * FROM content_with_outcomes
WHERE decision_type IN ('single', 'thread');

-- Create view for replies only
CREATE OR REPLACE VIEW replies_with_outcomes AS
SELECT * FROM content_with_outcomes
WHERE decision_type = 'reply';

-- Grant access
GRANT SELECT ON posts_with_outcomes TO anon, authenticated, service_role;
GRANT SELECT ON replies_with_outcomes TO anon, authenticated, service_role;

-- Add comments
COMMENT ON VIEW posts_with_outcomes IS 'Posted content (singles + threads) with outcomes - for learning systems';
COMMENT ON VIEW replies_with_outcomes IS 'Reply content with outcomes - for reply learning systems';

