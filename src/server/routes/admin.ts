/**
 * 🔐 ADMIN ROUTES - Protected endpoints for smoke testing and manual operations
 */

import express from 'express';
import { postNow } from '../../posting/postNow';

const router = express.Router();

/**
 * Admin auth middleware
 */
function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const validToken = process.env.ADMIN_TOKEN;

  if (!validToken) {
    return res.status(500).json({ ok: false, error: 'ADMIN_TOKEN not configured' });
  }

  if (!token || token !== validToken) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }

  next();
}

/**
 * POST /admin/post - Smoke test post
 * 
 * Usage:
 * curl -X POST $HOST/admin/post \
 *   -H "Authorization: Bearer $ADMIN_TOKEN" \
 *   -H "Content-Type: application/json" \
 *   -d '{"text":"xBOT smoke test"}'
 */
router.post('/post', requireAdmin, async (req, res) => {
  const text = (req.body?.text || '').toString().trim();
  
  if (!text) {
    return res.status(400).json({ ok: false, error: 'missing text' });
  }

  try {
    const result = await postNow({ text });
    res.json({ ok: result.success, ...result });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || 'post failed' });
  }
});

/**
 * POST /admin/queue-now - Force a decision to post immediately
 */
router.post('/queue-now', requireAdmin, async (req, res) => {
  try {
    const { decision_id } = req.body;
    
    if (!decision_id) {
      return res.status(400).json({ ok: false, error: 'decision_id required' });
    }
    
    const { getSupabaseClient } = await import('../../db/index');
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase
      .from('content_metadata')
      .update({
        scheduled_at: new Date().toISOString(),
        status: 'queued'
      })
      .eq('id', decision_id)
      .select()
      .single();
    
    if (error) {
      return res.status(500).json({ ok: false, error: error.message });
    }
    
    if (!data) {
      return res.status(404).json({ ok: false, error: 'decision_id not found' });
    }
    
    console.log(`[ADMIN] ✅ Queued decision ${decision_id} for immediate posting`);
    res.json({ ok: true, decision_id, scheduled_at: data.scheduled_at });
    
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

/**
 * POST /admin/generate-and-post-now - Generate and post immediately
 */
router.post('/generate-and-post-now', requireAdmin, async (req, res) => {
  try {
    console.log('[ADMIN] 🚀 Triggering immediate content generation and posting...');
    
    // Trigger the posting queue immediately
    const { processPostingQueue } = await import('../../jobs/postingQueue');
    const { planContent } = await import('../../jobs/planJob');
    
    // Set env to force immediate scheduling
    const originalEnv = process.env.POST_NOW_ON_COLD_START;
    process.env.POST_NOW_ON_COLD_START = 'true';
    process.env.MIN_MINUTES_UNTIL_SLOT = '0';
    
    try {
      // Generate content (will schedule immediately due to cold start logic)
      await planContent();
      
      // Wait a moment then trigger posting
      await new Promise(resolve => setTimeout(resolve, 2000));
      await processPostingQueue();
      
      res.json({
        ok: true,
        message: 'Content generated and posting triggered. Check logs for results.'
      });
      
    } finally {
      // Restore original env
      if (originalEnv !== undefined) {
        process.env.POST_NOW_ON_COLD_START = originalEnv;
      } else {
        delete process.env.POST_NOW_ON_COLD_START;
      }
    }
    
  } catch (error: any) {
    console.error('[ADMIN] ❌ generate-and-post-now error:', error.message);
    res.status(500).json({ ok: false, error: error.message });
  }
});

export default router;

