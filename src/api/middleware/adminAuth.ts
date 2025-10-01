/**
 * 🔐 ADMIN AUTHENTICATION MIDDLEWARE
 * 
 * Secure admin endpoint protection with:
 * - Constant-time token comparison (prevents timing attacks)
 * - Multiple header support (Authorization Bearer + x-admin-token)
 * - Safe logging (never logs tokens)
 * - Clear error messages for debugging
 */

import { Request, Response, NextFunction } from 'express';
import { timingSafeEqual } from 'crypto';

/**
 * Constant-time string comparison to prevent timing attacks
 */
function constantTimeCompare(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a, 'utf8');
    const bufB = Buffer.from(b, 'utf8');
    
    // If lengths differ, still compare to prevent timing leak
    if (bufA.length !== bufB.length) {
      return false;
    }
    
    return timingSafeEqual(bufA, bufB);
  } catch (error) {
    return false;
  }
}

/**
 * Extract admin token from request headers
 * Supports:
 * - Authorization: Bearer <token>
 * - x-admin-token: <token>
 * - Query param: ?token=<token> (for CLI convenience)
 */
function extractToken(req: Request): string | null {
  // Check Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const parts = authHeader.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') {
      return parts[1];
    }
  }
  
  // Check x-admin-token header
  const customHeader = req.headers['x-admin-token'];
  if (customHeader && typeof customHeader === 'string') {
    return customHeader;
  }
  
  // Check query param (for CLI convenience)
  const queryToken = req.query.token;
  if (queryToken && typeof queryToken === 'string') {
    return queryToken;
  }
  
  return null;
}

/**
 * Admin authentication middleware
 * Apply to all /admin/* routes
 */
export function requireAdminAuth(req: Request, res: Response, next: NextFunction): void {
  const envToken = process.env.ADMIN_TOKEN;
  
  // Check if ADMIN_TOKEN is configured
  if (!envToken || envToken.trim() === '') {
    console.error('[ADMIN_AUTH] ❌ ADMIN_TOKEN not configured in environment');
    res.status(503).json({
      error: 'Service Unavailable',
      message: 'ADMIN_TOKEN not configured. Set it in Railway variables and restart the service.'
    });
    return;
  }
  
  // Extract token from request
  const reqToken = extractToken(req);
  
  if (!reqToken) {
    console.warn('[ADMIN_AUTH] ⚠️ Auth failed: No token provided');
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing admin token. Provide via Authorization: Bearer <token>, x-admin-token header, or ?token= query param.'
    });
    return;
  }
  
  // Constant-time comparison to prevent timing attacks
  const isValid = constantTimeCompare(reqToken, envToken);
  
  if (!isValid) {
    console.warn('[ADMIN_AUTH] ⚠️ Auth failed: Invalid token');
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid admin token'
    });
    return;
  }
  
  // Success - log but don't include token
  console.log('[ADMIN_AUTH] ✅ Auth passed');
  next();
}

/**
 * Optional: Auth check for programmatic use (doesn't send response)
 */
export function checkAdminAuth(token: string | null): { valid: boolean; error?: string } {
  const envToken = process.env.ADMIN_TOKEN;
  
  if (!envToken || envToken.trim() === '') {
    return { valid: false, error: 'ADMIN_TOKEN not configured' };
  }
  
  if (!token) {
    return { valid: false, error: 'No token provided' };
  }
  
  const isValid = constantTimeCompare(token, envToken);
  
  if (!isValid) {
    return { valid: false, error: 'Invalid token' };
  }
  
  return { valid: true };
}
