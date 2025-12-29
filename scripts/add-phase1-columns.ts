#!/usr/bin/env tsx
/**
 * Add Phase 1 columns to reply_opportunities table
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

async function main() {
  console.log('🔧 Adding Phase 1 columns to reply_opportunities...\n');

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const sqls = [
    'ALTER TABLE reply_opportunities ADD COLUMN IF NOT EXISTS engagement_tier TEXT;',
    'ALTER TABLE reply_opportunities ADD COLUMN IF NOT EXISTS timing_window TEXT;',
    'ALTER TABLE reply_opportunities ADD COLUMN IF NOT EXISTS account_size_tier TEXT;',
    'ALTER TABLE reply_opportunities ADD COLUMN IF NOT EXISTS opportunity_score_v2 NUMERIC(10,2) DEFAULT 0;',
    'CREATE INDEX IF NOT EXISTS idx_reply_opp_engagement_tier ON reply_opportunities(engagement_tier);',
    'CREATE INDEX IF NOT EXISTS idx_reply_opp_score_v2 ON reply_opportunities(opportunity_score_v2 DESC);'
  ];

  try {
    for (const sql of sqls) {
      console.log(`   Executing: ${sql.substring(0, 60)}...`);
      const { error } = await supabase.rpc('exec', { sql });
      
      if (error) {
        console.error(`   ❌ Failed: ${error.message}`);
        // Try alternative RPC name
        const { error: error2 } = await supabase.rpc('execute_sql', { query: sql });
        if (error2) {
          console.error(`   ❌ Alternative also failed: ${error2.message}`);
          console.log('\n💡 Manual SQL required - copy these to Supabase SQL Editor:\n');
          for (const s of sqls) {
            console.log(s);
          }
          process.exit(1);
        }
      }
      console.log('   ✅ Success');
    }

    console.log('\n✅ All columns added successfully!');
    
    // Verify
    const { data, error } = await supabase
      .from('reply_opportunities')
      .select('engagement_tier, timing_window, account_size_tier, opportunity_score_v2')
      .limit(1);

    if (error) {
      console.error('\n⚠️  Verification failed:', error.message);
      process.exit(1);
    }

    console.log('\n✅ Verification passed!');
    console.log('   - engagement_tier: ✓');
    console.log('   - timing_window: ✓');
    console.log('   - account_size_tier: ✓');
    console.log('   - opportunity_score_v2: ✓');

    console.log('\n🎉 Phase 1 migration complete!');
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Migration failed:', error.message);
    console.log('\n💡 Manual SQL required - copy these to Supabase SQL Editor:\n');
    for (const sql of sqls) {
      console.log(sql);
    }
    process.exit(1);
  }
}

main();

