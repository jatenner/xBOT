import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function analyzeBug() {
  console.log('🔍 Analyzing format selection bug...\n');

  // Get last 20 posts
  const { data, error } = await supabase
    .from('content_metadata')
    .select('decision_type, thread_parts, created_at')
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('�� RECENT 20 POSTS:\n');
  
  let singleCount = 0;
  let threadCount = 0;

  data?.forEach((post, i) => {
    const isThread = post.decision_type === 'thread';
    const threadPartsCount = post.thread_parts?.length || 0;
    
    if (isThread) threadCount++;
    else singleCount++;

    const emoji = isThread ? '🧵' : '📄';
    console.log(`${i+1}. ${emoji} ${post.decision_type.toUpperCase()} - ${threadPartsCount} parts`);
  });

  const totalRecent = singleCount + threadCount;
  console.log(`\n�� SUMMARY (Last 20 posts):`);
  console.log(`   Singles: ${singleCount} (${((singleCount/totalRecent)*100).toFixed(1)}%)`);
  console.log(`   Threads: ${threadCount} (${((threadCount/totalRecent)*100).toFixed(1)}%)`);
  console.log(`\n🎯 Expected: 7% threads (~1-2 out of 20)`);
  console.log(`❗ Actual: ${((threadCount/totalRecent)*100).toFixed(1)}% threads (${threadCount} out of 20)`);

  if (threadCount > 3) {
    console.log(`\n⚠️  BUG CONFIRMED: Way too many threads!`);
    console.log(`\nThe code says: Math.random() < 0.07 ? 'thread' : 'single'`);
    console.log(`This should give ~7% threads, but we're getting ${((threadCount/totalRecent)*100).toFixed(1)}%!`);
    console.log(`\nLikely cause: The AI is overriding our format selection.`);
  } else {
    console.log(`\n✅ Thread rate looks normal`);
  }

  process.exit(0);
}

analyzeBug();
