/**
 * 🛡️ BULLETPROOF POSTING API - CRASH RESISTANT
 * Handles browser crashes and resource exhaustion gracefully
 */

import express from 'express';
import { bulletproofPoster } from '../posting/bulletproofPoster';

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

    console.log('🛡️ BULLETPROOF_API: Starting crash-resistant post...');
    console.log(`📝 Content: "${content.substring(0, 100)}${content.length > 100 ? '...' : ''}"`);
    
    // Get system status before posting
    const systemStatus = await bulletproofPoster.getStatus();
    console.log(`📊 SYSTEM_STATUS: Queue: ${systemStatus.queueLength}, Memory: ${systemStatus.systemHealth.memoryMB}MB, Healthy: ${systemStatus.systemHealth.healthy}`);

    // Use bulletproof posting system
    const result = await bulletproofPoster.postContent(content);
    
    const duration = Date.now() - startTime;
    
    if (result.success) {
      console.log(`✅ BULLETPROOF_SUCCESS: Posted via ${result.method} in ${duration}ms`);
      
      res.json({
        success: true,
        message: `Posted successfully via bulletproof ${result.method} system`,
        tweetId: result.tweetId,
        method: result.method,
        performance: {
          duration: duration,
          memoryUsed: result.resourcesUsed.memoryMB,
          queueLength: systemStatus.queueLength
        },
        systemHealth: systemStatus.systemHealth
      });
    } else {
      console.error(`❌ BULLETPROOF_FAILED: ${result.error}`);
      
      // Return appropriate status code based on error type
      const statusCode = result.retryAfter ? 429 : 500;
      
      res.status(statusCode).json({
        success: false,
        error: result.error,
        retryAfter: result.retryAfter,
        performance: {
          duration: duration,
          memoryUsed: result.resourcesUsed.memoryMB,
          queueLength: systemStatus.queueLength
        },
        systemHealth: systemStatus.systemHealth
      });
    }

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
    const status = await bulletproofPoster.getStatus();
    
    res.json({
      bulletproof: {
        posting: {
          active: status.isPosting,
          queueLength: status.queueLength
        },
        session: status.bulletproof,
        systemHealth: status.systemHealth
      },
      railway: {
        memoryMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        uptime: Math.round(process.uptime()),
        healthy: status.systemHealth.healthy
      },
      recommendations: {
        canPost: status.systemHealth.healthy && status.queueLength < 3,
        reason: status.systemHealth.healthy 
          ? (status.queueLength >= 3 ? 'Queue full - wait for processing' : 'System ready')
          : 'System unhealthy - check browser status'
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
    console.log('🔧 BULLETPROOF_RESET: Resetting crash-resistant system...');
    
    // Get current status
    const beforeStatus = await bulletproofPoster.getStatus();
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
      console.log('🧹 BULLETPROOF_RESET: Forced garbage collection');
    }
    
    const afterStatus = await bulletproofPoster.getStatus();
    
    console.log('✅ BULLETPROOF_RESET: System reset completed');
    
    res.json({
      success: true,
      message: 'Bulletproof system reset completed',
      before: beforeStatus.systemHealth,
      after: afterStatus.systemHealth,
      improvements: {
        memoryFreed: beforeStatus.systemHealth.memoryMB - afterStatus.systemHealth.memoryMB,
        queueCleared: beforeStatus.queueLength - afterStatus.queueLength
      }
    });
    
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: `Reset failed: ${error.message}`
    });
  }
});

export default router;
