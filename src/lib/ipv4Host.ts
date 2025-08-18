/**
 * IPv4 Host Resolution Utility
 * Resolves hostnames to IPv4 addresses and caches results to avoid IPv6 ENETUNREACH
 */

import { promises as dns } from 'dns';

interface CacheEntry {
  ipv4: string;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Resolve hostname to first IPv4 address, with 10-minute caching
 */
export async function resolveIPv4Host(hostname: string): Promise<string | null> {
  // Check cache first
  const cached = cache.get(hostname);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.ipv4;
  }

  try {
    // Resolve A records (IPv4 only)
    const addresses = await dns.resolve4(hostname);
    
    if (addresses.length === 0) {
      console.warn(`IPv4: No A records found for ${hostname}`);
      return null;
    }

    const ipv4 = addresses[0];
    
    // Cache the result
    cache.set(hostname, {
      ipv4,
      expiresAt: Date.now() + CACHE_TTL_MS
    });

    console.info(`IPv4: Resolved ${hostname} → ${ipv4}`);
    return ipv4;
    
  } catch (error) {
    console.warn(`IPv4: Resolution failed for ${hostname}:`, (error as Error).message);
    return null;
  }
}

/**
 * Clear the resolution cache (useful for testing)
 */
export function clearIPv4Cache(): void {
  cache.clear();
}
