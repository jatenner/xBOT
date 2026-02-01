#!/usr/bin/env tsx
/**
 * Verify public_search_* candidates in database
 */

import 'dotenv/config';
import { getSupabaseClient } from '../../src/db/index';
import { Client } from 'pg';

async function main() {
  const supabase = getSupabaseClient();
  const dbUrl = process.env.DATABASE_URL!;
  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  
  await client.connect();
  
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('📊 VERIFYING PUBLIC_SEARCH_* CANDIDATES');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');
  
  // Check for public_search_* opportunities
  const { rows: publicOpps } = await client.query(`
    SELECT discovery_source, COUNT(*) as count, 
           MIN(created_at) as first_seen, MAX(created_at) as last_seen
    FROM reply_opportunities
    WHERE discovery_source LIKE 'public_search_%'
    AND replied_to = false
    GROUP BY discovery_source
    ORDER BY discovery_source;
  `);
  
  console.log('1. Public search opportunities by discovery_source:');
  if (publicOpps.length === 0) {
    console.log('   ❌ No public_search_* opportunities found');
  } else {
    publicOpps.forEach((r: any) => {
      console.log(`   ✅ ${r.discovery_source}: ${r.count} opportunities`);
      console.log(`      First seen: ${r.first_seen}`);
      console.log(`      Last seen: ${r.last_seen}`);
    });
  }
  
  // Check recent opportunities (last 30 minutes)
  const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const { rows: recentPublic } = await client.query(`
    SELECT target_tweet_id, target_username, discovery_source, 
           accessibility_status, created_at, like_count
    FROM reply_opportunities
    WHERE discovery_source LIKE 'public_search_%'
    AND replied_to = false
    AND created_at >= $1
    ORDER BY created_at DESC
    LIMIT 10;
  `, [thirtyMinAgo]);
  
  console.log(`\n2. Recent public_search_* opportunities (last 30 min): ${recentPublic.length}`);
  if (recentPublic.length > 0) {
    recentPublic.forEach((r: any) => {
      console.log(`   tweet_id=${r.target_tweet_id} author=@${r.target_username} source=${r.discovery_source} status=${r.accessibility_status || 'unknown'} likes=${r.like_count || 0}`);
    });
  }
  
  // Check overall distribution
  const { rows: allSources } = await client.query(`
    SELECT discovery_source, COUNT(*) as count
    FROM reply_opportunities
    WHERE replied_to = false
    GROUP BY discovery_source
    ORDER BY count DESC
    LIMIT 10;
  `);
  
  console.log('\n3. All discovery sources (top 10):');
  allSources.forEach((r: any) => {
    const source = r.discovery_source || 'NULL';
    console.log(`   ${source}: ${r.count}`);
  });
  
  await client.end();
}

main().catch(console.error);
