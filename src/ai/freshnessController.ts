/**
 * 🕐 AUTONOMOUS FRESHNESS CONTROLLER
 * 
 * Self-adjusting freshness policy for reply opportunity harvesting.
 * 
 * Default strict ages:
 * - Tier A (100K+ likes): 24h
 * - Tier B (25K+ likes): 18h
 * - Tier C (10K+ likes): 8h
 * - Tier D (2.5K+ likes): 90m (fallback only)
 * 
 * Autonomous relaxation:
 * - If harvest fails to find A/B/C tiers for N consecutive runs → relax
 * - Require velocity/trending proof for older tweets
 * - Tighten back when fresh targets appear
 */

import { getSupabaseClient } from '../db/index';

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

// Default strict limits (in minutes)
const DEFAULT_TIER_A_MAX_AGE = 24 * 60;   // 24 hours
const DEFAULT_TIER_B_MAX_AGE = 18 * 60;   // 18 hours
const DEFAULT_TIER_C_MAX_AGE = 8 * 60;    // 8 hours
const DEFAULT_TIER_D_MAX_AGE = 90;        // 90 minutes (fallback only)

// Absolute max limits (cannot be exceeded even with relaxation)
const ABSOLUTE_TIER_A_MAX = 72 * 60;      // 72 hours
const ABSOLUTE_TIER_B_MAX = 48 * 60;      // 48 hours
const ABSOLUTE_TIER_C_MAX = 24 * 60;      // 24 hours
const ABSOLUTE_TIER_D_MAX = 3 * 60;       // 3 hours

// Relaxation parameters
const RELAXATION_INCREMENT_MINUTES = 2 * 60;  // +2 hours per failed run
const RUNS_BEFORE_RELAXATION = 2;             // Relax after N failed runs
const RUNS_BEFORE_TIGHTENING = 3;             // Tighten after N successful runs

// Velocity thresholds for older tweet acceptance
const MIN_VELOCITY_FOR_RELAXED_A = 30;   // likes/min required for 100K+ tweets older than default
const MIN_VELOCITY_FOR_RELAXED_B = 20;   // likes/min required for 25K+ tweets older than default
const MIN_VELOCITY_FOR_RELAXED_C = 15;   // likes/min required for 10K+ tweets older than default

// ═══════════════════════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════════════════════

interface FreshnessState {
  current_tier_a_max: number;
  current_tier_b_max: number;
  current_tier_c_max: number;
  current_tier_d_max: number;
  consecutive_failed_runs: number;
  consecutive_successful_runs: number;
  last_adjustment_at: string;
  adjustment_reason: string;
  total_relaxations: number;
  total_tightenings: number;
}

let _state: FreshnessState = {
  current_tier_a_max: DEFAULT_TIER_A_MAX_AGE,
  current_tier_b_max: DEFAULT_TIER_B_MAX_AGE,
  current_tier_c_max: DEFAULT_TIER_C_MAX_AGE,
  current_tier_d_max: DEFAULT_TIER_D_MAX_AGE,
  consecutive_failed_runs: 0,
  consecutive_successful_runs: 0,
  last_adjustment_at: new Date().toISOString(),
  adjustment_reason: 'initialized',
  total_relaxations: 0,
  total_tightenings: 0,
};

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get the current max age for a tier (in minutes)
 */
export function getMaxAgeForTier(tier: 'A' | 'B' | 'C' | 'D'): number {
  switch (tier) {
    case 'A': return _state.current_tier_a_max;
    case 'B': return _state.current_tier_b_max;
    case 'C': return _state.current_tier_c_max;
    case 'D': return _state.current_tier_d_max;
  }
}

/**
 * Get the minimum velocity required for an older tweet to be accepted
 */
export function getMinVelocityForRelaxed(tier: 'A' | 'B' | 'C' | 'D'): number {
  switch (tier) {
    case 'A': return MIN_VELOCITY_FOR_RELAXED_A;
    case 'B': return MIN_VELOCITY_FOR_RELAXED_B;
    case 'C': return MIN_VELOCITY_FOR_RELAXED_C;
    case 'D': return 10; // Low bar for fallback tier
  }
}

/**
 * Check if a tweet passes the freshness gate
 * Returns { pass: boolean, reason: string, velocity_required?: number }
 */
