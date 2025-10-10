/**
 * 🎯 DYNAMIC RATE API ENDPOINTS
 * 
 * Provides API access to dynamic rate controller status and controls
 */

import { Router } from 'express';
import { DynamicRateController } from '../ai/dynamicRateController';
import { getDynamicRateStatus } from '../jobs/dynamicRateJob';

const router = Router();

/**
 * GET /api/dynamic-rates/status
 * Get current dynamic rate status and recent decisions
 */
router.get('/status', async (req, res) => {
  try {
    const rateController = DynamicRateController.getInstance();
    
    // Get comprehensive status
    const [currentStatus, history] = await Promise.all([
      getDynamicRateStatus(),
      rateController.getRateHistory()
    ]);

    const response = {
      current_rates: currentStatus.current_rates,
      last_adjustment: currentStatus.last_adjustment,
      performance_trend: currentStatus.performance_trend,
      recent_reasoning: currentStatus.recent_reasoning,
      recent_adjustments: history.recent_adjustments.slice(0, 5), // Last 5 adjustments
      system_info: {
        min_rates: { posts_per_hour: 1, replies_per_hour: 2 },
        max_rates: { posts_per_hour: 4, replies_per_hour: 6 },
        learning_window_hours: 24,
        adjustment_interval_hours: 2
      }
    };

    res.json(response);

  } catch (error: any) {
    console.error('❌ DYNAMIC_RATE_API: Status request failed:', error.message);
    res.status(500).json({
      error: 'Failed to get dynamic rate status',
      message: error.message
    });
  }
});

/**
 * POST /api/dynamic-rates/analyze
 * Force immediate analysis and rate recommendation (without applying)
 */
router.post('/analyze', async (req, res) => {
  try {
    const rateController = DynamicRateController.getInstance();
    const recommendation = await rateController.getOptimalRates();

    res.json({
      recommendation,
      current_rates: await getCurrentRatesFromEnv(),
      would_change: recommendation.posts_per_hour !== parseInt(process.env.MAX_POSTS_PER_HOUR || '2') ||
                   recommendation.replies_per_hour !== Math.ceil(parseInt(process.env.REPLY_MAX_PER_DAY || '72') / 24)
    });

  } catch (error: any) {
    console.error('❌ DYNAMIC_RATE_API: Analysis request failed:', error.message);
    res.status(500).json({
      error: 'Failed to analyze optimal rates',
      message: error.message
    });
  }
});

/**
 * POST /api/dynamic-rates/apply
 * Force immediate rate adjustment based on current performance
 */
router.post('/apply', async (req, res) => {
  try {
    const rateController = DynamicRateController.getInstance();
    const result = await rateController.applyDynamicRates();

    res.json({
      applied: result.applied,
      new_rates: {
        posts_per_hour: result.posts_per_hour,
        replies_per_hour: result.replies_per_hour
      },
      reasoning: result.reasoning,
      message: result.applied 
        ? `Rates updated to ${result.posts_per_hour}p/h, ${result.replies_per_hour}r/h`
        : 'No rate changes applied'
    });

  } catch (error: any) {
    console.error('❌ DYNAMIC_RATE_API: Apply request failed:', error.message);
    res.status(500).json({
      error: 'Failed to apply dynamic rates',
      message: error.message
    });
  }
});

/**
 * GET /api/dynamic-rates/performance
 * Get detailed performance metrics used for rate decisions
 */
router.get('/performance', async (req, res) => {
  try {
    const rateController = DynamicRateController.getInstance();
    
    // This is a bit of a hack to access private methods, but for API purposes it's useful
    const metrics = await (rateController as any).gatherPerformanceMetrics();
    
    res.json({
      metrics,
      interpretation: {
        engagement_quality: metrics.avg_engagement_rate > 0.03 ? 'high' : 
                           metrics.avg_engagement_rate > 0.02 ? 'medium' : 'low',
        follower_growth: metrics.follower_growth_rate > 1.0 ? 'excellent' :
                        metrics.follower_growth_rate > 0.5 ? 'good' : 'needs_improvement',
        content_saturation: metrics.content_saturation_score > 0.7 ? 'high' :
                           metrics.content_saturation_score > 0.4 ? 'medium' : 'low',
        audience_fatigue: metrics.audience_fatigue_indicator > 0.6 ? 'high' :
                         metrics.audience_fatigue_indicator > 0.3 ? 'medium' : 'low'
      }
    });

  } catch (error: any) {
    console.error('❌ DYNAMIC_RATE_API: Performance request failed:', error.message);
    res.status(500).json({
      error: 'Failed to get performance metrics',
      message: error.message
    });
  }
});

/**
 * Helper function to get current rates from environment
 */
async function getCurrentRatesFromEnv(): Promise<{ posts_per_hour: number; replies_per_hour: number }> {
  return {
    posts_per_hour: parseInt(process.env.MAX_POSTS_PER_HOUR || '2', 10),
    replies_per_hour: Math.ceil(parseInt(process.env.REPLY_MAX_PER_DAY || '72', 10) / 24)
  };
}

export default router;
