#!/usr/bin/env tsx
"use strict";
/**
 * Apply Migration Script
 * Uses our existing SupabaseMetaRunner to apply the migration via HTTP
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const SupabaseMetaRunner_1 = require("../src/lib/SupabaseMetaRunner");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
async function applyMigration() {
    console.log('🚀 MIGRATION: Starting telemetry and content quality migration');
    const migrationPath = path_1.default.join(__dirname, '../supabase/migrations/20250818_telemetry_and_content_quality.sql');
    if (!fs_1.default.existsSync(migrationPath)) {
        console.error('❌ MIGRATION: Migration file not found:', migrationPath);
        process.exit(1);
    }
    const migrationSql = fs_1.default.readFileSync(migrationPath, 'utf8');
    console.log('📄 MIGRATION: Loaded migration SQL (', migrationSql.length, 'characters)');
    const runner = new SupabaseMetaRunner_1.SupabaseMetaRunner();
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
        }
        else {
            console.log('✅ MIGRATION: PostgREST schema reloaded!');
        }
        console.log('🎉 MIGRATION: Complete! Database is ready for xBOT operations.');
    }
    catch (error) {
        console.error('❌ MIGRATION: Failed to apply migration:', error.message);
        console.error('💡 MIGRATION: Try applying the SQL manually in Supabase SQL Editor');
        process.exit(1);
    }
}
if (require.main === module) {
    applyMigration();
}
//# sourceMappingURL=apply-migration.js.map