/**
 * Supabase Client Factory - Public and Admin clients
 * Public client uses ANON key for reads, Admin uses SERVICE_ROLE for all writes
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { resolveIPv4Host } from './ipv4Host';

let publicClient: SupabaseClient | null = null;
let adminClient: SupabaseClient | null = null;

/**
 * Get public Supabase client (ANON key) for reads
 */
export function getPublicClient(): SupabaseClient {
  if (!publicClient) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const anonKey = process.env.SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !anonKey) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY');
    }
    
    publicClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false },
      global: {
        headers: {
          'User-Agent': 'xBOT/1.0'
        }
      }
    });
  }
  
  return publicClient;
}

/**
 * Get admin Supabase client (SERVICE_ROLE) for all writes and admin operations
 */
export async function getAdminClient(): Promise<SupabaseClient> {
  if (!adminClient) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !serviceKey) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    }

    let finalUrl = supabaseUrl;
    
    // IPv4 fallback if enabled
    if (process.env.SUPABASE_IPV4_ONLY === 'true') {
      try {
        const url = new URL(supabaseUrl);
        const ipv4Host = await resolveIPv4Host(url.hostname);
        if (ipv4Host) {
          url.hostname = ipv4Host;
          finalUrl = url.toString();
          console.info(`DB: Using IPv4 host ${ipv4Host} for Supabase`);
        }
      } catch (error) {
        console.warn('DB: IPv4 resolution failed, using original URL:', (error as Error).message);
      }
    }
    
    adminClient = createClient(finalUrl, serviceKey, {
      auth: { persistSession: false },
      global: {
        headers: {
          'User-Agent': 'xBOT/1.0-admin'
        }
      },
      db: {
        schema: 'public'
      }
    });
    
    console.info('DB: adminClient ready (service-role)');
  }
  
  return adminClient;
}

/**
 * Test admin client connectivity
 */
export async function testAdminConnection(): Promise<boolean> {
  try {
    const client = await getAdminClient();
    const { error } = await client.from('tweet_metrics').select('tweet_id').limit(1);
    return !error;
  } catch {
    return false;
  }
}
