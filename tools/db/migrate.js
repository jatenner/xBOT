#!/usr/bin/env ts-node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runMigrations = runMigrations;
const pg_1 = require("pg");
const fs_1 = require("fs");
const path_1 = require("path");
// Import SSL helper
function getPgSSL(dbUrl) {
    if (!dbUrl) {
        return undefined;
    }
    if (dbUrl.includes('sslmode=require')) {
        return { rejectUnauthorized: false, require: true };
    }
    return undefined;
}
function logSafeConnectionInfo(connectionString) {
    if (!connectionString) {
        console.log('DB connect -> no connection string provided');
        return;
    }
    try {
        const url = new URL(connectionString);
        const host = url.hostname;
        const port = url.port || '5432';
        const ssl = connectionString.includes('sslmode=require') ? 'no-verify' : 'off';
        console.log(`DB connect -> host=${host} port=${port} ssl=${ssl}`);
    }
    catch (error) {
        console.log('DB connect -> invalid connection string format');
    }
}
async function runMigrations() {
    const enabled = process.env.MIGRATIONS_RUNTIME_ENABLED === 'true';
    if (!enabled) {
        console.log('runtime migrations disabled');
        process.exit(0);
    }
    const DATABASE_URL = process.env.DATABASE_URL;
    if (!DATABASE_URL) {
        console.error('❌ DATABASE_URL environment variable is required');
        process.exit(1);
    }
    const migrationsDir = (0, path_1.join)(process.cwd(), 'supabase', 'migrations');
    if (!(0, fs_1.existsSync)(migrationsDir)) {
        console.log('ℹ️  No migrations directory found');
        process.exit(0);
    }
    const files = (0, fs_1.readdirSync)(migrationsDir).filter(f => f.endsWith('.sql')).sort();
    if (files.length === 0) {
        console.log('ℹ️  No migration files found');
        process.exit(0);
    }
    console.log(`🗃️  Found ${files.length} migration files`);
    logSafeConnectionInfo(DATABASE_URL);
    const client = new pg_1.Client({
        connectionString: DATABASE_URL,
        ssl: getPgSSL(DATABASE_URL)
    });
    try {
        await client.connect();
    }
    catch (error) {
        if (error.message.includes('self-signed certificate')) {
            console.log('Retrying connection with same SSL options...');
            try {
                await client.connect();
            }
            catch (retryError) {
                console.error('💥 Migration connection failed after retry:', retryError.message);
                process.exit(1);
            }
        }
        else {
            console.error('💥 Migration connection failed:', error.message);
            process.exit(1);
        }
    }
    for (const filename of files) {
        const filePath = (0, path_1.join)(migrationsDir, filename);
        try {
            process.stdout.write(`→ Applying ${filename} ... `);
            const sql = (0, fs_1.readFileSync)(filePath, 'utf8');
            await client.query(sql);
            console.log('OK');
        }
        catch (error) {
            console.log('FAILED:', error.message);
            await client.end();
            process.exit(1);
        }
    }
    await client.end();
    console.log('✅ All migrations applied');
}
if (require.main === module) {
    runMigrations().catch(error => {
        console.error('💥 Migration failed:', error.message);
        process.exit(1);
    });
}
//# sourceMappingURL=migrate.js.map