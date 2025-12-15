/**
 * Phase 4 Orchestrator Router
 * 
 * Part 1: Routes to CoreContentOrchestrator only
 * Part 2: Will add ExpertOrchestrator routing based on content_slot and priority_score
 */

import { CoreContentOrchestrator, type CoreContentRequest, type CoreContentResponse } from './CoreContentOrchestrator';
import { getAiRoutingRule, isPhase4RoutingEnabled } from '../config/aiRoutingConfig';

/**
 * Route content generation request to appropriate orchestrator
 * 
 * Part 1: Always routes to CoreContentOrchestrator (GPT-4o-mini)
 * Part 2: Will route to ExpertOrchestrator for high-value content
 */
export async function routeContentGeneration(
  request: CoreContentRequest
): Promise<CoreContentResponse> {
  // Get routing rule (Part 1: Always returns GPT-4o-mini)
  const rule = getAiRoutingRule(request.decision_type, request.content_slot);

  // Part 1: Always use CoreContentOrchestrator (ignore rule.useExpert)
  // Part 2: Will check rule.useExpert and route to ExpertOrchestrator if true
  console.log(`[PHASE4][orchestratorRouter] Routing to CoreContentOrchestrator (model: ${rule.model})`);

  return CoreContentOrchestrator.generate(request);
}

/**
 * Check if Phase 4 routing should be used
 */
export function shouldUsePhase4Routing(): boolean {
  return isPhase4RoutingEnabled();
}

