-- Learning System Tables Migration
-- Adds bandit arms, experiments, kv_store, and embeddings support

-- Enable pgvector extension for embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Bandit arms table for Thompson Sampling and UCB1
CREATE TABLE IF NOT EXISTS bandit_arms (
  arm_id TEXT PRIMARY KEY,
  scope TEXT CHECK (scope IN ('content','reply','timing')) NOT NULL,
  successes INT DEFAULT 0,
  trials INT DEFAULT 0,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  
  -- Additional metadata for arm analysis
  alpha DECIMAL(10,4) DEFAULT 1.0, -- Beta distribution parameter
  beta DECIMAL(10,4) DEFAULT 1.0,  -- Beta distribution parameter
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient scope queries
CREATE INDEX IF NOT EXISTS idx_bandit_arms_scope ON bandit_arms(scope);
CREATE INDEX IF NOT EXISTS idx_bandit_arms_last_updated ON bandit_arms(last_updated);

-- Experiments table for A/B testing with SPRT
CREATE TABLE IF NOT EXISTS experiments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  factor TEXT NOT NULL, -- 'hook','cta','format','topic_angle'
  variant_a TEXT NOT NULL,
  variant_b TEXT NOT NULL,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  stopped_at TIMESTAMPTZ,
  status TEXT CHECK (status IN ('running','stopped')) DEFAULT 'running',
  stop_reason TEXT,
  
  -- SPRT tracking
  log_likelihood_ratio DECIMAL(10,6) DEFAULT 0.0,
  n_a INT DEFAULT 0, -- samples for variant A
  n_b INT DEFAULT 0, -- samples for variant B
  success_a INT DEFAULT 0,
  success_b INT DEFAULT 0,
  
  -- Configuration
  alpha DECIMAL(4,3) DEFAULT 0.05, -- Type I error rate
  beta DECIMAL(4,3) DEFAULT 0.10,  -- Type II error rate
  min_effect_size DECIMAL(4,3) DEFAULT 0.02, -- Minimum detectable effect
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for active experiments
CREATE INDEX IF NOT EXISTS idx_experiments_status ON experiments(status);
CREATE INDEX IF NOT EXISTS idx_experiments_factor ON experiments(factor);

-- Key-value store for predictor coefficients and system state
CREATE TABLE IF NOT EXISTS kv_store (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  expires_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for expiration cleanup
CREATE INDEX IF NOT EXISTS idx_kv_store_expires_at ON kv_store(expires_at);

-- Add embeddings support to content_metadata if not exists
DO $$
BEGIN
  -- Check if content_metadata exists and add columns
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'content_metadata') THEN
    -- Add embedding column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'content_metadata' AND column_name = 'embedding') THEN
      ALTER TABLE content_metadata ADD COLUMN embedding vector(1536);
    END IF;
    
    -- Add content hash for uniqueness
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'content_metadata' AND column_name = 'content_hash') THEN
      ALTER TABLE content_metadata ADD COLUMN content_hash TEXT;
    END IF;
    
    -- Add feature columns for predictor
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'content_metadata' AND column_name = 'features') THEN
      ALTER TABLE content_metadata ADD COLUMN features JSONB;
    END IF;
    
    -- Add bandit tracking
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'content_metadata' AND column_name = 'bandit_arm') THEN
      ALTER TABLE content_metadata ADD COLUMN bandit_arm TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'content_metadata' AND column_name = 'timing_arm') THEN
      ALTER TABLE content_metadata ADD COLUMN timing_arm TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'content_metadata' AND column_name = 'experiment_id') THEN
      ALTER TABLE content_metadata ADD COLUMN experiment_id UUID REFERENCES experiments(id);
    END IF;
    
    -- Create unique index on content_hash
    CREATE UNIQUE INDEX IF NOT EXISTS idx_content_metadata_hash ON content_metadata(content_hash);
    
    -- Create index on embedding for similarity search (if using pgvector)
    CREATE INDEX IF NOT EXISTS idx_content_metadata_embedding ON content_metadata USING ivfflat (embedding vector_cosine_ops);
  END IF;
  
  -- If content_metadata doesn't exist, create content_embeddings table as fallback
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'content_metadata') THEN
    CREATE TABLE IF NOT EXISTS content_embeddings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      post_id TEXT NOT NULL,
      content_hash TEXT UNIQUE NOT NULL,
      embedding vector(1536) NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      
      -- Add foreign key if unified_posts exists
      CONSTRAINT fk_content_embeddings_post_id 
        FOREIGN KEY (post_id) 
        REFERENCES unified_posts(post_id) 
        ON DELETE CASCADE
    );
    
    CREATE INDEX IF NOT EXISTS idx_content_embeddings_post_id ON content_embeddings(post_id);
    CREATE INDEX IF NOT EXISTS idx_content_embeddings_embedding ON content_embeddings USING ivfflat (embedding vector_cosine_ops);
  END IF;
END $$;

-- Add bandit tracking to unified_posts if exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'unified_posts') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'unified_posts' AND column_name = 'bandit_arm') THEN
      ALTER TABLE unified_posts ADD COLUMN bandit_arm TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'unified_posts' AND column_name = 'timing_arm') THEN
      ALTER TABLE unified_posts ADD COLUMN timing_arm TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'unified_posts' AND column_name = 'experiment_id') THEN
      ALTER TABLE unified_posts ADD COLUMN experiment_id UUID REFERENCES experiments(id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'unified_posts' AND column_name = 'predicted_er') THEN
      ALTER TABLE unified_posts ADD COLUMN predicted_er DECIMAL(6,4);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'unified_posts' AND column_name = 'predicted_follow_through') THEN
      ALTER TABLE unified_posts ADD COLUMN predicted_follow_through DECIMAL(6,4);
    END IF;
  END IF;
END $$;

-- Create function to clean expired KV entries
CREATE OR REPLACE FUNCTION cleanup_expired_kv()
RETURNS void AS $$
BEGIN
  DELETE FROM kv_store WHERE expires_at IS NOT NULL AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update bandit arm timestamps
CREATE OR REPLACE FUNCTION update_bandit_arm_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_updated = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_bandit_arms_updated
  BEFORE UPDATE ON bandit_arms
  FOR EACH ROW
  EXECUTE FUNCTION update_bandit_arm_timestamp();

-- Create trigger to update kv_store timestamps
CREATE OR REPLACE FUNCTION update_kv_store_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_kv_store_updated
  BEFORE UPDATE ON kv_store
  FOR EACH ROW
  EXECUTE FUNCTION update_kv_store_timestamp();

-- Grant permissions (assuming standard RLS setup)
-- ALTER TABLE bandit_arms ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE experiments ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE kv_store ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE bandit_arms IS 'Multi-armed bandit arms for content, reply, and timing optimization';
COMMENT ON TABLE experiments IS 'A/B experiments with SPRT early stopping';
COMMENT ON TABLE kv_store IS 'Key-value store for predictor coefficients and system state';
