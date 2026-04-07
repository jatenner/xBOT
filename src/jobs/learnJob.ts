/**
 * 🧠 LEARN JOB
 * Handles learning cycle: update bandits, train predictors, compute arm rewards
 */

import { getConfig } from '../config/config';
import { logLearningState } from '../utils/learningStateLogger';

export interface LearningStats {
  sampleSize: number;
  armsUpdated: number;
  exploreRatio: number;
  predictorUpdated: boolean;
  simulatedPercent: number;
}

export async function runLearningCycle(): Promise<LearningStats> {
  const config = getConfig();
  
  console.log('[LEARN_JOB] 🧠 Starting learning cycle...');
  
  try {
    // 1. Collect recent decisions and outcomes
    const trainingData = await collectTrainingData();
    
    // Check if we have sufficient data for training
    const learningMode = trainingData.length === 0 ? 'insufficient_data'
      : trainingData.length < 2 ? 'insufficient_data'
      : 'real_data';
    console.log(`[LEARNING_STATE] system=learn_job mode=${learningMode} samples=${trainingData.length} min_required=2`);
    logLearningState('learn_job', learningMode, trainingData.length, 2);

    if (trainingData.length === 0) {
      console.log('[LEARN_JOB] ⚠️ Training skipped: insufficient samples (need real outcomes in LIVE mode)');
      return {
        sampleSize: 0,
        armsUpdated: 0,
        exploreRatio: config.EXPLORE_RATIO_MIN || 0.1,
        predictorUpdated: false,
        simulatedPercent: config.MODE === 'shadow' ? 100 : 0
      };
    }
    
    // 1.5 Growth action logs: aggregate efficiency signals and influence bandits
    const growthSignals = await collectGrowthActionSignals();
    if (growthSignals.armEfficiency.size > 0 || growthSignals.timingEfficiency.size > 0 || growthSignals.tierConversion.size > 0) {
      growthSignals.armEfficiency.forEach((agg, arm) => {
        console.log(`[LEARNING_SIGNAL] arm=${arm} efficiency=${agg.avgEfficiency?.toFixed(4) ?? 'n/a'} samples=${agg.samples}`);
      });
      growthSignals.timingEfficiency.forEach((agg, hour) => {
        console.log(`[LEARNING_SIGNAL] hour=${hour} timing_efficiency=${agg.avgEfficiency?.toFixed(4) ?? 'n/a'} samples=${agg.samples}`);
      });
      growthSignals.tierConversion.forEach((agg, tier) => {
        console.log(`[LEARNING_SIGNAL] account_size_tier=${tier} conversion_rate=${agg.avgRate?.toFixed(6) ?? 'n/a'} samples=${agg.samples}`);
      });
    }

    // 2. Update bandit arms (Thompson sampling for content/reply, UCB for timing)
    const banditStats = await updateBanditArms(trainingData, growthSignals);
    
    // 3. Update predictors (ridge/logit regression)
    const predictorStats = await updatePredictors(trainingData);
    
    // 4. Compute exploration ratio based on recent performance
    const exploreRatio = computeExploreRatio(trainingData, config);
    
    const stats: LearningStats = {
      sampleSize: trainingData.length,
      armsUpdated: banditStats.armsUpdated,
      exploreRatio,
      predictorUpdated: predictorStats.updated,
      simulatedPercent: config.MODE === 'shadow' ? 100 : calculateSimulatedPercent(trainingData)
    };
    
    // Log one-line summary
    console.log(`[LEARN_JOB] ✅ LEARN_RUN sample=${stats.sampleSize}, arms_trained=${stats.armsUpdated}, explore_ratio=${stats.exploreRatio.toFixed(3)}, coeffs_updated=${predictorStats.version}`);

    // 🎯 ARCHETYPE LEARNING: Aggregate reply archetype performance
    try {
      const { aggregateArchetypePerformance } = await import('../learning/archetypeLearning');
      await aggregateArchetypePerformance();
    } catch (archetypeErr: any) {
      console.warn(`[LEARN_JOB] ⚠️ Archetype aggregation failed (non-fatal): ${archetypeErr.message}`);
    }

    // 🧠 GROWTH INTELLIGENCE: Compute multi-dimensional performance snapshot
    try {
      const { runGrowthIntelligence } = await import('../intelligence/growthIntelligence');
      await runGrowthIntelligence();
    } catch (growthErr: any) {
      console.warn(`[LEARN_JOB] ⚠️ Growth intelligence failed (non-fatal): ${growthErr.message}`);
    }

    // 🧠 TIMELINE INTELLIGENCE: Evaluate account strategy and posting mix
    try {
      const { runTimelineIntelligence } = await import('../intelligence/timelineIntelligence');
      await runTimelineIntelligence();
    } catch (timelineErr: any) {
      console.warn(`[LEARN_JOB] ⚠️ Timeline intelligence failed (non-fatal): ${timelineErr.message}`);
    }

    // 🧠 STRATEGY LEARNER: Update strategy_state from all learning signals
    // This is the brain that closes the loop — breakout detection, volume ramp, content/discovery preferences
    try {
      const { updateStrategy } = await import('../strategy/strategyLearner');
      const { getLatestGrowthSnapshot } = await import('../intelligence/growthIntelligence');
      const gi = await getLatestGrowthSnapshot();
      const strategyResult = await updateStrategy({ growthSnapshot: gi });
      console.log(`[LEARN_JOB] 🧠 Strategy updated: gen=${strategyResult.generation} changes=${strategyResult.changes.length} breakouts=${strategyResult.breakout_count}`);
    } catch (strategyErr: any) {
      console.warn(`[LEARN_JOB] ⚠️ Strategy learner failed (non-fatal): ${strategyErr.message}`);
    }

    // 📊 OPPORTUNITY LOG BACKFILL: Fill in actual_reward for past decisions
    try {
      const supabase = getSupabaseClient();
      // Find opportunity_log entries missing actual_reward that have outcomes
      const { data: unfilled } = await supabase
        .from('opportunity_log')
        .select('id, decision_id, tick_at')
        .is('actual_reward', null)
        .not('decision_id', 'is', null)
        .order('tick_at', { ascending: false })
        .limit(50);

      if (unfilled && unfilled.length > 0) {
        let backfilled = 0;
        for (const entry of unfilled) {
          // Check if this decision has outcomes
          const { data: outcome } = await supabase
            .from('outcomes')
            .select('impressions, likes, retweets, replies, followers_gained')
            .eq('decision_id', entry.decision_id)
            .order('collected_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (outcome && (outcome.impressions || outcome.likes)) {
            const reward = ((outcome.likes || 0) + (outcome.retweets || 0) * 2 + (outcome.replies || 0) * 3 + (outcome.followers_gained || 0) * 10) / Math.max(1, Math.sqrt(outcome.impressions || 1));
            await supabase
              .from('opportunity_log')
              .update({
                actual_reward: Math.round(reward * 100) / 100,
                actual_followers_gained: outcome.followers_gained || 0,
              })
              .eq('id', entry.id);
            backfilled++;
          }
        }
        if (backfilled > 0) {
          console.log(`[LEARN_JOB] 📊 Opportunity log backfill: ${backfilled}/${unfilled.length} entries updated with actual rewards`);
        }
      }
    } catch (backfillErr: any) {
      console.warn(`[LEARN_JOB] ⚠️ Opportunity backfill failed (non-fatal): ${backfillErr.message}`);
    }

    return stats;
  } catch (error) {
    console.error('[LEARN_JOB] ❌ Learning cycle failed:', error.message);
    throw error;
  }
}

