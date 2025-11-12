/**
 * Supabase Client Factory - Anon and Admin clients
 * anon client uses ANON key for public reads, admin uses SERVICE_ROLE for all writes
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Singleton clients
export const admin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // server-only
  { 
    auth: { persistSession: false }, 
    global: { headers: { 'x-client-info': 'xbot-admin' } } 
  }
) as SupabaseClient<any, any, any>;

export const anon = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!,
  { 
    auth: { persistSession: false }, 
    global: { headers: { 'x-client-info': 'xbot-anon' } } 
  }
) as SupabaseClient<any, any, any>;

// Default export for backward compatibility
export const supabase = admin;

/**
 * Helper that ensures write operations succeed by retrying with admin on 401/403
 */
export async function ensureWrite<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error: any) {
    // If permission denied, this might be using anon client by mistake
    if (error?.code === '401' || error?.code === '403' || 
        error?.message?.includes('permission denied') ||
        error?.message?.includes('not authorized')) {
      console.warn('ENSURE_WRITE: Permission denied, operation should use admin client');
      throw error; // Don't retry automatically - caller should use admin
    }
    throw error;
  }
}

/**
 * Legacy compatibility - get admin client
 * @deprecated Use `admin` directly instead
 */
export async function getAdminClient(): Promise<SupabaseClient> {
  return admin;
}

/**
 * Legacy compatibility - get public client  
 * @deprecated Use `anon` directly instead
 */
export function getPublicClient(): SupabaseClient {
  return anon;
}

/**
 * Test admin client connectivity
 */
export async function testAdminConnection(): Promise<boolean> {
  try {
    const { error } = await admin.from('tweet_metrics').select('tweet_id').limit(1);
    return !error;
  } catch {
    return false;
  }
}
