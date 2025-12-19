-- ═══════════════════════════════════════════════════════════════════════════════
-- TRUTH INTEGRITY SCHEMA ENHANCEMENTS
-- 
-- Adds required columns for truth integrity verification system:
-- - component column for system_events (for filtering by subsystem)
-- - message column for system_events (for human-readable messages)
-- - metadata column (rename from event_data for consistency)
-- - reconciled_at column for content_metadata (tracks auto-repair)
-- - timestamp column for system_events (explicit timestamp field)
-- 
-- Date: December 19, 2025
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. ENHANCE SYSTEM_EVENTS TABLE
-- Add columns required by truth integrity verifier and guard
-- ═══════════════════════════════════════════════════════════════════════════════

-- Add component column (for filtering by subsystem)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'system_events' 
    AND column_name = 'component'
  ) THEN
    ALTER TABLE system_events ADD COLUMN component TEXT;
    COMMENT ON COLUMN system_events.component IS 'Subsystem that generated the event (e.g., truth_integrity, posting_queue)';
  END IF;
END $$;

-- Add message column (human-readable message)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'system_events' 
    AND column_name = 'message'
  ) THEN
    ALTER TABLE system_events ADD COLUMN message TEXT;
    COMMENT ON COLUMN system_events.message IS 'Human-readable event message';
  END IF;
END $$;

-- Rename event_data to metadata (if event_data exists and metadata doesn't)
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'system_events' 
    AND column_name = 'event_data'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'system_events' 
    AND column_name = 'metadata'
  ) THEN
    ALTER TABLE system_events RENAME COLUMN event_data TO metadata;
    COMMENT ON COLUMN system_events.metadata IS 'Structured event metadata (JSON)';
  END IF;
END $$;

-- Add metadata column if it doesn't exist (and event_data doesn't exist either)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'system_events' 
    AND column_name IN ('metadata', 'event_data')
  ) THEN
    ALTER TABLE system_events ADD COLUMN metadata JSONB;
    COMMENT ON COLUMN system_events.metadata IS 'Structured event metadata (JSON)';
  END IF;
END $$;

-- Add timestamp column (explicit timestamp field, separate from created_at)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'system_events' 
    AND column_name = 'timestamp'
  ) THEN
    ALTER TABLE system_events ADD COLUMN timestamp TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN system_events.timestamp IS 'Event timestamp (when event occurred)';
    
    -- Backfill timestamp from created_at for existing rows
    UPDATE system_events SET timestamp = created_at WHERE timestamp IS NULL;
  END IF;
END $$;

-- Create index on (component, event_type, timestamp) for truth guard queries
CREATE INDEX IF NOT EXISTS idx_system_events_component_type_ts 
  ON system_events(component, event_type, timestamp DESC);

COMMENT ON INDEX idx_system_events_component_type_ts IS 
  'Optimizes truth guard queries: WHERE component=X AND event_type=Y AND timestamp > cutoff';

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. ADD RECONCILED_AT TO CONTENT_GENERATION_METADATA_COMPREHENSIVE
-- Tracks when a decision was auto-repaired by truth reconciliation
-- Note: content_metadata is a VIEW, so we modify the underlying table
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'content_generation_metadata_comprehensive' 
    AND column_name = 'reconciled_at'
  ) THEN
    ALTER TABLE content_generation_metadata_comprehensive ADD COLUMN reconciled_at TIMESTAMPTZ;
    COMMENT ON COLUMN content_generation_metadata_comprehensive.reconciled_at IS 'When this decision was auto-repaired by truth reconciliation';
  END IF;
END $$;

-- Add reconciled_from column (tracks source of reconciliation)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'content_generation_metadata_comprehensive' 
    AND column_name = 'reconciled_from'
  ) THEN
    ALTER TABLE content_generation_metadata_comprehensive ADD COLUMN reconciled_from TEXT;
    COMMENT ON COLUMN content_generation_metadata_comprehensive.reconciled_from IS 'Source of reconciliation (e.g., truth_repair_auto, manual)';
  END IF;
END $$;

-- Create index on reconciled_at for querying reconciled decisions
CREATE INDEX IF NOT EXISTS idx_content_gen_metadata_reconciled 
  ON content_generation_metadata_comprehensive(reconciled_at DESC) 
  WHERE reconciled_at IS NOT NULL;

COMMENT ON INDEX idx_content_gen_metadata_reconciled IS 
  'Optimizes queries for reconciled decisions';

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════════
-- VERIFICATION QUERIES
-- Run these to confirm migration applied correctly
-- ═══════════════════════════════════════════════════════════════════════════════

-- Verify system_events columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'system_events'
ORDER BY ordinal_position;

-- Verify content_generation_metadata_comprehensive columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'content_generation_metadata_comprehensive'
AND column_name IN ('reconciled_at', 'reconciled_from');

-- Verify indexes
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename IN ('system_events', 'content_metadata')
AND indexname LIKE '%truth%' OR indexname LIKE '%reconciled%' OR indexname LIKE '%component%';

