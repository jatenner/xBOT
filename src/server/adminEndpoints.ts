/**
 * 🔒 ADMIN ENDPOINTS - Secure manual job triggers
 */

import { Request, Response, NextFunction } from 'express';
import { ENV } from '../config/env';

// Middleware to verify admin token
export function requireAdminToken(req: Request, res: Response, next: NextFunction): void {
  const providedToken = req.headers['x-admin-token'];
  const expectedToken = process.env.ADMIN_TOKEN || ENV.ADMIN_TOKEN;
  
  if (!expectedToken) {
    res.status(500).json({ ok: false, error: 'ADMIN_TOKEN not configured' });
    return;
  }
  
  if (providedToken !== expectedToken) {
    console.warn(`[ADMIN] ⚠️ Unauthorized access attempt from ${req.ip}`);
    res.status(401).json({ ok: false, error: 'Unauthorized - invalid or missing x-admin-token' });
    return;
  }
  
  next();
}

// Manual trigger for postingQueue
export async function triggerPostingQueue(req: Request, res: Response): Promise<void> {
  console.log('[ADMIN] 🚀 Manual trigger: postingQueue');
  
  try {
    const { processPostingQueue } = await import('../jobs/postingQueue');
    await processPostingQueue();
    
    console.log('[ADMIN] ✅ postingQueue completed successfully');
    res.json({ ok: true, message: 'postingQueue completed successfully' });
  } catch (error: any) {
    console.error('[ADMIN] ❌ postingQueue failed:', error);
    console.error('[ADMIN] Stack:', error.stack);
    res.status(500).json({ 
      ok: false, 
      error: error.message,
      stack: error.stack,
    });
  }
}

// Manual trigger for replyJob (ENHANCED version with root resolution)
export async function triggerReplyJob(req: Request, res: Response): Promise<void> {
  console.log('[ADMIN] 🚀 Manual trigger: replyJobEnhanced (with root resolution + pacing)');
  
  try {
    const { generateRepliesEnhanced } = await import('../jobs/replyJobEnhanced');
    await generateRepliesEnhanced();
    
    console.log('[ADMIN] ✅ replyJobEnhanced completed successfully');
    res.json({ ok: true, message: 'replyJobEnhanced completed successfully' });
  } catch (error: any) {
    console.error('[ADMIN] ❌ replyJobEnhanced failed:', error);
    console.error('[ADMIN] Stack:', error.stack);
    res.status(500).json({ 
      ok: false, 
      error: error.message,
      stack: error.stack,
    });
  }
}

// Manual trigger for planJob
export async function triggerPlanJob(req: Request, res: Response): Promise<void> {
  console.log('[ADMIN] 🚀 Manual trigger: planJob');
  
  try {
    const { planContent } = await import('../jobs/planJob');
    await planContent();
    
    console.log('[ADMIN] ✅ planJob completed successfully');
    res.json({ ok: true, message: 'planJob completed successfully' });
  } catch (error: any) {
    console.error('[ADMIN] ❌ planJob failed:', error);
    console.error('[ADMIN] Stack:', error.stack);
    res.status(500).json({ 
      ok: false, 
      error: error.message,
      stack: error.stack,
    });
  }
}

// Manual trigger for harvester
export async function triggerHarvester(req: Request, res: Response): Promise<void> {
  console.log('[ADMIN] 🚀 Manual trigger: replyOpportunityHarvester');
  
  try {
    const { replyOpportunityHarvester } = await import('../jobs/replyOpportunityHarvester');
    await replyOpportunityHarvester();
    
    console.log('[ADMIN] ✅ replyOpportunityHarvester completed successfully');
    res.json({ ok: true, message: 'replyOpportunityHarvester completed successfully' });
  } catch (error: any) {
    console.error('[ADMIN] ❌ replyOpportunityHarvester failed:', error);
    console.error('[ADMIN] Stack:', error.stack);
    res.status(500).json({ 
      ok: false, 
      error: error.message,
      stack: error.stack,
    });
  }
}

