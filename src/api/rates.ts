/**
 * 🎯 SIMPLIFIED DYNAMIC RATES API
 * 
 * Simple API endpoints for the lightweight dynamic rate system
 */

import { Router } from 'express';
import { SimplifiedDynamicRates } from '../ai/simplifiedDynamicRates';

const router = Router();

/**
 * GET /api/rates/status
 * Get current rate status
 */
router.get('/status', async (req, res) => {
  try {
    const rateController = SimplifiedDynamicRates.getInstance();
    const status = rateController.getCurrentStatus();
    
    res.json({
      success: true,
      ...status,
      message: 'Simplified dynamic rates active'
    });

  } catch (error: any) {
    console.error('❌ RATES_API: Status failed:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/rates/analyze
 * Get rate recommendations
 */
router.post('/analyze', async (req, res) => {
  try {
    const rateController = SimplifiedDynamicRates.getInstance();
    const recommendation = await rateController.getRecommendedRates();
    
    res.json({
      success: true,
      recommendation,
      current_rates: {
        posts_per_hour: parseInt(process.env.MAX_POSTS_PER_HOUR || '1', 10),
        replies_per_hour: Math.ceil(parseInt(process.env.REPLY_MAX_PER_DAY || '72', 10) / 24)
      }
    });

  } catch (error: any) {
    console.error('❌ RATES_API: Analysis failed:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/rates/apply
 * Apply recommended rates
 */
router.post('/apply', async (req, res) => {
  try {
    const rateController = SimplifiedDynamicRates.getInstance();
    const result = await rateController.applyRecommendedRates();
    
    res.json({
      success: result.applied,
      ...result
    });

  } catch (error: any) {
    console.error('❌ RATES_API: Apply failed:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
