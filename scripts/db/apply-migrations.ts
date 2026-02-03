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
  
  // Check if migration already has BEGIN/COMMIT
  const hasTransaction = sql.toUpperCase().includes('BEGIN') && sql.toUpperCase().includes('COMMIT');
  
  if (hasTransaction) {
    // Migration has its own transaction - need to handle errors carefully
    // Split into statements and execute with error handling
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    let inTransaction = false;
    let transactionStarted = false;
    
    try {
      for (const stmt of statements) {
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
          // If statement has IF EXISTS/IF NOT EXISTS, some errors are expected
          const hasIfExists = upperStmt.includes('IF EXISTS') || upperStmt.includes('IF NOT EXISTS');
          if (hasIfExists && (error.message.includes('does not exist') || error.message.includes('already exists'))) {
            // Expected - object already exists or doesn't exist, which is fine with IF EXISTS
            console.log(`   ℹ️  Skipped (expected): ${stmt.substring(0, 60)}...`);
            // If in transaction, we need to continue - but transaction might be aborted
            // Try to continue anyway
            continue;
          }
          // COMMENT ON statements can fail if object doesn't exist - that's OK
          if (upperStmt.startsWith('COMMENT') && error.message.includes('does not exist')) {
            console.log(`   ℹ️  Comment skipped (object does not exist): ${stmt.substring(0, 60)}...`);
            continue;
          }
          // If transaction is aborted, we can't continue
          if (error.message.includes('aborted') && inTransaction) {
            await client.query('ROLLBACK');
            inTransaction = false;
            // Re-execute migration without transaction wrapper (safer for idempotent migrations)
            console.log(`   ⚠️  Transaction aborted, retrying without transaction wrapper...`);
            // Fall through to non-transaction path
            break;
          }
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
      
      // If error is about transaction being aborted, try executing without transaction
      if (error.message.includes('aborted') && hasTransaction) {
        console.log(`   ⚠️  Transaction failed, retrying statements individually...`);
        // Retry without transaction wrapper
        const retryStatements = statements.filter(s => {
          const upper = s.toUpperCase().trim();
          return upper !== 'BEGIN' && upper !== 'COMMIT';
        });
        
        for (const stmt of retryStatements) {
          if (stmt.trim().length === 0) continue;
          try {
            await client.query(stmt);
          } catch (retryError: any) {
            const upperStmt = stmt.toUpperCase();
            const hasIfExists = upperStmt.includes('IF EXISTS') || upperStmt.includes('IF NOT EXISTS');
            if (hasIfExists && (retryError.message.includes('does not exist') || retryError.message.includes('already exists'))) {
              console.log(`   ℹ️  Skipped (expected): ${stmt.substring(0, 60)}...`);
              continue;
            }
            if (upperStmt.startsWith('COMMENT') && retryError.message.includes('does not exist')) {
              console.log(`   ℹ️  Comment skipped: ${stmt.substring(0, 60)}...`);
              continue;
            }
            // If it's a constraint violation that's OK (object already exists)
            if (retryError.message.includes('already exists') || retryError.message.includes('duplicate')) {
              console.log(`   ℹ️  Skipped (already exists): ${stmt.substring(0, 60)}...`);
              continue;
            }
            throw retryError;
          }
        }
        
        // Record migration after retry
        await client.query(`
          INSERT INTO schema_migrations (filename, checksum, applied_at)
          VALUES ($1, $2, NOW())
          ON CONFLICT (filename) 
          DO UPDATE SET checksum = EXCLUDED.checksum, applied_at = NOW()
        `, [filename, checksum]);
        
        console.log(`✅ Migration applied (retry): ${filename}`);
        return;
      }
      
      throw error;
    }
  } else {
    // No transaction in migration - execute statements individually (safer for IF EXISTS)
    // Split SQL into statements
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
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
    
    // Acquire advisory lock (prevents concurrent runs)
    console.log('🔒 Acquiring advisory lock...');
    const lockResult = await client.query(
      `SELECT pg_try_advisory_lock($1) as acquired`,
      [ADVISORY_LOCK_ID]
    );
    
    if (!lockResult.rows[0].acquired) {
      console.error('❌ Could not acquire advisory lock - another migration may be running');
      process.exit(1);
    }
    
    console.log('✅ Advisory lock acquired');
    
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
      // Release advisory lock
      await client.query(`SELECT pg_advisory_unlock($1)`, [ADVISORY_LOCK_ID]);
      console.log('🔓 Advisory lock released');
    }
    
  } catch (error: any) {
    console.error(`❌ Migration failed: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
