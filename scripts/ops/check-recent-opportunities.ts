#!/usr/bin/env tsx
/**
 * Check recent opportunities by discovery_source
 */

import 'dotenv/config';
import { getSupabaseClient } from '../../src/db/index';

async function main() {
  const supabase = getSupabaseClient();
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  
  const { data } = await supabase
    .from('reply_opportunities')
    .select('discovery_source, accessibility_status, created_at, target_tweet_id, target_username')
    .gte('created_at', oneHourAgo)
    .eq('replied_to', false)
    .order('created_at', { ascending: false })
    .limit(50);
  
  console.log('Recent opportunities (last 60 min):', data?.length || 0);
  
  const bySource: Record<string, number> = {};
  data?.forEach((o: any) => {
    const source = o.discovery_source || 'unknown';
    bySource[source] = (bySource[source] || 0) + 1;
  });
  
  console.log('\nCounts by discovery_source:');
  Object.entries(bySource).forEach(([source, count]) => {
    console.log(`  ${source}: ${count}`);
  });
  
  const publicCandidates = data?.filter((o: any) => o.discovery_source?.startsWith('public_search_'));
  console.log(`\nPublic candidates: ${publicCandidates?.length || 0}`);
  
  if (publicCandidates && publicCandidates.length > 0) {
    console.log('\nSample public candidate:');
    console.log(JSON.stringify(publicCandidates[0], null, 2));
  }
}

main().catch(console.error);
