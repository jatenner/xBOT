/**
 * Quick Reply Check (Last 10 Posted)
 * Shows tweet_id + parent_tweet_id + reply preview + parent preview
 */

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log('🔍 LAST 10 POSTED REPLIES\n');
  console.log('═══════════════════════════════════════════════════════\n');
  
  const { data: replies, error } = await supabase
    .from('content_metadata')
    .select('decision_id, tweet_id, target_tweet_id, target_username, content, posted_at, updated_at')
    .eq('decision_type', 'reply')
    .eq('status', 'posted')
    .not('posted_at', 'is', null)
    .order('posted_at', { ascending: false })
    .limit(10);
  
  if (error) {
    console.log(`❌ Error: ${error.message}\n`);
    return;
  }
  
  if (!replies || replies.length === 0) {
    console.log('❌ No posted replies found with non-null posted_at\n');
    console.log('(Some replies may have status=posted but posted_at=NULL)\n');
    return;
  }
  
  console.log(`Found ${replies.length} posted replies:\n`);
  
  for (let i = 0; i < replies.length; i++) {
    const reply = replies[i];
    const ago = Math.round((Date.now() - new Date(reply.posted_at).getTime()) / (1000 * 60));
    
    console.log(`${i+1}. ${reply.decision_id.substring(0, 8)}... (${ago}m ago)`);
    console.log(`   Tweet ID: ${reply.tweet_id || 'NULL'}`);
    console.log(`   Parent ID: ${reply.target_tweet_id || 'NULL'} (@${reply.target_username || 'NULL'})`);
    console.log(`   Reply: "${reply.content.substring(0, 100)}${reply.content.length > 100 ? '...' : ''}"`);
    console.log(`   Parent: (context fetch not yet implemented)`);
    
    console.log('');
  }
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});

