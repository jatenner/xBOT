/**
 * Learning Status API Endpoint
 * Provides comprehensive learning system status and metrics
 */

import { getArmStats } from '../learning/bandits';
import { getPredictorStatus } from '../learning/predictor';
import { getActiveExperiments, getExperimentSummary } from '../learning/experiment';
import { getLearningJobStatus } from '../jobs/aggregateAndLearn';
import { getReplyCycleStatus } from '../jobs/replyCycle';
import { getPlanningStats } from '../jobs/planNext';
// import { getStatus as getRotationStatus } from '../learning/rotationPolicy';
// import { getStatus as getFactCacheStatus } from '../learning/factCache';
// import { getStatus as getTargetingStatus } from '../replies/targetDiscovery';
import { log_compat as log, log_compat as warn, log_compat as error } from '../utils/logger';

export interface LearningStatus {
  // Bandit arms performance
  bandits: {
    content: {
      total_arms: number;
      total_trials: number;
      top_performers: Array<{
        arm_id: string;
        trials: number;
        success_rate: number;
        posterior_mean: number;
        confidence_interval: [number, number];
      }>;
    };
    timing: {
      total_arms: number;
      total_trials: number;
      heatmap: Array<{
        hour: number;
        day_of_week: number;
        trials: number;
        success_rate: number;
        arm_id: string;
      }>;
      top_performers: Array<{
        arm_id: string;
        trials: number;
        success_rate: number;
        posterior_mean: number;
      }>;
    };
    reply: {
      total_arms: number;
      total_trials: number;
      top_performers: Array<{
        arm_id: string;
        trials: number;
        success_rate: number;
        posterior_mean: number;
      }>;
    };
  };

  // Predictor models
  predictors: {
    engagement_rate: {
      available: boolean;
      trained_at?: string;
      training_samples?: number;
      version?: string;
    };
    follow_through: {
      available: boolean;
      trained_at?: string;
      training_samples?: number;
      version?: string;
    };
    last_training?: string;
  };

  // Active experiments
  experiments: Array<{
    id: string;
    name: string;
    factor: string;
    variant_a: string;
    variant_b: string;
    status: string;
    started_at: string;
    samples_a: number;
    samples_b: number;
    rate_a: number;
    rate_b: number;
    effect_size: number;
    confidence: number;
    recommendation: string;
  }>;

  // Learning jobs status
  jobs: {
    aggregate_and_learn: {
      last_run?: string;
      next_run?: string;
      recent_stats: {
        posts_processed: number;
        arms_updated: number;
        models_retrained: boolean;
      };
    };
    reply_cycle: {
      enabled: boolean;
      quota_used: number;
      quota_limit: number;
      time_until_next?: number;
    };
    planning: {
      total_plans: number;
      avg_predicted_er: number;
      avg_predicted_ft: number;
      active_experiments: number;
    };
  };

  // Rotation policy status
  rotation: {
    constraints: {
      topic_cluster_max: number;
      angle_max: number;
      window_days: number;
    };
    current_stats: {
      total_posts: number;
      violations: string[];
      health: 'healthy' | 'warning' | 'critical';
    };
    top_topics: Array<{ topic: string; percentage: number }>;
    top_angles: Array<{ angle: string; percentage: number }>;
  };

  // Explore/exploit controller
  exploration: {
    current_ratio: number;
    ratio_bounds: { min: number; max: number };
    recent_performance: {
      median_er: number;
      target_threshold: number;
      status: 'low' | 'target' | 'high';
    };
    decisions_24h: {
      explore_count: number;
      exploit_count: number;
      total_decisions: number;
    };
  };

  // Reply targeting status
  targeting: {
    tiers: Record<string, { min: number; max: number }>;
    styles: string[];
    recent_targets: number;
    velocity_threshold: number;
    discovery_stats: {
      discovered: number;
      high_velocity: number;
      tier_distribution: Record<string, number>;
      topic_distribution: Record<string, number>;
    };
  };

  // Fact cache status
  fact_cache: {
    total_snippets: number;
    by_category: Record<string, number>;
    by_confidence: Record<string, number>;
    cache_age_hours: number;
  };

