/**
 * AI ORCHESTRATION JOB
 * 
 * Runs AI systems on schedule while staying within budget
 * 
 * Frequency: Every 6 hours
 * - Checks which AI systems need to run
 * - Runs them if budget allows
 * - Logs all executions
 */

import { getAIBudgetOrchestrator } from '../ai-core/aiBudgetOrchestrator';

export async function runAIOrchestrationJob(): Promise<void> {
  console.log('\n🤖 ═══════════════════════════════════════════════════');
  console.log('🤖 JOB_AI_ORCHESTRATION: Starting');
  console.log('🤖 ═══════════════════════════════════════════════════\n');

  try {
    const orchestrator = getAIBudgetOrchestrator();

    // Get budget status first
    const budgetStatus = await orchestrator.getBudgetStatus();

    console.log('[JOB_AI_ORCHESTRATION] 💰 Budget Status:');
    console.log(`[JOB_AI_ORCHESTRATION]    Spent: $${budgetStatus.spent_today.toFixed(2)}/$${budgetStatus.daily_budget.toFixed(2)}`);
    console.log(`[JOB_AI_ORCHESTRATION]    Remaining: $${budgetStatus.remaining_today.toFixed(2)}`);
    console.log(`[JOB_AI_ORCHESTRATION]    Projected EOD: $${budgetStatus.projected_end_of_day.toFixed(2)}`);

    if (!budgetStatus.can_run_expensive_tasks) {
      console.log('[JOB_AI_ORCHESTRATION] ⚠️ Budget exhausted for today, skipping AI tasks');
      return;
    }

    // Run orchestration
    await orchestrator.orchestrate();

    // Run AI-driven reply systems
    console.log('[JOB_AI_ORCHESTRATION] 🤖 Running AI reply systems...');
    const { runAISystems } = await import('./aiSystemsJob');
    await runAISystems();

    // Get recommendations
    const recommendations = await orchestrator.getSystemRecommendations();

    console.log('[JOB_AI_ORCHESTRATION] 📊 Recommendations:');
    recommendations.forEach(rec => {
      console.log(`[JOB_AI_ORCHESTRATION]    ${rec}`);
    });

    console.log('\n✅ JOB_AI_ORCHESTRATION: Completed successfully\n');

  } catch (error: any) {
    console.error('\n❌ JOB_AI_ORCHESTRATION: Failed\n');
    console.error(`[JOB_AI_ORCHESTRATION] Error: ${error.message}`);
    throw error;
  }
}

