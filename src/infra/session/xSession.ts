/**
 * 🔐 X/Twitter Session Manager
 * 
 * Normalizes cookies for both .twitter.com and .x.com domains
 * Prevents "Not logged in" errors when cookies are domain-mismatched
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import type { BrowserContext, Cookie } from 'playwright';

const SESSION_PATH = process.env.XBOT_SESSION_PATH || '/tmp/xbot-session.json';

/**
 * Duplicate cookies for both .twitter.com and .x.com domains
 * This ensures auth works regardless of which domain we navigate to
 */
function dupDomains(cookies: Cookie[]): Cookie[] {
  const out: Cookie[] = [];
  
  for (const c of cookies) {
    const base = { ...c };
    // Normalize domain without leading scheme
    const d = (base.domain || '').replace(/^https?:\/\//, '');
    
    // Create variants for both domains
    if (d.includes('twitter.com') || d.includes('x.com')) {
      // Add for both .twitter.com and .x.com
      out.push({ ...base, domain: '.twitter.com' });
      out.push({ ...base, domain: '.x.com' });
    } else {
      // Keep original for other domains
      out.push(base);
    }
  }
  
  // Deduplicate by name+domain+path
  const seen = new Set<string>();
  return out.filter(c => {
    const k = `${c.name}|${c.domain}|${c.path || '/'}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/**
 * Load storage state with domain-normalized cookies
 * Tries: 1) /tmp/xbot-session.json, 2) TWITTER_SESSION_B64 env var
 */
export async function loadStorageState(): Promise<{ cookies: Cookie[]; origins: any[] } | null> {
  // Try loading from file first
  try {
    const raw = await fs.readFile(SESSION_PATH, 'utf8');
    const state = JSON.parse(raw);
    
    if (Array.isArray(state?.cookies)) {
      state.cookies = dupDomains(state.cookies as Cookie[]);
      console.log(`[X_SESSION] Loaded ${state.cookies.length} cookies from file (normalized for both domains)`);
    }
    
    return state;
  } catch (error: any) {
    console.log('[X_SESSION] No session file found, trying TWITTER_SESSION_B64...');
  }
  
  // Fallback to TWITTER_SESSION_B64 env var
  try {
    const b64 = process.env.TWITTER_SESSION_B64;
    if (!b64) {
      console.log('[X_SESSION] ⚠️ No TWITTER_SESSION_B64 env var found');
      return null;
    }
    
    const decoded = Buffer.from(b64, 'base64').toString('utf8');
    const state = JSON.parse(decoded);
    
    if (Array.isArray(state?.cookies)) {
      state.cookies = dupDomains(state.cookies as Cookie[]);
      console.log(`[X_SESSION] Loaded ${state.cookies.length} cookies from TWITTER_SESSION_B64 (normalized for both domains)`);
      
      // Save to file for next time
      await saveStorageState(state);
    }
    
    return state;
  } catch (error: any) {
    console.error('[X_SESSION] ❌ Failed to load from TWITTER_SESSION_B64:', error.message);
    return null;
  }
}

/**
 * Save storage state with domain-normalized cookies
 */
export async function saveStorageState(state: { cookies: Cookie[]; origins: any[] }) {
  const normalized = { ...state, cookies: dupDomains(state.cookies || []) };
  await fs.writeFile(SESSION_PATH, JSON.stringify(normalized, null, 2), 'utf8');
  
  console.log(`[X_SESSION] ✅ Saved ${normalized.cookies.length} cookies to ${SESSION_PATH}`);
  globalThis.__x_last_login_at = new Date().toISOString();
}

/**
 * Apply storage state to an existing browser context
 */
export async function applyStateToContext(ctx: BrowserContext) {
  const state = await loadStorageState();
  
  if (!state?.cookies?.length) {
    console.log('[X_SESSION] ⚠️ No cookies to apply');
    return false;
  }
  
  // Persistent contexts don't accept storageState option; add cookies manually
  await ctx.addCookies(state.cookies);
  console.log(`[X_SESSION] ✅ Applied ${state.cookies.length} cookies to context`);
  
  return true;
}

/**
 * Check if a page is logged in to X/Twitter
 */
export async function isLoggedIn(page: any): Promise<boolean> {
  try {
    // Look for compose button (primary indicator of being logged in)
    const compose = await page.$('[data-testid="SideNav_NewTweet_Button"], [data-testid="tweetTextarea_0"]');
    
    // Look for login buttons (indicator of NOT being logged in)
    const loginBtn = await page.$('a[href*="login"], [data-testid="loginButton"]');
    
    const loggedIn = !!compose && !loginBtn;
    
    globalThis.__x_last_auth_check = new Date().toISOString();
    
    return loggedIn;
  } catch (error: any) {
    console.error('[X_SESSION] Error checking login status:', error.message);
    return false;
  }
}

export { SESSION_PATH };

