/**
 * System Review Script
 * Queries database for harvester, reply, and database store status
 */

import { getSupabaseClient } from './src/db/index';

async function reviewSystemStatus() {
  const supabase = getSupabaseClient();
  
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('📊 SYSTEM STATUS REVIEW');
  console.log('═══════════════════════════════════════════════════════════\n');

  // 1. HARVESTER STATUS
  console.log('🌾 HARVESTER SYSTEM STATUS');
  console.log('─────────────────────────────────────────────────────────');
  
  const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const last7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  
  // Reply opportunities
  const { data: opps, error: oppsError } = await supabase
    .from('reply_opportunities')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);
  
  if (oppsError) {
    console.log(`❌ Error querying reply_opportunities: ${oppsError.message}`);
  } else {
    const totalOpps = opps?.length || 0;
    const pendingOpps = opps?.filter(o => o.status === 'pending').length || 0;
    const repliedOpps = opps?.filter(o => o.status === 'replied').length || 0;
    const recentOpps = opps?.filter(o => new Date(o.created_at) > new Date(last24h)).length || 0;
    
    console.log(`📊 Total opportunities: ${totalOpps}`);
    console.log(`   • Pending: ${pendingOpps}`);
    console.log(`   • Replied: ${repliedOpps}`);
    console.log(`   • Created in last 24h: ${recentOpps}`);
    
    if (opps && opps.length > 0) {
      const latest = opps[0];
      console.log(`\n📅 Latest opportunity:`);
      console.log(`   • Created: ${latest.created_at}`);
      console.log(`   • Status: ${latest.status}`);
      console.log(`   • Tier: ${latest.tier || 'N/A'}`);
      console.log(`   • Tweet ID: ${latest.tweet_id || 'N/A'}`);
    }
  }
  
  // Discovered accounts
  const { data: accounts, error: accountsError } = await supabase
    .from('discovered_accounts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);
  
  if (accountsError) {
    console.log(`❌ Error querying discovered_accounts: ${accountsError.message}`);
  } else {
    const totalAccounts = accounts?.length || 0;
    console.log(`\n👥 Discovered accounts (sample): ${totalAccounts}`);
    if (accounts && accounts.length > 0) {
      const latest = accounts[0];
      console.log(`   • Latest: @${latest.username || 'N/A'} (${latest.follower_count || 0} followers)`);
      console.log(`   • Discovered: ${latest.created_at}`);
    }
  }
  
  // 2. REPLY SYSTEM STATUS
  console.log('\n💬 REPLY SYSTEM STATUS');
  console.log('─────────────────────────────────────────────────────────');
  
  // Reply decisions
  const { data: replies, error: repliesError } = await supabase
    .from('content_metadata')
    .select('decision_id, status, created_at, posted_at, target_tweet_id')
    .eq('decision_type', 'reply')
    .order('created_at', { ascending: false })
    .limit(50);
  
  if (repliesError) {
    console.log(`❌ Error querying replies: ${repliesError.message}`);
  } else {
    const totalReplies = replies?.length || 0;
    const postedReplies = replies?.filter(r => r.status === 'posted').length || 0;
    const queuedReplies = replies?.filter(r => r.status === 'queued').length || 0;
    const failedReplies = replies?.filter(r => r.status === 'failed').length || 0;
    const recentReplies = replies?.filter(r => {
      const posted = r.posted_at ? new Date(r.posted_at) : null;
      return posted && posted > new Date(last24h);
    }).length || 0;
    
    console.log(`📊 Total replies (last 50): ${totalReplies}`);
    console.log(`   • Posted: ${postedReplies}`);
    console.log(`   • Queued: ${queuedReplies}`);
    console.log(`   • Failed: ${failedReplies}`);
    console.log(`   • Posted in last 24h: ${recentReplies}`);
    
    if (replies && replies.length > 0) {
      const latest = replies[0];
      console.log(`\n📅 Latest reply:`);
      console.log(`   • Created: ${latest.created_at}`);
      console.log(`   • Status: ${latest.status}`);
      console.log(`   • Posted: ${latest.posted_at || 'Not posted'}`);
      console.log(`   • Target: ${latest.target_tweet_id || 'N/A'}`);
    }
  }
  
  // Reply conversions
  const { data: conversions, error: conversionsError } = await supabase
    .from('reply_conversions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);
  
  if (conversionsError) {
    console.log(`⚠️  reply_conversions table may not exist: ${conversionsError.message}`);
  } else {
    const totalConversions = conversions?.length || 0;
    const totalFollowers = conversions?.reduce((sum, c) => sum + (c.followers_gained || 0), 0) || 0;
    console.log(`\n📈 Reply conversions: ${totalConversions}`);
    console.log(`   • Total followers gained: ${totalFollowers}`);
  }
  
  // 3. DATABASE STORE STATUS
  console.log('\n💾 DATABASE STORE STATUS');
  console.log('─────────────────────────────────────────────────────────');
  
  // Content metadata overview
  const { data: allContent, error: contentError } = await supabase
    .from('content_metadata')
    .select('decision_type, status')
    .limit(1000);
  
  if (contentError) {
    console.log(`❌ Error querying content_metadata: ${contentError.message}`);
  } else {
    const byType = (allContent || []).reduce((acc: any, item: any) => {
      acc[item.decision_type] = (acc[item.decision_type] || 0) + 1;
      return acc;
    }, {});
    
    const byStatus = (allContent || []).reduce((acc: any, item: any) => {
      acc[item.status] = (acc[item.status] || 0) + 1;
      return acc;
    }, {});
    
    console.log(`📊 Content by type (sample):`);
    Object.entries(byType).forEach(([type, count]) => {
      console.log(`   • ${type}: ${count}`);
    });
    
    console.log(`\n📊 Content by status (sample):`);
    Object.entries(byStatus).forEach(([status, count]) => {
      console.log(`   • ${status}: ${count}`);
    });
  }
  
  // Outcomes
  const { data: outcomes, error: outcomesError } = await supabase
    .from('outcomes')
    .select('*')
    .order('collected_at', { ascending: false })
    .limit(10);
  
  if (outcomesError) {
    console.log(`❌ Error querying outcomes: ${outcomesError.message}`);
  } else {
    console.log(`\n📊 Recent outcomes: ${outcomes?.length || 0} records`);
    if (outcomes && outcomes.length > 0) {
      const latest = outcomes[0];
      console.log(`   • Latest collected: ${latest.collected_at}`);
      console.log(`   • Tweet ID: ${latest.tweet_id || 'N/A'}`);
      console.log(`   • Likes: ${latest.likes || 0}`);
      console.log(`   • Views: ${latest.views || 0}`);
    }
  }
  
  // System logs
  const { data: logs, error: logsError } = await supabase
    .from('system_logs')
    .select('action, log_level, timestamp, success')
    .order('timestamp', { ascending: false })
    .limit(20);
  
  if (logsError) {
    console.log(`⚠️  system_logs table may not exist: ${logsError.message}`);
  } else {
    const errorLogs = logs?.filter(l => l.log_level === 'ERROR' || l.success === false).length || 0;
    console.log(`\n📋 Recent system logs: ${logs?.length || 0} entries`);
    console.log(`   • Errors: ${errorLogs}`);
    if (logs && logs.length > 0) {
      const latest = logs[0];
      console.log(`   • Latest: ${latest.action} (${latest.log_level}) at ${latest.timestamp}`);
    }
  }
  
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('✅ Review complete');
  console.log('═══════════════════════════════════════════════════════════\n');
}

reviewSystemStatus().catch(console.error);




