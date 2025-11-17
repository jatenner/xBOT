/**
 * 🔐 SESSION MONITOR
 * 
 * Monitors Twitter session state and detects when authentication expires.
 * Auto-reloads session from environment variable when needed.
 */

import { UnifiedBrowserPool } from '../browser/UnifiedBrowserPool';

export interface SessionStatus {
  isValid: boolean;
  lastChecked: Date;
  needsRefresh: boolean;
  error?: string;
}

export class SessionMonitor {
  private static lastCheckTime = 0;
  private static readonly CHECK_INTERVAL_MS = 5 * 60 * 1000; // Check every 5 minutes
  private static lastRefreshTime = 0;
  private static readonly MIN_REFRESH_INTERVAL_MS = 30 * 60 * 1000; // Don't refresh more than once per 30 min
  
  /**
   * Check if session is still valid by attempting a lightweight operation
   */
  static async checkSession(): Promise<SessionStatus> {
    const now = Date.now();
    
    // Throttle checks (don't check too frequently)
    if (now - this.lastCheckTime < this.CHECK_INTERVAL_MS) {
      return {
        isValid: true,
        lastChecked: new Date(this.lastCheckTime),
        needsRefresh: false
      };
    }
    
    this.lastCheckTime = now;
    
    try {
      const browserPool = UnifiedBrowserPool.getInstance();
      
      // Use withContext to test if we can acquire a page (tests session)
      const testResult = await browserPool.withContext(
        'session_check',
        async (context) => {
          const page = await context.newPage();
          try {
            // Navigate to Twitter home (requires auth)
            await page.goto('https://x.com/home', {
              waitUntil: 'domcontentloaded',
              timeout: 10000
            });
            
            // Check for login indicators
            const isLoggedIn = await page.evaluate(() => {
              // Look for elements that only exist when logged in
              return !!(
                document.querySelector('[data-testid="SideNav_AccountSwitcher_Button"]') ||
                document.querySelector('[data-testid="primaryColumn"]') ||
                document.querySelector('nav[role="navigation"]')
              );
            });
            
            return { isValid: isLoggedIn };
          } finally {
            await page.close();
          }
        },
        10 // Low priority
      );
      
      const isValid = testResult?.isValid ?? false;
      
      if (!isValid) {
        console.warn('[SESSION_MONITOR] ⚠️ Session appears invalid - may need refresh');
      }
      
      return {
        isValid,
        lastChecked: new Date(now),
        needsRefresh: !isValid && (now - this.lastRefreshTime) > this.MIN_REFRESH_INTERVAL_MS
      };
      
    } catch (error: any) {
      const errorMsg = error?.message || String(error);
      
      // Check if error indicates session expired
      const isAuthError = errorMsg.includes('not logged in') ||
                         errorMsg.includes('session expired') ||
                         errorMsg.includes('authentication') ||
                         errorMsg.includes('logged out');
      
      if (isAuthError && (now - this.lastRefreshTime) > this.MIN_REFRESH_INTERVAL_MS) {
        console.error('[SESSION_MONITOR] ❌ Session expired detected:', errorMsg.substring(0, 100));
        return {
          isValid: false,
          lastChecked: new Date(now),
          needsRefresh: true,
          error: errorMsg
        };
      }
      
      // Other errors might be transient
      return {
        isValid: true, // Assume valid if we can't determine
        lastChecked: new Date(now),
        needsRefresh: false,
        error: errorMsg
      };
    }
  }
  
  /**
   * Refresh session by reloading from environment variable
   */
  static async refreshSession(): Promise<{ success: boolean; error?: string }> {
    const now = Date.now();
    
    // Throttle refreshes
    if (now - this.lastRefreshTime < this.MIN_REFRESH_INTERVAL_MS) {
      const minutesUntilNext = Math.ceil((this.MIN_REFRESH_INTERVAL_MS - (now - this.lastRefreshTime)) / 60000);
      console.log(`[SESSION_MONITOR] ⏳ Refresh throttled - wait ${minutesUntilNext} more minutes`);
      return { success: false, error: `Refresh throttled - wait ${minutesUntilNext} more minutes` };
    }
    
    try {
      console.log('[SESSION_MONITOR] 🔄 Refreshing session from environment...');
      
      const browserPool = UnifiedBrowserPool.getInstance();
      
      // Reload session state (pool will detect env variable changes)
      await browserPool.reloadSessionState();
      
      this.lastRefreshTime = now;
      
      // Verify refresh worked
      const checkResult = await this.checkSession();
      if (checkResult.isValid) {
        console.log('[SESSION_MONITOR] ✅ Session refreshed successfully');
        return { success: true };
      } else {
        console.error('[SESSION_MONITOR] ❌ Session refresh failed - still invalid');
        return { success: false, error: 'Session still invalid after refresh' };
      }
      
    } catch (error: any) {
      console.error('[SESSION_MONITOR] ❌ Session refresh error:', error?.message || error);
      return {
        success: false,
        error: error?.message || String(error)
      };
    }
  }
  
  /**
   * Auto-check and refresh if needed (call periodically)
   */
  static async autoCheckAndRefresh(): Promise<void> {
    const status = await this.checkSession();
    
    if (status.needsRefresh) {
      console.log('[SESSION_MONITOR] 🔄 Auto-refreshing expired session...');
      const refreshResult = await this.refreshSession();
      
      if (!refreshResult.success) {
        console.error('[SESSION_MONITOR] ❌ Auto-refresh failed:', refreshResult.error);
        
        // Log to system_events for monitoring
        try {
          const { getSupabaseClient } = await import('../db/index');
          const supabase = getSupabaseClient();
          await supabase.from('system_events').insert({
            event_type: 'session_refresh_failed',
            severity: 'warning',
            event_data: {
              error: refreshResult.error,
              last_checked: status.lastChecked.toISOString()
            },
            created_at: new Date().toISOString()
          });
        } catch (e) {
          // Ignore DB errors
        }
      }
    }
  }
}

