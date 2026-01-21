#!/usr/bin/env tsx
import 'dotenv/config';
import { Client } from 'pg';

async function verifyPlan() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    
    const { rows } = await client.query(`
      SELECT 
        plan_id,
        window_start,
        window_end,
        target_posts,
        target_replies,
        feed_weights,
        strategy_weights,
        resistance_backoff_applied,
        backoff_reason,
        created_at
      FROM growth_plans
      ORDER BY window_start DESC
      LIMIT 1;
    `);
    
    if (rows.length === 0) {
      console.log('❌ No plan found');
      process.exit(1);
    }
    
    console.log(JSON.stringify(rows[0], null, 2));
    await client.end();
    process.exit(0);
  } catch (err: any) {
    console.error('Error:', err.message);
    await client.end().catch(() => {});
    process.exit(1);
  }
}

verifyPlan();
