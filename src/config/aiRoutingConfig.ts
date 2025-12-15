/**
 * Phase 4 AI Routing Configuration
 * 
 * Part 1: Foundation only - always returns GPT-4o-mini
 * Part 2: Will add intelligent routing based on content_slot and priority_score
 */

export type DecisionType = 'single' | 'thread' | 'reply';
export type ContentSlotType =
  | 'myth_busting'
  | 'framework'
  | 'research'
  | 'practical_tip'
  | 'case_study'
  | 'trend_analysis'
  | 'comparison'
  | 'deep_dive'
  | 'question'
  | 'story'
  | 'news'
  | 'educational'
  | 'reply'; // For replies

export interface AIRoutingRule {
  model: 'gpt-4o-mini' | 'gpt-4o';
  useExpert: boolean; // Part 1: Always false, Part 2: Will be true for high-value content
  maxTokens: number;
  experimentationEnabled: boolean;
}

/**
 * Get AI routing rule for a decision type and content slot
 * 
 * Part 1: Always returns GPT-4o-mini with sensible defaults
 * Part 2: Will implement intelligent routing based on slot value and learning signals
 */
export function getAiRoutingRule(
  decisionType: DecisionType,
  contentSlot: ContentSlotType
): AIRoutingRule {
  // Part 1: Simple defaults - always GPT-4o-mini
  const defaults: Record<DecisionType, { maxTokens: number }> = {
    single: { maxTokens: 512 },
    thread: { maxTokens: 2000 },
    reply: { maxTokens: 300 }
  };

  const defaultForType = defaults[decisionType] || defaults.single;

  return {
    model: 'gpt-4o-mini', // Part 1: Always GPT-4o-mini
    useExpert: false, // Part 1: Never use expert orchestrator
    maxTokens: defaultForType.maxTokens,
    experimentationEnabled: false // Part 1: No experiments
  };
}

/**
 * Check if Phase 4 routing is enabled
 */
export function isPhase4RoutingEnabled(): boolean {
  return process.env.ENABLE_PHASE4_ROUTING === 'true';
}

