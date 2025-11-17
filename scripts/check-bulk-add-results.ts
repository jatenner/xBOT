/**
 * Quick script to check bulk add results
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db/index';

async function main() {
  const supabase = getSupabaseClient();
  
  // Total accounts
  const { data: total } = await supabase
    .from('vi_scrape_targets')
    .select('id', { count: 'exact', head: true });
  
  // Bulk added accounts
  const { data: bulkAdded } = await supabase
    .from('vi_scrape_targets')
    .select('tier, inclusion_reason', { count: 'exact' })
    .eq('discovery_method', 'manual_bulk_add');
  
  // By tier
  const { data: byTier } = await supabase
    .from('vi_scrape_targets')
    .select('tier')
    .eq('discovery_method', 'manual_bulk_add');
  
  const tierCounts: Record<string, number> = {};
  (byTier || []).forEach((acc: any) => {
    tierCounts[acc.tier] = (tierCounts[acc.tier] || 0) + 1;
  });
  
  // By generator (from inclusion_reason JSON)
  const generatorCounts: Record<string, number> = {};
  (bulkAdded || []).forEach((acc: any) => {
    try {
      const reason = typeof acc.inclusion_reason === 'string' 
        ? JSON.parse(acc.inclusion_reason) 
        : acc.inclusion_reason;
      const generators = reason?.primary_generators || [];
      generators.forEach((gen: string) => {
        generatorCounts[gen] = (generatorCounts[gen] || 0) + 1;
      });
    } catch (e) {
      // Skip if can't parse
    }
  });
  
  console.log('\n✅ BULK ADD RESULTS:\n');
  console.log(`Total accounts in system: ${total?.length || 0}`);
  console.log(`Bulk added accounts: ${bulkAdded?.length || 0}\n`);
  
  console.log('📊 BY TIER:');
  Object.entries(tierCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([tier, count]) => {
      console.log(`   ${tier}: ${count}`);
    });
  
  console.log('\n🎭 BY GENERATOR:');
  Object.entries(generatorCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .forEach(([gen, count]) => {
      console.log(`   ${gen}: ${count}`);
    });
  
  console.log('\n');
  process.exit(0);
}

main().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});

