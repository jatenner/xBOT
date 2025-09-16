#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runMigrations = runMigrations;
const fs_1 = require("fs");
const path_1 = require("path");
const pg_1 = require("pg");
async function runMigrations() {
    const DATABASE_URL = process.env.DATABASE_URL;
    if (!DATABASE_URL) {
        console.error('❌ DATABASE_URL environment variable is required');
        process.exit(1);
    }
    console.log('🗃️  Starting database migrations...');
    console.log(`🔗 Connecting to database with SSL...`);
    const client = new pg_1.Client({
        connectionString: DATABASE_URL,
        ssl: {
            rejectUnauthorized: false // Accept self-signed certificates
        }
    });
    try {
        await client.connect();
        console.log('✅ Database connection established');
        // Get all migration files
        const migrationsDir = (0, path_1.join)(process.cwd(), 'supabase', 'migrations');
        let migrationFiles;
        try {
            migrationFiles = (0, fs_1.readdirSync)(migrationsDir)
                .filter(file => file.endsWith('.sql'))
                .sort(); // Sort alphabetically for consistent ordering
        }
        catch (error) {
            console.error('❌ Could not read migrations directory:', migrationsDir);
            throw error;
        }
        if (migrationFiles.length === 0) {
            console.log('ℹ️  No migration files found');
            return;
        }
        console.log(`📋 Found ${migrationFiles.length} migration files`);
        // Execute each migration
        for (const filename of migrationFiles) {
            const filePath = (0, path_1.join)(migrationsDir, filename);
            try {
                console.log(`🔄 Executing ${filename}...`);
                const sql = (0, fs_1.readFileSync)(filePath, 'utf8');
                // Execute with error handling
                await client.query('BEGIN');
                await client.query(sql);
                await client.query('COMMIT');
                console.log(`✅ ${filename} completed successfully`);
            }
            catch (error) {
                await client.query('ROLLBACK');
                console.error(`❌ ${filename} failed:`, error.message);
                throw error;
            }
        }
        console.log('🎉 All migrations completed successfully');
    }
    catch (error) {
        console.error('💥 Migration failed:', error.message);
        process.exit(1);
    }
    finally {
        await client.end();
    }
}
// Run migrations if this file is executed directly
if (require.main === module) {
    runMigrations().catch(error => {
        console.error('💥 Unhandled migration error:', error);
        process.exit(1);
    });
}
//# sourceMappingURL=migrate.js.map