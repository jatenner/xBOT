/**
 * 🩺 STATUS ROUTE - FAST healthcheck for Railway (no DB queries, no slow imports)
 * 
 * This endpoint MUST respond within 5 seconds for Railway healthcheck to pass.
 * All heavy operations (DB, browser, etc.) are deferred to /health endpoint.
 */

import express from 'express';

const router = express.Router();

router.get('/', (req, res) => {
  // ⚡ INSTANT RESPONSE - no async, no DB, no imports
  res.status(200).json({
    ok: true,
    ts: Date.now(),
    version: '1.0.0',
    uptime: Math.floor(process.uptime())
  });
});

export default router;

