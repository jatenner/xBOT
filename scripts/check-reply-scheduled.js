const { createClient } = require('@supabase/supabase-js');

const c = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  const { data: replies, count } = await c
    .from('content_metadata')
    .select('decision_id, scheduled_at, created_at, target_username', { count: 'exact' })
    .eq('decision_type', 'reply')
    .eq('status', 'queued')
    .order('created_at', { ascending: false })
    .limit(10);
  
  console.log(`Total queued replies: ${count}`);
  console.log('\nSample of 10:');
  
  if (replies && replies.length > 0) {
    replies.forEach((r, i) => {
      const scheduled = r.scheduled_at || 'NULL';
      console.log(`${i + 1}. @${r.target_username}: scheduled=${scheduled}`);
    });
    
    const nullScheduled = replies.filter(r => !r.scheduled_at).length;
    console.log(`\n❌ ${nullScheduled}/10 have NULL scheduled_at`);
    
    if (nullScheduled > 0) {
      console.log('\n🔧 FIX: Reply generator needs to set scheduled_at when creating replies');
    }
  }
  
  process.exit(0);
})();

