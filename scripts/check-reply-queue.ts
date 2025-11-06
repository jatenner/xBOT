/**
 * Check reply opportunities queue - are they old or new? Good or bad quality?
 */

import 'dotenv/config';
import { Client } from 'pg';

const databaseUrl = process.env.DATABASE_URL!;

async function checkReplyQueue() {
  const client = new Client({ 
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    console.log('✅ Connected\n');
    
    // Check reply_opportunities table
    const queueStats = await client.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'used') as used,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as last_24h,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 hour') as last_hour,
        MIN(created_at) as oldest,
        MAX(created_at) as newest
      FROM reply_opportunities;
    `);
    
    const stats = queueStats.rows[0];
    console.log('📊 REPLY OPPORTUNITIES QUEUE:');
    console.log(`   Total: ${stats.total}`);
    console.log(`   Pending: ${stats.pending}`);
    console.log(`   Used: ${stats.used}`);
    console.log(`   Last 24h: ${stats.last_24h}`);
    console.log(`   Last hour: ${stats.last_hour}`);
    console.log(`   Oldest: ${stats.oldest}`);
    console.log(`   Newest: ${stats.newest}`);
    
    // Check quality distribution
    const qualityDist = await client.query(`
      SELECT 
        tier,
        COUNT(*) as count,
        AVG(likes_count) as avg_likes,
        AVG(account_followers) as avg_followers
      FROM reply_opportunities
      WHERE status = 'pending'
      GROUP BY tier
      ORDER BY 
        CASE tier
          WHEN 'GOLDEN' THEN 1
          WHEN 'MEGA' THEN 2
          WHEN 'TITAN' THEN 3
          WHEN 'ULTRA' THEN 4
          WHEN 'GOOD' THEN 5
          WHEN 'ACCEPTABLE' THEN 6
          ELSE 7
        END;
    `);
    
    console.log('\n🎯 QUALITY DISTRIBUTION (pending opportunities):');
    if (qualityDist.rows.length > 0) {
      qualityDist.rows.forEach(row => {
        console.log(`   ${row.tier}: ${row.count} opportunities`);
        console.log(`      Avg ${Math.round(row.avg_likes)} likes, ${Math.round(row.avg_followers)} followers`);
      });
    } else {
      console.log('   No pending opportunities');
    }
    
    // Check recent harvests (last 5)
    const recentHarvests = await client.query(`
      SELECT 
        tweet_id,
        tier,
        likes_count,
        account_followers,
        author_username,
        created_at,
        status
      FROM reply_opportunities
      ORDER BY created_at DESC
      LIMIT 10;
    `);
    
    console.log('\n📝 LAST 10 HARVESTED OPPORTUNITIES:');
    recentHarvests.rows.forEach((row, i) => {
      const age = Math.round((Date.now() - new Date(row.created_at).getTime()) / (1000 * 60));
      console.log(`\n   ${i+1}. ${row.tier} - @${row.author_username}`);
      console.log(`      ${row.likes_count} likes, ${row.account_followers} followers`);
      console.log(`      ${age} minutes ago, status: ${row.status}`);
    });
    
    // Check if harvester is finding NEW quality tweets
    const todayQuality = await client.query(`
      SELECT 
        tier,
        COUNT(*) as count
      FROM reply_opportunities
      WHERE created_at > NOW() - INTERVAL '24 hours'
      GROUP BY tier
      ORDER BY 
        CASE tier
          WHEN 'GOLDEN' THEN 1
          WHEN 'MEGA' THEN 2
          WHEN 'TITAN' THEN 3
          WHEN 'ULTRA' THEN 4
          WHEN 'GOOD' THEN 5
          WHEN 'ACCEPTABLE' THEN 6
          ELSE 7
        END;
    `);
    
    console.log('\n🆕 NEW HARVESTS (last 24 hours):');
    if (todayQuality.rows.length > 0) {
      todayQuality.rows.forEach(row => {
        console.log(`   ${row.tier}: ${row.count} new opportunities`);
      });
      
      const hasGoodQuality = todayQuality.rows.some(r => 
        ['GOLDEN', 'MEGA', 'TITAN', 'ULTRA'].includes(r.tier)
      );
      
      if (hasGoodQuality) {
        console.log('\n   ✅ Harvester IS finding high-quality tweets!');
      } else {
        console.log('\n   ⚠️ No high-quality tweets found in last 24h');
      }
    } else {
      console.log('   No new harvests in last 24 hours');
    }
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

checkReplyQueue().catch(console.error);

