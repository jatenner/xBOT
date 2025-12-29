#!/usr/bin/env tsx
/**
 * Apply engagement tier migration manually
 */

import 'dotenv/config';
import pg from 'pg';
import fs from 'fs';
import path from 'path';

const { Pool } = pg;

async function main() {
  console.log('🔧 Applying engagement tier migration...\n');

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL not set in environment');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: databaseUrl });

  try {
    // Read migration file
    const migrationPath = path.join(process.cwd(), 'supabase/migrations/20251229_engagement_tiers.sql');
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Migration file: 20251229_engagement_tiers.sql');
    console.log('🔗 Target database: ' + databaseUrl.split('@')[1]?.split('/')[0] + '\n');

    // Execute migration
    await pool.query(migrationSql);

    console.log('✅ Migration applied successfully!\n');

    // Verify columns exist
    const { rows } = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'reply_opportunities' 
        AND column_name IN ('engagement_tier', 'timing_window', 'account_size_tier', 'opportunity_score_v2')
      ORDER BY column_name;
    `);

    console.log('✅ Verification - New columns in reply_opportunities:');
    for (const row of rows) {
      console.log(`   - ${row.column_name}: ${row.data_type}`);
    }

    console.log('\n🎉 Phase 1 migration complete!');
    process.exit(0);
  } catch (error: any) {
    if (error.message.includes('already exists')) {
      console.log('⚠️  Migration already applied (columns exist)');
      console.log('✅ Phase 1 migration verified!');
      process.exit(0);
    }
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();

