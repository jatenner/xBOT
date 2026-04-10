/**
 * 📊 PLAN LEARNING SIGNALS
 *
 * Reads learning outputs (bandit_arms, generator performance) to bias
 * original-content planning. Used by planJob.generateRealContent() so
 * future posts improve based on actual performance.
 *
 * - bandit_arms: learnJob writes content_* (educational, fact_sharing, etc.)
 *   and timing_* (0–23). We map content slots to content arms and Thompson-sample.
 * - Generator performance: GeneratorPerformanceTracker top performers (F/1K).
 */

import { getSupabaseClient } from '../db/index';

export interface BanditArm {
  arm_name: string;
  scope: string;
  alpha: number;
  beta: number;
  successes: number;
  failures: number;
}

/** Map content_slot (planJob) → bandit arm name (learnJob content_type) */
const SLOT_TO_CONTENT_ARM: Record<string, string> = {
  educational: 'content_educational',
  myth_busting: 'content_myth_busting',
  practical_tip: 'content_wellness_tip',
  framework: 'content_fact_sharing',
  research: 'content_fact_sharing',
  case_study: 'content_fact_sharing',
  trend_analysis: 'content_fact_sharing',
  comparison: 'content_fact_sharing',
  deep_dive: 'content_educational',
  question: 'content_educational',
  story: 'content_fact_sharing',
  news: 'content_fact_sharing',
};

/** Thompson sample from Beta(alpha, beta). */
function sampleBeta(alpha: number, beta: number): number {
  const u = Math.random();
  const v = Math.random();
  // Simplified: use mean + noise for stability when alpha/beta are small
  const mean = alpha / (alpha + beta);
  const variance = (alpha * beta) / ((alpha + beta) ** 2 * (alpha + beta + 1));
  const noise = (Math.random() - 0.5) * 2 * Math.sqrt(Math.max(0, variance));
  return Math.max(0.01, Math.min(0.99, mean + noise));
}

/**
 * Load bandit arms from DB (content + timing). Returns map arm_name → arm.
 * Supports both schemas: arm_name (current) and arm_key (legacy).
 */
export async function loadBanditArmsForPlan(): Promise<Map<string, BanditArm>> {
  const supabase = getSupabaseClient();

  // Try current schema (arm_name) first
  let data: any[] | null = null;
  let error: { message: string } | null = null;

  const res1 = await supabase
    .from('bandit_arms')
    .select('arm_name, scope, alpha, beta, successes, failures')
    .in('scope', ['content', 'timing']);
  error = res1.error;
  data = res1.data;

  // If column arm_name or scope does not exist, try legacy schema (arm_key; no scope column)
  if (error?.message?.includes('arm_name') || error?.message?.includes('scope') || error?.message?.includes('does not exist')) {
    let res2 = await supabase
      .from('bandit_arms')
      .select('arm_key, alpha, beta, successes, attempts');
    if (res2.error && (res2.error.message?.includes('attempts') || res2.error.message?.includes('does not exist'))) {
      res2 = await supabase.from('bandit_arms').select('arm_key, alpha, beta, successes');
    }
    if (res2.error && res2.error.message?.includes('does not exist')) {
      res2 = await supabase.from('bandit_arms').select('arm_key, successes');
    }
    if (res2.error && res2.error.message?.includes('does not exist')) {
      res2 = await supabase.from('bandit_arms').select('arm_key');
    }
    if (!res2.error && res2.data?.length) {
      data = res2.data
        .filter((row: any) => {
          const k = (row.arm_key || '').toString();
          return k.startsWith('content_') || k.startsWith('timing_');
        })
        .map((row: any) => {
          const attempts = Number(row.attempts) ?? 0;
          const successes = Number(row.successes) ?? 0;
          const failures = Math.max(0, (attempts || successes * 2) - successes);
          const alpha = Number(row.alpha) || successes + 1;
          const beta = Number(row.beta) || failures + 1;
          return {
            arm_name: row.arm_key,
            scope: (row.arm_key || '').toString().startsWith('timing_') ? 'timing' : 'content',
            alpha,
            beta,
            successes,
            failures,
          };
        });
      error = null;
    }
  }

  if (error || !data?.length) {
    if (error) console.warn(`[PLAN_LEARNING] ⚠️ Failed to load bandit_arms: ${error.message}`);
    return new Map();
  }

  const map = new Map<string, BanditArm>();
  let usedLegacy = false;
  for (const row of data) {
    const armName = row.arm_name ?? row.arm_key;
    if (!armName) continue;
    if (row.arm_key != null && !row.arm_name) usedLegacy = true;
    map.set(armName, {
      arm_name: armName,
      scope: row.scope,
      alpha: Number(row.alpha) || 1,
      beta: Number(row.beta) || 1,
      successes: Number(row.successes) || 0,
      failures: Number(row.failures) ?? Math.max(0, (Number(row.attempts) || 0) - (Number(row.successes) || 0)),
    });
  }
  console.log(`[PLAN_LEARNING] bandit arms loaded count: ${map.size} (schema: ${usedLegacy ? 'arm_key legacy' : 'arm_name'})`);
  return map;
}

