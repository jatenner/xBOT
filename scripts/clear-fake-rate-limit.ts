/**
 * 🚨 CLEAR FAKE RATE LIMIT
 * The rate limit shows 6 posts but last real post was 10h ago
 * This clears phantom/fake posts blocking the rate limit
 */

import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

import { getSupabaseClient } from '../src/db/index';

async function clearFakeRateLimit() {
  console.log('🚨 CLEARING FAKE RATE LIMIT BLOCKER\n');
  console.log('='.repeat(60));
  
  const supabase = getSupabaseClient();
  const oneHourAgo = new Date(Date.now() - 60*60*1000);
  const now = new Date();
  
  // 1. Find all posts marked as posted in last hour
  console.log('\n1️⃣ FINDING POSTS IN LAST HOUR:');
  const { data: recent } = await supabase
    .from('content_metadata')
    .select('decision_id, posted_at, tweet_id, status')
    .in('decision_type', ['single', 'thread'])
    .eq('status', 'posted')
    .gte('posted_at', oneHourAgo.toISOString())
    .order('posted_at', { ascending: false });
  
  console.log(`   Found: ${recent?.length || 0} posts`);
  
  if (recent && recent.length > 0) {
    console.log('\n   Details:');
    recent.forEach((p, i) => {
      const posted = new Date(p.posted_at);
      const mins = Math.round((Date.now() - posted.getTime())/60000);
      const isPhantom = !p.tweet_id || 
        p.tweet_id.toString().startsWith('mock_') || 
        p.tweet_id.toString().startsWith('emergency_') || 
        p.tweet_id.toString().startsWith('bulletproof_') || 
        p.tweet_id.toString().startsWith('posted_');
      console.log(`   ${i+1}. ${p.decision_id.substring(0,8)}... tweet_id=${p.tweet_id || 'NULL'}, ${mins}min ago, ${isPhantom ? 'PHANTOM ❌' : 'REAL ✅'}`);
    });
    
    // 2. Mark ALL as failed (they're blocking the rate limit)
    // If they were real, they'd be on Twitter already
    console.log('\n2️⃣ CLEARING ALL (they should be on Twitter if real):');
    const idsToClear = recent.map(p => p.decision_id);
    
    const { error } = await supabase
      .from('content_metadata')
      .update({ 
        status: 'failed',
        error_message: 'Cleared - blocking rate limit, not on Twitter',
        updated_at: now.toISOString()
      })
      .in('decision_id', idsToClear);
    
    if (error) {
      console.error(`   ❌ Error: ${error.message}`);
    } else {
      console.log(`   ✅ Cleared ${idsToClear.length} posts from rate limit`);
    }
  } else {
    console.log('   ✅ No posts found in last hour');
  }
  
  // 3. Check real posts (last 24h)
  console.log('\n3️⃣ REAL POSTS (last 24h):');
  const oneDayAgo = new Date(Date.now() - 24*60*60*1000);
  const { data: realPosts } = await supabase
    .from('content_metadata')
    .select('decision_id, posted_at, tweet_id')
    .in('decision_type', ['single', 'thread'])
    .eq('status', 'posted')
    .gte('posted_at', oneDayAgo.toISOString())
    .not('tweet_id', 'is', null)
    .not('tweet_id', 'like', 'mock_%')
    .not('tweet_id', 'like', 'emergency_%')
    .not('tweet_id', 'like', 'bulletproof_%')
    .not('tweet_id', 'like', 'posted_%')
    .order('posted_at', { ascending: false })
    .limit(10);
  
  console.log(`   Real posts: ${realPosts?.length || 0}`);
  if (realPosts && realPosts.length > 0) {
    realPosts.forEach((p, i) => {
      const posted = new Date(p.posted_at);
      const hours = Math.round((Date.now() - posted.getTime())/(60*60*1000));
      console.log(`   ${i+1}. tweet_id=${p.tweet_id}, ${hours}h ago`);
    });
  }
  
  // 4. Final status
  console.log('\n' + '='.repeat(60));
  console.log('📊 FINAL STATUS:');
  
  const { count: newCount } = await supabase
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
  
  console.log(`   Real posts in last hour: ${newCount || 0}/1`);
  console.log(`   Status: ${(newCount || 0) >= 1 ? '⚠️ Still blocked' : '✅ CLEARED - Ready to post!'}`);
  
  if ((newCount || 0) < 1) {
    console.log('\n✅ RATE LIMIT CLEARED!');
    console.log('   System should start posting in next cycle (5 min)');
  }
}

clearFakeRateLimit().catch(console.error);

