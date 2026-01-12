-- Reply Quality + Growth Tracking
-- Adds candidate features, template tracking, and engagement metrics

-- 1. Extend reply_decisions with quality tracking fields
ALTER TABLE reply_decisions
  ADD COLUMN IF NOT EXISTS candidate_features jsonb, -- Store candidate scoring features
  ADD COLUMN IF NOT EXISTS candidate_score numeric, -- Overall candidate score (0-100)
  ADD COLUMN IF NOT EXISTS template_id text, -- Template used (e.g., 'explanation', 'actionable', 'clarification', 'contrarian')
  ADD COLUMN IF NOT EXISTS prompt_version text, -- Prompt version/template version used
  ADD COLUMN IF NOT EXISTS engagement_24h_likes int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS engagement_24h_replies int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS engagement_24h_retweets int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS engagement_24h_views int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS engagement_fetched_at timestamptz; -- When 24h metrics were fetched

-- 2. Create reply_templates table for template definitions
CREATE TABLE IF NOT EXISTS reply_templates (
  id text PRIMARY KEY, -- e.g., 'explanation', 'actionable', 'clarification', 'contrarian', 'question', 'story'
  name text NOT NULL,
  description text,
  prompt_template text NOT NULL, -- Template prompt structure
  use_cases text[], -- When to use this template
  priority_weight numeric DEFAULT 1.0, -- Weight for selection (higher = more likely)
  exploration_rate numeric DEFAULT 0.1, -- % chance to explore (try different template)
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Create reply_candidate_features table for detailed candidate logging
CREATE TABLE IF NOT EXISTS reply_candidate_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_tweet_id text NOT NULL,
  feed_run_id text,
  candidate_score numeric NOT NULL,
  topic_relevance_score numeric,
  spam_score numeric,
  velocity_score numeric,
  recency_score numeric,
  author_signal_score numeric,
  author_follower_count int,
  author_verified boolean,
  current_likes int,
  current_replies int,
  current_retweets int,
  age_minutes numeric,
  predicted_24h_views int,
  predicted_tier int,
  features_json jsonb, -- Full feature set as JSON
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_reply_decisions_template_id ON reply_decisions(template_id);
CREATE INDEX IF NOT EXISTS idx_reply_decisions_candidate_score ON reply_decisions(candidate_score);
CREATE INDEX IF NOT EXISTS idx_reply_decisions_engagement_fetched ON reply_decisions(engagement_fetched_at);
CREATE INDEX IF NOT EXISTS idx_reply_candidate_features_tweet_id ON reply_candidate_features(candidate_tweet_id);
CREATE INDEX IF NOT EXISTS idx_reply_candidate_features_score ON reply_candidate_features(candidate_score DESC);
CREATE INDEX IF NOT EXISTS idx_reply_candidate_features_feed_run ON reply_candidate_features(feed_run_id);

-- 5. Insert default templates
INSERT INTO reply_templates (id, name, description, prompt_template, use_cases, priority_weight) VALUES
  ('explanation', 'Explanation', 'Clarify mechanisms or provide context', 
   'Explain the mechanism or provide context about {topic}. Focus on: {specific_detail}.',
   ARRAY['mechanism', 'how_it_works', 'context'], 1.0),
  ('actionable', 'Actionable', 'Offer practical steps or tips',
   'Here''s what you can do: {actionable_step}. This works because {reason}.',
   ARRAY['tips', 'steps', 'practical'], 1.0),
  ('clarification', 'Clarification', 'Address misconceptions with evidence',
   'Actually, {correction}. Here''s why: {evidence}.',
   ARRAY['misconception', 'correction', 'myth'], 0.9),
  ('contrarian', 'Contrarian', 'Present alternative view with sources',
   'Alternative perspective: {alternative_view}. Evidence: {source}.',
   ARRAY['debate', 'alternative', 'different_view'], 0.8),
  ('question', 'Question', 'Ask thoughtful follow-up to deepen discussion',
   'What about {specific_aspect}? This matters because {reason}.',
   ARRAY['engagement', 'discussion', 'curiosity'], 0.9),
  ('story', 'Story', 'Share brief relevant experience or example',
   'Similar experience: {story}. Key insight: {insight}.',
   ARRAY['personal', 'example', 'experience'], 0.85)
ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE reply_templates IS 'Reply template definitions for quality + variety';
COMMENT ON TABLE reply_candidate_features IS 'Detailed candidate scoring features for learning';
COMMENT ON COLUMN reply_decisions.candidate_features IS 'JSON of candidate scoring features';
COMMENT ON COLUMN reply_decisions.template_id IS 'Template used for this reply';
COMMENT ON COLUMN reply_decisions.prompt_version IS 'Prompt version/template version used';
