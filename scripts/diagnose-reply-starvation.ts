#!/usr/bin/env tsx
/**
 * Diagnose reply opportunity starvation
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db';

async function main() {
  const supabase = getSupabaseClient();

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           🔍 REPLY STARVATION DIAGNOSIS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // 1) Count reply_opportunities last 24h
  const { count: opp24h } = await supabase
    .from('reply_opportunities')
    .select('*', { count: 'exact', head: true })
    .gt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
  
  console.log(`1️⃣  Reply opportunities (last 24h): ${opp24h || 0}`);

  // 2) Count reply_candidate_queue last 24h
  const { count: queue24h } = await supabase
    .from('reply_candidate_queue')
    .select('*', { count: 'exact', head: true })
    .gt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
  
  console.log(`2️⃣  Reply candidate queue (last 24h): ${queue24h || 0}`);

  // 3) Count opportunities by target_username (last 7 days)
  const { data: oppByUser } = await supabase
    .from('reply_opportunities')
    .select('target_username')
    .gt('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

  const userCounts: Record<string, number> = {};
  oppByUser?.forEach(opp => {
    const user = opp.target_username?.toLowerCase() || 'unknown';
    userCounts[user] = (userCounts[user] || 0) + 1;
  });

  const sortedUsers = Object.entries(userCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 50);

  console.log(`\n3️⃣  Opportunities by target_username (last 7 days, top 50):`);
  if (sortedUsers.length === 0) {
    console.log('   ⚠️  No opportunities found');
  } else {
    sortedUsers.forEach(([user, count]) => {
      console.log(`   ${user}: ${count}`);
    });
  }

  // 4) Inspect schema
  console.log(`\n4️⃣  reply_opportunities schema (key columns):`);
  const { data: sample } = await supabase
    .from('reply_opportunities')
    .select('*')
    .limit(1)
    .maybeSingle();
  
  if (sample) {
    console.log(`   Columns: ${Object.keys(sample).join(', ')}`);
  } else {
    console.log('   ⚠️  Table empty - cannot infer schema');
  }

  // 5) Check curated handles
  const curatedHandles = (process.env.REPLY_CURATED_HANDLES || '')
    .split(',')
    .map(h => h.trim().toLowerCase().replace('@', ''))
    .filter(Boolean)
    .slice(0, 5);

  if (curatedHandles.length > 0) {
    console.log(`\n5️⃣  Curated handles (first 5): ${curatedHandles.join(', ')}`);
    
    const { count: curatedOpps } = await supabase
      .from('reply_opportunities')
      .select('*', { count: 'exact', head: true })
      .in('target_username', curatedHandles)
      .gt('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());
    
    console.log(`   Opportunities for curated handles (last 7 days): ${curatedOpps || 0}`);
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main().catch(console.error);
