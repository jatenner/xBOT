#!/usr/bin/env tsx
/**
 * Verify reply quality tracking implementation
 */

import 'dotenv/config';
import { Client } from 'pg';

async function verifyQualityTracking() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('❌ DATABASE_URL not set');
    process.exit(1);
  }

  const client = new Client({
    connectionString: dbUrl,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });

  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    // 1. Verify templates exist
    console.log('📊 1. VERIFY TEMPLATES:');
    const { rows: templates } = await client.query(`
      SELECT id, name, description, priority_weight, exploration_rate
      FROM reply_templates
      ORDER BY priority_weight DESC;
    `);
    
    console.log(`   Found ${templates.length} templates:`);
    templates.forEach((t: any) => {
      console.log(`   ✅ ${t.id}: ${t.name} (weight=${t.priority_weight}, explore=${t.exploration_rate})`);
    });
    console.log('');

    // 2. Check reply_decisions with new fields
    console.log('📊 2. REPLY_DECISIONS WITH NEW FIELDS (last 10):');
    const { rows: decisions } = await client.query(`
      SELECT 
        decision_id,
        target_tweet_id,
        decision,
        candidate_score,
        template_id,
        prompt_version,
        candidate_features,
        posted_reply_tweet_id,
        created_at
      FROM reply_decisions
      ORDER BY created_at DESC
      LIMIT 10;
    `);
    
    if (decisions.length === 0) {
      console.log('   ⚠️  No reply_decisions found yet');
    } else {
      decisions.forEach((d: any, i: number) => {
        console.log(`   ${i + 1}. decision_id=${d.decision_id?.substring(0, 8)}...`);
        console.log(`      decision=${d.decision}, candidate_score=${d.candidate_score || 'NULL'}`);
        console.log(`      template_id=${d.template_id || 'NULL'}, prompt_version=${d.prompt_version || 'NULL'}`);
        console.log(`      candidate_features=${d.candidate_features ? 'SET' : 'NULL'}`);
        console.log(`      posted_reply_tweet_id=${d.posted_reply_tweet_id || 'NULL'}`);
        console.log('');
      });
    }

    // 3. Template distribution (last 24h)
    console.log('📊 3. TEMPLATE DISTRIBUTION (last 24h):');
    const { rows: distribution } = await client.query(`
      SELECT 
        template_id,
        COUNT(*) as count,
        COUNT(CASE WHEN decision = 'ALLOW' THEN 1 END) as allows,
        COUNT(CASE WHEN decision = 'DENY' THEN 1 END) as denies
      FROM reply_decisions
      WHERE created_at >= NOW() - INTERVAL '24 hours'
        AND template_id IS NOT NULL
        AND template_id != 'pending'
      GROUP BY template_id
      ORDER BY count DESC;
    `);
    
    if (distribution.length === 0) {
      console.log('   ⚠️  No template usage in last 24h');
    } else {
      distribution.forEach((d: any) => {
        console.log(`   ${d.template_id}: ${d.count} total (${d.allows} ALLOW, ${d.denies} DENY)`);
      });
    }
    console.log('');

    // 4. Engagement tracking status
    console.log('📊 4. ENGAGEMENT TRACKING STATUS:');
    const { rows: engagement } = await client.query(`
      SELECT 
        COUNT(*) as total_posted,
        COUNT(CASE WHEN engagement_fetched_at IS NOT NULL THEN 1 END) as fetched,
        COUNT(CASE WHEN engagement_24h_likes > 0 THEN 1 END) as has_likes,
        COUNT(CASE WHEN engagement_24h_views > 0 THEN 1 END) as has_views
      FROM reply_decisions
      WHERE posted_reply_tweet_id IS NOT NULL
        AND decision = 'ALLOW';
    `);
    
    if (engagement.length > 0) {
      const e = engagement[0];
      console.log(`   Total posted replies: ${e.total_posted}`);
      console.log(`   Engagement fetched: ${e.fetched}`);
      console.log(`   Has likes data: ${e.has_likes}`);
      console.log(`   Has views data: ${e.has_views}`);
    }
    console.log('');

    // 5. Sample engagement data
    console.log('📊 5. SAMPLE ENGAGEMENT DATA (last 5):');
    const { rows: engagementSamples } = await client.query(`
      SELECT 
        posted_reply_tweet_id,
        engagement_24h_likes,
        engagement_24h_replies,
        engagement_24h_retweets,
        engagement_24h_views,
        engagement_fetched_at,
        template_id
      FROM reply_decisions
      WHERE posted_reply_tweet_id IS NOT NULL
        AND engagement_fetched_at IS NOT NULL
      ORDER BY engagement_fetched_at DESC
      LIMIT 5;
    `);
    
    if (engagementSamples.length === 0) {
      console.log('   ⚠️  No engagement data fetched yet');
    } else {
      engagementSamples.forEach((e: any, i: number) => {
        console.log(`   ${i + 1}. tweet_id=${e.posted_reply_tweet_id}`);
        console.log(`      likes=${e.engagement_24h_likes}, replies=${e.engagement_24h_replies}, retweets=${e.engagement_24h_retweets}, views=${e.engagement_24h_views}`);
        console.log(`      template=${e.template_id}, fetched_at=${e.engagement_fetched_at}`);
        console.log('');
      });
    }

    // 6. Candidate features logging status
    console.log('📊 6. CANDIDATE FEATURES LOGGING:');
    const { rows: featuresCount } = await client.query(`
      SELECT COUNT(*) as count
      FROM reply_candidate_features
      WHERE created_at >= NOW() - INTERVAL '24 hours';
    `);
    
    console.log(`   Features logged in last 24h: ${featuresCount[0]?.count || 0}`);
    console.log('');

    console.log('✅ Verification complete');

  } catch (error: any) {
    console.error('❌ Verification failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await client.end();
  }
}

verifyQualityTracking().catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