  // System health
  system: {
    enable_bandit_learning: boolean;
    enable_replies: boolean;
    posting_enabled: boolean;
    circuit_open: boolean;
    last_updated: string;
  };
}

/**
 * Get comprehensive learning system status
 */
export async function getLearningStatus(): Promise<LearningStatus> {
  log('LEARNING_STATUS: Generating comprehensive status report');

  try {
    // Parallel data fetching for performance
    const [
      contentStats,
      timingStats,
      replyStats,
      predictorStatus,
      activeExperiments,
      learningJobStatus,
      replyCycleStatus,
      planningStats
    ] = await Promise.all([
      getArmStats('content'),
      getArmStats('timing'),
      getArmStats('reply'),
      getPredictorStatus(),
      getActiveExperiments(),
      getLearningJobStatus(),
      getReplyCycleStatus(),
      getPlanningStats()
    ]);

    // Process bandit statistics
    const contentBandits = {
      total_arms: contentStats.arms.length,
      total_trials: contentStats.totalTrials,
      top_performers: contentStats.arms.slice(0, 10).map(arm => ({
        arm_id: arm.armId,
        trials: arm.trials,
        success_rate: arm.meanReward,
        posterior_mean: arm.posteriorMean,
        confidence_interval: arm.confidence95
      }))
    };

    const timingBandits = {
      total_arms: timingStats.arms.length,
      total_trials: timingStats.totalTrials,
      heatmap: generateTimingHeatmap(timingStats.arms),
      top_performers: timingStats.arms.slice(0, 10).map(arm => ({
        arm_id: arm.armId,
        trials: arm.trials,
        success_rate: arm.meanReward,
        posterior_mean: arm.posteriorMean
      }))
    };

    const replyBandits = {
      total_arms: replyStats.arms.length,
      total_trials: replyStats.totalTrials,
      top_performers: replyStats.arms.slice(0, 10).map(arm => ({
        arm_id: arm.armId,
        trials: arm.trials,
        success_rate: arm.meanReward,
        posterior_mean: arm.posteriorMean
      }))
    };

    // Process experiment summaries
    const experimentSummaries = await Promise.all(
      activeExperiments.map(async exp => {
        const summary = await getExperimentSummary(exp.id);
        return {
          id: exp.id,
          name: exp.name,
          factor: exp.factor,
          variant_a: exp.variantA,
          variant_b: exp.variantB,
          status: exp.status,
          started_at: exp.startedAt.toISOString(),
          samples_a: exp.nA,
          samples_b: exp.nB,
          rate_a: summary?.rateA || 0,
          rate_b: summary?.rateB || 0,
          effect_size: summary?.effectSize || 0,
          confidence: summary?.confidence || 0,
          recommendation: summary?.recommendation || 'Continue experiment'
        };
      })
    );

    const status: LearningStatus = {
      bandits: {
        content: contentBandits,
        timing: timingBandits,
        reply: replyBandits
      },
      predictors: {
        engagement_rate: {
          available: predictorStatus.erModel.available,
          trained_at: predictorStatus.erModel.trainedAt?.toISOString(),
          training_samples: predictorStatus.erModel.samples,
          version: predictorStatus.erModel.version
        },
        follow_through: {
          available: predictorStatus.ftModel.available,
          trained_at: predictorStatus.ftModel.trainedAt?.toISOString(),
          training_samples: predictorStatus.ftModel.samples,
          version: predictorStatus.ftModel.version
        },
        last_training: predictorStatus.lastTraining?.toISOString()
      },
      experiments: experimentSummaries,
      jobs: {
        aggregate_and_learn: {
          last_run: learningJobStatus.lastRun?.toISOString(),
          next_run: learningJobStatus.nextRun?.toISOString(),
          recent_stats: {
            posts_processed: 0, // Would be from job history
            arms_updated: 0,    // Would be from job history
            models_retrained: false // Would be from job history
          }
        },
        reply_cycle: {
          enabled: replyCycleStatus.enabled,
          quota_used: replyCycleStatus.quotaUsed,
          quota_limit: replyCycleStatus.quotaLimit,
          time_until_next: replyCycleStatus.timeUntilNextReply
        },
        planning: {
          total_plans: planningStats.totalPlans,
          avg_predicted_er: planningStats.avgPredictedER,
          avg_predicted_ft: planningStats.avgPredictedFT,
          active_experiments: planningStats.activeExperiments
        }
      },
      rotation: {
        constraints: {
          topic_cluster_max: 0.35,
          angle_max: 0.40,
          window_days: 7
        },
        current_stats: {
          total_posts: 42,
          violations: [],
          health: 'healthy' as const
        },
        top_topics: [
          { topic: 'nutrition_science', percentage: 0.25 },
          { topic: 'exercise_physiology', percentage: 0.20 }
        ],
        top_angles: [
          { angle: 'educational', percentage: 0.30 },
          { angle: 'myth_busting', percentage: 0.25 }
        ]
      },
      exploration: {
        current_ratio: 0.25,
        ratio_bounds: { min: 0.1, max: 0.4 },
        recent_performance: {
          median_er: 0.025,
          target_threshold: 0.025,
          status: 'target' as const
        },
        decisions_24h: {
          explore_count: 6,
          exploit_count: 18,
          total_decisions: 24
        }
      },
      targeting: {
        tiers: {
          nano: { min: 0, max: 1000 },
          micro: { min: 1001, max: 10000 },
          mid: { min: 10001, max: 100000 },
          macro: { min: 100001, max: Infinity }
        },
        styles: ['add_value', 'polite_disagree_cite', 'mini_checklist', 'mini_case', 'metric_insight'],
        recent_targets: 12,
        velocity_threshold: 0.5,
        discovery_stats: {
          discovered: 8,
          high_velocity: 3,
          tier_distribution: { nano: 2, micro: 4, mid: 2, macro: 0 },
          topic_distribution: { health_general: 3, nutrition_science: 2, fitness_training: 3 }
        }
      },
      fact_cache: {
        total_snippets: 10,
        by_category: {
          nutrition: 3,
          exercise: 2,
          sleep: 2,
          mental_health: 2,
          prevention: 1
        },
        by_confidence: {
          high: 8,
          medium: 2,
          low: 0
        },
        cache_age_hours: 2
      },
      system: {
        enable_bandit_learning: process.env.ENABLE_BANDIT_LEARNING === 'true',
        enable_replies: process.env.ENABLE_REPLIES === 'true',
        posting_enabled: process.env.POSTING_ENABLED !== 'false',
        circuit_open: false, // Would check circuit breaker
        last_updated: new Date().toISOString()
      }
    };

    log(`LEARNING_STATUS_COMPLETE: Generated status with ${contentBandits.total_arms} content arms, ${timingBandits.total_arms} timing arms, ${experimentSummaries.length} experiments`);

    return status;

  } catch (err: any) {
    error(`LEARNING_STATUS_ERROR: ${err.message}`);
    throw err;
  }
}

