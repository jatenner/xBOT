#!/usr/bin/env tsx
/**
 * Apply Migration Script
 * Uses our existing SupabaseMetaRunner to apply the migration via HTTP
 */

import { SupabaseMetaRunner, MetaResponse } from '../src/lib/SupabaseMetaRunner';
import fs from 'fs';
import path from 'path';

async function applyMigration() {
  console.log('🚀 MIGRATION: Starting telemetry and content quality migration');
  
  const migrationPath = path.join(__dirname, '../supabase/migrations/20250818_telemetry_and_content_quality.sql');
  
  if (!fs.existsSync(migrationPath)) {
    console.error('❌ MIGRATION: Migration file not found:', migrationPath);
    process.exit(1);
  }

  const migrationSql = fs.readFileSync(migrationPath, 'utf8');
  console.log('📄 MIGRATION: Loaded migration SQL (', migrationSql.length, 'characters)');

  const runner = new SupabaseMetaRunner();

  try {
    console.log('🔄 MIGRATION: Testing connection...');
    const testResult = await runner.testConnection();
    if (!testResult.success) {
      throw new Error(`Connection test failed: ${testResult.error}`);
    }
    console.log('✅ MIGRATION: Connection successful');

    console.log('🔄 MIGRATION: Executing migration via Supabase Meta API...');
    const migrationResult = await runner.execSql(migrationSql);
    if (!migrationResult.success) {
      throw new Error(`Migration failed: ${migrationResult.error}`);
    }
    console.log('✅ MIGRATION: Migration applied successfully!');
    
    console.log('🔄 MIGRATION: Reloading PostgREST schema cache...');
    const reloadResult = await runner.reloadPostgrest();
    if (!reloadResult.success) {
      console.warn('⚠️ MIGRATION: Schema reload failed, but migration was applied:', reloadResult.error);
    } else {
      console.log('✅ MIGRATION: PostgREST schema reloaded!');
    }
    
    console.log('🎉 MIGRATION: Complete! Database is ready for xBOT operations.');
    
  } catch (error: any) {
    console.error('❌ MIGRATION: Failed to apply migration:', error.message);
    console.error('💡 MIGRATION: Try applying the SQL manually in Supabase SQL Editor');
    process.exit(1);
  }
}

if (require.main === module) {
  applyMigration();
}
