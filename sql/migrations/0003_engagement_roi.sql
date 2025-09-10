-- =====================================================
-- ENGAGEMENT ROI TRACKING
-- Track cost per follower by hour for optimization
-- =====================================================

BEGIN;

-- Create engagement ROI table
CREATE TABLE IF NOT EXISTS public.engagement_roi (
  hour integer PRIMARY KEY CHECK (hour >= 0 AND hour <= 23),
  engagement_score numeric NOT NULL DEFAULT 0,
  followers_gained integer NOT NULL DEFAULT 0,
  cost_usd numeric(12,6) NOT NULL DEFAULT 0,
  cost_per_follower numeric(12,6) NOT NULL DEFAULT 0,
  sample_size integer NOT NULL DEFAULT 0,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_engagement_roi_cost_per_follower ON public.engagement_roi (cost_per_follower);
CREATE INDEX IF NOT EXISTS idx_engagement_roi_updated_at ON public.engagement_roi (updated_at);

-- Auto-update timestamp
CREATE OR REPLACE FUNCTION update_engagement_roi_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER engagement_roi_update_timestamp
  BEFORE UPDATE ON public.engagement_roi
  FOR EACH ROW
  EXECUTE FUNCTION update_engagement_roi_timestamp();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON public.engagement_roi TO service_role;
GRANT SELECT ON public.engagement_roi TO authenticated;

COMMIT;
