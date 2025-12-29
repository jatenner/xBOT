#!/usr/bin/env tsx
/**
 * Check if Phase 1 columns exist in reply_opportunities table
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

async function main() {
  console.log('🔍 Checking Phase 1 columns...\n');

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Test query for all Phase 1 columns
    const { data, error } = await supabase
      .from('reply_opportunities')
      .select('engagement_tier, timing_window, account_size_tier, opportunity_score_v2')
      .limit(1);

    if (error) {
      if (error.message.includes('column') && error.message.includes('does not exist')) {
        console.log('⚠️  Phase 1 columns NOT FOUND!');
        console.log('❌ Error:', error.message);
        console.log('\n📋 Expected columns:');
        console.log('   - engagement_tier (TEXT)');
        console.log('   - timing_window (TEXT)');
        console.log('   - account_size_tier (TEXT)');
        console.log('   - opportunity_score_v2 (NUMERIC)\n');
        console.log('💡 Solution: Manually add columns via Supabase SQL Editor:');
        console.log('   ALTER TABLE reply_opportunities ADD COLUMN IF NOT EXISTS engagement_tier TEXT;');
        console.log('   ALTER TABLE reply_opportunities ADD COLUMN IF NOT EXISTS timing_window TEXT;');
        console.log('   ALTER TABLE reply_opportunities ADD COLUMN IF NOT EXISTS account_size_tier TEXT;');
        console.log('   ALTER TABLE reply_opportunities ADD COLUMN IF NOT EXISTS opportunity_score_v2 NUMERIC(10,2) DEFAULT 0;');
        process.exit(1);
      } else {
        console.error('❌ Query error:', error.message);
        process.exit(1);
      }
    }

    console.log('✅ All Phase 1 columns exist!');
    console.log('   - engagement_tier: ✓');
    console.log('   - timing_window: ✓');
    console.log('   - account_size_tier: ✓');
    console.log('   - opportunity_score_v2: ✓');

    // Check if any opportunities have tier classification yet
    const { data: tieredOpps, error: tierError } = await supabase
      .from('reply_opportunities')
      .select('engagement_tier')
      .not('engagement_tier', 'is', null)
      .limit(5);

    if (tierError) {
      console.warn('\n⚠️  Error checking tier data:', tierError.message);
    } else if (tieredOpps && tieredOpps.length > 0) {
      console.log(`\n📊 Found ${tieredOpps.length} opportunities with tier classification`);
      const tiers = tieredOpps.map((o: any) => o.engagement_tier).filter(Boolean);
      if (tiers.length > 0) {
        console.log(`   Sample tiers: ${[...new Set(tiers)].join(', ')}`);
      }
    } else {
      console.log('\n📊 No opportunities classified yet (harvester hasn\'t run since deploy)');
      console.log('   Wait 30 min for harvester to run, then new opportunities will have tiers');
    }

    console.log('\n🎉 Phase 1 deployment verified!');
    console.log('\n📊 Next: Check harvester logs:');
    console.log('   railway logs | grep "\\[HARVESTER\\] 🔥"');
    console.log('   Expected: "ENGAGEMENT-FIRST discovery tiers"');
    console.log('   Expected: "EXTREME tier: 100K+ likes"');

    process.exit(0);
  } catch (error: any) {
    console.error('❌ Verification failed:', error.message);
    process.exit(1);
  }
}

main();

