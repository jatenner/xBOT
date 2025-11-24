/**
 * 🧹 DATABASE CLEANUP API
 * 
 * Endpoints to clear phantom posts and reset rate limiting
 */

import express from 'express';

const router = express.Router();

/**
 * 🧹 POST /api/clear-phantom-posts
 * Clear fake/phantom posts from database that never actually posted to Twitter
 */
router.post('/clear-phantom-posts', async (req, res) => {
  try {
    console.log('🧹 CLEANUP_API: Clearing phantom posts from database...');
    
    const { getSupabaseClient } = await import('../db/index');
    const supabase = getSupabaseClient();
    
    // Delete posts with mock/emergency/fallback tweet IDs (these are phantom posts)
    const { data: deletedPosts, error } = await supabase
      .from('posted_decisions')
      .delete()
      .or('tweet_id.like.mock_%,tweet_id.like.emergency_%,tweet_id.like.bulletproof_%')
      .select();
    
    if (error) {
      throw new Error(`Database cleanup failed: ${error.message}`);
    }
    
    const deletedCount = deletedPosts?.length || 0;
    console.log(`✅ CLEANUP_API: Deleted ${deletedCount} phantom posts`);
    
    // Also check current rate limit status
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: remainingPosts } = await supabase
      .from('posted_decisions')
      .select('*', { count: 'exact', head: true })
      .gte('posted_at', oneHourAgo);
    
    res.json({
      success: true,
      message: `Cleared ${deletedCount} phantom posts from database`,
      phantomPostsCleared: deletedCount,
      realPostsRemaining: remainingPosts || 0,
      rateLimitStatus: `${remainingPosts || 0}/2 posts in last hour`,
      canPostNow: (remainingPosts || 0) < 2
    });
    
  } catch (error: any) {
    console.error('❌ CLEANUP_API: Database cleanup failed:', error.message);
    
    res.status(500).json({
      success: false,
      error: `Database cleanup failed: ${error.message}`
    });
  }
});

/**
 * 🎭 POST /api/test-playwright-posting
 * Test the new Playwright-only posting system
 */
router.post('/test-playwright-posting', async (req, res) => {
  try {
    const { content } = req.body;
    
    if (!content || typeof content !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Content is required and must be a string'
      });
    }

    console.log('🎭 TEST_API: Testing posting...');
    
    const { UltimateTwitterPoster } = await import('../posting/UltimateTwitterPoster');
    const poster = new UltimateTwitterPoster();
    const startTime = Date.now();
    const result = await poster.postTweet(content);
    const duration = Date.now() - startTime;
    
    if (result.success) {
      console.log(`✅ TEST_API: Posting succeeded in ${duration}ms`);
      
      res.json({
        success: true,
        message: 'Posting test successful',
        tweetId: result.tweetId,
        method: 'ultimate',
        duration: duration
      });
    } else {
      console.error(`❌ TEST_API: Posting failed: ${result.error}`);
      
      res.status(500).json({
        success: false,
        error: result.error,
        method: 'ultimate',
        duration: duration
      });
    }
    
  } catch (error: any) {
    console.error('❌ TEST_API: Playwright test failed:', error.message);
    
    res.status(500).json({
      success: false,
      error: `Playwright test failed: ${error.message}`
    });
  }
});

export default router;
