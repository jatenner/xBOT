/**
 * Set a controlled window token for single-post tests
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db/index';
import crypto from 'crypto';

async function main() {
  const supabase = getSupabaseClient();
  
  // Generate a random token
  const token = crypto.randomBytes(32).toString('hex');
  
  // Insert or update the token
  const { data, error } = await supabase
    .from('ops_control')
    .upsert(
      {
        key: 'controlled_post_token',
        value: token,
        updated_at: new Date().toISOString()
      },
      { onConflict: 'key' }
    )
    .select()
    .single();
  
  if (error) {
    console.error(`❌ Error setting token: ${error.message}`);
    process.exit(1);
  }
  
  console.log(`✅ Controlled window token set:`);
  console.log(`   Token: ${token}`);
  console.log(`   Updated at: ${data?.updated_at}`);
  console.log(`\n📋 Set Railway variable:`);
  console.log(`   railway variables --set CONTROLLED_POST_TOKEN=${token}`);
  
  process.exit(0);
}

main().catch(console.error);

