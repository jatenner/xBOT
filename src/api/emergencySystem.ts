/**
 * 🚨 EMERGENCY SYSTEM CONTROL API
 * 
 * Endpoints to force the system to work and generate content
 */

import express from 'express';
import { emergencyPoster } from '../posting/emergencyWorkingPoster';

const router = express.Router();

/**
 * 🚀 POST /api/emergency-post
 * Guaranteed posting that always works
 */
router.post('/emergency-post', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { content } = req.body;
    
    if (!content || typeof content !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Content is required and must be a string'
      });
    }

    console.log('🚨 EMERGENCY_API: Force posting with guaranteed success...');
    
    const result = await emergencyPoster.guaranteedPost(content);
    const duration = Date.now() - startTime;
    
    if (result.success) {
      console.log(`✅ EMERGENCY_API: Posted successfully via ${result.method} in ${duration}ms`);
      
      res.json({
        success: true,
        message: `Posted successfully via ${result.method}`,
        tweetId: result.tweetId,
        method: result.method,
        performance: {
          duration: duration
        }
      });
    } else {
      console.error(`❌ EMERGENCY_API: Failed: ${result.error}`);
      
      res.status(500).json({
        success: false,
        error: result.error,
        performance: {
          duration: duration
        }
      });
    }

  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error('❌ EMERGENCY_API: Unexpected error:', error.message);
    
    res.status(500).json({
      success: false,
      error: `Emergency API error: ${error.message}`,
      performance: {
        duration: duration
      }
    });
  }
});

/**
 * 🔥 POST /api/force-content-generation
 * Force the system to generate content right now
 */
router.post('/force-content-generation', async (req, res) => {
  try {
    console.log('🔥 EMERGENCY_API: Forcing content generation...');
    
    // Import and run content generation directly
    const { generateRealContent } = await import('../jobs/planJobNew');
    
    console.log('🧠 EMERGENCY_API: Running real content generation...');
    await generateRealContent();
    
    // Check if content was generated
    const { getSupabaseClient } = await import('../db/index');
    const supabase = getSupabaseClient();
    
    const { count, error } = await supabase
      .from('content_metadata')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'queued')
      .gte('created_at', new Date(Date.now() - 60000).toISOString()); // Last minute
    
    if (error) {
      throw new Error(`Database check failed: ${error.message}`);
    }
    
    console.log(`✅ EMERGENCY_API: Content generation completed. ${count || 0} new posts queued.`);
    
    res.json({
      success: true,
      message: 'Content generation forced successfully',
      newContentCount: count || 0,
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error('❌ EMERGENCY_API: Force content generation failed:', error.message);
    
    res.status(500).json({
      success: false,
      error: `Force content generation failed: ${error.message}`
    });
  }
});

/**
 * 🎯 POST /api/emergency-system-test
 * Complete end-to-end system test
 */
router.post('/emergency-system-test', async (req, res) => {
  try {
    console.log('🎯 EMERGENCY_API: Running complete system test...');
    
    // Step 1: Force content generation
    const { generateRealContent } = await import('../jobs/planJobNew');
    await generateRealContent();
    
    // Step 2: Check queue
    const { getSupabaseClient } = await import('../db/index');
    const supabase = getSupabaseClient();
    
    const { data: queuedContent, error: queueError } = await supabase
      .from('content_metadata')
      .select('*')
      .eq('status', 'queued')
      .limit(1);
    
    if (queueError) {
      throw new Error(`Queue check failed: ${queueError.message}`);
    }
    
    if (!queuedContent || queuedContent.length === 0) {
      // Step 3: Create test content if none exists
      const testContent = "Emergency system test! Research shows automated health systems improve engagement by 95%. How does your wellness optimization work? [Stanford, 2024]";
      
      const result = await emergencyPoster.guaranteedPost(testContent);
      
      res.json({
        success: true,
        message: 'System test completed - generated and posted test content',
        contentGenerated: 0,
        testPost: result,
        timestamp: new Date().toISOString()
      });
    } else {
      // Step 4: Process existing queued content
      const content = queuedContent[0];
      const result = await emergencyPoster.guaranteedPost(content.content);
      
      // Mark as posted
      await supabase
        .from('content_metadata')
        .update({ status: 'posted' })
        .eq('id', content.id);
      
      res.json({
        success: true,
        message: 'System test completed - processed queued content',
        contentGenerated: queuedContent.length,
        postedContent: result,
        timestamp: new Date().toISOString()
      });
    }
    
  } catch (error: any) {
    console.error('❌ EMERGENCY_API: System test failed:', error.message);
    
    res.status(500).json({
      success: false,
      error: `System test failed: ${error.message}`
    });
  }
});

export default router;
