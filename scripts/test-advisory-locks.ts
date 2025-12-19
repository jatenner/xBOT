/**
 * Test if advisory locks are accessible via Supabase
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

async function test() {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  console.log('[TEST] Testing advisory lock access...\n');

  // Test 1: Try to call pg_try_advisory_lock directly
  try {
    const { data, error } = await supabase.rpc('pg_try_advisory_lock', { lock_id: 999999 });
    if (error) {
      console.log(`[TEST] ❌ Direct call failed: ${error.message}`);
    } else {
      console.log(`[TEST] ✅ Direct call succeeded: ${data}`);
      
      // Release it
      const { data: unlockData, error: unlockError } = await supabase.rpc('pg_advisory_unlock', { lock_id: 999999 });
      if (unlockError) {
        console.log(`[TEST] ❌ Unlock failed: ${unlockError.message}`);
      } else {
        console.log(`[TEST] ✅ Unlock succeeded: ${unlockData}`);
      }
    }
  } catch (err: any) {
    console.log(`[TEST] ❌ Exception: ${err.message}`);
  }

  console.log('\n[TEST] Complete');
}

test();

