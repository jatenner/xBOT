/**
 * Test token consumption
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db/index';

const token = process.argv[2];

if (!token) {
  console.error('Usage: tsx scripts/test-token-consumption.ts <token>');
  process.exit(1);
}

async function main() {
  const supabase = getSupabaseClient();
  
  console.log(`🔍 Testing token consumption:`);
  console.log(`   Token: ${token.substring(0, 20)}...`);
  
  const { data, error } = await supabase
    .rpc('consume_controlled_token', { token_value: token });
  
  if (error) {
    console.error(`❌ Error: ${error.message}`);
    console.error(`   Code: ${error.code}`);
    process.exit(1);
  }
  
  console.log(`✅ Result: ${data}`);
  
  if (data) {
    console.log(`✅ Token consumed successfully!`);
  } else {
    console.log(`❌ Token consumption failed (token doesn't match or already consumed)`);
  }
  
  // Check token status after
  const { data: tokenData } = await supabase
    .from('ops_control')
    .select('value')
    .eq('key', 'controlled_post_token')
    .single();
  
  console.log(`\n📊 Token status after consumption:`);
  console.log(`   Value: ${tokenData?.value?.substring(0, 50)}...`);
  
  process.exit(0);
}

main().catch(console.error);

