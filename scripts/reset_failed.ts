import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function resetFailedDecisions() {
  const { data, error } = await supabase
    .from('content_metadata')
    .update({ status: 'queued' })
    .eq('status', 'failed')
    .gt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .select('decision_id, decision_type');
    
  if (error) {
    console.log('Error:', error.message);
  } else {
    console.log('✅ Reset', data?.length || 0, 'failed decisions');
    data?.forEach(d => console.log('  -', d.decision_id, d.decision_type));
  }
}

resetFailedDecisions();
