#!/usr/bin/env tsx
/**
 * Query reply_opportunities pool for diagnostics
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkPool() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🔍 REPLY OPPORTUNITIES POOL STATUS');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  // Total count (last 24h, not replied)
  const { count: totalCount } = await supabase
    .from('reply_opportunities')
    .select('*', { count: 'exact', head: true })
    .eq('replied_to', false)
    .gte('created_at', new Date(Date.now() - 24*60*60*1000).toISOString());
  
  console.log(`📊 Total opportunities (last 24h): ${totalCount || 0}`);
  
  // Top 10 by likes
  const { data: topOpps } = await supabase
    .from('reply_opportunities')
    .select('target_tweet_id, tweet_content, target_username, like_count, created_at')
    .eq('replied_to', false)
    .gte('created_at', new Date(Date.now() - 24*60*60*1000).toISOString())
    .order('like_count', { ascending: false })
    .limit(10);
  
  if (topOpps && topOpps.length > 0) {
    console.log(`\n📈 Top ${topOpps.length} opportunities by engagement:\n`);
    topOpps.forEach((opp, i) => {
      const username = opp.target_username || 'unknown';
      const content = opp.tweet_content?.substring(0, 60) || '';
      const likes = opp.like_count?.toLocaleString() || '0';
      const age = Math.round((Date.now() - new Date(opp.created_at).getTime()) / (60*60*1000));
      console.log(`  ${i+1}. @${username} (${likes} likes, ${age}h ago)`);
      console.log(`     "${content}..."`);
    });
  } else {
    console.log('\n⚠️  No opportunities found in pool');
  }
}

checkPool().catch(console.error);

