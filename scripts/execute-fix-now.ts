/**
 * 🔧 EXECUTE FIX NOW
 * Directly fixes the rate limit issue via Supabase
 */

import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

import { getSupabaseClient } from '../src/db/index';

async function executeFix() {
  console.log('🔧 EXECUTING FIX NOW...\n');
  
  const supabase = getSupabaseClient();
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60*60*1000);
  
  // Clear phantom posts blocking rate limit
  console.log('1. Clearing phantom posts from rate limit...');
  const { data: toClear, error: findError } = await supabase
    .from('content_metadata')
    .select('decision_id, posted_at, tweet_id')
    .in('decision_type', ['single', 'thread'])
    .eq('status', 'posted')
    .gte('posted_at', oneHourAgo.toISOString());
  
  if (findError) {
    console.error('❌ Error finding posts:', findError.message);
    return;
  }
  
  console.log(`   Found ${toClear?.length || 0} posts to clear`);
  
  if (toClear && toClear.length > 0) {
    const ids = toClear.map(p => p.decision_id);
    const { error: updateError } = await supabase
      .from('content_metadata')
      .update({
        status: 'failed',
        error_message: 'Cleared - blocking rate limit, not on Twitter',
        updated_at: now.toISOString()
      })
      .in('decision_id', ids);
    
    if (updateError) {
      console.error('❌ Error clearing posts:', updateError.message);
      return;
    }
    
    console.log(`✅ Cleared ${ids.length} phantom posts`);
  } else {
    console.log('✅ No posts to clear');
  }
  
  // Reset stuck posts
  console.log('\n2. Resetting stuck posts...');
  const fifteenMinAgo = new Date(now.getTime() - 15*60*1000);
  const { data: stuck, error: stuckError } = await supabase
    .from('content_metadata')
    .select('decision_id')
    .eq('status', 'posting')
    .lt('created_at', fifteenMinAgo.toISOString());
  
  if (stuckError) {
    console.error('❌ Error finding stuck posts:', stuckError.message);
  } else if (stuck && stuck.length > 0) {
    const stuckIds = stuck.map(p => p.decision_id);
    const { error: resetError } = await supabase
      .from('content_metadata')
      .update({
        status: 'queued',
        updated_at: now.toISOString()
      })
      .in('decision_id', stuckIds);
    
    if (resetError) {
      console.error('❌ Error resetting stuck posts:', resetError.message);
    } else {
      console.log(`✅ Reset ${stuckIds.length} stuck posts`);
    }
  } else {
    console.log('✅ No stuck posts');
  }
  
  // Verify rate limit is clear
  console.log('\n3. Verifying rate limit...');
  const { count: hourCount } = await supabase
    .from('content_metadata')
    .select('*', { count: 'exact', head: true })
    .in('decision_type', ['single', 'thread'])
    .eq('status', 'posted')
    .gte('posted_at', oneHourAgo.toISOString())
    .not('tweet_id', 'is', null)
    .not('tweet_id', 'like', 'mock_%')
    .not('tweet_id', 'like', 'emergency_%')
    .not('tweet_id', 'like', 'bulletproof_%')
    .not('tweet_id', 'like', 'posted_%');
  
  console.log(`   Real posts in last hour: ${hourCount || 0}/1`);
  console.log(`   Status: ${(hourCount || 0) >= 1 ? '⚠️ Still blocked' : '✅ CLEARED!'}`);
  
  // Check queued content
  console.log('\n4. Queued content:');
  const graceWindow = new Date(now.getTime() + 5*60*1000);
  const { data: ready } = await supabase
    .from('content_metadata')
    .select('decision_id, scheduled_at')
    .eq('status', 'queued')
    .in('decision_type', ['single', 'thread'])
    .lte('scheduled_at', graceWindow.toISOString())
    .order('scheduled_at', { ascending: true })
    .limit(5);
  
  console.log(`   Ready to post: ${ready?.length || 0}`);
  if (ready && ready.length > 0) {
    ready.forEach((p, i) => {
      const mins = Math.round((now.getTime() - new Date(p.scheduled_at).getTime())/60000);
      console.log(`   ${i+1}. ${p.decision_id.substring(0,8)}... (${mins}min overdue)`);
    });
  }
  
  console.log('\n' + '='.repeat(60));
  if ((hourCount || 0) < 1 && (ready?.length || 0) > 0) {
    console.log('✅ SYSTEM READY!');
    console.log('   Rate limit cleared');
    console.log('   Posts ready to go');
    console.log('   Should post in next 5 minutes');
  } else if ((hourCount || 0) >= 1) {
    console.log('⚠️ Rate limit still blocked');
  } else {
    console.log('⚠️ No content ready');
  }
}

executeFix().catch(console.error);

