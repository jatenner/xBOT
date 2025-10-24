require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function clearStale() {
  console.log('🧹 Clearing stale reply queue...\n');
  
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  
  // Mark old queued replies as failed
  const { data, error } = await supabase
    .from('content_metadata')
    .update({ status: 'failed' })
    .eq('decision_type', 'reply')
    .eq('status', 'queued')
    .lte('scheduled_at', oneHourAgo.toISOString())
    .select();
  
  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }
  
  console.log(`✅ Marked ${data?.length || 0} stale replies as failed`);
  
  // Show remaining queue
  const { count } = await supabase
    .from('content_metadata')
    .select('*', { count: 'exact', head: true })
    .eq('decision_type', 'reply')
    .eq('status', 'queued');
  
  console.log(`\n📊 Remaining queued replies: ${count || 0}`);
}

clearStale().catch(console.error);