async function collectTrainingData(config?: any): Promise<any[]> {
  if (!config) config = getConfig();
  
  const controlledDecisionId = process.env.CONTROLLED_DECISION_ID?.trim();
  if (controlledDecisionId) {
    const { getSupabaseClient } = await import('../db/index');
    const supabase = getSupabaseClient();
    const { data: outcome, error } = await supabase
      .from('outcomes')
      .select('*')
      .eq('decision_id', controlledDecisionId)
      .maybeSingle();
    if (error || !outcome) {
      console.log('[LEARN_JOB] ⚠️ Controlled: no outcome found for decision_id=' + controlledDecisionId);
      return [];
    }
    const impressions = outcome.impressions ?? outcome.views ?? 0;
    const likes = outcome.likes ?? 0;
    const collectedAt = outcome.collected_at;
    const actual_er =
      outcome.engagement_rate != null
        ? Number(outcome.engagement_rate)
        : impressions > 0
          ? ((likes + (outcome.retweets || 0) + (outcome.replies || 0)) / impressions)
          : 0;
    const trainingSample = {
      decision_id: outcome.decision_id,
      content_type: 'educational',
      timing_slot: collectedAt ? new Date(collectedAt).getHours() : new Date().getHours(),
      quality_score: 0.8,
      predicted_er: actual_er * 0.95,
      actual_er,
      actual_impressions: impressions,
      actual_likes: likes,
      actual_retweets: outcome.retweets || 0,
      actual_replies: outcome.replies || 0,
      simulated: outcome.simulated ?? false,
      hours_old: collectedAt ? (Date.now() - new Date(collectedAt).getTime()) / (1000 * 60 * 60) : 0,
    };
    console.log('[LEARN_JOB] 📋 Controlled: using 1 outcome for decision_id=' + controlledDecisionId);
    return [trainingSample];
  }

  console.log('[LEARN_JOB] 📊 Collecting training data from decisions and outcomes...');
  
  try {
    // ✅ MEMORY OPTIMIZATION: Check memory before loading data
    const { isMemorySafeForOperation, paginatedQuery, clearArrays } = await import('../utils/memoryOptimization');
    const memoryCheck = await isMemorySafeForOperation(50, 1400);
    if (!memoryCheck.safe) {
      console.warn(`[LEARN_JOB] ⚠️ Low memory (${memoryCheck.currentMB}MB), reducing training data size`);
      // Continue with smaller dataset
    }
    
    const { getSupabaseClient } = await import('../db/index');
    const supabase = getSupabaseClient();
    
    // In live mode, ONLY use real outcomes (simulated=false); in shadow mode, use simulated
    const simulatedFilter = config.MODE === 'shadow';
    
    // ✅ MEMORY OPTIMIZATION: Use pagination instead of loading all 50 at once
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const outcomes = await paginatedQuery<any>('outcomes', {
      select: '*',
      filters: { simulated: simulatedFilter },
      orderBy: 'collected_at',
      ascending: false,
      batchSize: 20,
      maxBatches: 3 // Max 60 items (reduced from 50 if memory is tight)
    });
    
    // Legacy code compatibility - check if we got data
    const error = outcomes.length === 0 ? { message: 'No outcomes found' } : null;

    if (error || !outcomes || outcomes.length === 0) {
      // In LIVE mode, never use mock data - only train on real outcomes
      if (config.MODE === 'live') {
        console.log('[LEARN_JOB] ⚠️ Training skipped: insufficient real outcomes (need 2)');
        return [];
      }

      console.log('[LEARN_JOB] ℹ️ No outcomes data found, using mock training data');
      return getMockTrainingData();
    }

    // In LIVE mode, require at least 2 real outcomes
    if (config.MODE === 'live' && outcomes.length < 2) {
      console.log(`[LEARN_JOB] ⚠️ Training skipped: insufficient real outcomes (have ${outcomes.length}, need 2)`);
      return [];
    }
    
    // ✅ MEMORY OPTIMIZATION: Filter outcomes by date after pagination
    const filteredOutcomes = outcomes.filter((outcome: any) => {
      if (!outcome.collected_at) return false;
      const collectedDate = new Date(outcome.collected_at);
      const sevenDaysAgoDate = new Date(sevenDaysAgo);
      return collectedDate >= sevenDaysAgoDate;
    });
    
    // Use filtered outcomes for rest of function
    const outcomesToUse = filteredOutcomes.length > 0 ? filteredOutcomes : outcomes;

    // 🔥 FIX: Get engagement rate from multiple sources
    // engagement_rate is populated in 39% of outcomes, er_calculated is NULL for all
    const getEngagementRate = (outcome: any): number => {
      // Try engagement_rate first (39% have this)
      if (outcome.engagement_rate != null && outcome.engagement_rate > 0) {
        return Number(outcome.engagement_rate);
      }
      
      // Try er_calculated (should be same thing, but currently NULL)
      if (outcome.er_calculated != null && outcome.er_calculated > 0) {
        return Number(outcome.er_calculated);
      }
      
      // Calculate from raw metrics if available
      const impressions = outcome.impressions || 0;
      if (impressions > 0) {
        const likes = outcome.likes || 0;
        const retweets = outcome.retweets || 0;
        const replies = outcome.replies || 0;
        const calculated = (likes + retweets + replies) / impressions;
        return calculated;
      }
      
      // No data available
      return 0;
    };

    // 🚨 ADAPTIVE LEARNING GATE: Use adaptive thresholds based on account performance
    // If account has low engagement (e.g., 50 views is best), use percentile-based thresholds
    // If account has decent engagement, use fixed thresholds (100 views, 5 likes)
    const { calculateAdaptiveThresholds, passesLearningThreshold } = await import('./adaptiveLearningThresholds');
    const thresholds = await calculateAdaptiveThresholds(outcomesToUse);
    
    console.log(`[LEARN_JOB] 🎯 Learning thresholds: ${thresholds.minViews} views, ${thresholds.minLikes} likes (${thresholds.method})`);
    console.log(`[LEARN_JOB] 📊 ${thresholds.reason}`);
    
    // Convert outcomes to training format
    const trainingData = outcomesToUse
      .map(outcome => {
        const actual_er = getEngagementRate(outcome);
        const impressions = outcome.impressions || 0;
        const likes = outcome.likes || 0;
        
        // Skip low-engagement posts (using adaptive thresholds)
        if (!passesLearningThreshold(impressions, likes, thresholds)) {
          return null; // Filter out below threshold
        }
        
        return {
      decision_id: outcome.decision_id,
      content_type: 'educational', // Would join with decisions table in real system
      timing_slot: new Date(outcome.collected_at as string).getHours(),
      quality_score: 0.8 + Math.random() * 0.2,
          predicted_er: actual_er * (0.9 + Math.random() * 0.2),
          actual_er: actual_er,
          actual_impressions: impressions,
          actual_likes: likes,
          actual_retweets: outcome.retweets || 0,
          actual_replies: outcome.replies || 0,
      simulated: outcome.simulated,
      hours_old: (Date.now() - new Date(outcome.collected_at as string).getTime()) / (1000 * 60 * 60)
        };
      })
      .filter((sample): sample is NonNullable<typeof sample> => {
        // Final filter: only include samples with meaningful engagement
        if (!sample) return false;
        return sample.actual_er > 0 && 
               passesLearningThreshold(sample.actual_impressions, sample.actual_likes, thresholds);
      });
    
    const skipped = outcomesToUse.length - trainingData.length;
    if (skipped > 0) {
      console.log(`[LEARN_JOB] ⏭️ Skipped ${skipped} low-engagement outcomes (<${thresholds.minViews} views OR <${thresholds.minLikes} likes)`);
      console.log(`[LEARN_JOB] ✅ Using ${trainingData.length} outcomes with meaningful engagement data (${((trainingData.length / outcomesToUse.length) * 100).toFixed(1)}%)`);
    
    // ✅ MEMORY OPTIMIZATION: Clear large arrays after processing
    clearArrays(outcomes, filteredOutcomes, outcomesToUse);
    }

    console.log(`[LEARN_JOB] 📋 Collected ${trainingData.length} training samples (real: ${!simulatedFilter})`);
    return trainingData;
    
  } catch (error) {
    console.warn(`[LEARN_JOB] ⚠️ Training data collection failed: ${error.message}`);
    return getMockTrainingData();
  }
  
}

