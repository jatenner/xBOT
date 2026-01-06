/**
 * Query tweet details from database
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db/index';

const tweetId = process.argv[2];

if (!tweetId) {
  console.error('Usage: tsx scripts/query-tweet-details.ts <tweet_id>');
  process.exit(1);
}

async function main() {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('*')
    .eq('tweet_id', tweetId)
    .single();
  
  if (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
  
  console.log(JSON.stringify(data, null, 2));
  process.exit(0);
}

main().catch(console.error);

