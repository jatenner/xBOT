-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- EXPERT TWEET ANALYSIS SYSTEM - Database Schema
-- Date: December 3, 2025
-- Purpose: Store expert-level strategic analysis of successful tweets
-- Risk: ZERO - New table, doesn't touch existing system
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

BEGIN;

-- ════════════════════════════════════════════════════════════════════════════
-- TABLE: expert_tweet_analysis
-- Purpose: Expert-level strategic analysis from GPT-4o acting as social media manager
-- Links to: vi_viral_unknowns OR vi_collected_tweets
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS expert_tweet_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tweet_id TEXT NOT NULL,
  source_table TEXT NOT NULL CHECK (source_table IN ('vi_viral_unknowns', 'vi_collected_tweets')),
  
  -- Strategic Analysis (JSONB for flexibility)
  strategic_analysis JSONB NOT NULL,
  /* Example structure:
  {
    "why_it_works": "Creates curiosity gap in first 10 words...",
    "core_value_proposition": "Provides counterintuitive health insight backed by research",
    "target_audience": "Health-conscious individuals who value evidence-based information",
    "engagement_strategy": "Question hook → Surprising data → Mechanism explanation → Actionable insight",
    "viral_elements": ["curiosity gap", "counterintuitive insight", "data-backed credibility"],
    "follower_conversion_factors": ["demonstrates expertise", "provides unique value", "builds trust"]
  }
  */
  
  -- Content Intelligence (JSONB)
  content_intelligence JSONB NOT NULL,
  /* Example structure:
  {
    "hook_analysis": {
      "type": "question",
      "effectiveness": 85,
      "why_effective": "Creates immediate curiosity gap - makes people stop scrolling",
      "improvement_suggestions": ["Could be more specific", "Could add urgency"]
    },
    "structure_analysis": {
      "pattern": "question_hook",
      "why_it_works": "Question creates curiosity, data builds credibility...",
      "when_to_use": "Best for educational content that challenges assumptions"
    },
    "messaging_analysis": {
      "core_message": "Sleep debt works differently than most people think",
      "clarity_score": 90,
      "value_delivery": "Provides actionable insight backed by research",
      "emotional_appeal": ["curiosity", "surprise", "validation"]
    },
    "angle_analysis": {
      "angle_type": "provocative",
      "effectiveness": "Challenges mainstream beliefs",
      "audience_appeal": "Health enthusiasts who value evidence but are open to contrarian views"
    },
    "tone_analysis": {
      "tone_type": "conversational",
      "appropriateness": "Balances approachability with expertise",
      "audience_match": "Appeals to educated audience who wants expert insights without jargon"
    }
  }
  */
  
  -- Performance Insights (JSONB)
  performance_insights JSONB NOT NULL,
  /* Example structure:
  {
    "engagement_drivers": ["curiosity gap in hook", "surprising data point", "mechanism explanation"],
    "shareability_factors": ["counterintuitive insight", "data-backed credibility", "challenges thinking"],
    "follower_conversion_reasons": ["demonstrates expertise", "provides unique insights", "builds trust"],
    "timing_effectiveness": "Best posted 8-10am or 6-8pm when health-conscious audience is active",
    "audience_resonance": "Health enthusiasts, biohackers, evidence-based wellness seekers"
  }
  */
  
  -- Actionable Recommendations (JSONB)
  actionable_recommendations JSONB NOT NULL,
  /* Example structure:
  {
    "content_strategy": ["Start with curiosity gap hook", "Follow with surprising data", "Explain mechanism"],
    "formatting_advice": ["Use 1-2 line breaks for readability", "Keep under 200 characters", "Use minimal emojis"],
    "hook_improvements": ["Create curiosity gap in first 10 words", "Make it specific enough to be interesting"],
    "messaging_tips": ["Lead with surprising insight", "Back with data/research", "Provide actionable value"],
    "timing_recommendations": ["Post 8-10am or 6-8pm for health audience", "Avoid late night"],
    "audience_targeting": ["Target health-conscious individuals", "Appeal to evidence-based wellness seekers"]
  }
  */
  
  -- Visual Analysis (JSONB)
  visual_analysis JSONB NOT NULL,
  /* Example structure:
  {
    "formatting_strategy": "Minimal formatting with strategic line breaks",
    "visual_hierarchy": "Hook draws attention first, then data, then insight",
    "readability_analysis": "High readability - clear structure, good spacing",
    "scanning_pattern": "Hook → Data → Mechanism → Insight"
  }
  */
  
  -- Confidence & Metadata
  confidence DECIMAL(3,2) DEFAULT 0.8 CHECK (confidence >= 0 AND confidence <= 1),
  analyzed_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Performance Data (for correlation)
  engagement_rate NUMERIC(5,4),
  impressions INTEGER,
  likes INTEGER,
  retweets INTEGER,
  replies INTEGER,
  
  -- Constraints
  CONSTRAINT expert_analysis_tweet_id_unique UNIQUE (tweet_id, source_table)
);

CREATE INDEX IF NOT EXISTS idx_expert_analysis_tweet_id 
  ON expert_tweet_analysis (tweet_id);

CREATE INDEX IF NOT EXISTS idx_expert_analysis_analyzed_at 
  ON expert_tweet_analysis (analyzed_at DESC);

CREATE INDEX IF NOT EXISTS idx_expert_analysis_source_table 
  ON expert_tweet_analysis (source_table);

COMMENT ON TABLE expert_tweet_analysis IS 
  'Expert-level strategic analysis from GPT-4o acting as social media manager. Provides plain English explanations of why content works.';

-- ════════════════════════════════════════════════════════════════════════════
-- ENHANCE: vi_format_intelligence table
-- Purpose: Add expert insights column to store aggregated strategic advice
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE vi_format_intelligence
ADD COLUMN IF NOT EXISTS expert_insights JSONB,
ADD COLUMN IF NOT EXISTS strategic_recommendations TEXT[],
ADD COLUMN IF NOT EXISTS content_strategy TEXT;

COMMENT ON COLUMN vi_format_intelligence.expert_insights IS 
  'Aggregated expert insights from expert_tweet_analysis, grouped by angle/tone/structure combination';

COMMENT ON COLUMN vi_format_intelligence.strategic_recommendations IS 
  'Actionable strategic recommendations synthesized from expert analyses';

COMMENT ON COLUMN vi_format_intelligence.content_strategy IS 
  'High-level content strategy advice for this combination';

-- ════════════════════════════════════════════════════════════════════════════
-- GRANTS (Ensure proper permissions)
-- ════════════════════════════════════════════════════════════════════════════

GRANT ALL ON expert_tweet_analysis TO anon, authenticated, service_role;

COMMIT;

-- ════════════════════════════════════════════════════════════════════════════
-- VERIFICATION
-- ════════════════════════════════════════════════════════════════════════════

-- Verify table created:
-- SELECT table_name FROM information_schema.tables WHERE table_name = 'expert_tweet_analysis';

-- Verify columns added:
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'vi_format_intelligence' AND column_name IN ('expert_insights', 'strategic_recommendations', 'content_strategy');