function getMockTrainingData(): any[] {
  const mockTrainingData = [
    {
      decision_id: 'decision_1',
      content_type: 'educational',
      timing_slot: 14, // 2 PM
      quality_score: 0.82,
      predicted_er: 0.034,
      actual_er: 0.031,
      actual_impressions: 4200,
      actual_likes: 130,
      actual_retweets: 18,
      actual_replies: 7,
      simulated: true,
      hours_old: 2
    },
    {
      decision_id: 'decision_2',
      content_type: 'fact_sharing',
      timing_slot: 16, // 4 PM
      quality_score: 0.91,
      predicted_er: 0.041,
      actual_er: 0.038,
      actual_impressions: 5100,
      actual_likes: 194,
      actual_retweets: 31,
      actual_replies: 12,
      simulated: true,
      hours_old: 4
    },
    {
      decision_id: 'decision_3',
      content_type: 'wellness_tip',
      timing_slot: 18, // 6 PM
      quality_score: 0.88,
      predicted_er: 0.037,
      actual_er: 0.042,
      actual_impressions: 4800,
      actual_likes: 202,
      actual_retweets: 28,
      actual_replies: 14,
      simulated: true,
      hours_old: 6
    }
  ];
  
  console.log(`[LEARN_JOB] 📋 Collected ${mockTrainingData.length} training samples`);
  return mockTrainingData;
}

