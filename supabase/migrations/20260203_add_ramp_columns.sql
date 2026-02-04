-- ═══════════════════════════════════════════════════════════════════════════════
-- ADD RAMP COLUMNS TO RATE CONTROLLER STATE
-- 
-- Adds columns for ramp schedule tracking:
-- - ramp_reason: Reason for current ramp level
-- - hours_since_start: Hours since first execution
-- - has_24h_stability: Whether 24h stability criteria met
-- - success_rate_6h: Success rate over last 6 hours
-- 
-- Date: February 3, 2026
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE rate_controller_state
  ADD COLUMN IF NOT EXISTS ramp_reason TEXT,
  ADD COLUMN IF NOT EXISTS hours_since_start INTEGER,
  ADD COLUMN IF NOT EXISTS has_24h_stability BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS success_rate_6h NUMERIC DEFAULT 0 CHECK (success_rate_6h >= 0 AND success_rate_6h <= 1);

COMMENT ON COLUMN rate_controller_state.ramp_reason IS 'Reason for current ramp level (e.g., "warmup_ramp_hour_3_stable")';
COMMENT ON COLUMN rate_controller_state.hours_since_start IS 'Hours since first rate controller execution';
COMMENT ON COLUMN rate_controller_state.has_24h_stability IS 'Whether 24h stability criteria met (no 429s, no auth failures)';
COMMENT ON COLUMN rate_controller_state.success_rate_6h IS 'Success rate over last 6 hours (executed / target)';

COMMIT;
