/**
 * 🔧 CONFIG ENDPOINT
 * Provides configuration access with authentication and secret redaction
 */

import { Request, Response } from 'express';
import { getConfig, getRedactedConfig } from '../config/config';

export function configHandler(req: Request, res: Response): void {
  try {
    // Check authorization
    const authHeader = req.headers.authorization;
    const config = getConfig();
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: 'Authorization header required. Use: Authorization: Bearer <ADMIN_TOKEN>',
        timestamp: new Date().toISOString()
      });
      return;
    }
    
    const token = authHeader.slice(7); // Remove 'Bearer ' prefix
    
    if (token !== config.ADMIN_TOKEN) {
      res.status(403).json({
        success: false,
        error: 'Invalid admin token',
        timestamp: new Date().toISOString()
      });
      return;
    }
    
    // Return redacted configuration
    const redactedConfig = getRedactedConfig(config);
    
    res.json({
      success: true,
      config: redactedConfig,
      timestamp: new Date().toISOString(),
      note: 'Sensitive values are redacted. Full config available in environment variables.'
    });
    
  } catch (error) {
    console.error('❌ CONFIG_ENDPOINT: Error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to get configuration',
      timestamp: new Date().toISOString()
    });
  }
}
