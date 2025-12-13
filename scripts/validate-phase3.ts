#!/usr/bin/env tsx
/**
 * Validate Phase 3 - Reply System Enhancements in production
 */

import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

function getPgSSL(connectionString: string) {
  if (connectionString.includes('supabase') || connectionString.includes('pooler') || connectionString.includes('sslmode')) {
    return { rejectUnauthorized: false };
  }
  return undefined;
}

async function validate() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL not found in environment');
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: getPgSSL(databaseUrl),
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000
  });

  console.log('🔍 Validating Phase 3 - Reply System Enhancements...\n');

  try {
    // 1. Check priority_score column exists
    console.log('1️⃣ Checking priority_score column...');
    const columnCheck = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'discovered_accounts' 
        AND column_name IN ('priority_score', 'last_successful_reply_at', 'reply_performance_score')
      ORDER BY column_name
    `);
    
    console.log(`   Found ${columnCheck.rows.length}/3 Phase 3 columns:`);
    columnCheck.rows.forEach(row => {
      console.log(`   ✅ ${row.column_name} (${row.data_type}, default: ${row.column_default || 'NULL'})`);
    });
    
    if (columnCheck.rows.length < 3) {
      const missing = ['priority_score', 'last_successful_reply_at', 'reply_performance_score']
        .filter(field => !columnCheck.rows.some(r => r.column_name === field));
      console.log(`   ⚠️  Missing columns: ${missing.join(', ')}`);
    }

    // 2. Check priority_score distribution
    console.log('\n2️⃣ Checking priority_score distribution...');
    const priorityStats = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(priority_score) as has_priority,
        COUNT(CASE WHEN priority_score > 0 THEN 1 END) as has_positive_priority,
        AVG(priority_score) as avg_priority,
        MAX(priority_score) as max_priority,
        MIN(priority_score) as min_priority
      FROM discovered_accounts
    `);
    
    if (priorityStats.rows.length > 0) {
      const stats = priorityStats.rows[0];
      console.log(`   📊 Priority Score Stats:`);
      console.log(`      Total accounts: ${stats.total}`);
      console.log(`      With priority_score: ${stats.has_priority}`);
      console.log(`      With positive priority: ${stats.has_positive_priority}`);
      console.log(`      Average: ${Number(stats.avg_priority || 0).toFixed(3)}`);
      console.log(`      Max: ${Number(stats.max_priority || 0).toFixed(3)}`);
      console.log(`      Min: ${Number(stats.min_priority || 0).toFixed(3)}`);
      
      if (parseInt(stats.has_positive_priority) > 0) {
        console.log('   ✅ Priority scores are being updated!');
      } else {
        console.log('   ⚠️  No positive priority scores yet (reply learning job may need to run)');
      }
    }

    // 3. Check reply opportunities with boosted scores
    console.log('\n3️⃣ Checking reply opportunities (boosted by priority)...');
    const oppStats = await pool.query(`
      SELECT 
        COUNT(*) as total,
        AVG(opportunity_score) as avg_score,
        MAX(opportunity_score) as max_score,
        COUNT(CASE WHEN opportunity_score > 100 THEN 1 END) as high_score_count
      FROM reply_opportunities
      WHERE replied_to = false
        AND (expires_at IS NULL OR expires_at > NOW())
    `);
    
    if (oppStats.rows.length > 0) {
      const stats = oppStats.rows[0];
      console.log(`   📊 Opportunity Pool:`);
      console.log(`      Total available: ${stats.total}`);
      console.log(`      Average score: ${Number(stats.avg_score || 0).toFixed(2)}`);
      console.log(`      Max score: ${Number(stats.max_score || 0).toFixed(2)}`);
      console.log(`      High scores (>100): ${stats.high_score_count}`);
    }

    // 4. Check recent replies and their target accounts
    console.log('\n4️⃣ Checking recent replies and account priorities...');
    const replyStats = await pool.query(`
      SELECT 
        cm.target_username,
        da.priority_score,
        COUNT(*) as reply_count,
        AVG(o.primary_objective_score) as avg_objective_score,
        AVG(o.followers_gained_weighted) as avg_followers_gained
      FROM content_metadata cm
      LEFT JOIN discovered_accounts da ON LOWER(da.username) = LOWER(cm.target_username)
      LEFT JOIN outcomes o ON o.decision_id = cm.decision_id
      WHERE cm.decision_type = 'reply'
        AND cm.status = 'posted'
        AND cm.posted_at > NOW() - INTERVAL '7 days'
      GROUP BY cm.target_username, da.priority_score
      ORDER BY da.priority_score DESC NULLS LAST
      LIMIT 10
    `);
    
    if (replyStats.rows.length > 0) {
      console.log(`   📊 Top 10 Accounts by Priority (last 7 days):`);
      replyStats.rows.forEach((row, idx) => {
        console.log(`      ${idx + 1}. @${row.target_username}: priority=${Number(row.priority_score || 0).toFixed(3)}, replies=${row.reply_count}, avg_obj=${Number(row.avg_objective_score || 0).toFixed(2)}`);
      });
    } else {
      console.log('   ⚠️  No recent replies found (may need to wait for reply system to run)');
    }

    // 5. Check reply learning job activity
    console.log('\n5️⃣ Checking reply learning job activity...');
    const learningStats = await pool.query(`
      SELECT 
        COUNT(*) as total,
        MAX(computed_at) as latest_computation
      FROM learning_model_weights
      WHERE weights->>'generator_name' IS NOT NULL
    `);
    
    // Check for reply learning via system_events or job_heartbeats
    const jobCheck = await pool.query(`
      SELECT 
        job_name,
        last_success,
        last_failure,
        consecutive_failures
      FROM job_heartbeats
      WHERE job_name = 'reply_priority_learning'
      ORDER BY last_success DESC NULLS LAST
      LIMIT 1
    `);
    
    if (jobCheck.rows.length > 0) {
      const job = jobCheck.rows[0];
      console.log(`   📊 Reply Priority Learning Job:`);
      console.log(`      Last success: ${job.last_success || 'Never'}`);
      console.log(`      Last failure: ${job.last_failure || 'None'}`);
      console.log(`      Consecutive failures: ${job.consecutive_failures || 0}`);
      
      if (job.last_success) {
        console.log('   ✅ Reply learning job is running!');
      } else {
        console.log('   ⚠️  Reply learning job has not run yet (may need to wait for schedule)');
      }
    } else {
      console.log('   ⚠️  Reply learning job not found in job_heartbeats (may need to wait for first run)');
    }

    console.log('\n✅ Phase 3 validation complete!\n');

  } catch (error: any) {
    console.error('❌ Validation error:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

validate().catch(error => {
  console.error('❌ Validation failed:', error);
  process.exit(1);
});