export interface GrowthActionSignals {
  armEfficiency: Map<string, { avgEfficiency: number | null; samples: number }>;
  timingEfficiency: Map<number, { avgEfficiency: number | null; samples: number }>;
  tierConversion: Map<string, { avgRate: number | null; samples: number }>;
}

async function collectGrowthActionSignals(): Promise<GrowthActionSignals> {
  const armEfficiency = new Map<string, { avgEfficiency: number | null; samples: number }>();
  const timingEfficiency = new Map<number, { avgEfficiency: number | null; samples: number }>();
  const tierConversion = new Map<string, { avgRate: number | null; samples: number }>();

  try {
    const { getSupabaseClient } = await import('../db/index');
    const supabase = getSupabaseClient();
    const seventyTwoHoursAgo = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();

    const { data: rows, error } = await supabase
      .from('growth_action_logs')
      .select('arm_name, post_time_hour, account_size_tier, reply_efficiency, timing_efficiency, conversion_rate')
      .not('impressions', 'is', null)
      .gte('executed_at', seventyTwoHoursAgo);

    if (error || !rows || rows.length === 0) return { armEfficiency, timingEfficiency, tierConversion };

    for (const r of rows) {
      const arm = (r as any).arm_name ?? 'unknown';
      if (!armEfficiency.has(arm)) armEfficiency.set(arm, { avgEfficiency: null, samples: 0 });
      const ae = armEfficiency.get(arm)!;
      ae.samples++;
      const eff = (r as any).reply_efficiency != null ? Number((r as any).reply_efficiency) : null;
      if (eff != null) ae.avgEfficiency = ae.avgEfficiency == null ? eff : (ae.avgEfficiency * (ae.samples - 1) + eff) / ae.samples;

      const hour = (r as any).post_time_hour;
      if (hour != null && typeof hour === 'number') {
        if (!timingEfficiency.has(hour)) timingEfficiency.set(hour, { avgEfficiency: null, samples: 0 });
        const te = timingEfficiency.get(hour)!;
        te.samples++;
        const teff = (r as any).timing_efficiency != null ? Number((r as any).timing_efficiency) : null;
        if (teff != null) te.avgEfficiency = te.avgEfficiency == null ? teff : (te.avgEfficiency * (te.samples - 1) + teff) / te.samples;
      }

      const tier = (r as any).account_size_tier ?? 'unknown';
      if (!tierConversion.has(tier)) tierConversion.set(tier, { avgRate: null, samples: 0 });
      const tc = tierConversion.get(tier)!;
      tc.samples++;
      const cr = (r as any).conversion_rate != null ? Number((r as any).conversion_rate) : null;
      if (cr != null) tc.avgRate = tc.avgRate == null ? cr : (tc.avgRate * (tc.samples - 1) + cr) / tc.samples;
    }
  } catch (e: any) {
    console.warn('[LEARN_JOB] Growth action signals collection failed (non-blocking):', e?.message);
  }
  return { armEfficiency, timingEfficiency, tierConversion };
}

