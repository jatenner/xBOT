-- Multi-Point Follower Tracking Enhancement
-- Adds phase column and post_id reference to follower_snapshots
-- Adds follower attribution columns to content_metadata

-- Add phase column to follower_snapshots
ALTER TABLE follower_snapshots 
ADD COLUMN IF NOT EXISTS phase TEXT DEFAULT 'baseline', -- 'before', '2h', '24h', '48h'
ADD COLUMN IF NOT EXISTS post_id UUID; -- References content_metadata(decision_id)

-- Add index for fast lookups
CREATE INDEX IF NOT EXISTS idx_follower_snapshots_post_phase 
ON follower_snapshots(post_id, phase) 
WHERE post_id IS NOT NULL;

-- Add attribution columns to content_metadata
ALTER TABLE content_metadata
ADD COLUMN IF NOT EXISTS followers_before INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS followers_gained_2h INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS followers_gained_24h INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS followers_gained_48h INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS attribution_confidence TEXT DEFAULT 'low'; -- 'high', 'medium', 'low'

-- Add index for follower attribution queries
CREATE INDEX IF NOT EXISTS idx_content_metadata_follower_attribution 
ON content_metadata(decision_id, posted_at) 
WHERE status = 'posted' AND followers_before > 0;

-- Add comment
COMMENT ON COLUMN follower_snapshots.phase IS 'Snapshot phase: before (baseline), 2h, 24h, or 48h after posting';
COMMENT ON COLUMN follower_snapshots.post_id IS 'Reference to content_metadata.decision_id for attribution';
COMMENT ON COLUMN content_metadata.followers_before IS 'Follower count before posting (baseline)';
COMMENT ON COLUMN content_metadata.followers_gained_2h IS 'Followers gained within 2 hours (high confidence attribution)';
COMMENT ON COLUMN content_metadata.followers_gained_24h IS 'Followers gained within 24 hours (primary attribution)';
COMMENT ON COLUMN content_metadata.followers_gained_48h IS 'Followers gained within 48 hours (long-term tracking)';
COMMENT ON COLUMN content_metadata.attribution_confidence IS 'Confidence level: high (2h gains), medium (24h gains), low (48h gains or no gains)';




