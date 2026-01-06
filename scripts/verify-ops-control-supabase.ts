/**
 * Verify ops_control table via Supabase client
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db/index';

async function main() {
  const supabase = getSupabaseClient();
  
  try {
    // Try to query the table directly
    console.log('🔍 Checking if ops_control table exists...');
    const { data, error } = await supabase
      .from('ops_control')
      .select('key, value, updated_at')
      .limit(1);
    
    if (error) {
      if (error.code === '42P01') {
        console.error('❌ Table NOT found: ops_control (error code: 42P01)');
        process.exit(1);
      } else {
        console.error(`❌ Error querying table: ${error.message} (code: ${error.code})`);
        process.exit(1);
      }
    } else {
      console.log('✅ Table exists: ops_control');
      console.log(`   Sample data: ${data ? JSON.stringify(data, null, 2) : 'empty'}`);
    }
    
    // Try to call the function
    console.log('🔍 Checking if consume_controlled_token function exists...');
    const { data: functionTest, error: functionError } = await supabase
      .rpc('consume_controlled_token', { token_value: 'test_nonexistent_token' });
    
    if (functionError) {
      if (functionError.code === '42883') {
        console.error('❌ Function NOT found: consume_controlled_token (error code: 42883)');
        process.exit(1);
      } else {
        // Function exists but token doesn't (expected)
        console.log(`✅ Function exists: consume_controlled_token`);
        console.log(`   Test call result: ${functionTest} (expected false for nonexistent token)`);
      }
    } else {
      console.log(`✅ Function exists: consume_controlled_token`);
      console.log(`   Test call result: ${functionTest}`);
    }
    
    console.log('\n✅ All verifications passed!');
    
  } catch (error: any) {
    console.error(`❌ Error: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

main().catch(console.error);

