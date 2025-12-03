import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../.env') });

async function deepAnalysis() {
  const { getSupabaseClient } = await import('../src/db/index');
  const supabase = getSupabaseClient();
  
  console.log('🔍 DEEP ROOT CAUSE ANALYSIS\n');
  console.log('='.repeat(70));
  
  // 1. Check ready content
  const now = new Date();
  const graceWindow = new Date(now.getTime() + 5 * 60 * 1000);
  
  console.log('\n1️⃣ CHECKING READY CONTENT:');
  const { data: readyContent } = await supabase
    .from('content_metadata')
    .select('decision_id, decision_type, scheduled_at, status')
    .eq('status', 'queued')
    .in('decision_type', ['single', 'thread'])
    .lte('scheduled_at', graceWindow.toISOString())
    .order('scheduled_at', { ascending: true })
    .limit(5);
  
  console.log(`   Found: ${readyContent?.length || 0} ready posts`);
  
  if (readyContent && readyContent.length > 0) {
    // 2. Check if they're already in posted_decisions
    console.log('\n2️⃣ CHECKING posted_decisions TABLE:');
    const decisionIds = readyContent.map((c: any) => c.decision_id);
    const { data: alreadyPosted } = await supabase
      .from('posted_decisions')
      .select('decision_id')
      .in('decision_id', decisionIds);
    
    const postedIds = new Set((alreadyPosted || []).map((p: any) => p.decision_id));
    console.log(`   Found ${postedIds.size} already in posted_decisions`);
    
    readyContent.forEach((c: any) => {
      const isPosted = postedIds.has(c.decision_id);
      const scheduled = new Date(c.scheduled_at);
      const minsUntil = Math.round((scheduled.getTime() - now.getTime()) / 60000);
      console.log(`   - ${c.decision_type} ${c.decision_id.substring(0, 8)}... scheduled: ${scheduled.toISOString()} (${minsUntil > 0 ? `${minsUntil}min` : 'READY'}) ${isPosted ? '🚨 ALREADY POSTED' : '❌ NOT POSTED'}`);
    });
    
    // 3. Check for duplicate content
    console.log('\n3️⃣ CHECKING FOR DUPLICATE CONTENT:');
    for (const content of readyContent) {
      const { data: fullContent } = await supabase
        .from('content_metadata')
        .select('content, thread_parts, tweet_id, status')
        .eq('decision_id', content.decision_id)
        .single();
      
      if (fullContent) {
        const contentText = content.decision_type === 'thread' 
          ? (fullContent.thread_parts as string[] || []).join(' ')
          : fullContent.content || '';
        
        // Check if same content already posted
        const { data: duplicates } = await supabase
          .from('content_metadata')
          .select('decision_id, tweet_id, status')
          .eq('content', contentText)
          .not('tweet_id', 'is', null)
          .neq('decision_id', content.decision_id)
          .limit(1);
        
        if (duplicates && duplicates.length > 0) {
          console.log(`   ⚠️ ${content.decision_id.substring(0, 8)}... DUPLICATE CONTENT (already posted as ${duplicates[0].tweet_id})`);
        }
      }
    }
    
    // 4. Check rate limit calculation
    console.log('\n4️⃣ CHECKING RATE LIMIT CALCULATION:');
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
    const { count: postsThisHour } = await supabase
      .from('content_metadata')
      .select('*', { count: 'exact', head: true })
      .in('decision_type', ['single', 'thread'])
      .in('status', ['posted', 'failed'])
      .gte('posted_at', oneHourAgo);
    
    const maxPostsPerHour = parseInt(process.env.MAX_POSTS_PER_HOUR || '1', 10);
    console.log(`   Posts this hour: ${postsThisHour || 0}/${maxPostsPerHour}`);
    console.log(`   Rate limit reached: ${(postsThisHour || 0) >= maxPostsPerHour ? 'YES ❌' : 'NO ✅'}`);
    
    // 5. Check for posts stuck in 'posting' status
    console.log('\n5️⃣ CHECKING FOR STUCK POSTS:');
    const { data: stuckPosts } = await supabase
      .from('content_metadata')
      .select('decision_id, decision_type, created_at')
      .eq('status', 'posting')
      .in('decision_id', decisionIds);
    
    if (stuckPosts && stuckPosts.length > 0) {
      console.log(`   ⚠️ Found ${stuckPosts.length} posts stuck in 'posting' status:`);
      stuckPosts.forEach((p: any) => {
        const minsStuck = Math.round((now.getTime() - new Date(p.created_at).getTime()) / (1000 * 60));
        console.log(`   - ${p.decision_type} ${p.decision_id.substring(0, 8)}... (stuck ${minsStuck}min)`);
      });
    } else {
      console.log('   ✅ No stuck posts');
    }
    
    // 6. Check what getReadyDecisions would actually return
    console.log('\n6️⃣ SIMULATING getReadyDecisions() LOGIC:');
    
    // Filter out already posted
    const notPosted = readyContent.filter((c: any) => !postedIds.has(c.decision_id));
    console.log(`   After filtering posted_decisions: ${notPosted.length} posts remain`);
    
    // Check posted_at field (if it exists, post was already posted)
    const { data: withPostedAt } = await supabase
      .from('content_metadata')
      .select('decision_id, posted_at')
      .in('decision_id', notPosted.map((c: any) => c.decision_id));
    
    const withPostedAtIds = new Set((withPostedAt || []).filter((p: any) => p.posted_at).map((p: any) => p.decision_id));
    const trulyReady = notPosted.filter((c: any) => !withPostedAtIds.has(c.decision_id));
    console.log(`   After filtering posts with posted_at: ${trulyReady.length} posts remain`);
    
    if (trulyReady.length === 0) {
      console.log('\n   🚨 ROOT CAUSE: All ready posts are already marked as posted!');
      console.log('   💡 This means posts succeeded but status wasn\'t updated correctly');
    } else {
      console.log(`\n   ✅ ${trulyReady.length} posts are truly ready to post`);
      trulyReady.forEach((c: any) => {
        console.log(`   - ${c.decision_type} ${c.decision_id.substring(0, 8)}...`);
      });
    }
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('✅ Deep analysis complete');
}

deepAnalysis().catch(console.error);

