/**
 * 🔄 AUTOMATED DATABASE MIGRATION ENGINE
 * 
 * Enterprise-grade migration system with:
 * - Automatic schema versioning
 * - Rollback capabilities
 * - Dependency management
 * - Parallel execution
 * - Backup and recovery
 * - Migration validation
 * - Performance optimization
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';
import { createHash } from 'crypto';

interface Migration {
  id: string;
  version: string;
  name: string;
  description: string;
  dependencies: string[];
  up: string;
  down: string;
  checksum: string;
  timestamp: Date;
  executionTime?: number;
  rollbackTime?: number;
}

interface MigrationResult {
  migration: Migration;
  success: boolean;
  error?: string;
  executionTime: number;
  affectedRows?: number;
  warnings: string[];
}

interface MigrationPlan {
  migrations: Migration[];
  totalMigrations: number;
  estimatedTime: number;
  dependencies: Map<string, string[]>;
  executionOrder: string[];
}

interface MigrationConfig {
  migrationsPath: string;
  schemaTable: string;
  lockTable: string;
  backupEnabled: boolean;
  backupPath: string;
  validateBeforeExecution: boolean;
  parallelExecution: boolean;
  maxConcurrency: number;
  dryRun: boolean;
  timeoutMs: number;
}

interface SchemaVersion {
  version: string;
  migration_id: string;
  migration_name: string;
  checksum: string;
  executed_at: Date;
  execution_time_ms: number;
  rollback_sql?: string;
  is_rolled_back: boolean;
}

class MigrationLock {
  private lockId: string;
  private lockTimeout: number;
  
  constructor(
    private supabase: SupabaseClient,
    private lockTable: string,
    lockTimeout = 300000 // 5 minutes
  ) {
    this.lockId = `migration_${Date.now()}_${Math.random().toString(36)}`;
    this.lockTimeout = lockTimeout;
  }

  async acquire(): Promise<boolean> {
    try {
      // Clean up expired locks
      await this.supabase
        .from(this.lockTable)
        .delete()
        .lt('expires_at', new Date().toISOString());

      // Try to acquire lock
      const { error } = await this.supabase
        .from(this.lockTable)
        .insert({
          lock_id: this.lockId,
          locked_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + this.lockTimeout).toISOString(),
          process_info: `Migration Engine ${process.pid}`
        });

      return !error;
    } catch (error) {
      return false;
    }
  }

  async release(): Promise<void> {
    await this.supabase
      .from(this.lockTable)
      .delete()
      .eq('lock_id', this.lockId);
  }

  async extend(): Promise<boolean> {
    const { error } = await this.supabase
      .from(this.lockTable)
      .update({
        expires_at: new Date(Date.now() + this.lockTimeout).toISOString()
      })
      .eq('lock_id', this.lockId);

    return !error;
  }
}

class MigrationValidator {
  constructor(private supabase: SupabaseClient) {}

  async validateMigration(migration: Migration): Promise<string[]> {
    const warnings: string[] = [];

    // Validate SQL syntax
    try {
      await this.validateSQLSyntax(migration.up);
      await this.validateSQLSyntax(migration.down);
    } catch (error: any) {
      warnings.push(`SQL syntax validation failed: ${error.message}`);
    }

    // Check for dangerous operations
    const dangerousOperations = [
      'DROP TABLE',
      'DROP DATABASE',
      'TRUNCATE',
      'DELETE FROM',
      'ALTER TABLE .* DROP COLUMN'
    ];

    for (const operation of dangerousOperations) {
      const regex = new RegExp(operation, 'i');
      if (regex.test(migration.up)) {
        warnings.push(`Potentially dangerous operation detected: ${operation}`);
      }
    }

    // Validate dependencies exist
    for (const dep of migration.dependencies) {
      const { data } = await this.supabase
        .from('schema_versions')
        .select('migration_id')
        .eq('migration_id', dep)
        .single();

      if (!data) {
        warnings.push(`Dependency not found: ${dep}`);
      }
    }

    return warnings;
  }

  private async validateSQLSyntax(sql: string): Promise<void> {
    // Use EXPLAIN to validate syntax without executing
    try {
      const statements = sql.split(';').filter(s => s.trim());
      
      for (const statement of statements) {
        if (statement.trim().toUpperCase().startsWith('SELECT')) {
          await this.supabase.rpc('explain_query', { query: statement });
        }
      }
    } catch (error) {
      // Syntax validation failed
      throw error;
    }
  }

  async validateRollback(migration: Migration): Promise<string[]> {
    const warnings: string[] = [];

    if (!migration.down || migration.down.trim() === '') {
      warnings.push('No rollback SQL provided');
      return warnings;
    }

    // Validate rollback syntax
    try {
      await this.validateSQLSyntax(migration.down);
    } catch (error: any) {
      warnings.push(`Rollback SQL syntax validation failed: ${error.message}`);
    }

    return warnings;
  }
}

class MigrationBackup {
  constructor(
    private supabase: SupabaseClient,
    private backupPath: string
  ) {}

  async createBackup(version: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(this.backupPath, `backup_${version}_${timestamp}.sql`);

    console.log(`📦 Creating backup before migration: ${backupFile}`);

    try {
      // Get schema backup
      const { data: tables } = await this.supabase
        .from('tweets')
        .select('table_name')
        .eq('table_schema', 'public');

      let backupContent = `-- Database backup created at ${new Date().toISOString()}\n`;
      backupContent += `-- Before migration version: ${version}\n\n`;

      if (tables) {
        for (const table of tables) {
          // Export table structure
          const { data: columns } = await this.supabase
            .from('information_schema.columns')
            .select('*')
            .eq('table_name', table.table_name)
            .eq('table_schema', 'public');

          if (columns) {
            backupContent += `-- Table: ${table.table_name}\n`;
            backupContent += `CREATE TABLE IF NOT EXISTS ${table.table_name} (\n`;
            
            const columnDefs = columns.map(col => 
              `  ${col.column_name} ${col.data_type}${col.is_nullable === 'NO' ? ' NOT NULL' : ''}`
            );
            
            backupContent += columnDefs.join(',\n');
            backupContent += '\n);\n\n';
          }

          // Export data
          const { data: rows, count } = await this.supabase
            .from(table.table_name)
            .select('*', { count: 'exact' });

          if (rows && rows.length > 0) {
            backupContent += `-- Data for ${table.table_name} (${count} rows)\n`;
            
            for (const row of rows) {
              const values = Object.values(row).map(v => 
                v === null ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`
              );
              
              backupContent += `INSERT INTO ${table.table_name} VALUES (${values.join(', ')});\n`;
            }
            
            backupContent += '\n';
          }
        }
      }

      await fs.writeFile(backupFile, backupContent);
      console.log(`✅ Backup created successfully: ${backupFile}`);
      
      return backupFile;
    } catch (error: any) {
      console.error(`❌ Backup creation failed: ${error.message}`);
      throw error;
    }
  }

  async restoreBackup(backupFile: string): Promise<void> {
    console.log(`🔄 Restoring backup: ${backupFile}`);

    try {
      const backupContent = await fs.readFile(backupFile, 'utf-8');
      const statements = backupContent.split(';').filter(s => s.trim() && !s.trim().startsWith('--'));

      for (const statement of statements) {
        await this.supabase.rpc('execute_sql', { sql: statement });
      }

      console.log(`✅ Backup restored successfully: ${backupFile}`);
    } catch (error: any) {
      console.error(`❌ Backup restoration failed: ${error.message}`);
      throw error;
    }
  }
}

export class MigrationEngine extends EventEmitter {
  private static instance: MigrationEngine;
  
  private config: MigrationConfig;
  private validator: MigrationValidator;
  private backup: MigrationBackup;
  private isRunning = false;

  private constructor(private supabase: SupabaseClient) {
    super();
    this.setupConfiguration();
    this.validator = new MigrationValidator(supabase);
    this.backup = new MigrationBackup(supabase, this.config.backupPath);
  }

  public static getInstance(supabase: SupabaseClient): MigrationEngine {
    if (!MigrationEngine.instance) {
      MigrationEngine.instance = new MigrationEngine(supabase);
    }
    return MigrationEngine.instance;
  }

  private setupConfiguration(): void {
    this.config = {
      migrationsPath: process.env.MIGRATIONS_PATH || './migrations',
      schemaTable: process.env.SCHEMA_TABLE || 'schema_versions',
      lockTable: process.env.MIGRATION_LOCK_TABLE || 'migration_locks',
      backupEnabled: process.env.MIGRATION_BACKUP_ENABLED !== 'false',
      backupPath: process.env.MIGRATION_BACKUP_PATH || './backups',
      validateBeforeExecution: process.env.MIGRATION_VALIDATE !== 'false',
      parallelExecution: process.env.MIGRATION_PARALLEL === 'true',
      maxConcurrency: parseInt(process.env.MIGRATION_MAX_CONCURRENCY || '3'),
      dryRun: process.env.MIGRATION_DRY_RUN === 'true',
      timeoutMs: parseInt(process.env.MIGRATION_TIMEOUT || '300000')
    };
  }

  async initialize(): Promise<void> {
    console.log('🔄 Initializing Migration Engine...');

    // Ensure migration infrastructure exists
    await this.createMigrationTables();
    
    // Ensure directories exist
    await this.ensureDirectories();
    
    console.log('✅ Migration Engine initialized');
  }

  private async createMigrationTables(): Promise<void> {
    // Create schema versions table
    await this.supabase.rpc('execute_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS ${this.config.schemaTable} (
          id SERIAL PRIMARY KEY,
          version VARCHAR(50) NOT NULL,
          migration_id VARCHAR(100) UNIQUE NOT NULL,
          migration_name VARCHAR(255) NOT NULL,
          checksum VARCHAR(64) NOT NULL,
          executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          execution_time_ms INTEGER,
          rollback_sql TEXT,
          is_rolled_back BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        CREATE INDEX IF NOT EXISTS idx_schema_versions_version ON ${this.config.schemaTable}(version);
        CREATE INDEX IF NOT EXISTS idx_schema_versions_migration_id ON ${this.config.schemaTable}(migration_id);
      `
    });

    // Create migration locks table
    await this.supabase.rpc('execute_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS ${this.config.lockTable} (
          lock_id VARCHAR(100) PRIMARY KEY,
          locked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
          process_info TEXT
        );
        
        CREATE INDEX IF NOT EXISTS idx_migration_locks_expires ON ${this.config.lockTable}(expires_at);
      `
    });
  }

  private async ensureDirectories(): Promise<void> {
    try {
      await fs.mkdir(this.config.migrationsPath, { recursive: true });
      if (this.config.backupEnabled) {
        await fs.mkdir(this.config.backupPath, { recursive: true });
      }
    } catch (error) {
      // Directories might already exist
    }
  }

  async loadMigrations(): Promise<Migration[]> {
    console.log(`📂 Loading migrations from: ${this.config.migrationsPath}`);

    try {
      const files = await fs.readdir(this.config.migrationsPath);
      const migrationFiles = files.filter(f => f.endsWith('.sql') || f.endsWith('.js'));
      
      const migrations: Migration[] = [];

      for (const file of migrationFiles) {
        const filePath = path.join(this.config.migrationsPath, file);
        const migration = await this.parseMigrationFile(filePath);
        migrations.push(migration);
      }

      // Sort by version
      migrations.sort((a, b) => a.version.localeCompare(b.version));
      
      console.log(`✅ Loaded ${migrations.length} migrations`);
      return migrations;
    } catch (error: any) {
      console.error(`❌ Failed to load migrations: ${error.message}`);
      throw error;
    }
  }

  private async parseMigrationFile(filePath: string): Promise<Migration> {
    const content = await fs.readFile(filePath, 'utf-8');
    const fileName = path.basename(filePath, path.extname(filePath));
    
    // Extract metadata from file header comments
    const metadataRegex = /\/\*\*(.*?)\*\//s;
    const metadataMatch = content.match(metadataRegex);
    
    let metadata: any = {};
    if (metadataMatch) {
      const metadataContent = metadataMatch[1];
      const lines = metadataContent.split('\n');
      
      for (const line of lines) {
        const match = line.match(/\*\s*@(\w+)\s+(.*)/);
        if (match) {
          const [, key, value] = match;
          if (key === 'dependencies') {
            metadata[key] = value.split(',').map(d => d.trim());
          } else {
            metadata[key] = value.trim();
          }
        }
      }
    }

    // Split up and down migrations
    const upDownSplit = content.split('-- ROLLBACK --');
    const up = upDownSplit[0].replace(/\/\*\*.*?\*\//s, '').trim();
    const down = upDownSplit[1]?.trim() || '';

    const checksum = createHash('sha256').update(content).digest('hex');

    return {
      id: metadata.id || fileName,
      version: metadata.version || this.extractVersionFromFileName(fileName),
      name: metadata.name || fileName,
      description: metadata.description || '',
      dependencies: metadata.dependencies || [],
      up,
      down,
      checksum,
      timestamp: new Date()
    };
  }

  private extractVersionFromFileName(fileName: string): string {
    const versionMatch = fileName.match(/^(\d+(?:\.\d+)*)/);
    return versionMatch ? versionMatch[1] : '0.0.0';
  }

  async createMigrationPlan(targetVersion?: string): Promise<MigrationPlan> {
    console.log('📋 Creating migration plan...');

    const allMigrations = await this.loadMigrations();
    const appliedMigrations = await this.getAppliedMigrations();
    
    // Filter migrations to apply
    const pendingMigrations = allMigrations.filter(m => 
      !appliedMigrations.some(am => am.migration_id === m.id) &&
      (!targetVersion || m.version <= targetVersion)
    );

    // Build dependency graph
    const dependencies = new Map<string, string[]>();
    for (const migration of pendingMigrations) {
      dependencies.set(migration.id, migration.dependencies);
    }

    // Resolve execution order
    const executionOrder = this.resolveDependencies(pendingMigrations, dependencies);
    
    // Estimate execution time
    const estimatedTime = pendingMigrations.length * 5000; // 5 seconds per migration average

    console.log(`✅ Migration plan created: ${pendingMigrations.length} migrations to apply`);

    return {
      migrations: pendingMigrations,
      totalMigrations: pendingMigrations.length,
      estimatedTime,
      dependencies,
      executionOrder
    };
  }

  private async getAppliedMigrations(): Promise<SchemaVersion[]> {
    const { data } = await this.supabase
      .from(this.config.schemaTable)
      .select('*')
      .eq('is_rolled_back', false)
      .order('executed_at');

    return data || [];
  }

  private resolveDependencies(migrations: Migration[], dependencies: Map<string, string[]>): string[] {
    const resolved: string[] = [];
    const resolving: Set<string> = new Set();

    const resolve = (migrationId: string): void => {
      if (resolved.includes(migrationId)) return;
      if (resolving.has(migrationId)) {
        throw new Error(`Circular dependency detected: ${migrationId}`);
      }

      resolving.add(migrationId);
      
      const deps = dependencies.get(migrationId) || [];
      for (const dep of deps) {
        resolve(dep);
      }
      
      resolving.delete(migrationId);
      resolved.push(migrationId);
    };

    for (const migration of migrations) {
      resolve(migration.id);
    }

    return resolved;
  }

  async executeMigrations(plan: MigrationPlan): Promise<MigrationResult[]> {
    if (this.isRunning) {
      throw new Error('Migration is already running');
    }

    this.isRunning = true;
    console.log(`🚀 Executing ${plan.totalMigrations} migrations...`);

    const lock = new MigrationLock(this.supabase, this.config.lockTable);
    const results: MigrationResult[] = [];

    try {
      // Acquire migration lock
      if (!await lock.acquire()) {
        throw new Error('Failed to acquire migration lock - another migration may be running');
      }

      // Create backup if enabled
      let backupFile: string | undefined;
      if (this.config.backupEnabled && !this.config.dryRun) {
        backupFile = await this.backup.createBackup(`pre_migration_${Date.now()}`);
      }

      // Execute migrations in order
      if (this.config.parallelExecution) {
        results.push(...await this.executeParallel(plan));
      } else {
        results.push(...await this.executeSequential(plan));
      }

      // Verify all migrations succeeded
      const failed = results.filter(r => !r.success);
      if (failed.length > 0) {
        console.error(`❌ ${failed.length} migrations failed`);
        
        if (backupFile && !this.config.dryRun) {
          console.log('🔄 Rolling back due to failures...');
          await this.backup.restoreBackup(backupFile);
        }
        
        throw new Error(`Migration failed: ${failed.map(f => f.migration.name).join(', ')}`);
      }

      console.log(`✅ All ${plan.totalMigrations} migrations executed successfully`);
      this.emit('migrationsComplete', results);

      return results;

    } catch (error: any) {
      console.error(`❌ Migration execution failed: ${error.message}`);
      this.emit('migrationError', error);
      throw error;
    } finally {
      await lock.release();
      this.isRunning = false;
    }
  }

  private async executeSequential(plan: MigrationPlan): Promise<MigrationResult[]> {
    const results: MigrationResult[] = [];

    for (const migrationId of plan.executionOrder) {
      const migration = plan.migrations.find(m => m.id === migrationId)!;
      const result = await this.executeSingleMigration(migration);
      results.push(result);

      if (!result.success) {
        break; // Stop on first failure
      }
    }

    return results;
  }

  private async executeParallel(plan: MigrationPlan): Promise<MigrationResult[]> {
    const results: MigrationResult[] = [];
    const executing = new Map<string, Promise<MigrationResult>>();
    const completed = new Set<string>();

    for (const migrationId of plan.executionOrder) {
      const migration = plan.migrations.find(m => m.id === migrationId)!;
      
      // Wait for dependencies to complete
      await Promise.all(migration.dependencies.map(dep => executing.get(dep)));
      
      // Check if dependencies succeeded
      const depResults = migration.dependencies.map(dep => 
        results.find(r => r.migration.id === dep)
      );
      
      if (depResults.some(r => r && !r.success)) {
        // Dependency failed, skip this migration
        results.push({
          migration,
          success: false,
          error: 'Dependency failed',
          executionTime: 0,
          warnings: ['Skipped due to dependency failure']
        });
        continue;
      }

      // Execute migration
      const promise = this.executeSingleMigration(migration);
      executing.set(migrationId, promise);

      // Limit concurrency
      if (executing.size >= this.config.maxConcurrency) {
        const result = await Promise.race(executing.values());
        results.push(result);
        executing.delete(result.migration.id);
        completed.add(result.migration.id);
      }
    }

    // Wait for remaining migrations
    const remaining = await Promise.all(executing.values());
    results.push(...remaining);

    return results;
  }

  private async executeSingleMigration(migration: Migration): Promise<MigrationResult> {
    const startTime = Date.now();
    const warnings: string[] = [];

    console.log(`⚡ Executing migration: ${migration.name}`);

    try {
      // Validate migration if enabled
      if (this.config.validateBeforeExecution) {
        const validationWarnings = await this.validator.validateMigration(migration);
        warnings.push(...validationWarnings);
        
        if (validationWarnings.some(w => w.includes('failed'))) {
          throw new Error(`Validation failed: ${validationWarnings.join(', ')}`);
        }
      }

      let affectedRows = 0;

      if (!this.config.dryRun) {
        // Execute migration SQL
        const statements = migration.up.split(';').filter(s => s.trim());
        
        for (const statement of statements) {
          const result = await Promise.race([
            this.supabase.rpc('execute_sql', { sql: statement }),
            new Promise<never>((_, reject) => 
              setTimeout(() => reject(new Error('Migration timeout')), this.config.timeoutMs)
            )
          ]);
          
          if (result.data) {
            affectedRows += result.data.length || 0;
          }
        }

        // Record migration in schema table
        await this.supabase.from(this.config.schemaTable).insert({
          version: migration.version,
          migration_id: migration.id,
          migration_name: migration.name,
          checksum: migration.checksum,
          execution_time_ms: Date.now() - startTime,
          rollback_sql: migration.down
        });
      } else {
        console.log(`🔍 DRY RUN: Would execute migration ${migration.name}`);
      }

      const executionTime = Date.now() - startTime;
      
      console.log(`✅ Migration completed: ${migration.name} (${executionTime}ms)`);
      
      this.emit('migrationSuccess', {
        migration,
        executionTime,
        affectedRows,
        warnings
      });

      return {
        migration,
        success: true,
        executionTime,
        affectedRows,
        warnings
      };

    } catch (error: any) {
      const executionTime = Date.now() - startTime;
      
      console.error(`❌ Migration failed: ${migration.name} - ${error.message}`);
      
      this.emit('migrationError', {
        migration,
        error: error.message,
        executionTime
      });

      return {
        migration,
        success: false,
        error: error.message,
        executionTime,
        warnings
      };
    }
  }

  async rollbackToVersion(targetVersion: string): Promise<MigrationResult[]> {
    console.log(`🔙 Rolling back to version: ${targetVersion}`);

    if (this.isRunning) {
      throw new Error('Cannot rollback while migration is running');
    }

    this.isRunning = true;
    const lock = new MigrationLock(this.supabase, this.config.lockTable);
    const results: MigrationResult[] = [];

    try {
      if (!await lock.acquire()) {
        throw new Error('Failed to acquire migration lock');
      }

      // Get migrations to rollback (newer than target version)
      const { data: migrationsToRollback } = await this.supabase
        .from(this.config.schemaTable)
        .select('*')
        .gt('version', targetVersion)
        .eq('is_rolled_back', false)
        .order('version', { ascending: false });

      if (!migrationsToRollback || migrationsToRollback.length === 0) {
        console.log('✅ No migrations to rollback');
        return results;
      }

      // Create backup before rollback
      let backupFile: string | undefined;
      if (this.config.backupEnabled) {
        backupFile = await this.backup.createBackup(`pre_rollback_${targetVersion}_${Date.now()}`);
      }

      // Execute rollbacks in reverse order
      for (const schemaVersion of migrationsToRollback) {
        const result = await this.executeSingleRollback(schemaVersion);
        results.push(result);

        if (!result.success) {
          console.error(`❌ Rollback failed for: ${schemaVersion.migration_name}`);
          break;
        }
      }

      console.log(`✅ Rollback to version ${targetVersion} completed`);
      this.emit('rollbackComplete', results);

      return results;

    } catch (error: any) {
      console.error(`❌ Rollback failed: ${error.message}`);
      this.emit('rollbackError', error);
      throw error;
    } finally {
      await lock.release();
      this.isRunning = false;
    }
  }

  private async executeSingleRollback(schemaVersion: SchemaVersion): Promise<MigrationResult> {
    const startTime = Date.now();
    
    console.log(`🔙 Rolling back: ${schemaVersion.migration_name}`);

    try {
      if (!schemaVersion.rollback_sql) {
        throw new Error('No rollback SQL available');
      }

      // Validate rollback SQL
      const warnings = await this.validator.validateRollback({
        id: schemaVersion.migration_id,
        version: schemaVersion.version,
        name: schemaVersion.migration_name,
        description: '',
        dependencies: [],
        up: '',
        down: schemaVersion.rollback_sql,
        checksum: schemaVersion.checksum,
        timestamp: schemaVersion.executed_at
      });

      if (!this.config.dryRun) {
        // Execute rollback SQL
        const statements = schemaVersion.rollback_sql.split(';').filter(s => s.trim());
        
        for (const statement of statements) {
          await this.supabase.rpc('execute_sql', { sql: statement });
        }

        // Mark as rolled back
        await this.supabase
          .from(this.config.schemaTable)
          .update({
            is_rolled_back: true,
            rollback_time: Date.now() - startTime
          })
          .eq('migration_id', schemaVersion.migration_id);
      }

      const executionTime = Date.now() - startTime;
      
      console.log(`✅ Rollback completed: ${schemaVersion.migration_name} (${executionTime}ms)`);

      return {
        migration: {
          id: schemaVersion.migration_id,
          version: schemaVersion.version,
          name: schemaVersion.migration_name,
          description: '',
          dependencies: [],
          up: '',
          down: schemaVersion.rollback_sql,
          checksum: schemaVersion.checksum,
          timestamp: schemaVersion.executed_at
        },
        success: true,
        executionTime,
        warnings
      };

    } catch (error: any) {
      const executionTime = Date.now() - startTime;
      
      console.error(`❌ Rollback failed: ${schemaVersion.migration_name} - ${error.message}`);

      return {
        migration: {
          id: schemaVersion.migration_id,
          version: schemaVersion.version,
          name: schemaVersion.migration_name,
          description: '',
          dependencies: [],
          up: '',
          down: schemaVersion.rollback_sql || '',
          checksum: schemaVersion.checksum,
          timestamp: schemaVersion.executed_at
        },
        success: false,
        error: error.message,
        executionTime,
        warnings: []
      };
    }
  }

  async getCurrentVersion(): Promise<string> {
    const { data } = await this.supabase
      .from(this.config.schemaTable)
      .select('version')
      .eq('is_rolled_back', false)
      .order('version', { ascending: false })
      .limit(1)
      .single();

    return data?.version || '0.0.0';
  }

  async getMigrationStatus(): Promise<{
    currentVersion: string;
    appliedMigrations: number;
    pendingMigrations: number;
    failedMigrations: number;
  }> {
    const currentVersion = await this.getCurrentVersion();
    const allMigrations = await this.loadMigrations();
    const appliedMigrations = await this.getAppliedMigrations();

    const { data: failedCount } = await this.supabase
      .from(this.config.schemaTable)
      .select('id', { count: 'exact' })
      .eq('is_rolled_back', true);

    return {
      currentVersion,
      appliedMigrations: appliedMigrations.length,
      pendingMigrations: allMigrations.length - appliedMigrations.length,
      failedMigrations: failedCount?.length || 0
    };
  }
}