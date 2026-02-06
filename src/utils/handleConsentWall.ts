/**
 * 🔒 CONSENT WALL HANDLER (FAIL-CLOSED + COOLDOWN)
 *
 * Deterministic, one-attempt consent wall dismissal.
 * If cooldown active: fail closed immediately, no clear attempts.
 * If consent wall detected and not cleared: record wall, trigger 30–60min cooldown.
 */

import { Page } from 'playwright';
import { detectConsentWall, acceptConsentWall } from '../playwright/twitterSession';
import { getSupabaseClient } from '../db/index';
import { getConsentWallCooldown } from './consentWallCooldown';
import * as fs from 'fs';
import * as path from 'path';

export interface ConsentWallHandleResult {
  handled: boolean;
  cleared: boolean;
  detected: boolean;
  dismissed: boolean;
  blocked: boolean;
  classified: 'INFRA_BLOCK_CONSENT_WALL' | 'none';
  attempts: number;
  variant?: string; // Selector/path fingerprint
  screenshotPath?: string;
  htmlSnippet?: string;
}

/**
 * Handle consent wall with fail-closed + cooldown
 *
 * - If cooldown active: return blocked immediately, no repeated clear attempts
 * - When cooldown inactive: up to 3 clear attempts (short waits)
 * - On block: record wall (triggers 30–60min cooldown) unless recordWallOnBlock=false
 */
export async function handleConsentWall(page: Page, context?: { url?: string; operation?: string; recordWallOnBlock?: boolean }): Promise<ConsentWallHandleResult> {
  const url = context?.url || page.url();
  const operation = context?.operation || 'unknown';

  try {
    // FAIL-CLOSED: If cooldown active, block immediately without attempting
    const cooldown = getConsentWallCooldown();
    if (cooldown.isCooldownActive()) {
      const status = cooldown.getStatus();
      console.warn('[CONSENT_WALL] Fail-closed: cooldown active (' + (status.remainingSeconds || 0) + 's remaining), skipping clear attempt');
      return {
        handled: true,
        cleared: false,
        detected: true,
        dismissed: false,
        blocked: true,
        classified: 'INFRA_BLOCK_CONSENT_WALL',
        attempts: 0,
        variant: 'cooldown_active',
      };
    }

    // Detect consent wall
    const detection = await detectConsentWall(page);

    if (!detection.detected || detection.wallType !== 'consent') {
      return {
        handled: false,
        cleared: false,
        detected: false,
        dismissed: false,
        blocked: false,
        classified: 'none',
        attempts: 0,
      };
    }
    
    const maxAttempts = 3;
    console.log(`[CONSENT_WALL] 🚧 Consent wall detected at ${url} (operation: ${operation}), attempting dismissal (up to ${maxAttempts} attempts)...`);
    
    // Extract variant fingerprint from detection
    const variant = detection.variant || 'unknown';
    
    // Log detection event
    try {
      const supabase = getSupabaseClient();
      await supabase.from('system_events').insert({
        event_type: 'CONSENT_WALL_DETECTED',
        severity: 'info',
        message: `Consent wall detected at ${url}`,
        event_data: {
          url,
          operation,
          wall_type: detection.wallType,
          variant,
        },
        created_at: new Date().toISOString(),
      });
    } catch (logError) {
      // Non-blocking
    }
    
    const result = await acceptConsentWall(page, maxAttempts);
    
    if (result.cleared) {
      console.log(`[CONSENT_WALL] ✅ Consent wall cleared (attempts: ${result.attempts})`);
      
      // Log dismissal success
      try {
        const supabase = getSupabaseClient();
        await supabase.from('system_events').insert({
          event_type: 'CONSENT_WALL_DISMISSED',
          severity: 'info',
          message: `Consent wall dismissed at ${url}`,
          event_data: {
            url,
            operation,
            attempts: result.attempts,
            matched_selector: result.matchedSelector,
            variant: result.matchedSelector || variant,
            dismissed: true,
          },
          created_at: new Date().toISOString(),
        });
      } catch (logError) {
        // Non-blocking
      }
      
      return {
        handled: true,
        cleared: true,
        detected: true,
        dismissed: true,
        blocked: false,
        classified: 'none',
        attempts: result.attempts,
        variant: result.matchedSelector || variant,
      };
    } else {
      // Not cleared - record wall (triggers cooldown) unless caller requested skip (e.g. retry with different URL)
      const recordWall = context?.recordWallOnBlock !== false;
      if (recordWall) {
        getConsentWallCooldown().recordWall();
        console.log(`[CONSENT_WALL] Consent wall not cleared after ${result.attempts} attempts - cooldown triggered (30–60min), saving artifacts, fail-closed`);
      } else {
        console.log(`[CONSENT_WALL] Consent wall not cleared after ${result.attempts} attempts - skipping cooldown (caller will retry)`);
      }
      
      let screenshotPath: string | undefined;
      let htmlSnippet: string | undefined;
      
      try {
        // Save screenshot
        const artifactsDir = path.join(process.cwd(), 'artifacts');
        if (!fs.existsSync(artifactsDir)) {
          fs.mkdirSync(artifactsDir, { recursive: true });
        }
        const timestamp = Date.now();
        screenshotPath = path.join(artifactsDir, `consent_wall_blocked_${timestamp}.png`);
        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.log(`[CONSENT_WALL] 📸 Screenshot saved: ${screenshotPath}`);
        
        // Save HTML snippet
        htmlSnippet = await page.evaluate(() => {
          const body = document.body;
          return body ? body.innerHTML.substring(0, 2000) : '';
        });
      } catch (artifactError: any) {
        console.warn(`[CONSENT_WALL] ⚠️ Failed to save artifacts: ${artifactError.message}`);
      }
      
      // Log blocked event with artifacts
      try {
        const supabase = getSupabaseClient();
        await supabase.from('system_events').insert({
          event_type: 'CONSENT_WALL_BLOCKED',
          severity: 'warning',
          message: `Consent wall not cleared at ${url} - classified as INFRA_BLOCK`,
          event_data: {
            url,
            operation,
            attempts: 1,
            variant,
            blocked: true,
            screenshot_path: screenshotPath,
            html_snippet_preview: htmlSnippet?.substring(0, 500),
          },
          created_at: new Date().toISOString(),
        });
      } catch (logError) {
        // Non-blocking
      }
      
      return {
        handled: true,
        cleared: false,
        detected: true,
        dismissed: false,
        blocked: true,
        classified: 'INFRA_BLOCK_CONSENT_WALL',
        attempts: 1,
        variant,
        screenshotPath,
        htmlSnippet,
      };
    }
  } catch (error: any) {
    console.error(`[CONSENT_WALL] ❌ Error handling consent wall: ${error.message}`);
    
    // Log error event
    try {
      const supabase = getSupabaseClient();
      await supabase.from('system_events').insert({
        event_type: 'CONSENT_WALL_ERROR',
        severity: 'error',
        message: `Error handling consent wall at ${url}: ${error.message}`,
        event_data: {
          url,
          operation,
          error: error.message,
        },
        created_at: new Date().toISOString(),
      });
    } catch (logError) {
      // Non-blocking
    }
    
    return {
      handled: true,
      cleared: false,
      detected: false,
      dismissed: false,
      blocked: true,
      classified: 'INFRA_BLOCK_CONSENT_WALL',
      attempts: 1,
      variant: 'error',
    };
  }
}
