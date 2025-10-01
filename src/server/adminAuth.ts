/**
 * Admin Authentication Middleware
 * Constant-time token comparison to prevent timing attacks
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

const EXPECTED_TOKEN = process.env.ADMIN_TOKEN || '';

/**
 * Constant-time token comparison
 */
export function checkAdmin(req: Request): boolean {
  const provided = req.get('x-admin-token') || '';
  
  if (!EXPECTED_TOKEN || EXPECTED_TOKEN.length === 0) {
    return false;
  }
  
  const a = Buffer.from(EXPECTED_TOKEN);
  const b = Buffer.from(provided);
  
  // Constant-time compare
  if (a.length !== b.length) {
    return false;
  }
  
  try {
    return crypto.timingSafeEqual(a, b);
  } catch (error) {
    return false;
  }
}

/**
 * Express middleware for admin routes
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!EXPECTED_TOKEN) {
    console.error('[ADMIN_AUTH] ❌ ADMIN_TOKEN not configured');
    res.status(503).json({ error: 'Admin authentication not configured' });
    return;
  }
  
  if (!checkAdmin(req)) {
    console.warn('[ADMIN_AUTH] 🚫 Unauthorized admin access attempt');
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  
  console.log('[ADMIN_AUTH] ✅ Admin access granted');
  next();
}

/**
 * Log admin token status on startup
 */
export function logAdminTokenStatus(): void {
  if (!EXPECTED_TOKEN || EXPECTED_TOKEN.length === 0) {
    console.warn('');
    console.warn('⚠️  ═══════════════════════════════════════════════════════════');
    console.warn('⚠️  WARNING: ADMIN_TOKEN is not set!');
    console.warn('⚠️  Admin endpoints will be UNAVAILABLE.');
    console.warn('⚠️  Set ADMIN_TOKEN environment variable to enable admin API.');
    console.warn('⚠️  ═══════════════════════════════════════════════════════════');
    console.warn('');
  } else {
    console.log(`✅ ADMIN_TOKEN configured (length: ${EXPECTED_TOKEN.length})`);
  }
}