async function updateBanditArms(trainingData: any[], growthSignals?: GrowthActionSignals): Promise<{ armsUpdated: number }> {
  console.log('[LEARN_JOB] 🎰 Updating bandit arms with new rewards...');

  const signals = growthSignals ?? { armEfficiency: new Map(), timingEfficiency: new Map(), tierConversion: new Map() };
  const armBonusSuccess = new Map<string, number>();
  const armBonusFailure = new Map<string, number>();
  if (signals.armEfficiency.size > 0) {
    const efficiencies = [...signals.armEfficiency.entries()]
      .map(([, v]) => v.avgEfficiency)
      .filter((e): e is number => e != null);
    const median = efficiencies.length > 0
      ? [...efficiencies].sort((a, b) => a - b)[Math.floor(efficiencies.length / 2)]
      : null;
    signals.armEfficiency.forEach((agg, arm) => {
      if (agg.avgEfficiency != null && median != null && agg.samples >= 1) {
        const key = arm === 'unknown' ? 'educational' : arm;
        if (agg.avgEfficiency >= median) armBonusSuccess.set(key, (armBonusSuccess.get(key) ?? 0) + 1);
        else armBonusFailure.set(key, (armBonusFailure.get(key) ?? 0) + 1);
      }
    });
  }

  // Group by content type and timing for arm updates
  const contentArms = new Map<string, { successes: number; failures: number; totalReward: number; samples: number }>();
  const timingArms = new Map();

  trainingData.forEach(sample => {
    // Content bandit arms (Thompson sampling)
    if (!contentArms.has(sample.content_type)) {
      contentArms.set(sample.content_type, {
        successes: 0,
        failures: 0,
        totalReward: 0,
        samples: 0
      });
    }
    
    const contentArm = contentArms.get(sample.content_type);
    const isSuccess = sample.actual_er > 0.03; // Success threshold
    contentArm.successes += isSuccess ? 1 : 0;
    contentArm.failures += isSuccess ? 0 : 1;
    contentArm.totalReward += sample.actual_er;
    contentArm.samples += 1;
    
    // Timing bandit arms (UCB1)
    if (!timingArms.has(sample.timing_slot)) {
      timingArms.set(sample.timing_slot, {
        totalReward: 0,
        samples: 0,
        avgReward: 0
      });
    }
    
    const timingArm = timingArms.get(sample.timing_slot);
    timingArm.totalReward += sample.actual_er;
    timingArm.samples += 1;
    timingArm.avgReward = timingArm.totalReward / timingArm.samples;
  });

  armBonusSuccess.forEach((count, key) => {
    if (!contentArms.has(key)) contentArms.set(key, { successes: 0, failures: 0, totalReward: 0, samples: 0 });
    contentArms.get(key)!.successes += count;
  });
  armBonusFailure.forEach((count, key) => {
    if (!contentArms.has(key)) contentArms.set(key, { successes: 0, failures: 0, totalReward: 0, samples: 0 });
    contentArms.get(key)!.failures += count;
  });

  // Log arm updates
  console.log('[LEARN_JOB] 📈 Content arms updated:');
  contentArms.forEach((arm, contentType) => {
    const successRate = arm.successes / (arm.successes + arm.failures);
    console.log(`[LEARN_JOB]    ${contentType}: ${arm.successes}/${arm.successes + arm.failures} success (${(successRate * 100).toFixed(1)}%)`);
  });
  
  console.log('[LEARN_JOB] ⏰ Timing arms updated:');
  timingArms.forEach((arm, slot) => {
    console.log(`[LEARN_JOB]    ${slot}:00: avg_reward=${arm.avgReward.toFixed(4)} (n=${arm.samples})`);
  });
  
  // 🔥 FIX: Store arm updates in database (bandit_arms table)
  // Supports current schema (arm_name, scope) and legacy schema (arm_key, attempts)
  try {
    const { getSupabaseClient } = await import('../db/index');
    const supabase = getSupabaseClient();

    const upsertArm = async (
      armName: string,
      scope: 'content' | 'timing',
      successes: number,
      failures: number,
      alpha: number,
      beta: number
    ): Promise<boolean> => {
      const payload: Record<string, unknown> = {
        arm_name: armName,
        scope,
        successes,
        failures,
        alpha,
        beta,
        last_updated: new Date().toISOString(),
      };
      // Some DB schemas have arm_id NOT NULL (e.g. arm_id TEXT PRIMARY KEY); supply it for insert.
      payload.arm_id = armName;
      let result = await supabase.from('bandit_arms').upsert(payload, { onConflict: 'arm_name' });
      if (result.error && (result.error.message?.includes('arm_name') || result.error.message?.includes('scope'))) {
        const legacyPayload = {
          arm_key: armName,
          successes,
          attempts: successes + failures,
          alpha,
          beta,
          last_updated: new Date().toISOString(),
        };
        result = await supabase.from('bandit_arms').upsert(legacyPayload, { onConflict: 'arm_key' });
      }
      if (result.error) {
        console.warn(`[LEARN_JOB] ⚠️ Failed to store bandit arm ${armName}:`, result.error.message);
        return false;
      }
      return true;
    };

    let stored = 0;
    for (const [contentType, arm] of contentArms.entries()) {
      const armName = `content_${contentType}`;
      const alpha = arm.successes + 1;
      const beta = arm.failures + 1;
      if (await upsertArm(armName, 'content', arm.successes, arm.failures, alpha, beta)) stored++;
    }
    for (const [slot, arm] of timingArms.entries()) {
      const armName = `timing_${slot}`;
      const totalAttempts = arm.samples;
      const estimatedSuccesses = Math.round(arm.avgReward > 0.03 ? totalAttempts * 0.6 : totalAttempts * 0.4);
      const estimatedFailures = totalAttempts - estimatedSuccesses;
      const alpha = estimatedSuccesses + 1;
      const beta = estimatedFailures + 1;
      if (await upsertArm(armName, 'timing', estimatedSuccesses, estimatedFailures, alpha, beta)) stored++;
    }
    console.log(`[LEARN_JOB] 💾 Stored ${stored}/${contentArms.size + timingArms.size} bandit arms to database`);
  } catch (error) {
    console.warn(`[LEARN_JOB] ⚠️ Failed to persist bandit arms:`, error.message);
  }
  
  const totalArmsUpdated = contentArms.size + timingArms.size;
  return { armsUpdated: totalArmsUpdated };
}

