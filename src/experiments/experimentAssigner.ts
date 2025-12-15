/**
 * Experiment Assigner
 * 
 * Assigns experiment metadata (experiment_group, hook_variant) to content
 * Part 3: Minimal experimentation layer for A/B hook testing
 */

import type { ContentSlotType } from '../config/aiRoutingConfig';

export interface ExperimentAssignment {
  experiment_group: string | null;
  hook_variant: string | null;
}

// Experiment configuration
const EXPERIMENT_ENABLED = process.env.ENABLE_PHASE4_EXPERIMENTS === 'true';
const EXPERIMENT_GROUP_NAME = 'hook_ab_v1';
const EXPERIMENT_SLOTS: ContentSlotType[] = [
  'practical_tip',
  'myth_busting',
  'framework'
]; // Slots that participate in experiments

/**
 * Assign experiment metadata to content
 * 
 * @param contentSlot - The content slot for this content
 * @returns Experiment assignment (experiment_group, hook_variant) or null if not participating
 */
export function assignExperiment(contentSlot: ContentSlotType): ExperimentAssignment {
  // Check if experiments are enabled
  if (!EXPERIMENT_ENABLED) {
    return {
      experiment_group: null,
      hook_variant: null
    };
  }

  // Check if this slot participates in experiments
  if (!EXPERIMENT_SLOTS.includes(contentSlot)) {
    return {
      experiment_group: null,
      hook_variant: null
    };
  }

  // Randomly assign hook variant (A or B)
  const hookVariant = Math.random() < 0.5 ? 'A' : 'B';

  console.log(`[PHASE4][Experiment] Assigned experiment_group=${EXPERIMENT_GROUP_NAME} hook_variant=${hookVariant} to slot=${contentSlot}`);

  return {
    experiment_group: EXPERIMENT_GROUP_NAME,
    hook_variant: hookVariant
  };
}

/**
 * Check if experiments are enabled
 */
export function isExperimentEnabled(): boolean {
  return EXPERIMENT_ENABLED;
}

