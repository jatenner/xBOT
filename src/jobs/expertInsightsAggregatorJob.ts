/**
 * 🔄 EXPERT INSIGHTS AGGREGATOR JOB
 * 
 * Scheduled job to aggregate expert analyses into strategic recommendations
 * Runs every 12 hours to synthesize insights by angle/tone/structure combinations
 * 
 * Stores aggregated insights in vi_format_intelligence.expert_insights
 */

import { ExpertInsightsAggregator } from '../intelligence/expertInsightsAggregator';
import { recordJobSuccess, recordJobFailure } from './jobHeartbeat';
import { log } from '../lib/logger';

export async function expertInsightsAggregatorJob(): Promise<void> {
  const jobName = 'expert_insights_aggregator';
  log({ op: 'expert_aggregator_job_start' });

  try {
    const aggregator = new ExpertInsightsAggregator();

    // Aggregate all insights
    await aggregator.aggregateAllInsights();

    log({ op: 'expert_aggregator_job_complete' });
    await recordJobSuccess(jobName);
  } catch (error: any) {
    log({ op: 'expert_aggregator_job_error', error: error.message });
    await recordJobFailure(jobName, error.message);
    throw error;
  }
}

