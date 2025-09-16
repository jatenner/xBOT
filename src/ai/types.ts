/**
 * Shared AI Decision Types
 */

export type Decision =
  | { action: 'post'; timing_arm?: string; content_arm?: string; optimal_wait_minutes?: number; reasons?: string[] }
  | { action: 'wait'; optimal_wait_minutes: number; reasons?: string[] }
  | { action: 'skip'; reason: 'quota_circuit' | 'posting_disabled' | 'cooldown' | string; reasons?: string[] };

export interface LearningAwareDecision {
  timing_arm: string;
  content_arm: string;
  reasons: string[];
  should_post_now: boolean;
  predicted_er: number;
  predicted_follow_through: number;
}
