import { AdvancedDatabaseManager } from '../lib/advancedDatabaseManager';

export interface TwitterCookieData {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
}

export interface StorageState {
  cookies: TwitterCookieData[];
  origins: Array<{
    origin: string;
    localStorage: Array<{ name: string; value: string }>;
  }>;
}

/**
 * Load Twitter cookies from Supabase for session persistence
 */
export async function loadTwitterCookiesFromSupabase(): Promise<StorageState | null> {
  try {
    const db = AdvancedDatabaseManager.getInstance();
    
    const result = await db.executeQuery('load_twitter_cookies', async (client) => {
      return await client
        .from('browser_cookies')
        .select('*')
        .eq('domain', '.twitter.com')
        .order('created_at', { ascending: false })
        .limit(50);
    });

    if (!result.data || result.data.length === 0) {
      console.log('[cookies] No stored Twitter cookies found');
      return null;
    }

    const cookies: TwitterCookieData[] = result.data.map((row: any) => ({
      name: row.name,
      value: row.value,
      domain: row.domain,
      path: row.path || '/',
      expires: row.expires_timestamp ? new Date(row.expires_timestamp).getTime() / 1000 : undefined,
      httpOnly: row.http_only || false,
      secure: row.secure || true,
      sameSite: row.same_site || 'Lax'
    }));

    console.log(`[cookies] Loaded ${cookies.length} Twitter cookies from Supabase`);

    return {
      cookies,
      origins: [{
        origin: 'https://twitter.com',
        localStorage: []
      }]
    };

  } catch (error) {
    console.error('[cookies] Failed to load Twitter cookies:', error);
    return null;
  }
}

/**
 * Save Twitter cookies to Supabase for session persistence
 */
export async function saveTwitterCookiesToSupabase(cookies: TwitterCookieData[]): Promise<boolean> {
  try {
    const db = AdvancedDatabaseManager.getInstance();
    
    // Filter for Twitter-related cookies only
    const twitterCookies = cookies.filter(cookie => 
      cookie.domain.includes('twitter.com') || 
      cookie.domain.includes('x.com')
    );

    if (twitterCookies.length === 0) {
      console.log('[cookies] No Twitter cookies to save');
      return true;
    }

    // Clear existing cookies first
    await db.executeQuery('clear_twitter_cookies', async (client) => {
      return await client
        .from('browser_cookies')
        .delete()
        .in('domain', ['.twitter.com', 'twitter.com', '.x.com', 'x.com']);
    });

    // Insert new cookies
    const cookieRecords = twitterCookies.map(cookie => ({
      name: cookie.name,
      value: cookie.value,
      domain: cookie.domain,
      path: cookie.path || '/',
      expires_timestamp: cookie.expires ? new Date(cookie.expires * 1000).toISOString() : null,
      http_only: cookie.httpOnly || false,
      secure: cookie.secure || true,
      same_site: cookie.sameSite || 'Lax',
      created_at: new Date().toISOString()
    }));

    await db.executeQuery('save_twitter_cookies', async (client) => {
      return await client
        .from('browser_cookies')
        .insert(cookieRecords);
    });

    console.log(`[cookies] Saved ${twitterCookies.length} Twitter cookies to Supabase`);
    return true;

  } catch (error) {
    console.error('[cookies] Failed to save Twitter cookies:', error);
    return false;
  }
}

/**
 * Clear all stored Twitter cookies
 */
export async function clearTwitterCookiesFromSupabase(): Promise<boolean> {
  try {
    const db = AdvancedDatabaseManager.getInstance();
    
    await db.executeQuery('clear_all_twitter_cookies', async (client) => {
      return await client
        .from('browser_cookies')
        .delete()
        .in('domain', ['.twitter.com', 'twitter.com', '.x.com', 'x.com']);
    });

    console.log('[cookies] Cleared all Twitter cookies from Supabase');
    return true;

  } catch (error) {
    console.error('[cookies] Failed to clear Twitter cookies:', error);
    return false;
  }
}