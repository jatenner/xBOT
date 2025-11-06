/**
 * Apply mega-viral harvester upgrade migration
 */

import 'dotenv/config';
import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

const databaseUrl = process.env.DATABASE_URL!;

if (!databaseUrl) {
  console.error('❌ Missing DATABASE_URL');
  process.exit(1);
}

async function applyMigration() {
  const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    // Read migration file
    const migrationPath = path.join(__dirname, '../supabase/migrations/20251106_mega_viral_harvester_upgrade.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Applying migration: 20251106_mega_viral_harvester_upgrade.sql...\n');

    // Execute migration
    await client.query(migrationSQL);

    console.log('✅ Migration applied successfully!\n');

    // Verify new columns exist
    const verifyColumns = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'reply_opportunities' 
      AND column_name IN ('health_relevance_score', 'health_category', 'ai_judge_reason', 'target_tweet_id', 'target_username');
    `);

    console.log('📊 Verification - New columns:');
    verifyColumns.rows.forEach(row => {
      console.log(`   ✓ ${row.column_name} (${row.data_type})`);
    });

    // Check tier constraint
    const checkConstraint = await client.query(`
      SELECT conname
      FROM pg_constraint 
      WHERE conname = 'reply_opportunities_tier_check';
    `);

    if (checkConstraint.rows.length > 0) {
      console.log('\n✅ Tier constraint updated to support TITAN/ULTRA/MEGA/SUPER/HIGH');
    }

    console.log('\n🎉 Migration complete!');

  } catch (error: any) {
    console.error('❌ Migration error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await client.end();
  }
}

applyMigration().catch(console.error);

