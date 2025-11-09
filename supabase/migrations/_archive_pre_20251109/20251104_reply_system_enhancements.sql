-- ═══════════════════════════════════════════════════════════════════════════════
-- REPLY SYSTEM ENHANCEMENTS
-- 
-- Migration for all new Option C features:
-- - Conversation threading
-- - A/B testing framework
-- - System events logging
-- 
-- Date: November 4, 2025
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. CONVERSATION OPPORTUNITIES
-- Tracks when targets reply to our replies, enabling multi-turn conversations
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS conversation_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Reply chain
  our_reply_id TEXT NOT NULL,           -- Our original reply tweet ID
  their_reply_id TEXT UNIQUE NOT NULL,  -- Their reply to us
  our_followup_id TEXT,                 -- Our follow-up (if posted)
  
  -- Content
  our_reply_content TEXT,
  their_reply_content TEXT,
  
  -- Target info
  target_username TEXT NOT NULL,
  target_followers INTEGER DEFAULT 0,
  
  -- Conversation tracking
  conversation_depth INTEGER DEFAULT 1,  -- How many turns (1 = first response)
  
  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'replied', 'expired', 'skipped')),
  
  -- Timestamps
  discovered_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,      -- Reply window (usually 2 hours)
  replied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_conversation_opps_status 
  ON conversation_opportunities(status);

CREATE INDEX IF NOT EXISTS idx_conversation_opps_target 
  ON conversation_opportunities(target_username, conversation_depth);

CREATE INDEX IF NOT EXISTS idx_conversation_opps_expires 
  ON conversation_opportunities(expires_at) 
  WHERE status = 'pending';

COMMENT ON TABLE conversation_opportunities IS 
  'Tracks ongoing Twitter conversations for multi-turn engagement';

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. A/B TESTING FRAMEWORK
-- Systematically test reply strategies to find what works best
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS ab_tests (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  
  -- Test configuration
  test_type TEXT NOT NULL CHECK (test_type IN ('generator', 'timing', 'tone', 'length')),
  variant_a TEXT NOT NULL,
  variant_b TEXT NOT NULL,
  variant_a_label TEXT,
  variant_b_label TEXT,
  traffic_split DECIMAL(3,2) DEFAULT 0.5,  -- 0.5 = 50/50 split
  
  -- Results
  variant_a_replies INTEGER DEFAULT 0,
  variant_b_replies INTEGER DEFAULT 0,
  variant_a_avg_followers DECIMAL(8,2) DEFAULT 0,
  variant_b_avg_followers DECIMAL(8,2) DEFAULT 0,
  winner TEXT CHECK (winner IN ('a', 'b', 'no_difference')),
  confidence_level DECIMAL(3,2),  -- 0-1
  
  -- Status
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'running', 'paused', 'completed')),
  min_sample_size INTEGER DEFAULT 30,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ab_test_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id TEXT NOT NULL REFERENCES ab_tests(id) ON DELETE CASCADE,
  variant TEXT NOT NULL CHECK (variant IN ('a', 'b')),
  decision_id UUID NOT NULL,  -- Links to content_metadata
  
  -- Metrics
  followers_gained INTEGER DEFAULT 0,
  engagement INTEGER DEFAULT 0,  -- Likes, etc.
  
  -- Timestamps
  recorded_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ab_tests_status 
  ON ab_tests(status);

CREATE INDEX IF NOT EXISTS idx_ab_test_results_test_id 
  ON ab_test_results(test_id, variant);

COMMENT ON TABLE ab_tests IS 
  'A/B test configurations for systematically testing reply strategies';

COMMENT ON TABLE ab_test_results IS 
  'Individual results from A/B tests for statistical analysis';

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. SYSTEM EVENTS
-- Logs critical system events (rate limit failures, backfills, etc.)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS system_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  event_data JSONB,
  severity TEXT CHECK (severity IN ('info', 'warning', 'error', 'critical')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_system_events_type 
  ON system_events(event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_system_events_severity 
  ON system_events(severity, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_system_events_created 
  ON system_events(created_at DESC);

COMMENT ON TABLE system_events IS 
  'System-wide event logging for monitoring and debugging';

-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. DROP UNUSED TABLES
-- Remove deprecated tables that are no longer referenced in code
-- ═══════════════════════════════════════════════════════════════════════════════

-- These tables have ZERO code references and are safe to drop
DROP TABLE IF EXISTS reply_targets CASCADE;
DROP TABLE IF EXISTS real_reply_opportunities CASCADE;

COMMENT ON DATABASE postgres IS 
  'Dropped unused reply tables: reply_targets, real_reply_opportunities (2024-11-04)';

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════════
-- VERIFICATION QUERIES
-- ═══════════════════════════════════════════════════════════════════════════════

-- Check new tables exist
-- SELECT table_name FROM information_schema.tables 
-- WHERE table_name IN ('conversation_opportunities', 'ab_tests', 'ab_test_results', 'system_events');

-- Check old tables were dropped
-- SELECT table_name FROM information_schema.tables 
-- WHERE table_name IN ('reply_targets', 'real_reply_opportunities');
-- (Should return 0 rows)

