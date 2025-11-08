import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkThreadRatio() {
  console.log('🔍 Checking actual thread vs single ratio...\n');

  // Last 24 hours
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: recentPosts, error } = await supabase
    .from('content_metadata')
    .select('decision_type, created_at, status')
    .gte('created_at', oneDayAgo)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error:', error);
    return;
  }

  const singles = recentPosts?.filter(p => p.decision_type === 'single').length || 0;
  const threads = recentPosts?.filter(p => p.decision_type === 'thread').length || 0;
  const total = singles + threads;

  const threadPercent = total > 0 ? ((threads / total) * 100).toFixed(1) : 0;

  console.log('📊 LAST 24 HOURS:');
  console.log(`   Total posts: ${total}`);
  console.log(`   Singles: ${singles} (${((singles/total)*100).toFixed(1)}%)`);
  console.log(`   Threads: ${threads} (${threadPercent}%)`);
  console.log('');
  console.log(`Expected: 7% threads`);
  console.log(`Actual: ${threadPercent}% threads`);
  console.log('');

  if (parseFloat(threadPercent as string) > 15) {
    console.log('⚠️ WARNING: Thread rate is MUCH higher than expected 7%!');
  } else {
    console.log('✅ Thread rate looks normal');
  }

  // Show recent posts
  console.log('\n📝 LAST 20 POSTS:');
  recentPosts?.slice(0, 20).forEach((post, i) => {
    const emoji = post.decision_type === 'thread' ? '🧵' : '📄';
    console.log(`   ${emoji} ${post.decision_type.padEnd(8)} - ${post.status.padEnd(10)} - ${new Date(post.created_at).toLocaleString()}`);
  });

  process.exit(0);
}

checkThreadRatio();
