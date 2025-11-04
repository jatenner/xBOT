-- =====================================================================================
-- PRODUCTION-READY SCHEMA ENHANCEMENTS
-- Purpose: Add growth-focused columns for real learning and outcomes collection
-- Date: 2025-09-30
-- Idempotent: Safe to re-run
-- =====================================================================================

BEGIN;

-- =====================================================================================
-- 1. POSTED_DECISIONS - Add expanded metrics columns
-- =====================================================================================

DO $$ 
BEGIN
  -- Add profile_visits if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'posted_decisions' AND column_name = 'profile_visits') 
  THEN
    ALTER TABLE posted_decisions ADD COLUMN profile_visits INT DEFAULT 0;
  END IF;
  
  -- Add link_clicks if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'posted_decisions' AND column_name = 'link_clicks') 
  THEN
    ALTER TABLE posted_decisions ADD COLUMN link_clicks INT DEFAULT 0;
  END IF;
  
  -- Add bookmarks if not exists (if not already present)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'posted_decisions' AND column_name = 'bookmarks') 
  THEN
    ALTER TABLE posted_decisions ADD COLUMN bookmarks INT DEFAULT 0;
  END IF;
END $$;

-- =====================================================================================
-- 2. OUTCOMES - Add growth-focused metrics and collection passes
-- =====================================================================================

DO $$ 
BEGIN
  -- Add follows (NEW FOLLOWERS from this post)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'outcomes' AND column_name = 'follows') 
  THEN
    ALTER TABLE outcomes ADD COLUMN follows INT DEFAULT 0;
  END IF;
  
  -- Add profile_visits
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'outcomes' AND column_name = 'profile_visits') 
  THEN
    ALTER TABLE outcomes ADD COLUMN profile_visits INT DEFAULT 0;
  END IF;
  
  -- Add link_clicks
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'outcomes' AND column_name = 'link_clicks') 
  THEN
    ALTER TABLE outcomes ADD COLUMN link_clicks INT DEFAULT 0;
  END IF;
  
  -- Add reward_composite (growth-focused reward calculation)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'outcomes' AND column_name = 'reward_composite') 
  THEN
    ALTER TABLE outcomes ADD COLUMN reward_composite NUMERIC(8,6);
  END IF;
  
  -- Add collected_pass (0=initial, 1=T+1h, 2=T+24h)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'outcomes' AND column_name = 'collected_pass') 
  THEN
    ALTER TABLE outcomes ADD COLUMN collected_pass SMALLINT DEFAULT 0 CHECK (collected_pass IN (0, 1, 2));
  END IF;
  
  -- Add updated_at for tracking re-collections
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'outcomes' AND column_name = 'updated_at') 
  THEN
    ALTER TABLE outcomes ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- =====================================================================================
-- 3. CONTENT_METADATA - Add feature extraction and experiment columns
-- =====================================================================================

DO $$ 
BEGIN
  -- Add experiment_id
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'content_metadata' AND column_name = 'experiment_id') 
  THEN
    ALTER TABLE content_metadata ADD COLUMN experiment_id TEXT;
  END IF;
  
  -- Add hook_pattern (Did you know, New study, question, etc.)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'content_metadata' AND column_name = 'hook_pattern') 
  THEN
    ALTER TABLE content_metadata ADD COLUMN hook_pattern TEXT;
  END IF;
  
  -- Add novelty (1 - max cosine similarity vs 30d history)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'content_metadata' AND column_name = 'novelty') 
  THEN
    ALTER TABLE content_metadata ADD COLUMN novelty REAL CHECK (novelty >= 0 AND novelty <= 1);
  END IF;
  
  -- Add readability score
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'content_metadata' AND column_name = 'readability_score') 
  THEN
    ALTER TABLE content_metadata ADD COLUMN readability_score REAL;
  END IF;
  
  -- Add sentiment (-1 to +1)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'content_metadata' AND column_name = 'sentiment') 
  THEN
    ALTER TABLE content_metadata ADD COLUMN sentiment REAL CHECK (sentiment >= -1 AND sentiment <= 1);
  END IF;
  
  -- Add tweet_id (direct reference after posting)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'content_metadata' AND column_name = 'tweet_id') 
  THEN
    ALTER TABLE content_metadata ADD COLUMN tweet_id TEXT;
  END IF;
  
  -- Ensure scheduled_at exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'content_metadata' AND column_name = 'scheduled_at') 
  THEN
    ALTER TABLE content_metadata ADD COLUMN scheduled_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
  
  -- Ensure status exists with correct default
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'content_metadata' AND column_name = 'status') 
  THEN
    ALTER TABLE content_metadata ADD COLUMN status TEXT DEFAULT 'pending' 
      CHECK (status IN ('pending', 'queued', 'posted', 'skipped', 'failed'));
  END IF;
