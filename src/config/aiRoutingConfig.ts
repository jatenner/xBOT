/**
 * Phase 4 AI Routing Configuration
 * 
 * Part 2: Real routing rules based on content_slot and priority_score
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
  useExpert: boolean;
  maxTokens: number;
  experimentationEnabled: boolean;
  minPriorityForExpert?: number; // Minimum priority_score to use expert (for replies)
  isHighValueSlot?: boolean; // Whether this slot is considered high-value
  forceCoreOnly?: boolean; // Never use expert for this slot
}

/**
 * High-value content slots that can use GPT-4o
 */
const HIGH_VALUE_SLOTS: ContentSlotType[] = [
  'deep_dive',
  'framework', // High-value when thread format
  'research' // High-value when thread format
];

/**
 * Get AI routing rule for a decision type and content slot
 * 
 * Part 3: Implements intelligent routing based on slot value, priority_score, and learning signals
 */
export async function getAiRoutingRule(
  decisionType: DecisionType,
  contentSlot?: ContentSlotType | null,
  priorityScore?: number | null,
  slotPerformanceScore?: number | null
): Promise<AIRoutingRule> {
  // Base defaults per decision type
  const defaults: Record<DecisionType, { maxTokens: number }> = {
    single: { maxTokens: 512 },
    thread: { maxTokens: 2000 },
    reply: { maxTokens: 300 }
  };

  const defaultForType = defaults[decisionType] || defaults.single;
  const slot = contentSlot || 'practical_tip'; // Default slot

  // High-value routing rules
  const isHighValueSlot = HIGH_VALUE_SLOTS.includes(slot);
  const isThreadFormat = decisionType === 'thread';
  
  // Part 3: Learning-aware routing
  // If slot performance is available, use it to adjust routing decisions
  const slotScore = slotPerformanceScore !== null && slotPerformanceScore !== undefined 
    ? slotPerformanceScore 
    : null;
  
  const SLOT_SCORE_THRESHOLD = 0.5; // Minimum slot performance to consider Expert
  const SLOT_SCORE_BOOST_THRESHOLD = 0.7; // High-performing slots get Expert preference

  // Rule 1: High-value threads get GPT-4o (if slot performance allows)
  if (isThreadFormat && isHighValueSlot) {
    // If slot performance is low, downgrade to Core
    if (slotScore !== null && slotScore < SLOT_SCORE_THRESHOLD) {
      console.log(`[PHASE4][Router] Downgraded slot=${slot} to Core due to low slotPerformanceScore=${slotScore.toFixed(3)}`);
      return {
        model: 'gpt-4o-mini',
        useExpert: false,
        maxTokens: defaultForType.maxTokens,
        experimentationEnabled: false,
        isHighValueSlot: false // Downgraded
      };
    }
    
    return {
      model: 'gpt-4o',
      useExpert: true,
      maxTokens: defaultForType.maxTokens,
      experimentationEnabled: false,
      isHighValueSlot: true
    };
  }

  // Rule 2: High-priority replies get GPT-4o (if priority_score >= 0.8)
  if (decisionType === 'reply' && priorityScore !== null && priorityScore !== undefined) {
    const minPriority = 0.8;
    if (priorityScore >= minPriority) {
      return {
        model: 'gpt-4o',
        useExpert: true,
        maxTokens: defaultForType.maxTokens,
        experimentationEnabled: false,
        minPriorityForExpert: minPriority,
        isHighValueSlot: true
      };
    }
  }

  // Rule 3: Deep dive singles can use GPT-4o (if slot performance is good)
  if (decisionType === 'single' && slot === 'deep_dive') {
    // If slot performance is high, increase chance of Expert
    const expertChance = slotScore !== null && slotScore >= SLOT_SCORE_BOOST_THRESHOLD 
      ? 0.5 // 50% chance if high-performing
      : 0.3; // 30% chance otherwise
    
    if (Math.random() < expertChance) {
      return {
        model: 'gpt-4o',
        useExpert: true,
        maxTokens: defaultForType.maxTokens,
        experimentationEnabled: false,
        isHighValueSlot: true
      };
    }
  }

  // Rule 4: High-performing slots (even if not "high value") can get Expert occasionally
  if (slotScore !== null && slotScore >= SLOT_SCORE_BOOST_THRESHOLD && decisionType === 'thread') {
    // 20% chance for high-performing thread slots
    if (Math.random() < 0.2) {
      console.log(`[PHASE4][Router] Upgraded slot=${slot} to Expert due to high slotPerformanceScore=${slotScore.toFixed(3)}`);
      return {
        model: 'gpt-4o',
        useExpert: true,
        maxTokens: defaultForType.maxTokens,
        experimentationEnabled: false,
        isHighValueSlot: true
      };
    }
  }

  // Default: GPT-4o-mini for everything else
  return {
    model: 'gpt-4o-mini',
    useExpert: false,
    maxTokens: defaultForType.maxTokens,
    experimentationEnabled: false,
    forceCoreOnly: false
  };
}

/**
 * Check if Phase 4 routing is enabled
 */
export function isPhase4RoutingEnabled(): boolean {
  return process.env.ENABLE_PHASE4_ROUTING === 'true';
}

