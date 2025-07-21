-- Create posting_coordination table for unified posting coordinator
-- This table tracks daily posting state to prevent burst posting

DROP TABLE IF EXISTS posting_coordination;

CREATE TABLE posting_coordination (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  posts_today INTEGER DEFAULT 0,
  last_post_time TIMESTAMPTZ,
  last_posting_agent TEXT,
  last_tweet_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for fast date lookups
CREATE INDEX idx_posting_coordination_date ON posting_coordination(date);

-- Create RLS policy to allow service role access
ALTER TABLE posting_coordination ENABLE ROW LEVEL SECURITY;

-- Policy for service role (bypasses RLS for system operations)
CREATE POLICY "Service role can manage posting coordination" ON posting_coordination
  FOR ALL 
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Policy for authenticated users (read-only)
CREATE POLICY "Authenticated users can read posting coordination" ON posting_coordination
  FOR SELECT 
  TO authenticated
  USING (true);

-- Update function for updated_at timestamp
CREATE OR REPLACE FUNCTION update_posting_coordination_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER update_posting_coordination_updated_at
  BEFORE UPDATE ON posting_coordination
  FOR EACH ROW
  EXECUTE FUNCTION update_posting_coordination_updated_at();

-- Grant permissions
GRANT ALL ON posting_coordination TO service_role;
GRANT SELECT ON posting_coordination TO authenticated;

-- Insert today's initial record if not exists
INSERT INTO posting_coordination (date, posts_today, last_post_time)
VALUES (CURRENT_DATE, 0, NULL)
ON CONFLICT (date) DO NOTHING;

COMMENT ON TABLE posting_coordination IS 'Tracks daily posting coordination to prevent burst posting and ensure proper spacing';
COMMENT ON COLUMN posting_coordination.date IS 'The date for this posting coordination record';
COMMENT ON COLUMN posting_coordination.posts_today IS 'Number of posts made on this date';
COMMENT ON COLUMN posting_coordination.last_post_time IS 'Timestamp of the last post made';
COMMENT ON COLUMN posting_coordination.last_posting_agent IS 'Name of the agent that made the last post';
COMMENT ON COLUMN posting_coordination.last_tweet_id IS 'Twitter ID of the last posted tweet'; 