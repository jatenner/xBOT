/**
 * Check thread content flow
 */

import { getSupabaseClient } from '../src/db/index';

async function checkThreadFlow() {
  const supabase = getSupabaseClient();
  
  // Get most recent thread
  const { data: threads } = await supabase
    .from('content_metadata')
    .select('*')
    .eq('decision_type', 'thread')
    .eq('status', 'posted')
    .order('posted_at', { ascending: false })
    .limit(2);
  
  for (const thread of threads || []) {
    console.log(`\n🧵 THREAD: ${thread.decision_id.substring(0, 8)}`);
    console.log(`   Topic: ${thread.topic_cluster}`);
    console.log(`   Posted: ${thread.posted_at}`);
    console.log(`\n   PARTS:`);
    
    const parts = thread.thread_parts || [];
    for (let i = 0; i < parts.length; i++) {
      console.log(`   ${i + 1}. ${parts[i].substring(0, 80)}...`);
    }
    
    // Check for self-mentions in content
    const hasSelfMention = thread.content?.includes('@SignalAndSynapse') || 
                          thread.content?.includes('@Signal_Synapse');
    if (hasSelfMention) {
      console.log(`\n   ⚠️ CONTENT has @SignalAndSynapse mention (BAD - this is content bug)`);
    }
    
    // Check flow
    console.log(`\n   FLOW CHECK:`);
    if (parts.length > 1) {
      console.log(`   Tweet 1 topic vs Tweet 2 topic...`);
      // Simple check: do they mention similar keywords?
      const words1 = new Set(parts[0].toLowerCase().split(/\s+/));
      const words2 = new Set(parts[1]?.toLowerCase().split(/\s+/) || []);
      const overlap = [...words1].filter(w => words2.has(w)).length;
      console.log(`   Word overlap: ${overlap} words`);
      console.log(`   ${overlap > 3 ? '✅ Good flow' : '⚠️ Weak connection'}`);
    }
  }
  
  process.exit(0);
}

checkThreadFlow().catch(console.error);

