#!/usr/bin/env tsx
import 'dotenv/config';
import { Client } from 'pg';

const planId = process.argv[2];

if (!planId) {
  console.error('Usage: tsx scripts/check-execution-counters.ts <plan_id>');
  process.exit(1);
}

async function checkCounters() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    
    const { rows } = await client.query(`
      SELECT 
        ge.plan_id,
        ge.posts_done,
        ge.replies_done,
        ge.last_updated,
        gp.target_posts,
        gp.target_replies,
        (gp.target_posts - ge.posts_done) AS posts_remaining,
        (gp.target_replies - ge.replies_done) AS replies_remaining
      FROM growth_execution ge
      JOIN growth_plans gp ON ge.plan_id = gp.plan_id
      WHERE ge.plan_id = $1;
    `, [planId]);
    
    if (rows.length === 0) {
      console.log('⚠️  No execution record found (may not have posted yet)');
      // Show plan targets
      const { rows: planRows } = await client.query(`
        SELECT target_posts, target_replies FROM growth_plans WHERE plan_id = $1;
      `, [planId]);
      if (planRows.length > 0) {
        console.log('Plan targets:', JSON.stringify(planRows[0], null, 2));
      }
    } else {
      console.log(JSON.stringify(rows[0], null, 2));
    }
    
    await client.end();
    process.exit(0);
  } catch (err: any) {
    console.error('Error:', err.message);
    await client.end().catch(() => {});
    process.exit(1);
  }
}

checkCounters();
