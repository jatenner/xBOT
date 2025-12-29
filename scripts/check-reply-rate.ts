import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function checkReplyRate() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           🎯 REPLY OPPORTUNITIES & RATE CHECK');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Check reply opportunities
  const { data: opportunities, error: oppError } = await supabase
    .from('reply_opportunities')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20);

  if (oppError) {
    console.log(`❌ Error querying reply_opportunities: ${oppError.message}\n`);
  } else {
    console.log(`✅ Total reply opportunities in table: ${opportunities?.length || 0}\n`);
    
    if (opportunities && opportunities.length > 0) {
      // Group by status
      const statusCounts: Record<string, number> = {};
      for (const opp of opportunities) {
        statusCounts[opp.status] = (statusCounts[opp.status] || 0) + 1;
      }
      
      console.log('📊 BY STATUS:\n');
      for (const [status, count] of Object.entries(statusCounts)) {
        console.log(`   ${status}: ${count}`);
      }
      console.log('');
      
      console.log('📋 RECENT OPPORTUNITIES (last 10):\n');
      for (let i = 0; i < Math.min(10, opportunities.length); i++) {
        const o = opportunities[i];
        const createdAt = new Date(o.created_at);
        const estTime = createdAt.toLocaleString('en-US', { timeZone: 'America/New_York', timeStyle: 'short', dateStyle: 'short' });
        console.log(`   ${i + 1}. @${o.target_username || 'unknown'}`);
        console.log(`      Tweet ID: ${o.target_tweet_id}`);
        console.log(`      Status: ${o.status}`);
        console.log(`      Followers: ${o.target_followers || 'N/A'}`);
        console.log(`      Created: ${estTime} EST\n`);
      }
    } else {
      console.log('   ⚠️  NO REPLY OPPORTUNITIES IN TABLE!\n');
      console.log('   This means either:');
      console.log('   1. Harvester job is not running');
      console.log('   2. Harvester is filtering out all tweets');
      console.log('   3. Reply opportunities are being consumed faster than created\n');
    }
  }

  // Check job heartbeats
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('💓 JOB HEARTBEATS (reply-related):\n');

  const { data: heartbeats, error: hbError } = await supabase
    .from('job_heartbeats')
    .select('job_name, last_run_at, status')
    .in('job_name', ['replyJob', 'tweetBasedHarvester', 'realTwitterDiscovery'])
    .order('last_run_at', { ascending: false });

  if (hbError) {
    console.log(`❌ Error: ${hbError.message}\n`);
  } else if (!heartbeats || heartbeats.length === 0) {
    console.log('   ⚠️  NO HEARTBEATS FOUND!\n');
    console.log('   This means jobManager may not be running.\n');
  } else {
    for (const hb of heartbeats) {
      const lastRun = new Date(hb.last_run_at);
      const estTime = lastRun.toLocaleString('en-US', { timeZone: 'America/New_York', timeStyle: 'medium', dateStyle: 'short' });
      const minutesAgo = Math.floor((Date.now() - lastRun.getTime()) / 60000);
      console.log(`   ${hb.job_name}: ${estTime} EST (${minutesAgo} min ago) - ${hb.status}`);
    }
    console.log('');
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

checkReplyRate().catch(console.error);

