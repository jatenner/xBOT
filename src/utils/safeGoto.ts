/**
 * 🔒 SAFE NAVIGATION WRAPPER
 * 
 * Central navigation wrapper that handles consent walls for ALL code paths.
 * This is the single point of truth for navigation + consent handling.
 */

import { Page } from 'playwright';
import { handleConsentWall } from './handleConsentWall';
import { getSupabaseClient } from '../db/index';

export interface SafeGotoOptions {
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' | 'commit';
  timeout?: number;
  operation?: string; // Operation name for logging
}

export interface SafeGotoResult {
  success: boolean;
  consentWallHandled: boolean;
  consentWallCleared: boolean;
  consentWallBlocked: boolean;
  error?: string;
}

/**
 * Safe navigation wrapper that handles consent walls automatically
 * 
 * Usage:
 *   const result = await safeGoto(page, 'https://x.com/home', { operation: 'profile_harvest' });
 *   if (result.consentWallBlocked) {
 *     throw new Error('INFRA_BLOCK_CONSENT_WALL');
 *   }
 */
export async function safeGoto(
  page: Page,
  url: string,
  options: SafeGotoOptions = {}
): Promise<SafeGotoResult> {
  const {
    waitUntil = 'domcontentloaded',
    timeout = 30000,
    operation = 'unknown',
  } = options;
  
  // Emit SAFE_GOTO_ATTEMPT event
  try {
    const supabase = getSupabaseClient();
    await supabase.from('system_events').insert({
      event_type: 'SAFE_GOTO_ATTEMPT',
      severity: 'info',
      message: `Navigation attempt: ${url}`,
      event_data: {
        url,
        operation,
        wait_until: waitUntil,
        timeout,
      },
      created_at: new Date().toISOString(),
    });
  } catch (logError) {
    // Non-blocking
  }
  
  try {
    // Navigate
    await page.goto(url, { waitUntil, timeout });
    
    // Wait for page to settle
    await page.waitForTimeout(2000);
    
    // 🔒 CONSENT WALL: Handle immediately after navigation
    const consentResult = await handleConsentWall(page, { url, operation });
    
    const success = !consentResult.blocked;
    
    // Emit SAFE_GOTO_OK or SAFE_GOTO_FAIL
    try {
      const supabase = getSupabaseClient();
      if (success) {
        await supabase.from('system_events').insert({
          event_type: 'SAFE_GOTO_OK',
          severity: 'info',
          message: `Navigation successful: ${url}`,
          event_data: {
            url,
            operation,
            consent_detected: consentResult.detected,
            consent_dismissed: consentResult.dismissed,
            consent_blocked: consentResult.blocked,
            consent_variant: consentResult.variant,
          },
          created_at: new Date().toISOString(),
        });
      } else {
        await supabase.from('system_events').insert({
          event_type: 'SAFE_GOTO_FAIL',
          severity: 'warning',
          message: `Navigation failed: ${url} - consent wall blocked`,
          event_data: {
            url,
            operation,
            reason: 'INFRA_BLOCK_CONSENT_WALL',
            consent_variant: consentResult.variant,
          },
          created_at: new Date().toISOString(),
        });
      }
    } catch (logError) {
      // Non-blocking
    }
    
    return {
      success,
      consentWallHandled: consentResult.handled,
      consentWallCleared: consentResult.cleared,
      consentWallBlocked: consentResult.blocked,
    };
  } catch (error: any) {
    // Emit SAFE_GOTO_FAIL for navigation errors
    try {
      const supabase = getSupabaseClient();
      await supabase.from('system_events').insert({
        event_type: 'SAFE_GOTO_FAIL',
        severity: 'error',
        message: `Navigation error: ${url} - ${error.message}`,
        event_data: {
          url,
          operation,
          reason: error.message,
          error_type: error.name || 'unknown',
        },
        created_at: new Date().toISOString(),
      });
    } catch (logError) {
      // Non-blocking
    }
    
    return {
      success: false,
      consentWallHandled: false,
      consentWallCleared: false,
      consentWallBlocked: false,
      error: error.message,
    };
  }
}