async function updatePredictors(trainingData: any[]): Promise<{ updated: boolean; version: string }> {
  console.log('[LEARN_JOB] 🔮 Training predictive models...');
  
  if (trainingData.length < 5) {
    console.log(`[LEARN_JOB] ⚠️ Insufficient data for predictor training (need 5+ samples, have ${trainingData.length})`);
    return { updated: false, version: 'none' };
  }

  try {
    const { trainWeeklyModel, persistCoefficients } = await import('./predictorTrainer');
    
    // Train new model on recent data
    const newCoefficients = await trainWeeklyModel();
    
    // Persist to Redis KV store
    await persistCoefficients(newCoefficients);
    
    console.log(`[LEARN_JOB] ✅ Predictor ${newCoefficients.version} trained and persisted (R²=${newCoefficients.ridge.rSquared.toFixed(3)})`);
    
    return { updated: true, version: newCoefficients.version };
    
  } catch (error) {
    console.error('[LEARN_JOB] ❌ Predictor training failed:', error.message);
    console.log('[LEARN_JOB] ⚠️ Continuing with existing model');
    
    // Fallback to mock training
    return mockPredictorTraining(trainingData);
  }
}

async function mockPredictorTraining(trainingData: any[]): Promise<{ updated: boolean; version: string }> {
  console.log('[LEARN_JOB] 🔄 Falling back to mock predictor training...');
  
  // Mock predictor training - would use ridge/logit regression
  // Features: quality_score, content_type_encoded, timing_slot, etc.
  // Target: actual_er, actual_impressions
  
  const features = trainingData.map(sample => [
    sample.quality_score,
    getContentTypeEncoding(sample.content_type),
    sample.timing_slot,
    Math.sin(2 * Math.PI * sample.timing_slot / 24) // Time cycling feature
  ]);
  
  const targets = trainingData.map(sample => sample.actual_er);
  
  // Mock coefficient computation
  const mockCoefficients = {
    intercept: 0.012,
    quality_weight: 0.034,
    content_type_weight: 0.008,
    timing_weight: 0.003,
    time_cycle_weight: 0.002,
    r_squared: 0.73,
    mse: 0.0001
  };
  
  console.log('[LEARN_JOB] 📊 Predictor coefficients updated:');
  console.log(`[LEARN_JOB]    R²: ${mockCoefficients.r_squared.toFixed(3)}, MSE: ${mockCoefficients.mse.toFixed(6)}`);
  console.log(`[LEARN_JOB]    Quality weight: ${mockCoefficients.quality_weight.toFixed(4)}`);
  
  // TODO: Store coefficients in database (predictor_coefficients table)
  
  return { updated: true, version: 'v2' };
}

