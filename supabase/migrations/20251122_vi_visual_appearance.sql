-- Migration: VI Visual Appearance Analysis
-- Creates table for storing visual appearance analysis of tweets

CREATE TABLE IF NOT EXISTS vi_visual_appearance (
  tweet_id TEXT PRIMARY KEY,
  
  -- Visual Appearance (How it actually looks)
  visual_appearance JSONB NOT NULL DEFAULT '{}',
  -- Contains: overall_style, simplicity_score, visual_complexity, text_density,
  --           white_space_ratio, line_break_strategy, paragraph_flow,
  --           first_visual_element, attention_flow, focal_points,
  --           structural_emojis, decorative_emojis, emoji_function,
  --           text_emphasis, visual_structure, scanning_pattern, visual_perception
  
  -- Visual Elements Analysis
  visual_elements JSONB NOT NULL DEFAULT '{}',
  -- Contains: numbers_used, emojis_used, line_breaks_visual, formatting_moments
  
  -- Visual Recommendations
  visual_recommendations JSONB NOT NULL DEFAULT '{}',
  -- Contains: should_enhance, enhancement_type, suggested_improvements, optimal_visual_style
  
  analyzed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add visually_analyzed flag to vi_collected_tweets
ALTER TABLE vi_collected_tweets
ADD COLUMN IF NOT EXISTS visually_analyzed BOOLEAN NOT NULL DEFAULT false;

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_vi_visual_analyzed_at ON vi_visual_appearance(analyzed_at DESC);
CREATE INDEX IF NOT EXISTS idx_vi_visual_style ON vi_visual_appearance((visual_appearance->>'overall_style'));
CREATE INDEX IF NOT EXISTS idx_vi_visual_simplicity ON vi_visual_appearance((visual_appearance->>'simplicity_score') DESC);
CREATE INDEX IF NOT EXISTS idx_vi_collected_visually_analyzed ON vi_collected_tweets(visually_analyzed) WHERE visually_analyzed = false;

-- GIN indexes for JSONB searches
CREATE INDEX IF NOT EXISTS idx_vi_visual_appearance ON vi_visual_appearance USING GIN(visual_appearance);
CREATE INDEX IF NOT EXISTS idx_vi_visual_elements ON vi_visual_appearance USING GIN(visual_elements);
CREATE INDEX IF NOT EXISTS idx_vi_visual_recommendations ON vi_visual_appearance USING GIN(visual_recommendations);

-- Comments for documentation
COMMENT ON TABLE vi_visual_appearance IS 'Visual appearance analysis of tweets - how they actually look, not just text content';
COMMENT ON COLUMN vi_visual_appearance.visual_appearance IS 'How the tweet appears visually (style, hierarchy, perception)';
COMMENT ON COLUMN vi_visual_appearance.visual_elements IS 'Individual visual elements (numbers, emojis, line breaks, formatting)';
COMMENT ON COLUMN vi_visual_appearance.visual_recommendations IS 'Recommendations for visual improvements';

