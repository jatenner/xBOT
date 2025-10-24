require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function diagnose() {
  console.log('🔍 POSTING QUEUE DIAGNOSTIC\n');
  
  const GRACE_MINUTES = parseInt(process.env.GRACE_MINUTES || '5', 10);
  const now = new Date();
  const graceWindow = new Date(Date.now() + GRACE_MINUTES * 60 * 1000);
  
  console.log(`Grace window: ${GRACE_MINUTES} minutes`);
  console.log(`Now: ${now.toISOString()}`);
  console.log(`Grace: ${graceWindow.toISOString()}\n`);
  
  // Get queued posts
  const { data: queued } = await supabase
    .from('content_metadata')
    .select('decision_id, decision_type, status, scheduled_at, created_at, quality_score, content')
    .eq('status', 'queued')
    .lte('scheduled_at', graceWindow.toISOString())
    .order('scheduled_at', { ascending: true })
    .limit(10);
  
  console.log(`📊 Queued within grace window: ${queued?.length || 0}\n`);
  
  if (queued && queued.length > 0) {
    for (const q of queued) {
      const sched = new Date(q.scheduled_at);
      const minOverdue = ((now.getTime() - sched.getTime()) / (1000 * 60)).toFixed(0);
      
      console.log(`Decision: ${q.decision_id}`);
      console.log(`  Type: ${q.decision_type}`);
      console.log(`  Overdue by: ${minOverdue} minutes`);
      console.log(`  Quality: ${q.quality_score}`);
      console.log(`  Content: "${q.content.substring(0, 50)}..."`);
      
      // Check if already posted
      const { data: posted } = await supabase
        .from('posted_decisions')
        .select('decision_id')
        .eq('decision_id', q.decision_id)
        .single();
      
      if (posted) {
        console.log(`  ⚠️  ALREADY POSTED (duplicate!)`);
      } else {
        console.log(`  ✅ Not posted yet - SHOULD POST`);
      }
      console.log('');
    }
  }
  
  // Check rate limits
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const { count: contentCount } = await supabase
    .from('posted_decisions')
    .select('*', { count: 'exact', head: true })
    .in('decision_type', ['single', 'thread'])
    .gte('posted_at', hourAgo.toISOString());
  
  const { count: replyCount } = await supabase
    .from('posted_decisions')
    .select('*', { count: 'exact', head: true })
    .eq('decision_type', 'reply')
    .gte('posted_at', hourAgo.toISOString());
  
  console.log(`🚦 RATE LIMITS:`);
  console.log(`  Content (single/thread): ${contentCount || 0}/2`);
  console.log(`  Replies: ${replyCount || 0}/4`);
}

diagnose().catch(console.error);
