import 'dotenv/config';
import { getSupabaseClient } from '../src/db/index';

async function verifyTodaysPosts() {
  const supabase = getSupabaseClient();
  
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📊 TODAYS POSTS VERIFICATION - November 3rd, 2025');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  // Get today's date range
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);
  
  console.log(`Checking posts from: ${todayStart.toISOString()}`);
  console.log(`                 to: ${todayEnd.toISOString()}\n`);
  
  // Check content_metadata table (all attempts)
  const { data: allAttempts, count: attemptsCount } = await supabase
    .from('content_metadata')
    .select('*', { count: 'exact' })
    .gte('created_at', todayStart.toISOString())
    .lte('created_at', todayEnd.toISOString());
  
  console.log(`📝 CONTENT GENERATION (content_metadata):`);
  console.log(`   Total attempts today: ${attemptsCount || 0}`);
  
  if (allAttempts && allAttempts.length > 0) {
    const byStatus = allAttempts.reduce((acc: any, item: any) => {
      acc[item.status] = (acc[item.status] || 0) + 1;
      return acc;
    }, {});
    
    console.log(`   Status breakdown:`);
    Object.entries(byStatus).forEach(([status, count]) => {
      console.log(`     - ${status}: ${count}`);
    });
  }
  
  // Check posted_decisions table (successful posts)
  const { data: successfulPosts, count: postedCount } = await supabase
    .from('posted_decisions')
    .select('*', { count: 'exact' })
    .gte('posted_at', todayStart.toISOString())
    .lte('posted_at', todayEnd.toISOString())
    .order('posted_at', { ascending: false });
  
  console.log(`\n✅ SUCCESSFUL POSTS (posted_decisions):`);
  console.log(`   Posts that reached Twitter: ${postedCount || 0}`);
  
  if (successfulPosts && successfulPosts.length > 0) {
    console.log(`\n   Recent posts:`);
    successfulPosts.slice(0, 10).forEach((post: any, i: number) => {
      const time = new Date(post.posted_at).toLocaleTimeString();
      const content = post.content?.substring(0, 50) || 'No content';
      console.log(`   ${i + 1}. [${time}] ${content}...`);
    });
  }
  
  // Calculate success rate
  const successRate = attemptsCount && attemptsCount > 0 
    ? ((postedCount || 0) / attemptsCount * 100).toFixed(1)
    : '0';
  
  console.log(`\n📊 SUCCESS RATE:`);
  console.log(`   ${postedCount || 0}/${attemptsCount || 0} posted = ${successRate}%`);
  
  // Check last 7 days for trend
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  
  const { count: weekCount } = await supabase
    .from('posted_decisions')
    .select('*', { count: 'exact' })
    .gte('posted_at', weekAgo.toISOString());
  
  console.log(`\n📅 LAST 7 DAYS:`);
  console.log(`   Total posts: ${weekCount || 0}`);
  console.log(`   Average per day: ${Math.round((weekCount || 0) / 7)}`);
  
  console.log('\n═══════════════════════════════════════════════════════════\n');
  
  // Check deployed config by looking at recent job runs
  console.log('🔧 SYSTEM CONFIGURATION INFERENCE:');
  
  if (allAttempts && allAttempts.length >= 2) {
    const sorted = [...allAttempts].sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    
    const timeBetweenPosts = [];
    for (let i = 1; i < sorted.length; i++) {
      const diff = new Date(sorted[i].created_at).getTime() - 
                   new Date(sorted[i-1].created_at).getTime();
      timeBetweenPosts.push(diff / 1000 / 60); // minutes
    }
    
    const avgInterval = timeBetweenPosts.reduce((a, b) => a + b, 0) / timeBetweenPosts.length;
    console.log(`   Estimated plan job interval: ~${Math.round(avgInterval)} minutes`);
    console.log(`   (Based on ${timeBetweenPosts.length} generation intervals)`);
  }
  
  console.log('═══════════════════════════════════════════════════════════\n');
}

verifyTodaysPosts().catch(console.error);

