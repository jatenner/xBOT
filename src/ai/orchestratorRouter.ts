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
 * Extended request interface for routing (includes priority_score)
 */
export interface RoutingRequest extends CoreContentRequest {
  priority_score?: number | null; // For replies - priority_score from discovered_accounts
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

  // Get routing rule based on decision type, slot, and priority
  const routingRule = getAiRoutingRule(decision_type, content_slot || null, priority_score || null);

  // Check if expert usage is allowed (budget + rules)
  const allowExpert = await shouldUseExpertModel(routingRule);

  // Determine upgrade reason for logging
  let upgradeReason: 'high_value_slot' | 'high_priority_reply' | 'banger_analysis' | undefined;
  if (routingRule.isHighValueSlot) {
    upgradeReason = 'high_value_slot';
  } else if (priority_score !== null && priority_score !== undefined && priority_score >= 0.8) {
    upgradeReason = 'high_priority_reply';
  }

  // Log routing decision
  console.log(`[PHASE4][Router] decisionType=${decision_type}, slot=${content_slot || 'unknown'}, priority=${priority_score || 'N/A'}, rule.model=${routingRule.model}, expertAllowed=${allowExpert}, reason=${upgradeReason || 'none'}`);

  // Route to appropriate orchestrator
  if (allowExpert && routingRule.useExpert) {
    // Use ExpertOrchestrator (GPT-4o)
    const expertRequest: ExpertContentRequest = {
      ...request,
      upgrade_reason: upgradeReason
    };
    return ExpertOrchestrator.generate(expertRequest);
  } else {
    // Use CoreContentOrchestrator (GPT-4o-mini)
    if (routingRule.useExpert && !allowExpert) {
      console.log(`[PHASE4][Router] ⚠️ Downgraded to core model due to budget constraints`);
    }
    return CoreContentOrchestrator.generate(request);
  }
}

/**
 * Check if Phase 4 routing should be used
 */
export function shouldUsePhase4Routing(): boolean {
  return isPhase4RoutingEnabled();
}

