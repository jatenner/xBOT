import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

async function fixFalseSuccess() {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  
  const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  
  // Find false success rows
  const { data, error } = await supabase
    .from('content_metadata')
    .select('decision_id')
    .eq('status', 'posted')
    .is('tweet_id', null)
    .gte('updated_at', cutoffTime);
  
  if (error || !data || data.length === 0) {
    console.log('No false success rows to fix');
    return;
  }
  
  console.log(`Fixing ${data.length} false success rows...`);
  
  // Mark them as failed
  const { error: updateError } = await supabase
    .from('content_metadata')
    .update({ 
      status: 'failed',
      updated_at: new Date().toISOString()
    })
    .in('decision_id', data.map(d => d.decision_id));
  
  if (updateError) {
    console.error('Update failed:', updateError);
  } else {
    console.log('✅ Fixed false success rows');
  }
}

fixFalseSuccess().catch(console.error);
