#!/usr/bin/env tsx
import 'dotenv/config';
import { Client } from 'pg';

const planId = process.argv[2];
const targetPosts = parseInt(process.argv[3] || '0', 10);
const targetReplies = parseInt(process.argv[4] || '1', 10);

if (!planId) {
  console.error('Usage: tsx scripts/update-plan-targets.ts <plan_id> [target_posts] [target_replies]');
  process.exit(1);
}

async function updateTargets() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    
    await client.query(`
      UPDATE growth_plans 
      SET target_posts = $1, target_replies = $2
      WHERE plan_id = $3;
    `, [targetPosts, targetReplies, planId]);
    
    const { rows } = await client.query(`
      SELECT plan_id, target_posts, target_replies 
      FROM growth_plans 
      WHERE plan_id = $1;
    `, [planId]);
    
    console.log('✅ Updated plan:');
    console.log(JSON.stringify(rows[0], null, 2));
    
    await client.end();
    process.exit(0);
  } catch (err: any) {
    console.error('Error:', err.message);
    await client.end().catch(() => {});
    process.exit(1);
  }
}

updateTargets();
