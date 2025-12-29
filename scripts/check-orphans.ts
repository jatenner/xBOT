import 'dotenv/config';
import { getSupabaseClient } from '../src/db/index.js';

async function check() {
  const supabase = getSupabaseClient();
  
  const orphanDecisionIds = [
    '86918643-85b5-42b8-ac42-2e044b4a4c8b',
    '4bbd3db3-7027-4eaf-9528-14c798226c01'
  ];
  
  console.log('\n🔍 Checking orphan decision IDs...\n');
  
  for (const id of orphanDecisionIds) {
    // Check content_generation_metadata_comprehensive
    const { data: decision } = await supabase
      .from('content_generation_metadata_comprehensive')
      .select('*')
      .eq('decision_id', id)
      .single();
    
    if (decision) {
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`Decision ID: ${id}`);
      console.log(`Type: ${decision.decision_type}`);
      console.log(`Status: ${decision.status}`);
      console.log(`Tweet ID: ${decision.tweet_id || 'NULL'}`);
      console.log(`Created: ${decision.created_at}`);
      console.log(`Posted: ${decision.posted_at || 'NULL'}`);
      
      if (decision.content) {
        console.log(`Content: "${decision.content.substring(0, 100)}..."`);
      }
      
      if (decision.thread_parts) {
        console.log(`⚠️  Thread Parts: ${decision.thread_parts.length}`);
      }
      
      const metadata = decision.metadata || {};
      if (metadata.target_username) {
        console.log(`Target: @${metadata.target_username}`);
      }
      
      console.log('');
    } else {
      console.log(`❌ Decision ${id} not found in database\n`);
    }
  }
}

check();
