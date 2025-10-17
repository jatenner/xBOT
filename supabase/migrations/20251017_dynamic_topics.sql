-- Dynamic Topics Generation Tracking

CREATE TABLE IF NOT EXISTS dynamic_topics_generated (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic TEXT NOT NULL,
  angle TEXT,
  dimension TEXT,
  viral_potential NUMERIC(3,2),
  
  -- Performance tracking
  actual_engagement INTEGER DEFAULT 0,
  actual_followers_gained INTEGER DEFAULT 0,
  actual_viral_score INTEGER DEFAULT 0,
  
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dynamic_topics_generated_at ON dynamic_topics_generated(generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_dynamic_topics_dimension ON dynamic_topics_generated(dimension);
CREATE INDEX IF NOT EXISTS idx_dynamic_topics_followers ON dynamic_topics_generated(actual_followers_gained DESC);

COMMENT ON TABLE dynamic_topics_generated IS 'Tracks AI-generated topics and their performance for learning';

