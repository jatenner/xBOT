#!/usr/bin/env tsx
/**
 * 🔧 AUTOMATIC MIGRATION RUNNER
 * 
 * Applies SQL migrations from supabase/migrations/*.sql
 * Uses DATABASE_URL with advisory locks to prevent concurrent runs
 * Records applied migrations in schema_migrations table
 */

import 'dotenv/config';
import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';

const MIGRATIONS_DIR = path.join(process.cwd(), 'supabase', 'migrations');
const ADVISORY_LOCK_ID = 1234567890; // Unique lock ID for migrations

interface MigrationRecord {
  filename: string;
  checksum: string;
  applied_at: Date;
}

/**
 * Compute SHA256 checksum of file
 */
function computeChecksum(filePath: string): string {
  const content = fs.readFileSync(filePath, 'utf-8');
  return createHash('sha256').update(content).digest('hex');
}

/**
 * Ensure schema_migrations table exists
 */
async function ensureMigrationsTable(client: Client): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      filename TEXT UNIQUE NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      checksum TEXT NOT NULL
    );
    
    CREATE INDEX IF NOT EXISTS idx_schema_migrations_filename 
      ON schema_migrations(filename);
  `);
}

/**
 * Get applied migrations
 */
async function getAppliedMigrations(client: Client): Promise<Map<string, MigrationRecord>> {
  const { rows } = await client.query<MigrationRecord>(`
    SELECT filename, checksum, applied_at 
    FROM schema_migrations 
    ORDER BY applied_at
  `);
  
  const map = new Map<string, MigrationRecord>();
  for (const row of rows) {
    map.set(row.filename, row);
  }
  return map;
}

/**
 * Apply a single migration file
 */
async function applyMigration(
  client: Client,
  filePath: string,
  filename: string
): Promise<void> {
  console.log(`📄 Applying migration: ${filename}`);
  
  const sql = fs.readFileSync(filePath, 'utf-8');
  const checksum = computeChecksum(filePath);
  
  // If migration contains ANY dollar-quoting (DO $$, CREATE FUNCTION $$, $func$, etc), execute as single statement
  const hasDoBlocks = sql.includes('DO $$') || /DO\s+\$[^$]+\$/i.test(sql) || sql.includes('DO $');
  const hasCreateFunction = /CREATE\s+(OR\s+REPLACE\s+)?FUNCTION.*?\$\$/is.test(sql) || /CREATE\s+FUNCTION.*\$func\$/is.test(sql);
  const hasDollarQuoting = sql.includes('$$') || /\$[^$]+\$/i.test(sql) || sql.includes('$func$');
  const hasDollarQuote = hasDoBlocks || hasCreateFunction || hasDollarQuoting;

  if (hasDollarQuote) {
    console.log(`[MIGRATIONS] executing as single statement due to dollar-quote/DO detection: ${filename}`);
  }
  
  // Check if migration already has BEGIN/COMMIT (but not inside DO $$ blocks)
  // If DO blocks exist, don't treat as transaction wrapper
  let hasTransaction = false;
  if (!hasDoBlocks && !hasCreateFunction) {
    const doBlockRegex = /DO\s+\$[^$]*\$[^$]*\$/gis;
    const sqlWithoutDoBlocks = sql.replace(doBlockRegex, '');
    hasTransaction = sqlWithoutDoBlocks.toUpperCase().includes('BEGIN') && sqlWithoutDoBlocks.toUpperCase().includes('COMMIT');
  }
  
  // If DO blocks, CREATE FUNCTION, or any dollar-quoting exists, execute as single statement
  if (hasDollarQuote) {
    try {
      await client.query(sql);
    } catch (error: any) {
      // First error visibility: filename, statement index (N/A for single-stmt), 200-char snippet, pg fields
      const sqlSnippet = sql.substring(0, 200).replace(/\n/g, ' ');
      console.error(`[MIGRATIONS] Migration failed`);
      console.error(`[MIGRATIONS] filename: ${filename}`);
      console.error(`[MIGRATIONS] statement_index: N/A (single statement)`);
      console.error(`[MIGRATIONS] sql_snippet: ${sqlSnippet}`);
      console.error(`[MIGRATIONS] pg_code: ${error.code || 'N/A'}`);
      console.error(`[MIGRATIONS] pg_message: ${error.message || 'N/A'}`);
      console.error(`[MIGRATIONS] pg_detail: ${error.detail || 'N/A'}`);
      console.error(`[MIGRATIONS] pg_hint: ${error.hint || 'N/A'}`);
      const hasIfExists = sql.toUpperCase().includes('IF EXISTS') || sql.toUpperCase().includes('IF NOT EXISTS');
      if (hasIfExists && error.message.includes('does not exist')) {
        console.log(`   ℹ️  Skipped (object does not exist)`);
      } else {
        throw error;
      }
    }
    
    await client.query(`
      INSERT INTO schema_migrations (filename, checksum, applied_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (filename) 
      DO UPDATE SET checksum = EXCLUDED.checksum, applied_at = NOW()
    `, [filename, checksum]);
    
    console.log(`✅ Migration applied: ${filename}`);
    return;
  }
  
  if (hasTransaction) {
    // Migration has its own transaction - need to handle errors carefully
    // Split into statements and execute with error handling
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    let inTransaction = false;
    let transactionStarted = false;
    let firstError: any = null;
    let firstErrorStmtIndex = -1;
    
    try {
      for (let i = 0; i < statements.length; i++) {
        const stmt = statements[i];
        if (stmt.trim().length === 0) continue;
        
        const upperStmt = stmt.toUpperCase().trim();
        
        // Handle BEGIN
        if (upperStmt === 'BEGIN') {
          await client.query('BEGIN');
          inTransaction = true;
          transactionStarted = true;
          continue;
        }
        
        // Handle COMMIT
        if (upperStmt === 'COMMIT') {
          if (inTransaction) {
            await client.query('COMMIT');
            inTransaction = false;
          }
          continue;
        }
        
        // Execute statement
        try {
          await client.query(stmt);
        } catch (error: any) {
          // Capture FIRST error with full context
          if (!firstError) {
            firstError = error;
            firstErrorStmtIndex = i;
            console.error(`❌ Migration failed at statement ${i + 1}/${statements.length}`);
            console.error(`   File: ${filename}`);
            console.error(`   Statement preview: ${stmt.substring(0, 200)}...`);
            console.error(`   Error: ${error.message}`);
            console.error(`   Error code: ${error.code || 'N/A'}`);
            console.error(`   Detail: ${error.detail || 'N/A'}`);
            console.error(`   Hint: ${error.hint || 'N/A'}`);
          }
          
          // If transaction is aborted, stop immediately and rollback
          if (error.message.includes('aborted') && inTransaction) {
            console.error(`   ⚠️  Transaction aborted - stopping execution`);
            await client.query('ROLLBACK');
            inTransaction = false;
            // Throw the FIRST error, not the abort error
            throw firstError || error;
          }
          
          // If statement has IF EXISTS/IF NOT EXISTS, some errors are expected
          const hasIfExists = upperStmt.includes('IF EXISTS') || upperStmt.includes('IF NOT EXISTS');
          if (hasIfExists && (error.message.includes('does not exist') || error.message.includes('already exists'))) {
            // Expected - object already exists or doesn't exist, which is fine with IF EXISTS
            console.log(`   ℹ️  Skipped (expected): ${stmt.substring(0, 60)}...`);
            continue;
          }
          // COMMENT ON statements can fail if object doesn't exist - that's OK
          if (upperStmt.startsWith('COMMENT') && error.message.includes('does not exist')) {
            console.log(`   ℹ️  Comment skipped (object does not exist): ${stmt.substring(0, 60)}...`);
            continue;
          }
          
          // For other errors, throw immediately (don't continue in aborted transaction)
          throw error;
        }
      }
      
      // Ensure transaction is closed
      if (inTransaction) {
        await client.query('COMMIT');
        inTransaction = false;
      }
      
      // Record migration (outside transaction)
      await client.query(`
        INSERT INTO schema_migrations (filename, checksum, applied_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (filename) 
        DO UPDATE SET checksum = EXCLUDED.checksum, applied_at = NOW()
      `, [filename, checksum]);
      
      console.log(`✅ Migration applied: ${filename}`);
    } catch (error: any) {
      // If transaction was started, ensure it's rolled back
      if (inTransaction) {
        try {
          await client.query('ROLLBACK');
        } catch (rollbackError) {
          // Ignore rollback errors
        }
      }
      
      // Throw the FIRST error if we captured one, otherwise throw current error
      throw firstError || error;
    }
  } else {
    // No transaction in migration - execute statements individually (safer for IF EXISTS)
    // If migration contains DO $$ blocks, execute as single statement to avoid splitting issues
    if (sql.includes('DO $$') || sql.includes('DO $')) {
      // Execute entire migration as one statement (PostgreSQL handles multiple statements)
      try {
        await client.query(sql);
      } catch (error: any) {
        // If statement has IF EXISTS/IF NOT EXISTS, some errors are expected
        const hasIfExists = sql.toUpperCase().includes('IF EXISTS') || sql.toUpperCase().includes('IF NOT EXISTS');
        if (hasIfExists && error.message.includes('does not exist')) {
          console.log(`   ℹ️  Skipped (object does not exist)`);
        } else {
          throw error;
        }
      }
      
      // Record migration
      await client.query(`
        INSERT INTO schema_migrations (filename, checksum, applied_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (filename) 
        DO UPDATE SET checksum = EXCLUDED.checksum, applied_at = NOW()
      `, [filename, checksum]);
      
      console.log(`✅ Migration applied: ${filename}`);
      return;
    }
    
    // Split SQL into statements (for migrations without DO blocks)
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    const filteredStatements = statements;
    
    // Execute all statements (each in its own implicit transaction for DDL)
    for (const stmt of statements) {
      if (stmt.trim().length > 0) {
        try {
          await client.query(stmt);
        } catch (error: any) {
          // If statement has IF EXISTS/IF NOT EXISTS, some errors are expected
          const hasIfExists = stmt.toUpperCase().includes('IF EXISTS') || stmt.toUpperCase().includes('IF NOT EXISTS');
          if (hasIfExists && error.message.includes('does not exist')) {
            // Expected - object doesn't exist, which is fine with IF EXISTS
            console.log(`   ℹ️  Skipped (object does not exist): ${stmt.substring(0, 60)}...`);
            continue;
          }
          // COMMENT ON statements can fail if object doesn't exist - that's OK
          if (stmt.toUpperCase().startsWith('COMMENT') && error.message.includes('does not exist')) {
            console.log(`   ℹ️  Comment skipped (object does not exist): ${stmt.substring(0, 60)}...`);
            continue;
          }
          // Re-throw other errors
          throw error;
        }
      }
    }
    
    // Record migration (outside any transaction)
    await client.query(`
      INSERT INTO schema_migrations (filename, checksum, applied_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (filename) 
      DO UPDATE SET checksum = EXCLUDED.checksum, applied_at = NOW()
    `, [filename, checksum]);
    
    console.log(`✅ Migration applied: ${filename}`);
  }
}

/**
 * Main migration runner
 */
async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL not set');
    process.exit(1);
  }

  console.log('🔧 Starting migration runner...');
  
  const client = new Client({ connectionString: databaseUrl });
  
  try {
    await client.connect();
    console.log('✅ Connected to database');
    
    // Acquire advisory lock with retry/backoff (prevents concurrent runs)
    console.log('🔒 Acquiring advisory lock...');
    const maxRetries = 24; // 24 retries * 5s = 120s max wait
    const baseDelayMs = 5000; // 5 seconds base delay
    let lockAcquired = false;
    let lockResult: any = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      lockResult = await client.query(
        `SELECT pg_try_advisory_lock($1) as acquired`,
        [ADVISORY_LOCK_ID]
      );
      
      if (lockResult.rows[0].acquired) {
        lockAcquired = true;
        console.log(`✅ Advisory lock acquired (attempt ${attempt}/${maxRetries})`);
        break;
      }
      
      if (attempt < maxRetries) {
        // Exponential backoff with jitter
        const jitter = Math.random() * 1000; // 0-1s jitter
        const delayMs = baseDelayMs + jitter;
        console.log(`⏳ Lock unavailable (attempt ${attempt}/${maxRetries}), retrying in ${Math.round(delayMs / 1000)}s...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
    
    if (!lockAcquired) {
      const failFast = process.env.RUN_MIGRATIONS_FAIL_FAST === 'true';
      console.error(`❌ Could not acquire advisory lock after ${maxRetries} attempts (120s timeout)`);
      console.error('   Another migration may be running, or previous migration did not release lock');
      if (failFast) {
        process.exit(1);
      }
      console.warn('[MIGRATIONS] Lock unavailable but RUN_MIGRATIONS_FAIL_FAST=false — exiting 0 (skip migrations)');
      return;
    }
    
    try {
      // Ensure migrations table exists
      await ensureMigrationsTable(client);
      console.log('✅ Migrations table ready');
      
      // Get applied migrations
      const appliedMigrations = await getAppliedMigrations(client);
      console.log(`📊 Found ${appliedMigrations.size} previously applied migrations`);
      
      // Scan migration files
      if (!fs.existsSync(MIGRATIONS_DIR)) {
        console.error(`❌ Migrations directory not found: ${MIGRATIONS_DIR}`);
        process.exit(1);
      }
      
      const files = fs.readdirSync(MIGRATIONS_DIR)
        .filter(f => f.endsWith('.sql'))
        .sort(); // Lexicographic order
      
      console.log(`📋 Found ${files.length} migration files`);
      
      let appliedCount = 0;
      let skippedCount = 0;
      
      for (const filename of files) {
        const filePath = path.join(MIGRATIONS_DIR, filename);
        const checksum = computeChecksum(filePath);
        
        const existing = appliedMigrations.get(filename);
        
        if (existing && existing.checksum === checksum) {
          console.log(`⏭️  Skipping ${filename} (already applied with same checksum)`);
          skippedCount++;
          continue;
        }
        
        if (existing && existing.checksum !== checksum) {
          console.log(`⚠️  Migration ${filename} checksum changed - reapplying`);
        }
        
        // Apply migration
        await applyMigration(client, filePath, filename);
        appliedCount++;
      }
      
      console.log(`\n✅ Migration run complete:`);
      console.log(`   Applied: ${appliedCount}`);
      console.log(`   Skipped: ${skippedCount}`);
      
      if (appliedCount === 0 && skippedCount === 0) {
        console.log('⚠️  No migrations found');
      }
      
    } finally {
      // Release advisory lock (always, even on error)
        try {
          const unlockResult = await client.query(`SELECT pg_advisory_unlock($1) as released`, [ADVISORY_LOCK_ID]);
          if (unlockResult.rows[0].released) {
            console.log('🔓 Advisory lock released');
          } else {
            console.warn('⚠️  Advisory lock was not held (may have been released already)');
          }
        } catch (unlockError: any) {
          console.error(`⚠️  Failed to release advisory lock: ${unlockError.message}`);
          // Best-effort: if transaction aborted, unlock may fail; don't throw
        }
    }
    
  } catch (error: any) {
    console.error(`❌ Migration failed: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  } finally {
    // Ensure connection is closed
    try {
      await client.end();
    } catch (closeError) {
      // Ignore close errors
    }
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
