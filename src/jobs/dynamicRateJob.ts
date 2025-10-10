/**
 * 🎯 DYNAMIC RATE JOB
 * 
 * Periodically analyzes performance and adjusts posting/reply rates automatically
 * - Runs every 2 hours to assess performance
 * - Scales up when engagement is high
 * - Scales down when audience shows fatigue
 * - Learns optimal patterns from data
 */

import { DynamicRateController } from '../ai/dynamicRateController';

interface RateJobStats {
  rates_adjusted: boolean;
  posts_per_hour: number;
  replies_per_hour: number;
  confidence: number;
  reasoning: string[];
  performance_trend: string;
}

export async function runDynamicRateJob(): Promise<RateJobStats> {
  console.log('[DYNAMIC_RATE_JOB] 🎯 Starting dynamic rate optimization...');
  
  try {
    const rateController = DynamicRateController.getInstance();
    
    // Apply dynamic rates based on current performance
    const result = await rateController.applyDynamicRates();
    
    // Get performance trend
    const history = await rateController.getRateHistory();
    
    const stats: RateJobStats = {
      rates_adjusted: result.applied,
      posts_per_hour: result.posts_per_hour,
      replies_per_hour: result.replies_per_hour,
      confidence: 0,
      reasoning: result.reasoning,
      performance_trend: history.performance_trend
    };

    if (result.applied) {
      console.log(`[DYNAMIC_RATE_JOB] ✅ Rates updated: ${result.posts_per_hour}p/h, ${result.replies_per_hour}r/h`);
      console.log(`[DYNAMIC_RATE_JOB] 📈 Trend: ${history.performance_trend}`);
      console.log(`[DYNAMIC_RATE_JOB] 💡 Reasoning: ${result.reasoning.join('; ')}`);
    } else {
      console.log('[DYNAMIC_RATE_JOB] ⚠️ No rate changes applied');
    }

    return stats;

  } catch (error: any) {
    console.error('[DYNAMIC_RATE_JOB] ❌ Dynamic rate job failed:', error.message);
    
    return {
      rates_adjusted: false,
      posts_per_hour: 2,
      replies_per_hour: 3,
      confidence: 0,
      reasoning: [`Error: ${error.message}`],
      performance_trend: 'unknown'
    };
  }
}

/**
 * 📊 Get current dynamic rate status
 */
export async function getDynamicRateStatus(): Promise<{
  current_rates: { posts_per_hour: number; replies_per_hour: number };
  last_adjustment: Date | null;
  performance_trend: string;
  recent_reasoning: string[];
}> {
  try {
    const rateController = DynamicRateController.getInstance();
    const history = await rateController.getRateHistory();
    
    return {
      current_rates: history.current_rates,
      last_adjustment: history.recent_adjustments.length > 0 
        ? new Date(history.recent_adjustments[0].created_at)
        : null,
      performance_trend: history.performance_trend,
      recent_reasoning: history.recent_adjustments.length > 0
        ? history.recent_adjustments[0].reasoning || []
        : []
    };

  } catch (error: any) {
    console.error('❌ Failed to get dynamic rate status:', error.message);
    return {
      current_rates: { posts_per_hour: 2, replies_per_hour: 3 },
      last_adjustment: null,
      performance_trend: 'unknown',
      recent_reasoning: []
    };
  }
}
