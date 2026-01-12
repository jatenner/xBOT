#!/usr/bin/env tsx
/**
 * Verify template tracking fix
 */

import 'dotenv/config';
import { Client } from 'pg';

async function verifyTemplateTracking() {
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

    // 1. Check for "pending" strings
    console.log('📊 1. CHECKING FOR "pending" STRINGS:');
    const { rows: pendingRows } = await client.query(`
      SELECT COUNT(*) as count
      FROM reply_decisions
      WHERE template_id = 'pending' OR prompt_version = 'pending';
    `);
    
    if (pendingRows[0]?.count > 0) {
      console.log(`   ❌ Found ${pendingRows[0].count} rows with "pending" strings`);
    } else {
      console.log(`   ✅ No "pending" strings found`);
    }
    console.log('');

    // 2. Template status distribution
    console.log('📊 2. TEMPLATE STATUS DISTRIBUTION (last 24h):');
    const { rows: statusDist } = await client.query(`
      SELECT 
        template_status,
        COUNT(*) as count
      FROM reply_decisions
      WHERE created_at >= NOW() - INTERVAL '24 hours'
      GROUP BY template_status
      ORDER BY count DESC;
    `);
    
    statusDist.forEach((row: any) => {
      console.log(`   ${row.template_status || 'NULL'}: ${row.count}`);
    });
    console.log('');

    // 3. Template distribution for SET status
    console.log('📊 3. TEMPLATE DISTRIBUTION (template_status=SET, last 24h):');
    const { rows: templateDist } = await client.query(`
      SELECT 
        template_id,
        COUNT(*) as count,
        COUNT(CASE WHEN decision = 'ALLOW' THEN 1 END) as allows
      FROM reply_decisions
      WHERE created_at >= NOW() - INTERVAL '24 hours'
        AND template_status = 'SET'
        AND template_id IS NOT NULL
      GROUP BY template_id
      ORDER BY count DESC;
    `);
    
    if (templateDist.length === 0) {
      console.log('   ⚠️  No templates with SET status in last 24h');
    } else {
      templateDist.forEach((row: any) => {
        console.log(`   ${row.template_id}: ${row.count} total (${row.allows} ALLOW)`);
      });
    }
    console.log('');

    // 4. Last 20 reply_decisions sample
    console.log('📊 4. LAST 20 REPLY_DECISIONS SAMPLE:');
    const { rows: samples } = await client.query(`
      SELECT 
        decision_id,
        decision,
        candidate_score,
        template_id,
        prompt_version,
        template_status,
        candidate_features IS NOT NULL as has_features,
        created_at
      FROM reply_decisions
      ORDER BY created_at DESC
      LIMIT 20;
    `);
    
    samples.forEach((row: any, i: number) => {
      console.log(`   ${i + 1}. decision_id=${row.decision_id?.substring(0, 8) || 'N/A'}...`);
      console.log(`      decision=${row.decision}, score=${row.candidate_score || 'NULL'}`);
      console.log(`      template_id=${row.template_id || 'NULL'}, prompt_version=${row.prompt_version || 'NULL'}`);
      console.log(`      template_status=${row.template_status || 'NULL'}, has_features=${row.has_features}`);
      console.log('');
    });

    console.log('✅ Verification complete');

  } catch (error: any) {
    console.error('❌ Verification failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await client.end();
  }
}

verifyTemplateTracking().catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
