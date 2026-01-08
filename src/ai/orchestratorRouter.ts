/**
 * Phase 4 Orchestrator Router
 * 
 * Part 2: Routes to CoreContentOrchestrator or ExpertOrchestrator based on rules + budget
 */

import { CoreContentOrchestrator, type CoreContentRequest, type CoreContentResponse } from './CoreContentOrchestrator';
import { ExpertOrchestrator, type ExpertContentRequest } from './ExpertOrchestrator';
import { getAiRoutingRule, isPhase4RoutingEnabled } from '../config/aiRoutingConfig';
import { shouldUseExpertModel } from './BudgetController';

/**
 * Extended request interface for routing (includes priority_score and reply_context)
 */
export interface RoutingRequest extends CoreContentRequest {
  priority_score?: number | null; // For replies - priority_score from discovered_accounts
  reply_context?: { // For replies - full conversation context
    target_text: string;
    quoted_text?: string;
    root_text?: string;
    thread_prev_text?: string;
    root_tweet_id?: string;
  };
}

/**
 * Route content generation request to appropriate orchestrator
 * 
 * Part 2: Routes to ExpertOrchestrator for high-value content if budget allows
 */
export async function routeContentGeneration(
  request: RoutingRequest
): Promise<CoreContentResponse> {
  const { decision_type, content_slot, priority_score } = request;

  // Get slot performance score for learning-aware routing
  let slotPerformanceScore: number | null = null;
  if (content_slot) {
    try {
      const { getSlotPerformanceScore } = await import('../learning/slotPerformanceTracker');
      slotPerformanceScore = await getSlotPerformanceScore(content_slot);
    } catch (error: any) {
      console.warn(`[PHASE4][Router] Failed to get slot performance:`, error.message);
    }
  }

  // Get routing rule based on decision type, slot, priority, and learning signals
  const routingRule = await getAiRoutingRule(
    decision_type, 
    content_slot || null, 
    priority_score || null,
    slotPerformanceScore
  );

  // Check if expert usage is allowed (budget + rules)
  const allowExpert = await shouldUseExpertModel(routingRule);

  // Determine upgrade reason for logging
  let upgradeReason: 'high_value_slot' | 'high_priority_reply' | 'banger_analysis' | undefined;
  if (routingRule.isHighValueSlot) {
    upgradeReason = 'high_value_slot';
  } else if (priority_score !== null && priority_score !== undefined && priority_score >= 0.8) {
    upgradeReason = 'high_priority_reply';
  }

  // Log routing decision with learning signals
  const slotScoreStr = slotPerformanceScore !== null ? slotPerformanceScore.toFixed(3) : 'N/A';
  console.log(`[PHASE4][Router] decisionType=${decision_type}, slot=${content_slot || 'unknown'}, priority=${priority_score || 'N/A'}, slotScore=${slotScoreStr}, rule.model=${routingRule.model}, expertAllowed=${allowExpert}, reason=${upgradeReason || 'none'}`);

  // Route to appropriate orchestrator with explicit model
  if (allowExpert && routingRule.useExpert) {
    // Use ExpertOrchestrator (GPT-4o)
    const expertRequest: ExpertContentRequest = {
      ...request,
      model: routingRule.model, // Explicit model from routing rule
      upgrade_reason: upgradeReason
    };
    return ExpertOrchestrator.generate(expertRequest);
  } else {
    // Use CoreContentOrchestrator (GPT-4o-mini or downgraded GPT-4o)
    if (routingRule.useExpert && !allowExpert) {
      console.log(`[PHASE4][Router] ⚠️ Downgraded to core model due to budget constraints`);
    }
    const coreRequest: CoreContentRequest = {
      ...request,
      model: routingRule.model // Explicit model from routing rule (may be downgraded)
    };
    return CoreContentOrchestrator.generate(coreRequest);
  }
}

/**
 * Check if Phase 4 routing should be used
 */
export function shouldUsePhase4Routing(): boolean {
  return isPhase4RoutingEnabled();
}

