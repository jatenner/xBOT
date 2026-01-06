/**
 * Check token status in database
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db/index';

async function main() {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('ops_control')
    .select('*')
    .eq('key', 'controlled_post_token')
    .single();
  
  if (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
  
  console.log(`📊 Token Status:`);
  console.log(`   Key: ${data?.key}`);
  console.log(`   Value: ${data?.value}`);
  console.log(`   Updated at: ${data?.updated_at}`);
  
  // Check if token starts with "consumed_"
  if (data?.value?.startsWith('consumed_')) {
    console.log(`\n⚠️  Token has been consumed!`);
    console.log(`   Consumed value: ${data.value.substring(0, 50)}...`);
  } else {
    console.log(`\n✅ Token is active and ready to consume`);
  }
  
  process.exit(0);
}

main().catch(console.error);

