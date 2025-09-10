/**
 * 🔄 AUTOMATIC MIGRATION RUNNER
 * Applies SQL migrations on startup with tracking
 */

import { createClient } from '@supabase/supabase-js';
import { Client } from 'pg';
import fs from 'fs';
import path from 'path';

interface MigrationRecord {
  filename: string;
  applied_at: string;
  checksum: string;
}

export class MigrationRunner {
  private supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  private pgClient: Client | null = null;

  async run(): Promise<void> {
    console.log('📊 MIGRATIONS: Starting automatic migration runner...');

    try {
      // Initialize PG client for DDL operations
      await this.initPgClient();
      
      // Ensure migrations tracking table exists
      await this.ensureMigrationsTable();
      
      // Get list of applied migrations
      const appliedMigrations = await this.getAppliedMigrations();
      const appliedSet = new Set(appliedMigrations.map(m => m.filename));
      
      // Read migration files
      const migrationFiles = await this.getMigrationFiles();
      
      // Apply new migrations
      for (const file of migrationFiles) {
        if (!appliedSet.has(file)) {
          await this.applyMigration(file);
        }
      }
      
      console.log(`✅ MIGRATIONS: All migrations applied successfully`);
      
    } catch (error: any) {
      console.error('❌ MIGRATIONS: Failed to run migrations:', error.message);
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  private async initPgClient(): Promise<void> {
    let databaseUrl = process.env.DATABASE_URL;
    
    if (!databaseUrl && process.env.SUPABASE_URL && process.env.SUPABASE_DB_PASSWORD) {
      // Construct from Supabase env vars
      const projectRef = process.env.SUPABASE_URL.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
      if (projectRef) {
        databaseUrl = `postgresql://postgres:${process.env.SUPABASE_DB_PASSWORD}@db.${projectRef}.supabase.co:5432/postgres`;
      }
    }
    
    if (!databaseUrl) {
      throw new Error('DATABASE_URL or SUPABASE_DB_PASSWORD required for migrations');
    }
    
    this.pgClient = new Client({ connectionString: databaseUrl });
    await this.pgClient.connect();
    console.log('📊 MIGRATIONS: Connected to PostgreSQL for DDL operations');
  }

  private async ensureMigrationsTable(): Promise<void> {
    const sql = `
      CREATE TABLE IF NOT EXISTS public.schema_migrations (
        filename text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now(),
        checksum text NOT NULL
      );
    `;
    
    await this.pgClient!.query(sql);
    console.log('📊 MIGRATIONS: Migration tracking table ready');
  }

  private async getAppliedMigrations(): Promise<MigrationRecord[]> {
    const { data, error } = await this.supabase
      .from('schema_migrations')
      .select('*')
      .order('applied_at');
      
    if (error && !error.message.includes('relation "schema_migrations" does not exist')) {
      throw error;
    }
    
    return data || [];
  }

  private async getMigrationFiles(): Promise<string[]> {
    const migrationsDir = path.join(__dirname, '../../sql/migrations');
    
    if (!fs.existsSync(migrationsDir)) {
      console.log('📊 MIGRATIONS: No migrations directory found, creating...');
      fs.mkdirSync(migrationsDir, { recursive: true });
      return [];
    }
    
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();
      
    console.log(`📊 MIGRATIONS: Found ${files.length} migration files`);
    return files;
  }

  private async applyMigration(filename: string): Promise<void> {
    console.log(`📊 MIGRATION_APPLYING: ${filename}`);
    
    const filepath = path.join(__dirname, '../../sql/migrations', filename);
    const sql = fs.readFileSync(filepath, 'utf8');
    const checksum = this.calculateChecksum(sql);
    
    try {
      // Execute the migration SQL
      await this.pgClient!.query(sql);
      
      // Record successful application
      await this.supabase
        .from('schema_migrations')
        .insert([{
          filename,
          applied_at: new Date().toISOString(),
          checksum
        }]);
        
      console.log(`✅ MIGRATION_APPLIED: ${filename}`);
      
    } catch (error: any) {
      console.error(`❌ MIGRATION_FAILED: ${filename} - ${error.message}`);
      throw error;
    }
  }

  private calculateChecksum(content: string): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(content).digest('hex').substring(0, 16);
  }

  private async cleanup(): Promise<void> {
    if (this.pgClient) {
      await this.pgClient.end();
    }
  }
}

// Auto-run on import in production
if (process.env.NODE_ENV === 'production' || process.env.RUN_MIGRATIONS === 'true') {
  const runner = new MigrationRunner();
  runner.run().catch(error => {
    console.error('❌ STARTUP_MIGRATIONS_FAILED:', error.message);
    process.exit(1);
  });
}

export default MigrationRunner;
