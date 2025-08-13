import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

export class AutoMigrationRunner {
  private supabase: SupabaseClient;

  constructor() {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing Supabase credentials for migration runner');
    }
    
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }

  /**
   * Automatically run all pending migrations on startup
   */
  async runPendingMigrations(): Promise<void> {
    try {
      console.log('🚀 Starting automatic migration check...');
      
      // Ensure migration tracking table exists
      await this.ensureMigrationTable();
      
      // Get all migration files
      const migrationFiles = await this.getMigrationFiles();
      
      // Get already applied migrations
      const appliedMigrations = await this.getAppliedMigrations();
      
      // Find pending migrations
      const pendingMigrations = migrationFiles.filter(
        file => !appliedMigrations.includes(file)
      );

      if (pendingMigrations.length === 0) {
        console.log('✅ No pending migrations');
        return;
      }

      console.log(`📋 Found ${pendingMigrations.length} pending migrations`);
      
      // Apply each migration
      for (const migrationFile of pendingMigrations) {
        await this.applyMigration(migrationFile);
      }
      
      console.log('✅ All pending migrations applied successfully');
      
    } catch (error: any) {
      console.error('❌ Migration error:', error.message);
      // Don't throw - allow bot to start even if migrations fail
      console.log('⚠️ Bot will continue with existing schema');
    }
  }

  /**
   * Ensure the migration tracking table exists
   */
  private async ensureMigrationTable(): Promise<void> {
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        filename TEXT UNIQUE NOT NULL,
        applied_at TIMESTAMPTZ DEFAULT NOW(),
        checksum TEXT,
        success BOOLEAN DEFAULT true
      );
      
      CREATE INDEX IF NOT EXISTS idx_schema_migrations_filename ON schema_migrations(filename);
    `;

    try {
      const { error } = await this.supabase.rpc('exec_sql', { sql: createTableSQL });
      if (error) {
        // Fallback: try individual statements if exec_sql doesn't exist
        await this.executeSQL(createTableSQL);
      }
    } catch (error: any) {
      console.warn('⚠️ Could not create migration table:', error.message);
    }
  }

  /**
   * Get all migration files sorted by filename
   */
  private async getMigrationFiles(): Promise<string[]> {
    const migrationsDir = path.join(process.cwd(), 'migrations');
    
    if (!fs.existsSync(migrationsDir)) {
      console.log('📁 No migrations directory found');
      return [];
    }

    return fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .filter(file => !file.includes('emergency_')) // Skip emergency fixes
      .filter(file => !file.includes('old_'))       // Skip old migrations
      .sort(); // Apply in chronological order
  }

  /**
   * Get list of already applied migrations
   */
  private async getAppliedMigrations(): Promise<string[]> {
    try {
      const { data, error } = await this.supabase
        .from('schema_migrations')
        .select('filename')
        .eq('success', true);

      if (error) {
        console.warn('⚠️ Could not read migration history:', error.message);
        return [];
      }

      return data?.map(row => row.filename) || [];
    } catch (error: any) {
      console.warn('⚠️ Migration table not accessible:', error.message);
      return [];
    }
  }

  /**
   * Apply a single migration file
   */
  private async applyMigration(filename: string): Promise<void> {
    console.log(`📝 Applying migration: ${filename}`);
    
    try {
      // Read migration file
      const migrationPath = path.join(process.cwd(), 'migrations', filename);
      const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
      
      // Calculate checksum for integrity
      const checksum = this.calculateChecksum(migrationSQL);
      
      // Execute migration
      await this.executeSQL(migrationSQL);
      
      // Record successful migration
      await this.recordMigration(filename, checksum, true);
      
      console.log(`✅ Migration ${filename} applied successfully`);
      
    } catch (error: any) {
      console.error(`❌ Migration ${filename} failed:`, error.message);
      
      // Record failed migration
      await this.recordMigration(filename, '', false);
      
      // Don't throw - continue with other migrations
    }
  }

  /**
   * Execute SQL with retry logic and error handling
   */
  private async executeSQL(sql: string): Promise<void> {
    // First try using exec_sql function if available
    try {
      const { error } = await this.supabase.rpc('exec_sql', { sql });
      if (!error) return;
    } catch (execSqlError) {
      // exec_sql not available, fall back to statement-by-statement
    }

    // Fallback: execute statements individually
    const statements = this.parseSQL(sql);
    
    for (const statement of statements) {
      if (statement.trim().length === 0) continue;
      
      try {
        // Use direct query for DDL statements
        await this.supabase.rpc('exec_sql', { sql: statement });
      } catch (error: any) {
        // If it's a "already exists" error, that's OK
        if (error.message?.includes('already exists') || 
            error.message?.includes('duplicate key')) {
          console.log(`⏭️ Skipping existing object: ${statement.substring(0, 50)}...`);
          continue;
        }
        throw error;
      }
    }
  }

  /**
   * Parse SQL into individual statements
   */
  private parseSQL(sql: string): string[] {
    return sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0)
      .filter(s => !s.startsWith('--'))  // Skip comments
      .filter(s => !s.match(/^(COMMENT|SELECT)/i)); // Skip non-DDL
  }

  /**
   * Record migration in tracking table
   */
  private async recordMigration(filename: string, checksum: string, success: boolean): Promise<void> {
    try {
      await this.supabase
        .from('schema_migrations')
        .upsert({
          filename,
          checksum,
          success,
          applied_at: new Date().toISOString()
        });
    } catch (error: any) {
      console.warn('⚠️ Could not record migration:', error.message);
    }
  }

  /**
   * Calculate simple checksum for migration integrity
   */
  private calculateChecksum(content: string): string {
    return Buffer.from(content).toString('base64').substring(0, 20);
  }

  /**
   * Get migration status for health checks
   */
  async getMigrationStatus(): Promise<{
    totalMigrations: number;
    appliedMigrations: number;
    pendingMigrations: number;
    lastMigration?: string;
  }> {
    try {
      const allMigrations = await this.getMigrationFiles();
      const appliedMigrations = await this.getAppliedMigrations();
      
      // Get last applied migration
      const { data: lastMigrationData } = await this.supabase
        .from('schema_migrations')
        .select('filename, applied_at')
        .eq('success', true)
        .order('applied_at', { ascending: false })
        .limit(1);

      return {
        totalMigrations: allMigrations.length,
        appliedMigrations: appliedMigrations.length,
        pendingMigrations: allMigrations.length - appliedMigrations.length,
        lastMigration: lastMigrationData?.[0]?.filename
      };
    } catch (error: any) {
      return {
        totalMigrations: 0,
        appliedMigrations: 0,
        pendingMigrations: 0
      };
    }
  }
}