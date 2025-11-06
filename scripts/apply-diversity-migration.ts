/**
 * Apply diversity tracking migration using pg directly
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
    console.log('✅ Connected to database');
    
    // Read migration file
    const migrationPath = path.join(__dirname, '../supabase/migrations/20251106_diversity_tracking.sql');
    const sql = fs.readFileSync(migrationPath, 'utf-8');
    
    console.log('📦 Applying diversity tracking migration...\n');
    
    // Execute migration
    await client.query(sql);
    
    console.log('✅ Migration applied successfully!\n');
    
    // Verify columns exist
    console.log('🔍 Verifying columns...');
    const result = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'content_metadata' 
      AND column_name IN ('generator_type', 'content_angle', 'format_type', 'complexity_score')
      ORDER BY column_name;
    `);
    
    if (result.rows.length === 4) {
      console.log('✅ All 4 diversity columns verified:');
      result.rows.forEach(row => {
        console.log(`   - ${row.column_name}: ${row.data_type}`);
      });
    } else {
      console.warn(`⚠️ Expected 4 columns, found ${result.rows.length}`);
      result.rows.forEach(row => {
        console.log(`   - ${row.column_name}: ${row.data_type}`);
      });
    }
    
    // Check indexes
    console.log('\n🔍 Checking indexes...');
    const indexResult = await client.query(`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'content_metadata' 
      AND indexname LIKE 'idx_%diversity%' OR indexname LIKE 'idx_%generator%'
      ORDER BY indexname;
    `);
    
    console.log(`✅ Found ${indexResult.rows.length} diversity-related indexes:`);
    indexResult.rows.forEach(row => {
      console.log(`   - ${row.indexname}`);
    });
    
    console.log('\n🎉 Migration complete!');
    
  } catch (error: any) {
    console.error('❌ Migration error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

applyMigration().catch(console.error);

