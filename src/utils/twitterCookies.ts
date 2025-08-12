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

    const cookieCount = data.data.length;
    console.log(`[cookies] Loaded twitter session from Supabase (cookies: ${cookieCount})`);
    
    // Convert the cookie array to Playwright storageState format
    return {
      cookies: data.data,
      origins: [] // We don't need localStorage for Twitter login
    };
  } catch (error) {
    console.warn('[cookies] Failed to load Twitter session:', (error as Error).message);
    return null;
  }
}