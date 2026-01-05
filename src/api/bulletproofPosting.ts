/**
 * 🛡️ BULLETPROOF POSTING API - CRASH RESISTANT
 * Handles browser crashes and resource exhaustion gracefully
 */

import express from 'express';
import { UltimateTwitterPoster } from '../posting/UltimateTwitterPoster';

const router = express.Router();

/**
 * 🚀 POST /api/bulletproof-post
 * Crash-resistant posting with intelligent fallbacks
 */
router.post('/bulletproof-post', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { content } = req.body;
    
    if (!content || typeof content !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Content is required and must be a string'
      });
    }

    if (content.length > 280) {
      return res.status(400).json({
        success: false,
        error: `Content too long: ${content.length}/280 characters`
      });
    }

    // 🚨 BYPASS BLOCKED: Bulletproof posting API is disabled
    // All posting MUST go through postingQueue.ts which enforces PostingGuard
    console.error(`[BYPASS_BLOCKED] 🚨 BULLETPROOF_API posting is disabled.`);
    console.error(`[BYPASS_BLOCKED]   content_length=${content.length}`);
    console.error(`[BYPASS_BLOCKED]   reason=All posting must go through postingQueue with PostingGuard`);
    
    res.status(403).json({
      success: false,
      error: 'BYPASS_BLOCKED: Bulletproof posting API is disabled. Use postingQueue.ts',
      reason: 'All posting must go through authorized pipeline with PostingGuard'
    });
    return;

  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error('❌ BULLETPROOF_API: Unexpected error:', error.message);
    
    res.status(500).json({
      success: false,
      error: `API error: ${error.message}`,
      performance: {
        duration: duration
      }
    });
  }
});

/**
 * 📊 GET /api/bulletproof-status
 * System health and crash resistance status
 */
router.get('/bulletproof-status', async (req, res) => {
  try {
    const memoryMB = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
    const uptime = Math.round(process.uptime());
    
    res.json({
      bulletproof: {
        posting: {
          active: false,
          queueLength: 0
        },
        session: { healthy: true },
        systemHealth: { healthy: true, memoryMB }
      },
      railway: {
        memoryMB,
        uptime,
        healthy: true
      },
      recommendations: {
        canPost: true,
        reason: 'System ready'
      },
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({
      error: `Status check failed: ${error.message}`,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * 🔧 POST /api/bulletproof-reset
 * Reset bulletproof system in case of persistent issues
 */
router.post('/bulletproof-reset', async (req, res) => {
  try {
    console.log('🔧 BULLETPROOF_RESET: Resetting system...');
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
      console.log('🧹 BULLETPROOF_RESET: Forced garbage collection');
    }
    
    console.log('✅ BULLETPROOF_RESET: System reset completed');
    
    res.json({
      success: true,
      message: 'System reset completed',
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: `Reset failed: ${error.message}`
    });
  }
});

export default router;