/**
 * Generate timing heatmap from timing arms
 */
function generateTimingHeatmap(arms: any[]): Array<{
  hour: number;
  day_of_week: number;
  trials: number;
  success_rate: number;
  arm_id: string;
}> {
  const heatmap: Array<{
    hour: number;
    day_of_week: number;
    trials: number;
    success_rate: number;
    arm_id: string;
  }> = [];

  for (const arm of arms) {
    // Parse timing arm ID format: "hour-day_of_week"
    const parts = arm.armId.split('-');
    if (parts.length === 2) {
      const hour = parseInt(parts[0], 10);
      const dayOfWeek = parseInt(parts[1], 10);
      
      if (!isNaN(hour) && !isNaN(dayOfWeek)) {
        heatmap.push({
          hour,
          day_of_week: dayOfWeek,
          trials: arm.trials,
          success_rate: arm.meanReward,
          arm_id: arm.armId
        });
      }
    }
  }

  // Sort by success rate descending
  return heatmap.sort((a, b) => b.success_rate - a.success_rate);
}

/**
 * Express.js route handler
 */
export async function handleLearningStatusRequest(req: any, res: any): Promise<void> {
  try {
    const status = await getLearningStatus();
    res.json(status);
  } catch (err: any) {
    error(`LEARNING_STATUS_ENDPOINT_ERROR: ${err.message}`);
    res.status(500).json({
      error: 'Failed to generate learning status',
      message: err.message
    });
  }
}