export interface LearningBiasedSlotResult {
  slot: string;
  reason: string;
  arm_used: string | null;
  sample_value: number | null;
  arms_loaded: number;
}

/**
 * Select a content slot using bandit arms (Thompson sampling).
 * Maps each available slot to a content_* arm; samples and picks the slot with highest sample.
 * If no arms or no mapping, returns null (caller should use existing selectContentSlot).
 */
export async function getLearningBiasedSlot(
  availableSlots: string[]
): Promise<LearningBiasedSlotResult | null> {
  if (availableSlots.length === 0) return null;
  if (availableSlots.length === 1) {
    return {
      slot: availableSlots[0],
      reason: 'single_slot',
      arm_used: null,
      sample_value: null,
      arms_loaded: 0,
    };
  }

  const arms = await loadBanditArmsForPlan();
  if (arms.size === 0) {
    console.log('[PLAN_LEARNING] No bandit arms in DB; slot selection will use default policy');
    return null;
  }

  let bestSlot = availableSlots[0];
  let bestSample = 0;
  let bestArm: string | null = null;

  for (const slot of availableSlots) {
    const armName = SLOT_TO_CONTENT_ARM[slot];
    if (!armName) continue;
    const arm = arms.get(armName);
    const alpha = arm ? arm.alpha : 1;
    const beta = arm ? arm.beta : 1;
    const sample = sampleBeta(alpha, beta);
    if (sample > bestSample) {
      bestSample = sample;
      bestSlot = slot;
      bestArm = armName;
    }
  }

  console.log(
    `[PLAN_LEARNING] slot_favored=${bestSlot} reason=bandit_arm arm=${bestArm} sample=${bestSample.toFixed(3)} historical_arms_loaded=${arms.size}`
  );
  return {
    slot: bestSlot,
    reason: 'bandit_arm',
    arm_used: bestArm,
    sample_value: bestSample,
    arms_loaded: arms.size,
  };
}

export interface LearningBiasedGeneratorResult {
  preferredGenerators: string[];
  reason: string;
  source: string;
}

/**
 * Get generator names to prefer based on recent performance (F/1K).
 * Returns top performers from GeneratorPerformanceTracker; empty if insufficient data.
 */
export async function getLearningBiasedGenerators(
  topN: number = 5,
  minPosts: number = 3
): Promise<LearningBiasedGeneratorResult> {
  try {
    const { GeneratorPerformanceTracker } = await import('./generatorPerformanceTracker');
    const tracker = new GeneratorPerformanceTracker();
    const top = await tracker.getTopPerformers(topN, minPosts);
    if (top.length === 0) {
      return { preferredGenerators: [], reason: 'insufficient_data', source: 'generator_performance' };
    }
    console.log(
      `[PLAN_LEARNING] generator_favored list=${top.join(', ')} reason=top_performer_f_per_1k source=GeneratorPerformanceTracker`
    );
    return {
      preferredGenerators: top,
      reason: 'top_performer_f_per_1k',
      source: 'GeneratorPerformanceTracker',
    };
  } catch (err: any) {
    console.warn(`[PLAN_LEARNING] ⚠️ getLearningBiasedGenerators failed: ${err.message}`);
    return { preferredGenerators: [], reason: 'error', source: 'GeneratorPerformanceTracker' };
  }
}
