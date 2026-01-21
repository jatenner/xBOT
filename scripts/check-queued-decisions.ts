#!/usr/bin/env tsx
import 'dotenv/config';
import { Client } from 'pg';

async function checkQueue() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    
    // Check for queued replies
    const { rows: replies } = await client.query(`
      SELECT decision_id, decision_type, status, created_at
      FROM content_metadata
      WHERE decision_type = 'reply'
        AND status = 'queued'
      ORDER BY created_at DESC
      LIMIT 5;
    `);
    
    // Check for queued posts
    const { rows: posts } = await client.query(`
      SELECT decision_id, decision_type, status, created_at
      FROM content_metadata
      WHERE decision_type IN ('single', 'thread')
        AND status = 'queued'
      ORDER BY created_at DESC
      LIMIT 5;
    `);
    
    console.log(`Queued replies: ${replies.length}`);
    console.log(`Queued posts: ${posts.length}`);
    
    if (replies.length > 0) {
      console.log('\nSample queued reply:');
      console.log(JSON.stringify(replies[0], null, 2));
    }
    
    if (posts.length > 0) {
      console.log('\nSample queued post:');
      console.log(JSON.stringify(posts[0], null, 2));
    }
    
    await client.end();
    process.exit(0);
  } catch (err: any) {
    console.error('Error:', err.message);
    await client.end().catch(() => {});
    process.exit(1);
  }
}

checkQueue();
