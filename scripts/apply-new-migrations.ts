/**
 * Apply new migrations: relevance/replyability scores + replied_tweets table
 */

import 'dotenv/config';
import { Client } from 'pg';
import fs from 'fs';
import path from 'path';

async function applyMigrations() {
  const DATABASE_URL = process.env.DATABASE_URL;
  
  if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is required');
    process.exit(1);
  }
  
  // SSL configuration
  const ssl = DATABASE_URL.includes('sslmode=require') 
    ? { require: true, rejectUnauthorized: false } 
    : undefined;
  
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl,
  });
  
  try {
    await client.connect();
    console.log('✅ Connected to database\n');
    
    // Apply migrations
    const migrations = [
      'supabase/migrations/20260108_add_relevance_replyability.sql',
      'supabase/migrations/20260108_replied_tweets.sql',
      'supabase/migrations/20260108_seed_account_stats.sql',
      'supabase/migrations/20260108_seed_account_stats_tier_counts.sql',
      'supabase/migrations/20260108_add_context_similarity_score_final.sql',
    ];
    
    for (const migrationPath of migrations) {
      const fullPath = path.join(process.cwd(), migrationPath);
      
      if (!fs.existsSync(fullPath)) {
        console.error(`❌ Migration file not found: ${migrationPath}`);
        process.exit(1);
      }
      
      console.log(`📄 Applying ${path.basename(migrationPath)}...`);
      const sql = fs.readFileSync(fullPath, 'utf8');
      
      try {
        await client.query(sql);
        console.log(`   ✅ Applied successfully\n`);
      } catch (error: any) {
        // Check if it's an "already exists" error (idempotent)
        if (error.code === '42710' || // duplicate_object
            error.code === '42P07' || // duplicate_table
            error.message?.includes('already exists') ||
            error.message?.includes('duplicate')) {
          console.log(`   ⚠️  Already applied (idempotent)\n`);
        } else {
          console.error(`   ❌ Failed: ${error.message}`);
          throw error;
        }
      }
    }
    
    console.log('✅ All migrations applied successfully');
    
  } catch (error: any) {
    console.error(`❌ Migration failed: ${error.message}`);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  } finally {
    await client.end();
  }
}

applyMigrations().catch(console.error);