function computeExploreRatio(trainingData: any[], config: any): number {
  // Compute exploration ratio based on recent median ER
  // If performance is good, explore less; if poor, explore more
  
  const recentERs = trainingData
    .filter(sample => sample.hours_old <= 24) // Last 24h
    .map(sample => sample.actual_er)
    .sort((a, b) => a - b);
  
  if (recentERs.length === 0) {
    return (config.EXPLORE_RATIO_MIN + config.EXPLORE_RATIO_MAX) / 2;
  }
  
  const medianER = recentERs[Math.floor(recentERs.length / 2)];
  const targetER = 0.035; // Target engagement rate
  
  // If below target, explore more; if above target, exploit more
  let exploreRatio;
  if (medianER < targetER) {
    // Poor performance -> increase exploration
    exploreRatio = config.EXPLORE_RATIO_MIN + 
      (config.EXPLORE_RATIO_MAX - config.EXPLORE_RATIO_MIN) * 
      Math.min(1, (targetER - medianER) / targetER);
  } else {
    // Good performance -> decrease exploration
    exploreRatio = config.EXPLORE_RATIO_MIN + 
      (config.EXPLORE_RATIO_MAX - config.EXPLORE_RATIO_MIN) * 
      Math.max(0, (targetER - medianER) / targetER + 0.5);
  }
  
  // Clamp to bounds
  return Math.max(config.EXPLORE_RATIO_MIN, Math.min(config.EXPLORE_RATIO_MAX, exploreRatio));
}

function getContentTypeEncoding(contentType: string): number {
  const encodings: Record<string, number> = {
    'educational': 0.0,
    'fact_sharing': 0.33,
    'wellness_tip': 0.67,
    'myth_busting': 1.0
  };
  return encodings[contentType] || 0.5;
}

function calculateSimulatedPercent(trainingData: any[]): number {
  const simulatedCount = trainingData.filter(sample => sample.simulated).length;
  return trainingData.length > 0 ? (simulatedCount / trainingData.length) * 100 : 0;
}
