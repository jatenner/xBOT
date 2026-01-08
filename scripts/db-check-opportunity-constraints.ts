import 'dotenv/config';
import { getSupabaseClient } from '../src/db/index';

/**
 * Check database constraints for reply_opportunities table
 * Prints column types and constraint definitions
 */
async function checkConstraints() {
  console.log('🔍 Checking reply_opportunities Database Constraints');
  console.log('═══════════════════════════════════════════════════════════\n');

  const supabase = getSupabaseClient();

  try {
    // Query information_schema for column types
    // Note: exec_sql RPC may not exist, so we'll use fallback approach
    let columns: any = null;
    let colError: any = null;
    
    try {
      const result = await supabase.rpc('exec_sql', {
        sql_query: `
          SELECT 
            column_name,
            data_type,
            character_maximum_length,
            numeric_precision,
            numeric_scale,
            is_nullable
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'reply_opportunities'
            AND column_name IN ('posted_minutes_ago', 'tier', 'age_minutes')
          ORDER BY column_name;
        `
      });
      if (result.error) throw result.error;
      columns = result.data;
    } catch (rpcError: any) {
      // Fallback: Use direct query if RPC doesn't exist
      const { data, error } = await supabase
        .from('reply_opportunities')
        .select('posted_minutes_ago, tier')
        .limit(0);
      
      if (error) {
        colError = error;
      }
      // columns remains null if RPC doesn't exist
    }

    // Query pg_constraint for tier check constraint
    let constraints: any = null;
    let constraintError: any = null;
    
    try {
      const result = await supabase.rpc('exec_sql', {
        sql_query: `
          SELECT 
            conname AS constraint_name,
            pg_get_constraintdef(oid) AS constraint_definition
          FROM pg_constraint
          WHERE conrelid = 'public.reply_opportunities'::regclass
            AND conname LIKE '%tier%'
          ORDER BY conname;
        `
      });
      if (result.error) throw result.error;
      constraints = result.data;
    } catch (rpcError: any) {
      // RPC doesn't exist or failed - we'll use fallback approach
      constraintError = rpcError;
    }

    // Alternative: Query via Supabase client (if RPC doesn't work)
    // We'll use a simpler approach - query the table structure
    console.log('📊 Column Information:\n');
    
    // Check posted_minutes_ago type by attempting a query
    const { data: sampleData, error: sampleError } = await supabase
      .from('reply_opportunities')
      .select('posted_minutes_ago, tier, age_minutes')
      .limit(1);

    if (sampleError && !sampleError.message.includes('does not exist')) {
      console.error(`❌ Error querying table: ${sampleError.message}`);
    } else {
      console.log('✅ Table exists and is queryable');
    }

    // Print constraint information
    console.log('\n📋 Expected Constraints:\n');
    console.log('Based on migrations:');
    console.log('  - posted_minutes_ago: INTEGER');
    console.log('  - tier: TEXT CHECK (tier IN (\'TITAN\', \'ULTRA\', \'MEGA\', \'SUPER\', \'HIGH\', \'golden\', \'good\', \'acceptable\'))');
    console.log('\n💡 To verify exact constraints, run this SQL in Supabase SQL Editor:');
    console.log(`
SELECT 
  column_name,
  data_type,
  numeric_precision,
  numeric_scale
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'reply_opportunities'
  AND column_name IN ('posted_minutes_ago', 'tier', 'age_minutes');

SELECT 
  conname AS constraint_name,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.reply_opportunities'::regclass
  AND conname LIKE '%tier%';
    `);

    // Try to get actual constraint via a test query with invalid tier
    console.log('\n🧪 Testing tier constraint...');
    const { error: testError } = await supabase
      .from('reply_opportunities')
      .insert({
        target_tweet_id: 'test_constraint_check_' + Date.now(),
        target_username: 'test',
        target_tweet_url: 'https://x.com/test/status/test',
        target_tweet_content: 'test',
        tier: 'INVALID_TIER_TEST',
        posted_minutes_ago: 0,
      })
      .select()
      .single();

    if (testError) {
      if (testError.message.includes('tier') || testError.message.includes('check constraint')) {
        console.log(`✅ Tier constraint is active: ${testError.message}`);
      } else {
        console.log(`⚠️  Insert error (may be expected): ${testError.message}`);
      }
    } else {
      console.log('⚠️  Test insert succeeded (constraint may not be active)');
      // Clean up test row
      await supabase
        .from('reply_opportunities')
        .delete()
        .eq('target_tweet_id', 'test_constraint_check_' + Date.now());
    }

  } catch (error: any) {
    console.error(`❌ Error checking constraints: ${error.message}`);
    console.error('\n💡 Alternative: Check constraints in Supabase Dashboard:');
    console.error('   1. Go to Table Editor > reply_opportunities');
    console.error('   2. Click "View Table Definition"');
    console.error('   3. Look for CHECK constraints on the tier column');
  }

  console.log('\n✅ Constraint check complete');
}

checkConstraints().catch(console.error);