END $$;

-- =====================================================================================
-- 4. INDEXES - Performance optimization
-- =====================================================================================

-- Outcomes: fast lookup of real outcomes for learning
CREATE INDEX IF NOT EXISTS idx_outcomes_real 
  ON outcomes(simulated, collected_at DESC) 
  WHERE simulated = false;

-- Outcomes: fast lookup by pass for multi-stage collection
CREATE INDEX IF NOT EXISTS idx_outcomes_pass 
  ON outcomes(collected_pass, updated_at DESC);

-- Content metadata: queue processing optimization
CREATE INDEX IF NOT EXISTS idx_cm_sched 
  ON content_metadata(status, generation_source, scheduled_at) 
  WHERE status = 'queued';

-- Content metadata: experiment analysis
CREATE INDEX IF NOT EXISTS idx_cm_experiment 
  ON content_metadata(experiment_id) 
  WHERE experiment_id IS NOT NULL;

-- Content metadata: novelty-based filtering
CREATE INDEX IF NOT EXISTS idx_cm_novelty 
  ON content_metadata(novelty DESC) 
  WHERE novelty IS NOT NULL;

-- Posted decisions: tweet_id lookup for outcomes collection
CREATE INDEX IF NOT EXISTS idx_posted_tweet 
  ON posted_decisions(tweet_id, posted_at DESC);

-- =====================================================================================
-- 5. BACKFILL scheduled_at for existing pending items
-- =====================================================================================

-- Backfill scheduled_at for items that are pending/queued but have NULL scheduled_at
UPDATE content_metadata 
SET scheduled_at = created_at + INTERVAL '15 minutes'
WHERE scheduled_at IS NULL 
  AND status IN ('pending', 'queued')
  AND created_at > NOW() - INTERVAL '7 days';

-- =====================================================================================
-- 6. COMMENTS FOR DOCUMENTATION
-- =====================================================================================

COMMENT ON COLUMN outcomes.follows IS 'New followers attributed to this post (detected via profile visit + follow timing)';
COMMENT ON COLUMN outcomes.reward_composite IS 'Growth-focused reward: 0.5*fpki + 0.3*retweet_rate + 0.15*reply_rate + 0.05*novelty - 0.1*dup_penalty';
COMMENT ON COLUMN outcomes.collected_pass IS '0=initial, 1=T+1h collection, 2=T+24h final collection';
COMMENT ON COLUMN content_metadata.hook_pattern IS 'Detected hook type: did_you_know, new_study, question, contrarian, cta, story, etc.';
COMMENT ON COLUMN content_metadata.novelty IS 'Novelty score: 1 - max(cosine_similarity vs 30d history)';
COMMENT ON COLUMN content_metadata.experiment_id IS 'Experiment assignment: hashtag_1, question_cta, contrarian_reply, late_evening_slot, etc.';

COMMIT;

-- =====================================================================================
-- DOWN MIGRATION (for rollback if needed)
-- =====================================================================================
-- To rollback, run:
-- BEGIN;
-- ALTER TABLE posted_decisions DROP COLUMN IF EXISTS profile_visits, DROP COLUMN IF EXISTS link_clicks;
-- ALTER TABLE outcomes DROP COLUMN IF EXISTS follows, DROP COLUMN IF EXISTS profile_visits, 
--   DROP COLUMN IF EXISTS link_clicks, DROP COLUMN IF EXISTS reward_composite, DROP COLUMN IF EXISTS collected_pass;
-- ALTER TABLE content_metadata DROP COLUMN IF EXISTS experiment_id, DROP COLUMN IF EXISTS hook_pattern, 
--   DROP COLUMN IF EXISTS novelty, DROP COLUMN IF EXISTS readability_score, DROP COLUMN IF EXISTS sentiment;
-- COMMIT;
