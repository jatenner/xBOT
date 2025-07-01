-- Knowledge store for embeddings and articles
CREATE TABLE IF NOT EXISTS knowledge_store (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  source TEXT NOT NULL,
  source_id TEXT,
  text TEXT NOT NULL,
  embedding VECTOR(1536),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(source, source_id)
);

-- Create index for vector similarity search
CREATE INDEX IF NOT EXISTS knowledge_store_embedding_idx ON knowledge_store 
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Engagement history for tweet performance tracking
CREATE TABLE IF NOT EXISTS engagement_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tweet_id UUID REFERENCES tweets(id) ON DELETE CASCADE,
  likes INTEGER DEFAULT 0,
  retweets INTEGER DEFAULT 0,
  replies INTEGER DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for efficient engagement queries
CREATE INDEX IF NOT EXISTS engagement_history_tweet_id_idx ON engagement_history(tweet_id);
CREATE INDEX IF NOT EXISTS engagement_history_timestamp_idx ON engagement_history(timestamp);

-- Function for vector similarity search
CREATE OR REPLACE FUNCTION match_knowledge(
  query_embedding VECTOR(1536),
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 10
)
RETURNS TABLE(
  id UUID,
  text TEXT,
  similarity FLOAT,
  metadata JSONB
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    knowledge_store.id,
    knowledge_store.text,
    1 - (knowledge_store.embedding <=> query_embedding) AS similarity,
    knowledge_store.metadata
  FROM knowledge_store
  WHERE 1 - (knowledge_store.embedding <=> query_embedding) > match_threshold
  ORDER BY knowledge_store.embedding <=> query_embedding
  LIMIT match_count;
END;
$$; 