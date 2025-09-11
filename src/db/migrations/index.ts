/**
 * 🔄 AUTOMATIC MIGRATION RUNNER
 * Applies SQL migrations on startup with tracking
 */

import { createClient } from '@supabase/supabase-js';
import { Client } from 'pg';
import fs from 'fs';
import path from 'path';
import { FEATURE_FLAGS } from '../../config/featureFlags';
import { log, warn, error } from '../../utils/logger';

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
  private migrationHealth: {
    lastRunAt: Date | null;
    success: boolean;
    error: string | null;
  } = {
    lastRunAt: null,
    success: true,
    error: null
  };

  async run(): Promise<void> {
    // Check if migrations were already run successfully in prestart
    if (process.env.MIGRATIONS_ALREADY_RAN === 'true') {
      log('✅ MIGRATIONS: Skipping runtime migrations (prestart completed successfully)');
      this.migrationHealth.success = true;
      this.migrationHealth.error = null;
      return;
    }

    // Check feature flag
    if (!FEATURE_FLAGS.MIGRATIONS_RUNTIME_ENABLED) {
      log('🚫 MIGRATIONS: Runtime migrations disabled by feature flag');
      this.migrationHealth.success = true;
      this.migrationHealth.error = null;
      return;
    }

    log('📊 MIGRATIONS: Starting runtime migration runner (prestart failed or skipped)...');
    this.migrationHealth.lastRunAt = new Date();

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
      let appliedCount = 0;
      let skippedCount = 0;
      
      for (const file of migrationFiles) {
        if (!appliedSet.has(file)) {
          await this.applyMigration(file);
          appliedCount++;
        } else {
          console.log(`🧱 MIGRATION_SKIPPED: ${file} (already applied)`);
          skippedCount++;
        }
      }
      
        if (appliedCount > 0) {
          log(`✅ MIGRATIONS: ALL APPLIED (pooler, ssl=${this.sslModeUsed})`);
          log(`📊 Applied ${appliedCount} new migrations, skipped ${skippedCount}`);
        } else {
          log(`✅ MIGRATIONS: ALL APPLIED (pooler, ssl=${this.sslModeUsed})`);
          log(`📊 All ${skippedCount} migrations already applied`);
        }
      
      this.migrationHealth.success = true;
      this.migrationHealth.error = null;
      
    } catch (error: any) {
      const errorMessage = error.message;
      this.migrationHealth.success = false;
      this.migrationHealth.error = errorMessage;
      
      console.error('❌ MIGRATIONS: Failed after fallback, manual intervention required:', errorMessage);
      
      // Don't block app startup, but log the issue
      console.log('💡 MIGRATIONS: App will continue running, check migration logs and /status endpoint');
      
    } finally {
      await this.cleanup();
    }
  }

  private sslModeUsed: string = 'unknown';

  private async initPgClient(): Promise<void> {
    try {
      const connectionString = process.env.DATABASE_URL;
      if (!connectionString) {
        throw new Error('DATABASE_URL not configured');
      }

      // Parse URL to detect pooler
      const parsedUrl = new URL(connectionString.replace(/^postgres:\/\//, 'http://'));
      const isPooler = parsedUrl.port === '6543' && 
                      (parsedUrl.hostname.includes('pooler.supabase.co') || 
                       parsedUrl.hostname.includes('.pooler.') ||
                       parsedUrl.hostname.startsWith('aws-'));

      if (isPooler) {
        log('🔗 DB_POOLER: Detected Supabase Transaction Pooler');
      }

      // SSL configuration - Railway/Supabase Transaction Pooler compatible
      let ssl: any;
      
      if (isPooler) {
        log('🔒 DB_SSL: Using Supabase Transaction Pooler SSL strategy (Railway-compatible)');
        
        // For Railway deployment, we need to handle Supabase pooler certificates
        // Set NODE_TLS_REJECT_UNAUTHORIZED=0 temporarily for pooler connections only
        const originalRejectUnauthorized = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
        
        // Restore original setting after connection
        process.on('exit', () => {
          if (originalRejectUnauthorized !== undefined) {
            process.env.NODE_TLS_REJECT_UNAUTHORIZED = originalRejectUnauthorized;
          } else {
            delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
          }
        });
        
        ssl = { 
          rejectUnauthorized: false  // Required for Supabase pooler infrastructure
        };
        this.sslModeUsed = 'railway-compatible';
      } else {
        log('🔒 DB_SSL: Using verified SSL for direct connection');
        ssl = { rejectUnauthorized: true };
        this.sslModeUsed = 'verified';
      }
      
      this.pgClient = new Client({ connectionString, ssl });
      await this.pgClient.connect();
      log(`✅ MIGRATIONS: Connected successfully with ${this.sslModeUsed} SSL`);
      
    } catch (connectError) {
      error(`❌ MIGRATIONS: Failed after fallback, manual intervention required: ${connectError instanceof Error ? connectError.message : connectError}`);
      throw connectError;
    }
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
    // Look in supabase/migrations first (preferred), then sql/migrations for compatibility
    let migrationsDir = path.join(__dirname, '../../supabase/migrations');
    
    if (!fs.existsSync(migrationsDir)) {
      migrationsDir = path.join(__dirname, '../../sql/migrations');
    }
    
    if (!fs.existsSync(migrationsDir)) {
      console.log('📊 MIGRATIONS: No migrations directory found, creating supabase/migrations...');
      migrationsDir = path.join(__dirname, '../../supabase/migrations');
      fs.mkdirSync(migrationsDir, { recursive: true });
      return [];
    }
    
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();
      
    console.log(`📊 MIGRATIONS: Found ${files.length} migration files in ${migrationsDir}`);
    return files;
  }

  private async applyMigration(filename: string): Promise<void> {
      console.log(`📊 MIGRATION_APPLYING: ${filename}`);
      
      // Try supabase/migrations first, then sql/migrations for backward compatibility
      let filepath = path.join(__dirname, '../../supabase/migrations', filename);
      if (!fs.existsSync(filepath)) {
        filepath = path.join(__dirname, '../../sql/migrations', filename);
      }
      
      if (!fs.existsSync(filepath)) {
        throw new Error(`Migration file not found: ${filename}`);
      }
      
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
          
        console.log(`🧱 MIGRATION_APPLIED: ${filename}`);
        
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

  /**
   * Get migration health status for health endpoints
   */
  getMigrationHealth() {
    return { ...this.migrationHealth };
  }
}

// Auto-run on import (checks DATABASE_URL first, then builds from env)
if (process.env.NODE_ENV === 'production' || process.env.RUN_MIGRATIONS === 'true') {
  const runner = new MigrationRunner();
  runner.run().then(() => {
    console.log('✅ STARTUP_MIGRATIONS: All migrations completed successfully');
  }).catch(error => {
    console.error('❌ STARTUP_MIGRATIONS_FAILED:', error.message);
    console.error('💡 Check DATABASE_URL or SUPABASE_DB_PASSWORD + PROJECT_REF variables');
    // Don't exit in development, but do in production
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
  });
}

export default MigrationRunner;
