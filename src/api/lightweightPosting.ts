/**
 * 🚀 RAILWAY-OPTIMIZED POSTING ENDPOINT
 * Replaces resource-heavy posting with lightweight solution
 */

import express from 'express';
import { RailwayResourceProtector } from '../utils/railwayResourceProtector';

const router = express.Router();
const resourceProtector = RailwayResourceProtector.getInstance();

/**
 * 📝 POST /api/post-lightweight
 * Ultra-efficient posting endpoint for Railway
 */
router.post('/post-lightweight', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { content } = req.body;
    
    if (!content || typeof content !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Content is required and must be a string'
      });
    }

    console.log(`🚀 LIGHTWEIGHT_ENDPOINT: Posting "${content.substring(0, 50)}..."`);
    
    // Get current resource stats
    const beforeStats = resourceProtector.getStats();
    console.log(`📊 BEFORE_POST: Queue: ${beforeStats.queueLength}, Memory: ${beforeStats.memoryMB}MB`);
    
    // Use protected posting to prevent Railway overload
    const result = await resourceProtector.protectedPost(content, async () => {
      const { LightweightPoster } = await import('../posting/lightweightPoster');
      const poster = LightweightPoster.getInstance();
      return await poster.postContent(content);
    });

    const afterStats = resourceProtector.getStats();
    const totalTime = Date.now() - startTime;
    
    console.log(`✅ LIGHTWEIGHT_SUCCESS: Posted in ${totalTime}ms, Memory: ${afterStats.memoryMB}MB`);
    
    res.json({
      success: result.success,
      tweetId: result.tweetId,
      performance: {
        totalTimeMs: totalTime,
        memoryUsedMB: result.resourcesUsed?.memoryMB || 0,
        queueLength: afterStats.queueLength
      },
      message: 'Posted via lightweight Railway-optimized system'
    });

  } catch (error: any) {
    const totalTime = Date.now() - startTime;
    console.error(`❌ LIGHTWEIGHT_ERROR: ${error.message} (${totalTime}ms)`);
    
    res.status(500).json({
      success: false,
      error: error.message,
      performance: {
        totalTimeMs: totalTime,
        failed: true
      }
    });
  }
});

/**
 * 📊 GET /api/system-stats
 * Railway resource monitoring endpoint
 */
router.get('/system-stats', (req, res) => {
  const stats = resourceProtector.getStats();
  const memUsage = process.memoryUsage();
  
  res.json({
    posting: {
      queueLength: stats.queueLength,
      activePosts: stats.activePosts,
      lastPost: stats.lastPostTime
    },
    system: {
      memoryMB: {
        heap: Math.round(memUsage.heapUsed / 1024 / 1024),
        total: Math.round(memUsage.heapTotal / 1024 / 1024),
        external: Math.round(memUsage.external / 1024 / 1024)
      },
      uptime: Math.round(process.uptime()),
      nodeVersion: process.version
    },
    railway: {
      estimatedCost: '$' + (stats.memoryMB * 0.02).toFixed(2), // Rough estimate
      optimized: true
    }
  });
});

/**
 * 🔧 POST /api/tune-limits
 * Adjust resource limits for optimal Railway performance
 */
router.post('/tune-limits', (req, res) => {
  try {
    const { maxMemoryMB, minPostInterval, maxConcurrentPosts } = req.body;
    
    const updates: any = {};
    if (maxMemoryMB) updates.maxMemoryMB = maxMemoryMB;
    if (minPostInterval) updates.minPostInterval = minPostInterval;
    if (maxConcurrentPosts) updates.maxConcurrentPosts = maxConcurrentPosts;
    
    resourceProtector.updateLimits(updates);
    
    res.json({
      success: true,
      message: 'Resource limits updated',
      newLimits: updates
    });
    
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
