-- Migration: Add source column to brain_daily_context
-- Created: 2026-04-11
-- Purpose: Track which ingest source wrote each daily context row.
--
-- Background: dailyContextCapture previously hit x.com/explore which is
-- auth-walled; every run silently returned 0 topics and the table stayed
-- empty. The fix switches the source to trends24.in (anonymous public
-- aggregator). Adding a `source` column lets us track which source wrote
-- each row so we can add more sources in future (Google Trends, etc.) and
-- compare their quality.
--
-- Values: 'trends24' (primary), 'google_trends' (future), 'none' (sentinel
-- written when all sources fail — lets the dead-man's-switch detect missing
-- daily context instead of silent accumulation).

ALTER TABLE brain_daily_context ADD COLUMN IF NOT EXISTS source TEXT;

COMMENT ON COLUMN brain_daily_context.source IS
  'Ingest source that wrote this row: trends24 / google_trends / none (all sources failed)';
