/**
 * Clear any existing lease on controlled_post_token
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db/index';

async function main() {
  const supabase = getSupabaseClient();
  
  // Get current token value
  const { data: tokenData, error: tokenError } = await supabase
    .from('ops_control')
    .select('value, lease_owner, lease_expires_at')
    .eq('key', 'controlled_post_token')
    .single();
  
  if (tokenError) {
    console.error(`❌ Error: ${tokenError.message}`);
    process.exit(1);
  }
  
  console.log(`📊 Current token status:`);
  console.log(`   Value: ${tokenData?.value?.substring(0, 20)}...`);
  console.log(`   Lease owner: ${tokenData?.lease_owner || 'None'}`);
  console.log(`   Lease expires: ${tokenData?.lease_expires_at || 'None'}`);
  console.log('');
  
  if (tokenData?.lease_owner) {
    console.log(`🔓 Clearing lease...`);
    const { error: clearError } = await supabase
      .from('ops_control')
      .update({
        lease_owner: null,
        lease_expires_at: null,
        updated_at: new Date().toISOString()
      })
      .eq('key', 'controlled_post_token');
    
    if (clearError) {
      console.error(`❌ Error clearing lease: ${clearError.message}`);
      process.exit(1);
    }
    
    console.log(`✅ Lease cleared`);
  } else {
    console.log(`✅ No lease to clear`);
  }
  
  process.exit(0);
}

main().catch(console.error);

