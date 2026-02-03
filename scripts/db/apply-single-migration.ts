#!/usr/bin/env tsx
/**
 * Apply a single migration file by name
 */

import 'dotenv/config';
import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';

const MIGRATIONS_DIR = path.join(process.cwd(), 'supabase', 'migrations');

async function main() {
  const filename = process.argv[2];
  if (!filename) {
    console.error('Usage: tsx scripts/db/apply-single-migration.ts <filename>');
    process.exit(1);
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL not set');
    process.exit(1);
  }

  const filePath = path.join(MIGRATIONS_DIR, filename);
  if (!fs.existsSync(filePath)) {
    console.error(`❌ Migration file not found: ${filePath}`);
    process.exit(1);
  }

  const client = new Client({ connectionString: databaseUrl });
  
  try {
    await client.connect();
    console.log(`🔧 Applying single migration: ${filename}`);
    
    // Ensure migrations table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        filename TEXT UNIQUE NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        checksum TEXT NOT NULL
      );
    `);
    
    const sql = fs.readFileSync(filePath, 'utf-8');
    const checksum = createHash('sha256').update(sql).digest('hex');
    
    // Check if already applied
    const { rows } = await client.query(
      'SELECT checksum FROM schema_migrations WHERE filename = $1',
      [filename]
    );
    
    if (rows.length > 0 && rows[0].checksum === checksum) {
      console.log(`⏭️  Migration already applied with same checksum`);
      process.exit(0);
    }
    
    // Execute migration
    const hasTransaction = sql.toUpperCase().includes('BEGIN') && sql.toUpperCase().includes('COMMIT');
    
    if (hasTransaction) {
      // Execute as-is (migration handles its own transaction)
      await client.query(sql);
    } else {
      // Execute statements individually
      const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));
      
      for (const stmt of statements) {
        try {
          await client.query(stmt);
        } catch (error: any) {
          const upperStmt = stmt.toUpperCase();
          const hasIfExists = upperStmt.includes('IF EXISTS') || upperStmt.includes('IF NOT EXISTS');
          if (hasIfExists && (error.message.includes('does not exist') || error.message.includes('already exists'))) {
            console.log(`   ℹ️  Skipped (expected): ${stmt.substring(0, 60)}...`);
            continue;
          }
          if (upperStmt.startsWith('COMMENT') && error.message.includes('does not exist')) {
            console.log(`   ℹ️  Comment skipped: ${stmt.substring(0, 60)}...`);
            continue;
          }
          throw error;
        }
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
    
  } catch (error: any) {
    console.error(`❌ Migration failed: ${error.message}`);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main().catch(console.error);
