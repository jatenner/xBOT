-- FIX CONTENT DUPLICATION SCHEMA
-- This creates tables to track content variations and prevent duplicates

-- Content variations tracking table
CREATE TABLE IF NOT EXISTS content_variations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  topic VARCHAR(255) NOT NULL,
  angle VARCHAR(100) NOT NULL,
  format VARCHAR(50) NOT NULL CHECK (format IN ('single', 'thread')),
  depth VARCHAR(20) NOT NULL CHECK (depth IN ('surface', 'medium', 'deep')),
  uniqueness_score DECIMAL(3,2) DEFAULT 0.95,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Post history for duplication checking
CREATE TABLE IF NOT EXISTS post_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tweet_id VARCHAR(255) UNIQUE NOT NULL,
  original_content TEXT NOT NULL,
  topic_extracted VARCHAR(255),
  similarity_hash VARCHAR(64),
  format_type VARCHAR(50),
  engagement_metrics JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- View optimization tracking
CREATE TABLE IF NOT EXISTS view_optimization_analysis (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tweet_id VARCHAR(255) REFERENCES post_history(tweet_id),
  estimated_views INTEGER DEFAULT 0,
  actual_views INTEGER DEFAULT 0,
  visibility_score INTEGER DEFAULT 0,
  algorithmic_penalties TEXT[] DEFAULT '{}',
  risk_factors TEXT[] DEFAULT '{}',
  optimization_suggestions TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_content_variations_topic ON content_variations(topic);
CREATE INDEX IF NOT EXISTS idx_content_variations_created_at ON content_variations(created_at);
CREATE INDEX IF NOT EXISTS idx_post_history_tweet_id ON post_history(tweet_id);
CREATE INDEX IF NOT EXISTS idx_post_history_created_at ON post_history(created_at);
CREATE INDEX IF NOT EXISTS idx_post_history_similarity_hash ON post_history(similarity_hash);
CREATE INDEX IF NOT EXISTS idx_view_optimization_tweet_id ON view_optimization_analysis(tweet_id);

-- Update existing tweets table to support thread tracking
ALTER TABLE tweet_analytics 
ADD COLUMN IF NOT EXISTS is_thread_root BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS thread_tweet_ids TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS content_uniqueness_score DECIMAL(3,2) DEFAULT 0.0,
ADD COLUMN IF NOT EXISTS view_optimization_score INTEGER DEFAULT 0;

-- Function to calculate content similarity hash
CREATE OR REPLACE FUNCTION calculate_similarity_hash(content TEXT)
RETURNS VARCHAR(64) AS $$
BEGIN
  -- Simple content hash for similarity detection
  -- In production, this could use more sophisticated algorithms
  RETURN encode(digest(
    regexp_replace(
      lower(trim(content)), 
      '[^a-z0-9\s]', 
      '', 
      'g'
    ), 
    'sha256'
  ), 'hex');
END;
$$ LANGUAGE plpgsql;

-- Function to update similarity hash on insert
CREATE OR REPLACE FUNCTION update_similarity_hash()
RETURNS TRIGGER AS $$
BEGIN
  NEW.similarity_hash = calculate_similarity_hash(NEW.original_content);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-calculate similarity hash
DROP TRIGGER IF EXISTS trigger_update_similarity_hash ON post_history;
CREATE TRIGGER trigger_update_similarity_hash
  BEFORE INSERT OR UPDATE ON post_history
  FOR EACH ROW
  EXECUTE FUNCTION update_similarity_hash();

-- Function to detect duplicate content
CREATE OR REPLACE FUNCTION detect_duplicate_content(
  new_content TEXT,
  similarity_threshold DECIMAL DEFAULT 0.7
)
RETURNS TABLE(
  is_duplicate BOOLEAN,
  similar_tweet_id VARCHAR(255),
  similarity_score DECIMAL
) AS $$
DECLARE
  new_hash VARCHAR(64);
  existing_record RECORD;
  word_similarity DECIMAL;
BEGIN
  -- Calculate hash for new content
  new_hash := calculate_similarity_hash(new_content);
  
  -- Check for exact hash matches first
  SELECT tweet_id INTO similar_tweet_id 
  FROM post_history 
  WHERE similarity_hash = new_hash
  AND created_at > NOW() - INTERVAL '30 days'
  LIMIT 1;
  
  IF FOUND THEN
    RETURN QUERY SELECT TRUE, similar_tweet_id, 1.0::DECIMAL;
    RETURN;
  END IF;
  
  -- Check for high similarity using word overlap
  FOR existing_record IN 
    SELECT tweet_id, original_content
    FROM post_history
    WHERE created_at > NOW() - INTERVAL '7 days'
    ORDER BY created_at DESC
    LIMIT 20
  LOOP
    -- Simple word-based similarity calculation
    -- This is a basic implementation - could be enhanced with more sophisticated NLP
    WITH content_words AS (
      SELECT ARRAY(
        SELECT DISTINCT unnest(
          string_to_array(
            regexp_replace(lower(new_content), '[^a-z0-9\s]', '', 'g'),
            ' '
          )
        )
        WHERE length(unnest(string_to_array(regexp_replace(lower(new_content), '[^a-z0-9\s]', '', 'g'), ' '))) > 3
      ) as new_words,
      ARRAY(
        SELECT DISTINCT unnest(
          string_to_array(
            regexp_replace(lower(existing_record.original_content), '[^a-z0-9\s]', '', 'g'),
            ' '
          )
        )
        WHERE length(unnest(string_to_array(regexp_replace(lower(existing_record.original_content), '[^a-z0-9\s]', '', 'g'), ' '))) > 3
      ) as existing_words
    ),
    similarity_calc AS (
      SELECT 
        array_length(new_words & existing_words, 1)::DECIMAL / 
        GREATEST(array_length(new_words | existing_words, 1), 1)::DECIMAL as similarity
      FROM content_words
    )
    SELECT similarity INTO word_similarity FROM similarity_calc;
    
    IF word_similarity >= similarity_threshold THEN
      RETURN QUERY SELECT TRUE, existing_record.tweet_id, word_similarity;
      RETURN;
    END IF;
  END LOOP;
  
  -- No duplicates found
  RETURN QUERY SELECT FALSE, NULL::VARCHAR(255), 0.0::DECIMAL;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT ALL ON content_variations TO anon, authenticated;
GRANT ALL ON post_history TO anon, authenticated;
GRANT ALL ON view_optimization_analysis TO anon, authenticated;

-- RLS policies
ALTER TABLE content_variations ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE view_optimization_analysis ENABLE ROW LEVEL SECURITY;

-- Allow all operations for now (can be restricted later)
CREATE POLICY "Enable all operations for content_variations" ON content_variations FOR ALL USING (true);
CREATE POLICY "Enable all operations for post_history" ON post_history FOR ALL USING (true);
CREATE POLICY "Enable all operations for view_optimization_analysis" ON view_optimization_analysis FOR ALL USING (true);

-- Insert some test data to verify the system works
INSERT INTO content_variations (topic, angle, format, depth, uniqueness_score) VALUES
('sleep optimization', 'scientific_breakdown', 'thread', 'deep', 0.95),
('productivity', 'contrarian_take', 'single', 'medium', 0.87),
('nutrition', 'first_principles', 'thread', 'deep', 0.92)
ON CONFLICT DO NOTHING;

-- Success message
SELECT 'Content duplication prevention schema created successfully!' as status;
