/**
 * 🔧 FIX AND RESTART POSTING SYSTEM
 * Comprehensive fix to get system posting live on X
 */

import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

import { getSupabaseClient } from '../src/db/index';

async function fixAndRestart() {
  console.log('🔧 FIXING AND RESTARTING POSTING SYSTEM\n');
  console.log('='.repeat(60));
  
  const supabase = getSupabaseClient();
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60*60*1000);
  const fifteenMinAgo = new Date(now.getTime() - 15*60*1000);
  
  // 1. Fix stuck posts
  console.log('\n1️⃣ FIXING STUCK POSTS:');
  const { data: stuck } = await supabase
    .from('content_metadata')
    .select('decision_id')
    .eq('status', 'posting')
    .lt('created_at', fifteenMinAgo.toISOString());
  
  if (stuck && stuck.length > 0) {
    console.log(`   Found ${stuck.length} stuck posts, resetting to queued...`);
    const stuckIds = stuck.map(p => p.decision_id);
    const { error } = await supabase
      .from('content_metadata')
      .update({ status: 'queued', updated_at: now.toISOString() })
      .in('decision_id', stuckIds);
    
    if (error) {
      console.error(`   ❌ Error: ${error.message}`);
    } else {
      console.log(`   ✅ Reset ${stuck.length} stuck posts to queued`);
    }
  } else {
    console.log('   ✅ No stuck posts');
  }
  
  // 2. Clear phantom posts from rate limit
  console.log('\n2️⃣ CLEARING PHANTOM POSTS:');
  const { data: recent } = await supabase
    .from('content_metadata')
    .select('decision_id, tweet_id')
    .in('decision_type', ['single', 'thread'])
    .eq('status', 'posted')
    .gte('posted_at', oneHourAgo.toISOString());
  
  if (recent && recent.length > 0) {
    const phantom = recent.filter(p => 
      !p.tweet_id || 
      p.tweet_id.startsWith('mock_') || 
      p.tweet_id.startsWith('emergency_') || 
      p.tweet_id.startsWith('bulletproof_') ||
      p.tweet_id.startsWith('posted_')
    );
    
    if (phantom.length > 0) {
      console.log(`   Found ${phantom.length} phantom posts, marking as failed...`);
      const phantomIds = phantom.map(p => p.decision_id);
      const { error } = await supabase
        .from('content_metadata')
        .update({ 
          status: 'failed', 
          error_message: 'Phantom post - no real tweet_id',
          updated_at: now.toISOString()
        })
        .in('decision_id', phantomIds);
      
      if (error) {
        console.error(`   ❌ Error: ${error.message}`);
      } else {
        console.log(`   ✅ Cleared ${phantom.length} phantom posts from rate limit`);
      }
    } else {
      console.log('   ✅ No phantom posts found');
    }
  }
  
  // 3. Check current rate limit
  console.log('\n3️⃣ RATE LIMIT STATUS:');
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
  console.log(`   Status: ${(hourCount || 0) >= 1 ? '⚠️ LIMIT REACHED' : '✅ OK'}`);
  
  // 4. Check queued content
  console.log('\n4️⃣ QUEUED CONTENT:');
  const graceWindow = new Date(now.getTime() + 5*60*1000);
  const { data: ready } = await supabase
    .from('content_metadata')
    .select('decision_id, decision_type, scheduled_at')
    .eq('status', 'queued')
    .in('decision_type', ['single', 'thread'])
    .lte('scheduled_at', graceWindow.toISOString())
    .order('scheduled_at', { ascending: true })
    .limit(5);
  
  console.log(`   Ready to post: ${ready?.length || 0}`);
  if (ready && ready.length > 0) {
    ready.forEach((p, i) => {
      const mins = Math.round((now.getTime() - new Date(p.scheduled_at).getTime())/60000);
      console.log(`   ${i+1}. ${p.decision_type} ${p.decision_id.substring(0,8)}... (${mins}min overdue)`);
    });
  }
  
  // 5. Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY:');
  
  if ((hourCount || 0) < 1 && (ready?.length || 0) > 0) {
    console.log('✅ SYSTEM READY TO POST');
    console.log(`   - Rate limit: OK (${hourCount || 0}/1)`);
    console.log(`   - Queued posts: ${ready?.length || 0}`);
    console.log('   - Next posting cycle should pick these up');
  } else if ((hourCount || 0) >= 1) {
    console.log('⚠️ RATE LIMIT REACHED');
    console.log('   - Wait 1 hour for rate limit to reset');
    console.log('   - Or manually clear phantom posts if any remain');
  } else {
    console.log('⚠️ NO CONTENT READY');
    console.log('   - Generate new content or wait for plan job');
  }
  
  console.log('\n💡 NEXT STEPS:');
  console.log('   1. Verify MODE=live in Railway: railway variables | grep MODE');
  console.log('   2. If not set: railway variables --set MODE=live');
  console.log('   3. Restart service: railway restart');
  console.log('   4. Monitor logs: railway logs --lines 200 | grep POSTING_QUEUE');
}

fixAndRestart().catch(console.error);

