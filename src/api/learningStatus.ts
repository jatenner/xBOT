/**
 * 📊 LEARNING STATUS API
 * 
 * GET /api/learning/status
 * Returns current model versions, exploration rate, and bandit arms summary
 */

import { Request, Response } from 'express';
import { getSupabaseClient } from '../db';
import { getConfig } from '../config/config';

interface BanditArmSummary {
    name: string;
  scope: string;
  successes: number;
  failures: number;
  mean_reward: number;
  ci_width: number;
  sample_count: number;
    last_updated: string;
}

interface LearningStatusResponse {
  predictorVersion: string;
  exploreRate: number;
  arms: BanditArmSummary[];
  totalOutcomes: number;
  realOutcomes: number;
  lastTrainingRun: string | null;
  budgetStatus: {
    dailyLimit: number;
    used: number;
    remaining: number;
  };
}

export async function getLearningStatus(req: Request, res: Response): Promise<void> {
  try {
    const config = getConfig();
    const supabase = getSupabaseClient();

    // 1. Get bandit arms with stats
    const { data: arms, error: armsError } = await supabase
      .from('bandit_arms')
      .select('*')
      .order('last_updated', { ascending: false });

    if (armsError) throw armsError;

    // 2. Calculate arm summaries
    const armSummaries: BanditArmSummary[] = (arms || []).map((arm: any) => {
      const total = arm.successes + arm.failures;
      const mean_reward = total > 0 ? arm.successes / total : 0;
      
      // Thompson Sampling CI width (beta distribution)
      const alpha = (arm.alpha || 1) + arm.successes;
      const beta = (arm.beta || 1) + arm.failures;
      const variance = (alpha * beta) / ((alpha + beta) ** 2 * (alpha + beta + 1));
      const ci_width = 2 * Math.sqrt(variance); // Approximate 95% CI width

        return {
        name: arm.arm_name,
        scope: arm.scope,
        successes: arm.successes,
        failures: arm.failures,
        mean_reward: parseFloat(mean_reward.toFixed(4)),
        ci_width: parseFloat(ci_width.toFixed(4)),
        sample_count: total,
        last_updated: arm.last_updated
      };
    });

    // 3. Get outcomes counts
    const { count: totalOutcomes } = await supabase
      .from('outcomes')
      .select('*', { count: 'exact', head: true });

    const { count: realOutcomes } = await supabase
      .from('outcomes')
      .select('*', { count: 'exact', head: true })
      .eq('simulated', false);

    // 4. Get last training run timestamp
    const { data: lastTraining } = await supabase
      .from('bandit_arms')
      .select('last_updated')
      .order('last_updated', { ascending: false })
      .limit(1)
      .single();

    // 5. Calculate exploration rate
    // Start at 0.20, decay to 0.05 over 14 days based on sample count
    const totalSamples = (arms || []).reduce((sum: number, arm: any) => 
      sum + arm.successes + arm.failures, 0
    );
    const targetSamples = 100; // After 100 samples, reach min explore rate
    const exploreRate = Math.max(
      0.05,
      0.20 - (0.15 * Math.min(1, totalSamples / targetSamples))
    );

    // 6. Get budget status
    const dailyLimit = parseFloat(config.DAILY_OPENAI_LIMIT_USD || '10');
    const { data: apiUsage } = await supabase
      .from('api_usage')
      .select('cost_usd')
      .gte('created_at', new Date().toISOString().split('T')[0]) // Today
      .eq('status', 'success');

    const used = (apiUsage || []).reduce((sum: number, u: any) => 
      sum + parseFloat(u.cost_usd || 0), 0
    );

    // 7. Determine predictor version
    const predictorVersion = lastTraining?.last_updated
      ? `v${Math.floor(new Date(lastTraining.last_updated).getTime() / 1000 / 3600)}` // Version per hour
      : 'v0';

    const response: LearningStatusResponse = {
      predictorVersion,
      exploreRate: parseFloat(exploreRate.toFixed(3)),
      arms: armSummaries,
      totalOutcomes: totalOutcomes || 0,
      realOutcomes: realOutcomes || 0,
      lastTrainingRun: lastTraining?.last_updated || null,
      budgetStatus: {
        dailyLimit,
        used: parseFloat(used.toFixed(4)),
        remaining: parseFloat((dailyLimit - used).toFixed(4))
      }
    };

    res.json(response);
  } catch (error: any) {
    console.error('[API] Learning status error:', error.message);
    res.status(500).json({ error: error.message });
  }
}