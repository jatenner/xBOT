/**
 * 🏥 THREAD HEALTH CHECK
 * 
 * Monitors thread generation and posting health.
 * Run this to diagnose thread posting issues.
 */

import { getSupabaseClient } from '../src/db/index';

async function checkThreadHealth() {
  console.log('🏥 THREAD HEALTH CHECK\n');
  
  const supabase = getSupabaseClient();
  const now = new Date();
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  
  // 1. Check thread generation rate (last 7 days)
  console.log('📊 Thread Generation Rate (Last 7 Days)');
  console.log('━'.repeat(60));
  
  const { data: generationData, error: genError } = await supabase
    .from('content_metadata')
    .select('decision_type')
    .gte('created_at', last7d.toISOString());
  
  if (genError) {
    console.error('❌ Error checking generation:', genError.message);
  } else if (generationData) {
    const singles = generationData.filter(d => d.decision_type === 'single').length;
    const threads = generationData.filter(d => d.decision_type === 'thread').length;
    const total = generationData.length;
    const threadPercent = total > 0 ? (threads / total * 100).toFixed(1) : 0;
    
    console.log(`   Total Content: ${total}`);
    console.log(`   Single Tweets: ${singles} (${((singles/total)*100).toFixed(1)}%)`);
    console.log(`   Threads: ${threads} (${threadPercent}%)`);
    console.log(`   Expected: 25% threads`);
    console.log(`   Status: ${parseFloat(String(threadPercent)) >= 20 ? '✅ HEALTHY' : '⚠️ LOW'}`);
  }
  
  // 2. Check thread posting status (last 24h)
  console.log('\n📝 Thread Status (Last 24 Hours)');
  console.log('━'.repeat(60));
  
  const { data: statusData, error: statusError } = await supabase
    .from('content_metadata')
    .select('status')
    .eq('decision_type', 'thread')
    .gte('created_at', last24h.toISOString());
  
  if (statusError) {
    console.error('❌ Error checking status:', statusError.message);
  } else if (statusData && statusData.length > 0) {
    const queued = statusData.filter(d => d.status === 'queued').length;
    const posted = statusData.filter(d => d.status === 'posted').length;
    const failed = statusData.filter(d => d.status === 'failed').length;
    const cancelled = statusData.filter(d => d.status === 'cancelled').length;
    
    console.log(`   Queued: ${queued}`);
    console.log(`   Posted: ${posted} ✅`);
    console.log(`   Failed: ${failed} ${failed > 0 ? '⚠️' : ''}`);
    console.log(`   Cancelled: ${cancelled}`);
    
    if (posted === 0 && (queued > 0 || failed > 0)) {
      console.log('\n   ⚠️ WARNING: Threads generated but not posting successfully!');
    }
  } else {
    console.log('   ℹ️ No threads generated in last 24 hours');
  }
  
  // 3. Check recent thread posts
  console.log('\n🧵 Recent Thread Posts');
  console.log('━'.repeat(60));
  
  const { data: recentThreads, error: threadsError } = await supabase
    .from('content_metadata')
    .select('id, status, thread_parts, created_at, scheduled_at')
    .eq('decision_type', 'thread')
    .order('created_at', { ascending: false })
    .limit(5);
  
  if (threadsError) {
    console.error('❌ Error fetching threads:', threadsError.message);
  } else if (recentThreads && recentThreads.length > 0) {
    recentThreads.forEach((thread: any, i: number) => {
      const parts = thread.thread_parts as string[] || [];
      const age = Math.floor((now.getTime() - new Date(String(thread.created_at)).getTime()) / (1000 * 60));
      console.log(`\n   ${i + 1}. Thread ${String(thread.id).substring(0, 8)}...`);
      console.log(`      Status: ${thread.status}`);
      console.log(`      Parts: ${parts.length} tweets`);
      console.log(`      Age: ${age}min ago`);
      console.log(`      Preview: "${parts[0]?.substring(0, 60)}..."`);
    });
  } else {
    console.log('   ℹ️ No threads found in database');
  }
  
  // 4. Check if any threads were actually posted to Twitter
  console.log('\n🐦 Threads Posted to Twitter');
  console.log('━'.repeat(60));
  
  const { data: postedThreads, error: postedError } = await supabase
    .from('posted_decisions')
    .select('tweet_id, posted_at, decision_id')
    .in('decision_id', recentThreads?.map(t => t.id) || [])
    .order('posted_at', { ascending: false })
    .limit(3);
  
  if (postedError) {
    console.error('❌ Error checking posted threads:', postedError.message);
  } else if (postedThreads && postedThreads.length > 0) {
    console.log(`   ✅ ${postedThreads.length} thread(s) posted successfully:\n`);
    postedThreads.forEach((post: any, i: number) => {
      const age = Math.floor((now.getTime() - new Date(String(post.posted_at)).getTime()) / (1000 * 60));
      console.log(`   ${i + 1}. https://x.com/Signal_Synapse/status/${post.tweet_id}`);
      console.log(`      Posted: ${age}min ago`);
    });
  } else {
    console.log('   ⚠️ No threads have been posted to Twitter yet');
  }
  
  // 5. Summary
  console.log('\n📋 Summary');
  console.log('━'.repeat(60));
  
  const threadsGenerated = generationData?.filter(d => d.decision_type === 'thread').length || 0;
  const threadsPosted = postedThreads?.length || 0;
  
  if (threadsGenerated === 0) {
    console.log('   ⚠️ No threads being generated - check plan job');
  } else if (threadsPosted === 0) {
    console.log('   ⚠️ Threads generated but not posting - check posting queue');
  } else {
    console.log('   ✅ Thread system is working!');
  }
  
  console.log('\n🏁 Health check complete!\n');
}

// Run the health check
checkThreadHealth().catch((error) => {
  console.error('💥 Health check failed:', error);
  process.exit(1);
});

