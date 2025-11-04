-- Create content metadata tracking table for viral content strategy learning
CREATE TABLE IF NOT EXISTS public.content_metadata (
  id TEXT PRIMARY KEY,
  content_id TEXT NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  posted_at TIMESTAMPTZ,
  
  -- Generation metadata
  style TEXT NOT NULL CHECK (style IN ('educational', 'storytelling', 'contrarian', 'quick_tip')),
  fact_source TEXT NOT NULL,
  topic TEXT NOT NULL,
  hook_type TEXT NOT NULL CHECK (hook_type IN ('surprising_fact', 'myth_buster', 'story_opener', 'tip_promise')),
  cta_type TEXT NOT NULL CHECK (cta_type IN ('follow_for_more', 'engagement_question', 'share_prompt', 'thread_continuation')),
  predicted_engagement TEXT NOT NULL,
  quality_score INTEGER NOT NULL CHECK (quality_score >= 0 AND quality_score <= 100),
  thread_length INTEGER NOT NULL CHECK (thread_length >= 1 AND thread_length <= 10),
  fact_count INTEGER NOT NULL DEFAULT 1,
  
  -- Performance metrics (filled after posting)
  actual_likes INTEGER,
  actual_retweets INTEGER,
  actual_comments INTEGER,
  actual_impressions INTEGER,
  actual_engagement_rate NUMERIC(5,2),
  
  -- Learning scores
  prediction_accuracy NUMERIC(5,2),
  viral_score INTEGER CHECK (viral_score >= 0 AND viral_score <= 100),
  style_effectiveness INTEGER CHECK (style_effectiveness >= 0 AND style_effectiveness <= 100),
  
  -- Metadata for evolution
  hook_effectiveness NUMERIC(5,2),
  cta_effectiveness NUMERIC(5,2),
  fact_resonance NUMERIC(5,2),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_content_metadata_style ON public.content_metadata(style);
CREATE INDEX IF NOT EXISTS idx_content_metadata_topic ON public.content_metadata(topic);
CREATE INDEX IF NOT EXISTS idx_content_metadata_created_at ON public.content_metadata(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_metadata_content_id ON public.content_metadata(content_id);
CREATE INDEX IF NOT EXISTS idx_content_metadata_engagement_rate ON public.content_metadata(actual_engagement_rate DESC) WHERE actual_engagement_rate IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_content_metadata_viral_score ON public.content_metadata(viral_score DESC) WHERE viral_score IS NOT NULL;

-- Create composite index for learning queries
CREATE INDEX IF NOT EXISTS idx_content_metadata_learning ON public.content_metadata(style, created_at DESC, actual_engagement_rate DESC);

-- Enable Row Level Security
ALTER TABLE public.content_metadata ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (allow service role full access)
CREATE POLICY "Enable all access for service role" ON public.content_metadata
  FOR ALL 
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_content_metadata_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_content_metadata_updated_at
  BEFORE UPDATE ON public.content_metadata
  FOR EACH ROW
  EXECUTE FUNCTION public.update_content_metadata_updated_at();

-- Create view for learning insights
CREATE OR REPLACE VIEW public.content_learning_insights AS
SELECT 
  style,
  COUNT(*) as total_posts,
  AVG(actual_engagement_rate) as avg_engagement_rate,
  AVG(viral_score) as avg_viral_score,
  AVG(quality_score) as avg_quality_score,
  AVG(prediction_accuracy) as avg_prediction_accuracy,
  COUNT(*) FILTER (WHERE actual_engagement_rate > 3.0) as high_engagement_posts,
  ROUND(
    (COUNT(*) FILTER (WHERE actual_engagement_rate > 3.0)::DECIMAL / NULLIF(COUNT(*), 0)) * 100, 
    2
  ) as success_rate_percent
FROM public.content_metadata 
WHERE actual_engagement_rate IS NOT NULL
  AND created_at > NOW() - INTERVAL '30 days'
GROUP BY style
ORDER BY avg_engagement_rate DESC;

-- Grant access to the view
GRANT SELECT ON public.content_learning_insights TO service_role;

-- Add comment for documentation
COMMENT ON TABLE public.content_metadata IS 'Tracks viral content generation metadata for learning and optimization';
COMMENT ON VIEW public.content_learning_insights IS 'Provides aggregated learning insights for content strategy optimization';