export function checkFreshness(
  likeCount: number,
  ageMinutes: number,
  velocity: number
): { pass: boolean; reason: string; velocity_required?: number } {
  // Determine tier
  let tier: 'A' | 'B' | 'C' | 'D';
  let defaultMax: number;
  let absoluteMax: number;
  let currentMax: number;
  
  if (likeCount >= 100000) {
    tier = 'A';
    defaultMax = DEFAULT_TIER_A_MAX_AGE;
    absoluteMax = ABSOLUTE_TIER_A_MAX;
    currentMax = _state.current_tier_a_max;
  } else if (likeCount >= 25000) {
    tier = 'B';
    defaultMax = DEFAULT_TIER_B_MAX_AGE;
    absoluteMax = ABSOLUTE_TIER_B_MAX;
    currentMax = _state.current_tier_b_max;
  } else if (likeCount >= 10000) {
    tier = 'C';
    defaultMax = DEFAULT_TIER_C_MAX_AGE;
    absoluteMax = ABSOLUTE_TIER_C_MAX;
    currentMax = _state.current_tier_c_max;
  } else if (likeCount >= 2500) {
    tier = 'D';
    defaultMax = DEFAULT_TIER_D_MAX_AGE;
    absoluteMax = ABSOLUTE_TIER_D_MAX;
    currentMax = _state.current_tier_d_max;
  } else {
    // Below 2.5K - reject
    return { pass: false, reason: 'below_min_likes' };
  }
  
  // Within default strict limit - always pass
  if (ageMinutes <= defaultMax) {
    return { pass: true, reason: `within_default_tier_${tier}` };
  }
  
  // Beyond absolute limit - always reject
  if (ageMinutes > absoluteMax) {
    return { pass: false, reason: `beyond_absolute_max_tier_${tier}` };
  }
  
  // Between default and current relaxed limit
  if (ageMinutes <= currentMax) {
    // Require velocity proof for relaxed acceptance
    const minVelocity = getMinVelocityForRelaxed(tier);
    if (velocity >= minVelocity) {
      return { pass: true, reason: `relaxed_tier_${tier}_velocity_ok` };
    } else {
      return { 
        pass: false, 
        reason: `relaxed_tier_${tier}_velocity_insufficient`,
        velocity_required: minVelocity
      };
    }
  }
  
  // Between current and absolute - need high velocity
  const minVelocity = getMinVelocityForRelaxed(tier) * 1.5;
  if (velocity >= minVelocity) {
    return { pass: true, reason: `extended_tier_${tier}_high_velocity` };
  }
  
  return { 
    pass: false, 
    reason: `beyond_current_max_tier_${tier}`,
    velocity_required: minVelocity
  };
}

/**
 * Report harvest results - triggers autonomous adjustment
 */
export async function reportHarvestResults(results: {
  tier_a_count: number;
  tier_b_count: number;
  tier_c_count: number;
  tier_d_count: number;
  total_scraped: number;
  total_stored: number;
}): Promise<{ adjusted: boolean; direction: 'relaxed' | 'tightened' | 'none'; reason: string }> {
  const highTierFound = results.tier_a_count > 0 || results.tier_b_count > 0 || results.tier_c_count > 0;
  
  if (highTierFound && results.total_stored > 0) {
    // SUCCESS: Found high-tier opportunities
    _state.consecutive_successful_runs++;
    _state.consecutive_failed_runs = 0;
    
    // Should we tighten?
    if (_state.consecutive_successful_runs >= RUNS_BEFORE_TIGHTENING) {
      const tightened = tightenLimits();
      if (tightened) {
        await logStateChange('tightened');
        return { adjusted: true, direction: 'tightened', reason: `${RUNS_BEFORE_TIGHTENING} consecutive successful runs` };
      }
    }
    
    return { adjusted: false, direction: 'none', reason: 'harvest_successful' };
  } else {
    // FAILED: No high-tier opportunities found
    _state.consecutive_failed_runs++;
    _state.consecutive_successful_runs = 0;
    
    // Should we relax?
    if (_state.consecutive_failed_runs >= RUNS_BEFORE_RELAXATION) {
      const relaxed = relaxLimits();
      if (relaxed) {
        await logStateChange('relaxed');
        return { adjusted: true, direction: 'relaxed', reason: `${RUNS_BEFORE_RELAXATION} consecutive failed runs` };
      } else {
        return { adjusted: false, direction: 'none', reason: 'already_at_max_relaxation' };
      }
    }
    
    return { adjusted: false, direction: 'none', reason: 'harvest_failed_but_not_relaxing_yet' };
  }
}

/**
 * Get current state for monitoring
 */
export function getState(): FreshnessState {
  return { ..._state };
}

/**
 * Reset to defaults (for testing or manual intervention)
 */
export function resetToDefaults(): void {
  _state = {
    current_tier_a_max: DEFAULT_TIER_A_MAX_AGE,
    current_tier_b_max: DEFAULT_TIER_B_MAX_AGE,
    current_tier_c_max: DEFAULT_TIER_C_MAX_AGE,
    current_tier_d_max: DEFAULT_TIER_D_MAX_AGE,
    consecutive_failed_runs: 0,
    consecutive_successful_runs: 0,
    last_adjustment_at: new Date().toISOString(),
    adjustment_reason: 'reset_to_defaults',
    total_relaxations: 0,
    total_tightenings: 0,
  };
  console.log(`[FRESHNESS_CONTROLLER] 🔄 Reset to defaults`);
}

