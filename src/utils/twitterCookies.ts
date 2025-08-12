import { createClient } from '@supabase/supabase-js';

export interface TwitterStorageState {
  cookies: Array<{
    name: string;
    value: string;
    domain: string;
    path: string;
    expires?: number;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: 'Strict' | 'Lax' | 'None';
  }>;
  origins?: Array<{
    origin: string;
    localStorage: Array<{ name: string; value: string }>;
  }>;
}

/**
 * Ensure critical cookies (auth_token, ct0) exist for both .x.com and .twitter.com domains
 */
function ensureCriticalCookiesDuplicated(cookies: any[]): any[] {
  const criticalCookies = ['auth_token', 'ct0'];
  const domains = ['.x.com', '.twitter.com'];
  const result = [...cookies];
  
  for (const cookieName of criticalCookies) {
    const existingCookies = cookies.filter(c => c.name === cookieName);
    
    for (const targetDomain of domains) {
      const hasTargetDomain = existingCookies.some(c => c.domain === targetDomain);
      
      if (!hasTargetDomain) {
        // Find a source cookie from the other domain
        const sourceCookie = existingCookies.find(c => 
          c.domain === (targetDomain === '.x.com' ? '.twitter.com' : '.x.com')
        );
        
        if (sourceCookie) {
          console.log(`[cookies] Duplicating ${cookieName} for ${targetDomain}`);
          result.push({
            ...sourceCookie,
            domain: targetDomain
          });
        }
      }
    }
  }
  
  return result;
}

/**
 * Load Twitter session cookies from Supabase
 */
export async function loadTwitterCookiesFromSupabase(): Promise<TwitterStorageState | null> {
  // Skip if disabled by environment variable
  if (process.env.DISABLE_TWITTER_SESSION === 'true') {
    console.log('[cookies] Twitter session loading disabled');
    return null;
  }

  try {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!url || !key) {
      console.warn('[cookies] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
      return null;
    }

    const supabase = createClient(url, key, { auth: { persistSession: false } });
    const { data, error } = await supabase
      .from('browser_cookies')
      .select('data')
      .eq('id', 'twitter')
      .single();

    if (error) {
      console.warn('[cookies] Failed to load Twitter session from Supabase:', error.message);
      return null;
    }

    if (!data?.data || !Array.isArray(data.data)) {
      console.warn('[cookies] No valid Twitter session found in Supabase');
      return null;
    }

    const rawCookies = data.data;
    const enhancedCookies = ensureCriticalCookiesDuplicated(rawCookies);
    
    console.log(`[cookies] Loaded twitter session from Supabase (cookies: ${enhancedCookies.length}, enhanced from ${rawCookies.length})`);
    
    // Convert the cookie array to Playwright storageState format
    return {
      cookies: enhancedCookies,
      origins: [] // We don't need localStorage for Twitter login
    };
  } catch (error) {
    console.warn('[cookies] Failed to load Twitter session:', (error as Error).message);
    return null;
  }
}

/**
 * Save Twitter session cookies to Supabase after successful login
 */
export async function saveTwitterCookiesToSupabase(cookies: any[]): Promise<boolean> {
  try {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!url || !key) {
      console.warn('[cookies] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for saving');
      return false;
    }

    // Filter to Twitter/X related cookies only
    const filtered = cookies.filter(c => 
      c.domain.includes('x.com') || c.domain.includes('twitter.com')
    );

    // Ensure critical cookies are duplicated for both domains
    const enhanced = ensureCriticalCookiesDuplicated(filtered);

    const supabase = createClient(url, key, { auth: { persistSession: false } });
    const { error } = await supabase
      .from('browser_cookies')
      .upsert({ 
        id: 'twitter', 
        data: enhanced, 
        updated_at: new Date().toISOString() 
      });

    if (error) {
      console.error('[cookies] Failed to save cookies to Supabase:', error.message);
      return false;
    }

    console.log(`[cookies] Saved ${enhanced.length} cookies to Supabase`);
    return true;
  } catch (error) {
    console.error('[cookies] Error saving cookies:', (error as Error).message);
    return false;
  }
}