/**
 * Discovery buckets for reply opportunity universe.
 * Expands beyond narrow "direct health" into health-adjacent lifestyle and broad viral/cultural
 * where a natural health/performance reply angle can fit.
 *
 * Buckets:
 * - direct_health: explicit health/fitness/nutrition/metabolism content
 * - health_adjacent_lifestyle: productivity, burnout, sleep, routines, food/drink, focus
 * - broad_viral_cultural: trending/viral posts where health angle can fit (e.g. memes, launches)
 */

export type DiscoveryBucket = 'direct_health' | 'health_adjacent_lifestyle' | 'broad_viral_cultural';

/** Map discovery_source string to bucket (for CDP, orchestrator, etc.). */
export function discoverySourceToBucket(discoverySource: string | null | undefined): DiscoveryBucket {
  if (!discoverySource) return 'direct_health'; // legacy default
  const s = discoverySource.toLowerCase();
  if (s.includes('keyword_search') || s.includes('viral_watcher') || s.includes('cdp_search_')) {
    // Keyword/viral feed source - bucket comes from keyword list at fetch time (features.discovery_bucket)
    return 'direct_health';
  }
  if (s.includes('curated') || s.includes('discovered_accounts')) return 'direct_health';
  if (s.includes('orchestrator_keyword_search')) return 'direct_health';
  if (s.includes('orchestrator_viral_watcher')) return 'broad_viral_cultural';
  if (s.includes('orchestrator_discovered')) return 'health_adjacent_lifestyle';
  return 'direct_health';
}

/** Get bucket from opp features (set at sync time from feed). */
export function getDiscoveryBucketFromOpp(opp: { features?: Record<string, unknown> | null; discovery_source?: string | null } | null | undefined): DiscoveryBucket {
  const bucket = opp?.features?.discovery_bucket;
  if (bucket === 'direct_health' || bucket === 'health_adjacent_lifestyle' || bucket === 'broad_viral_cultural') {
    return bucket;
  }
  return discoverySourceToBucket(opp?.discovery_source);
}
