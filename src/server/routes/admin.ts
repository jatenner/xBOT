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

export default router;

