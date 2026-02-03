#!/usr/bin/env tsx
import 'dotenv/config';
import { Client } from 'pg';

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  
  const { rows } = await client.query(`
    SELECT id, tweet_id, author_handle, like_count, created_at, discovery_source, replied_to
    FROM reply_opportunities
    WHERE replied_to = false
      AND like_count >= 50
      AND created_at > NOW() - INTERVAL '24 hours'
    ORDER BY like_count DESC, created_at DESC
    LIMIT 5
  `);
  
  console.log('Eligible opportunities:', JSON.stringify(rows, null, 2));
  console.log(`Found ${rows.length} eligible opportunities`);
  
  await client.end();
}

main().catch(console.error);
