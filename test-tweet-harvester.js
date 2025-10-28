require('dotenv').config();

async function test() {
  console.log('🧪 Testing Tweet-Based Harvester...\n');
  
  console.log('Environment check:');
  console.log('  ENABLE_REPLIES:', process.env.ENABLE_REPLIES);
  console.log('  MODE:', process.env.MODE);
  console.log('  TWITTER_SESSION_B64:', process.env.TWITTER_SESSION_B64 ? 'Set' : 'Missing');
  console.log('');
  
  try {
    console.log('📥 Importing tweet harvester...');
    const { tweetBasedHarvester } = require('./dist/src/jobs/tweetBasedHarvester');
    
    console.log('🚀 Running tweet harvester...\n');
    await tweetBasedHarvester();
    
    console.log('\n✅ Harvester completed!');
    
    // Check what was found
    const { createClient } = require('@supabase/supabase-js');
    const s = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    
    const { count } = await s
      .from('reply_opportunities')
      .select('*', { count: 'exact', head: true });
    
    console.log('\nOpportunities in database:', count || 0);
    
    if (count && count > 0) {
      const { data } = await s
        .from('reply_opportunities')
        .select('like_count, reply_count, target_username')
        .order('like_count', { ascending: false })
        .limit(5);
      
      console.log('\nTop 5 by likes:');
      data?.forEach((o, i) => {
        console.log(`  ${i+1}. @${o.target_username}: ${o.like_count} likes, ${o.reply_count} comments`);
      });
    }
    
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

test();

