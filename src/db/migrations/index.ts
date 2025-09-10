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
    
    // Smart DATABASE_URL resolver with APP_ENV support
    if (!databaseUrl) {
      databaseUrl = this.buildDatabaseUrl();
    }
    
    if (!databaseUrl) {
      throw new Error('DATABASE_URL required for migrations. Ensure DATABASE_URL is set OR provide SUPABASE_DB_PASSWORD with either SUPABASE_URL or valid PROJECT_REF variables.');
    }
    
    this.pgClient = new Client({ connectionString: databaseUrl });
    await this.pgClient.connect();
    console.log('📊 MIGRATIONS: Connected to PostgreSQL for DDL operations');
  }

  private buildDatabaseUrl(): string | null {
    const appEnv = process.env.APP_ENV || 'production';
    const dbPassword = process.env.SUPABASE_DB_PASSWORD;
    
    if (!dbPassword) {
      console.warn('⚠️ MIGRATION_URL_RESOLVER: No SUPABASE_DB_PASSWORD found');
      return null;
    }

    // Try direct SUPABASE_URL first
    if (process.env.SUPABASE_URL) {
      const projectRef = process.env.SUPABASE_URL.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
      if (projectRef) {
        const url = `postgresql://postgres:${dbPassword}@db.${projectRef}.supabase.co:5432/postgres`;
        console.log(`✅ MIGRATION_URL_RESOLVER: Built from SUPABASE_URL (${projectRef})`);
        return url;
      }
    }

    // Try environment-specific PROJECT_REF
    let projectRef = null;
    if (appEnv === 'staging') {
      projectRef = process.env.STAGING_PROJECT_REF;
    } else if (appEnv === 'production') {
      projectRef = process.env.PRODUCTION_PROJECT_REF || process.env.SUPABASE_PROJECT_REF;
    }

    // Fallback to generic PROJECT_REF
    if (!projectRef) {
      projectRef = process.env.PROJECT_REF;
    }

    if (projectRef) {
      const url = `postgresql://postgres:${dbPassword}@db.${projectRef}.supabase.co:5432/postgres`;
      console.log(`✅ MIGRATION_URL_RESOLVER: Built from ${appEnv.toUpperCase()}_PROJECT_REF (${projectRef})`);
      return url;
    }

    console.error('❌ MIGRATION_URL_RESOLVER: No valid PROJECT_REF found. Checked: SUPABASE_URL, STAGING_PROJECT_REF, PRODUCTION_PROJECT_REF, SUPABASE_PROJECT_REF, PROJECT_REF');
    return null;
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