// ═══════════════════════════════════════════════════════════════════════════
// INTERNAL HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function relaxLimits(): boolean {
  let anyRelaxed = false;
  
  if (_state.current_tier_a_max < ABSOLUTE_TIER_A_MAX) {
    _state.current_tier_a_max = Math.min(_state.current_tier_a_max + RELAXATION_INCREMENT_MINUTES, ABSOLUTE_TIER_A_MAX);
    anyRelaxed = true;
  }
  if (_state.current_tier_b_max < ABSOLUTE_TIER_B_MAX) {
    _state.current_tier_b_max = Math.min(_state.current_tier_b_max + RELAXATION_INCREMENT_MINUTES, ABSOLUTE_TIER_B_MAX);
    anyRelaxed = true;
  }
  if (_state.current_tier_c_max < ABSOLUTE_TIER_C_MAX) {
    _state.current_tier_c_max = Math.min(_state.current_tier_c_max + RELAXATION_INCREMENT_MINUTES, ABSOLUTE_TIER_C_MAX);
    anyRelaxed = true;
  }
  if (_state.current_tier_d_max < ABSOLUTE_TIER_D_MAX) {
    _state.current_tier_d_max = Math.min(_state.current_tier_d_max + 30, ABSOLUTE_TIER_D_MAX); // +30min for tier D
    anyRelaxed = true;
  }
  
  if (anyRelaxed) {
    _state.total_relaxations++;
    _state.last_adjustment_at = new Date().toISOString();
    _state.adjustment_reason = `relaxed_after_${_state.consecutive_failed_runs}_failed_runs`;
    _state.consecutive_failed_runs = 0;
    
    console.log(`[FRESHNESS_CONTROLLER] 📈 RELAXED limits:`);
    console.log(`  Tier A: ${Math.round(_state.current_tier_a_max / 60)}h`);
    console.log(`  Tier B: ${Math.round(_state.current_tier_b_max / 60)}h`);
    console.log(`  Tier C: ${Math.round(_state.current_tier_c_max / 60)}h`);
    console.log(`  Tier D: ${_state.current_tier_d_max}m`);
  }
  
  return anyRelaxed;
}

function tightenLimits(): boolean {
  let anyTightened = false;
  
  if (_state.current_tier_a_max > DEFAULT_TIER_A_MAX_AGE) {
    _state.current_tier_a_max = Math.max(_state.current_tier_a_max - RELAXATION_INCREMENT_MINUTES, DEFAULT_TIER_A_MAX_AGE);
    anyTightened = true;
  }
  if (_state.current_tier_b_max > DEFAULT_TIER_B_MAX_AGE) {
    _state.current_tier_b_max = Math.max(_state.current_tier_b_max - RELAXATION_INCREMENT_MINUTES, DEFAULT_TIER_B_MAX_AGE);
    anyTightened = true;
  }
  if (_state.current_tier_c_max > DEFAULT_TIER_C_MAX_AGE) {
    _state.current_tier_c_max = Math.max(_state.current_tier_c_max - RELAXATION_INCREMENT_MINUTES, DEFAULT_TIER_C_MAX_AGE);
    anyTightened = true;
  }
  if (_state.current_tier_d_max > DEFAULT_TIER_D_MAX_AGE) {
    _state.current_tier_d_max = Math.max(_state.current_tier_d_max - 30, DEFAULT_TIER_D_MAX_AGE);
    anyTightened = true;
  }
  
  if (anyTightened) {
    _state.total_tightenings++;
    _state.last_adjustment_at = new Date().toISOString();
    _state.adjustment_reason = `tightened_after_${_state.consecutive_successful_runs}_successful_runs`;
    _state.consecutive_successful_runs = 0;
    
    console.log(`[FRESHNESS_CONTROLLER] 📉 TIGHTENED limits:`);
    console.log(`  Tier A: ${Math.round(_state.current_tier_a_max / 60)}h`);
    console.log(`  Tier B: ${Math.round(_state.current_tier_b_max / 60)}h`);
    console.log(`  Tier C: ${Math.round(_state.current_tier_c_max / 60)}h`);
    console.log(`  Tier D: ${_state.current_tier_d_max}m`);
  }
  
  return anyTightened;
}

async function logStateChange(direction: 'relaxed' | 'tightened'): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    await supabase.from('system_events').insert({
      event_type: `freshness_policy_${direction}`,
      severity: 'info',
      message: `Freshness policy ${direction}: ${_state.adjustment_reason}`,
      event_data: {
        current_limits: {
          tier_a: `${Math.round(_state.current_tier_a_max / 60)}h`,
          tier_b: `${Math.round(_state.current_tier_b_max / 60)}h`,
          tier_c: `${Math.round(_state.current_tier_c_max / 60)}h`,
          tier_d: `${_state.current_tier_d_max}m`,
        },
        total_relaxations: _state.total_relaxations,
        total_tightenings: _state.total_tightenings,
      },
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    console.warn(`[FRESHNESS_CONTROLLER] Failed to log state change:`, err);
  }
}

