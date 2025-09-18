-- Content metadata with embeddings for uniqueness checking
-- Optional pgvector extension for similarity search

-- Try to create vector extension (will fail gracefully if not available)
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS content_metadata (
  decision_id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  topic_cluster TEXT,
  embedding VECTOR(1536)  -- OpenAI text-embedding-3-small
);

-- If vector extension failed, recreate table without vector type
DO $$
BEGIN
  -- Check if vector type exists, if not recreate without it
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vector') THEN
    DROP TABLE IF EXISTS content_metadata;
    CREATE TABLE content_metadata (
      decision_id TEXT PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      topic_cluster TEXT,
      embedding TEXT  -- JSON string fallback when pgvector unavailable
    );
  END IF;
END $$;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_content_metadata_created ON content_metadata(created_at DESC);

-- Comments for clarity
COMMENT ON TABLE content_metadata IS 'Content metadata with embeddings for uniqueness and topic tracking';
COMMENT ON COLUMN content_metadata.embedding IS 'OpenAI embedding vector (pgvector) or JSON string fallback';
COMMENT ON COLUMN content_metadata.topic_cluster IS 'Content topic classification for rotation policy';
