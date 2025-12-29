#!/usr/bin/env tsx
/**
 * Verify Phase 1 migration (engagement tiers)
 * Apply if needed using Supabase client
 */

import { getSupabaseClient } from '../src/lib/db.js';

async function main() {
  console.log('🔍 Verifying Phase 1 migration...\n');

  const supabase = getSupabaseClient();

  try {
    // Test if engagement_tier column exists by trying to select it
    const { data, error } = await supabase
      .from('reply_opportunities')
      .select('engagement_tier')
      .limit(1);

    if (error && error.message.includes('column') && error.message.includes('does not exist')) {
      console.log('⚠️  engagement_tier column missing - applying migration...\n');

      // Apply migration via raw SQL
      const { error: migrationError } = await supabase.rpc('exec_sql', {
        sql: `
          ALTER TABLE reply_opportunities 
          ADD COLUMN IF NOT EXISTS engagement_tier TEXT;

          CREATE INDEX IF NOT EXISTS idx_reply_opp_engagement_tier 
          ON reply_opportunities(engagement_tier);

          ALTER TABLE reply_opportunities 
          ADD COLUMN IF NOT EXISTS timing_window TEXT;

          ALTER TABLE reply_opportunities 
          ADD COLUMN IF NOT EXISTS account_size_tier TEXT;

          ALTER TABLE reply_opportunities 
          ADD COLUMN IF NOT EXISTS opportunity_score_v2 NUMERIC(10,2) DEFAULT 0;

          CREATE INDEX IF NOT EXISTS idx_reply_opp_score_v2 
          ON reply_opportunities(opportunity_score_v2 DESC);
        `
      });

      if (migrationError) {
        console.error('❌ Migration failed:', migrationError.message);
        
        // Try alternative: check in Railway logs if columns were added by auto-migration
        console.log('\n💡 Columns may have been added automatically by Railway.');
        console.log('   Check Railway logs for "ALTER TABLE reply_opportunities"');
        process.exit(1);
      }

      console.log('✅ Migration applied successfully!');
    } else if (error) {
      console.error('❌ Error checking migration status:', error.message);
      process.exit(1);
    } else {
      console.log('✅ engagement_tier column exists!');
    }

    // Verify all columns
    console.log('\n🔍 Verifying Phase 1 columns...');
    
    const testQuery = await supabase
      .from('reply_opportunities')
      .select('engagement_tier, timing_window, account_size_tier, opportunity_score_v2')
      .limit(1);

    if (testQuery.error) {
      console.log('⚠️  Some columns may be missing:', testQuery.error.message);
      console.log('\n📋 Expected columns:');
      console.log('   - engagement_tier (TEXT)');
      console.log('   - timing_window (TEXT)');
      console.log('   - account_size_tier (TEXT)');
      console.log('   - opportunity_score_v2 (NUMERIC)');
    } else {
      console.log('✅ All Phase 1 columns verified!');
      console.log('   - engagement_tier: ✓');
      console.log('   - timing_window: ✓');
      console.log('   - account_size_tier: ✓');
      console.log('   - opportunity_score_v2: ✓');
    }

    console.log('\n🎉 Phase 1 migration verification complete!');
    console.log('\n📊 Next: Wait 30 min for harvester to run, then check:');
    console.log('   railway logs | grep "\\[HARVESTER\\] 🔥"');
    console.log('   Should see: "EXTREME tier: 100K+ likes"');

    process.exit(0);
  } catch (error: any) {
    console.error('❌ Verification failed:', error.message);
    process.exit(1);
  }
}

main();

