import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

async function checkFalseSuccess() {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  
  const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  
  const { data, error } = await supabase
    .from('content_metadata')
    .select('decision_id, decision_type, status, tweet_id, thread_tweet_ids, posted_at, created_at')
    .eq('status', 'posted')
    .is('tweet_id', null)
    .gte('updated_at', cutoffTime)
    .order('posted_at', { ascending: false });
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log(`Found ${data.length} false success rows:\n`);
  
  data.forEach(row => {
    console.log(`Decision: ${row.decision_id.substring(0, 8)}...`);
    console.log(`  Type: ${row.decision_type}`);
    console.log(`  Posted at: ${row.posted_at}`);
    console.log(`  Created at: ${row.created_at}`);
    console.log(`  Tweet ID: ${row.tweet_id}`);
    console.log(`  Thread IDs: ${row.thread_tweet_ids}`);
    console.log('');
  });
}

checkFalseSuccess().catch(console.error);
