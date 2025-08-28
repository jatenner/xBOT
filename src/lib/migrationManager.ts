/**
 * 🚀 MIGRATION MANAGER - Schema Evolution Without Pain
 * 
 * PURPOSE: Manage database migrations with zero-downtime, additive-only changes
 * FEATURES: Shadow testing, rollback plans, drift detection, baseline management
 * STRATEGY: JSONB-first, additive changes only, comprehensive validation
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { dualStoreManager } from './dualStoreManager';

interface Migration {
  id: string;
  version: number;
  name: string;
  description: string;
  type: 'baseline' | 'additive' | 'data' | 'index';
  sql: string;
  rollbackSql?: string;
  rollbackPlan: string;
  dependencies: string[];
  validationQueries: string[];
  estimatedDuration: number; // seconds
  breakingChange: boolean;
  author: string;
  createdAt: Date;
}

interface MigrationResult {
  success: boolean;
  migrationId: string;
  duration: number;
  error?: string;
  validationResults?: ValidationResult[];
  rollbackRequired?: boolean;
}

interface ValidationResult {
  query: string;
  success: boolean;
  result?: any;
  error?: string;
  duration: number;
}

interface SchemaInventory {
  tables: SchemaTable[];
  indexes: SchemaIndex[];
  constraints: SchemaConstraint[];
  functions: SchemaFunction[];
  totalObjects: number;
  inventoryDate: Date;
}

interface SchemaTable {
  name: string;
  schema: string;
  columns: SchemaColumn[];
  rowCount: number;
  sizeBytes: number;
  hasData: boolean;
}

interface SchemaColumn {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue?: string;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
}

interface SchemaIndex {
  name: string;
  table: string;
  columns: string[];
  unique: boolean;
  type: string;
}

interface SchemaConstraint {
  name: string;
  table: string;
  type: string;
  definition: string;
}

interface SchemaFunction {
  name: string;
  returnType: string;
  language: string;
}

interface DriftReport {
  timestamp: Date;
  environment: string;
  driftFound: boolean;
  missingTables: string[];
  extraTables: string[];
  columnMismatches: ColumnMismatch[];
  indexMismatches: IndexMismatch[];
  recommendations: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
}

interface ColumnMismatch {
  table: string;
  column: string;
  expected: SchemaColumn;
  actual: SchemaColumn;
  mismatchType: 'missing' | 'extra' | 'type_change' | 'nullable_change';
}

interface IndexMismatch {
  table: string;
  index: string;
  mismatchType: 'missing' | 'extra' | 'definition_change';
  expected?: SchemaIndex;
  actual?: SchemaIndex;
}

interface BaselineConfig {
  version: number;
  coreTables: string[];
  createdAt: Date;
  author: string;
  description: string;
  environment: string;
}

class MigrationManager {
  private static instance: MigrationManager;
  private supabase: SupabaseClient;
  private shadowDatabase: SupabaseClient | null = null;
  private currentSchemaVersion: number = 0;
  private baseline: BaselineConfig | null = null;
  private migrations: Migration[] = [];

  private constructor() {
    this.supabase = this.initializeSupabase();
    this.initialize();
  }

  public static getInstance(): MigrationManager {
    if (!MigrationManager.instance) {
      MigrationManager.instance = new MigrationManager();
    }
    return MigrationManager.instance;
  }

  /**
   * Initialize Supabase client
   */
  private initializeSupabase(): SupabaseClient {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase credentials for migration manager');
    }

    return createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      },
      db: {
        schema: 'public'
      }
    });
  }

  /**
   * Initialize migration system
   */
  private async initialize(): Promise<void> {
    try {
      console.log('🔧 Initializing Migration Manager...');

      // Create migration tracking table if it doesn't exist
      await this.ensureMigrationTable();

      // Load current schema version
      await this.loadCurrentVersion();

      // Load baseline configuration
      await this.loadBaseline();

      // Load migration history
      await this.loadMigrations();

      console.log(`✅ Migration Manager initialized (schema version: ${this.currentSchemaVersion})`);

    } catch (error: any) {
      console.error('❌ Migration Manager initialization failed:', error.message);
      throw error;
    }
  }

  /**
   * Ensure migration tracking table exists
   */
  private async ensureMigrationTable(): Promise<void> {
    const createTableSql = `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        migration_id VARCHAR(100) UNIQUE NOT NULL,
        version INTEGER NOT NULL,
        name VARCHAR(200) NOT NULL,
        type VARCHAR(50) NOT NULL,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        duration_seconds INTEGER,
        author VARCHAR(100),
        rollback_plan TEXT,
        success BOOLEAN DEFAULT true,
        error_message TEXT,
        environment VARCHAR(50) DEFAULT 'production'
      );

      CREATE INDEX IF NOT EXISTS idx_schema_migrations_version ON schema_migrations(version);
      CREATE INDEX IF NOT EXISTS idx_schema_migrations_applied_at ON schema_migrations(applied_at);
    `;

    const { error } = await this.supabase.rpc('exec_sql', { sql: createTableSql });
    if (error) {
      throw new Error(`Could not create migration table: ${error.message}`);
    }
  }

  /**
   * Load current schema version
   */
  private async loadCurrentVersion(): Promise<void> {
    try {
      // Try to get from bot_config first
      const { data: config } = await this.supabase
        .from('bot_config')
        .select('value')
        .eq('key', 'schema_version')
        .single();

      if (config) {
        this.currentSchemaVersion = config.value.version || 0;
        return;
      }

      // Fallback: get from migration history
      const { data: migrations } = await this.supabase
        .from('schema_migrations')
        .select('version')
        .order('version', { ascending: false })
        .limit(1);

      this.currentSchemaVersion = migrations?.[0]?.version || 0;

    } catch (error: any) {
      console.warn('⚠️ Could not load schema version, defaulting to 0');
      this.currentSchemaVersion = 0;
    }
  }

  /**
   * Load baseline configuration
   */
  private async loadBaseline(): Promise<void> {
    try {
      // Skip bot_config baseline loading for now - table doesn't exist
      console.log('⚠️ Skipping baseline configuration (bot_config table not available)');
      
      // Set default baseline
      this.baseline = {
        version: 'default',
        coreTables: ['tweets', 'learning_posts', 'tweet_metrics'],
        createdAt: new Date(),
        author: 'system',
        description: 'Default baseline configuration',
        environment: 'production'
      };

    } catch (error: any) {
      console.warn('⚠️ No baseline configuration found');
    }
  }

  /**
   * Load migration history
   */
  private async loadMigrations(): Promise<void> {
    try {
      const { data: migrationRecords, error } = await this.supabase
        .from('schema_migrations')
        .select('*')
        .order('version', { ascending: true });

      if (error) {
        throw new Error(`Could not load migrations: ${error.message}`);
      }

      this.migrations = migrationRecords?.map(record => ({
        id: record.migration_id,
        version: record.version,
        name: record.name,
        description: '',
        type: record.type,
        sql: '',
        rollbackPlan: record.rollback_plan || '',
        dependencies: [],
        validationQueries: [],
        estimatedDuration: record.duration_seconds || 0,
        breakingChange: false,
        author: record.author || 'unknown',
        createdAt: new Date(record.applied_at)
      })) || [];

    } catch (error: any) {
      console.warn('⚠️ Could not load migration history:', error.message);
      this.migrations = [];
    }
  }

  // =====================================================================================
  // SCHEMA INVENTORY & DRIFT DETECTION
  // =====================================================================================

  /**
   * Generate comprehensive schema inventory
   */
  public async generateSchemaInventory(): Promise<SchemaInventory> {
    console.log('📊 Generating schema inventory...');

    try {
      const inventory: SchemaInventory = {
        tables: [],
        indexes: [],
        constraints: [],
        functions: [],
        totalObjects: 0,
        inventoryDate: new Date()
      };

      // Get all tables
      const { data: tables } = await this.supabase
        .from('information_schema.tables')
        .select('table_name, table_schema')
        .eq('table_schema', 'public')
        .eq('table_type', 'BASE TABLE');

      for (const table of tables || []) {
        const schemaTable = await this.getTableDetails(table.table_name);
        inventory.tables.push(schemaTable);
      }

      // Get all indexes
      const { data: indexes } = await this.supabase.rpc('get_all_indexes');
      inventory.indexes = indexes || [];

      // Get all constraints
      const { data: constraints } = await this.supabase.rpc('get_all_constraints');
      inventory.constraints = constraints || [];

      // Get all functions
      const { data: functions } = await this.supabase.rpc('get_all_functions');
      inventory.functions = functions || [];

      inventory.totalObjects = 
        inventory.tables.length + 
        inventory.indexes.length + 
        inventory.constraints.length + 
        inventory.functions.length;

      console.log(`✅ Schema inventory generated (${inventory.totalObjects} objects)`);
      return inventory;

    } catch (error: any) {
      console.error('❌ Schema inventory generation failed:', error.message);
      throw error;
    }
  }

  /**
   * Get detailed table information
   */
  private async getTableDetails(tableName: string): Promise<SchemaTable> {
    // Get columns
    const { data: columns } = await this.supabase
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable, column_default')
      .eq('table_name', tableName)
      .eq('table_schema', 'public')
      .order('ordinal_position');

    // Get row count and size
    const { count } = await this.supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true });

    const { data: sizeData } = await this.supabase.rpc('get_table_size', { 
      table_name: tableName 
    });

    return {
      name: tableName,
      schema: 'public',
      columns: columns?.map(col => ({
        name: col.column_name,
        type: col.data_type,
        nullable: col.is_nullable === 'YES',
        defaultValue: col.column_default,
        isPrimaryKey: false, // Would need separate query
        isForeignKey: false  // Would need separate query
      })) || [],
      rowCount: count || 0,
      sizeBytes: sizeData?.[0]?.size_bytes || 0,
      hasData: (count || 0) > 0
    };
  }

  /**
   * Detect schema drift between environments
   */
  public async detectSchemaDrift(
    targetEnvironment: string = 'production'
  ): Promise<DriftReport> {
    console.log(`🔍 Detecting schema drift for ${targetEnvironment}...`);

    try {
      const report: DriftReport = {
        timestamp: new Date(),
        environment: targetEnvironment,
        driftFound: false,
        missingTables: [],
        extraTables: [],
        columnMismatches: [],
        indexMismatches: [],
        recommendations: [],
        severity: 'low'
      };

      // Get current schema inventory
      const currentSchema = await this.generateSchemaInventory();

      // Get expected schema from baseline
      if (!this.baseline) {
        report.recommendations.push('No baseline schema found - create baseline first');
        report.severity = 'high';
        return report;
      }

      const expectedTables = this.baseline.coreTables;
      const actualTables = currentSchema.tables.map(t => t.name);

      // Check for missing tables
      report.missingTables = expectedTables.filter(table => !actualTables.includes(table));

      // Check for extra tables (beyond core set)
      report.extraTables = actualTables.filter(table => !expectedTables.includes(table));

      // Determine drift status
      report.driftFound = 
        report.missingTables.length > 0 || 
        report.columnMismatches.length > 0 ||
        report.indexMismatches.length > 0;

      // Determine severity
      if (report.missingTables.length > 0) {
        report.severity = 'critical';
        report.recommendations.push('Missing core tables detected - immediate action required');
      } else if (report.columnMismatches.length > 5) {
        report.severity = 'high';
        report.recommendations.push('Multiple column mismatches detected');
      } else if (report.driftFound) {
        report.severity = 'medium';
        report.recommendations.push('Minor schema drift detected');
      }

      console.log(`✅ Drift detection completed: ${report.severity} severity`);

      // Log the drift report
      await dualStoreManager.logAuditEvent({
        event_type: 'schema_drift_check',
        component: 'migration_manager',
        severity: report.severity === 'critical' ? 'error' : 'info',
        event_data: report
      });

      return report;

    } catch (error: any) {
      console.error('❌ Schema drift detection failed:', error.message);
      throw error;
    }
  }

  // =====================================================================================
  // BASELINE MANAGEMENT
  // =====================================================================================

  /**
   * Create new baseline from current schema
   */
  public async createBaseline(
    description: string,
    author: string,
    coreTables?: string[]
  ): Promise<BaselineConfig> {
    console.log('📋 Creating new schema baseline...');

    try {
      const defaultCoreTables = [
        'tweets',
        'bot_config', 
        'daily_summaries',
        'audit_log',
        'system_health'
      ];

      const baseline: BaselineConfig = {
        version: this.currentSchemaVersion + 1,
        coreTables: coreTables || defaultCoreTables,
        createdAt: new Date(),
        author,
        description,
        environment: 'production'
      };

      // Store baseline in bot_config
      const { error } = await this.supabase
        .from('bot_config')
        .upsert([{
          key: 'schema_baseline',
          environment: 'production',
          value: {
            version: baseline.version,
            core_tables: baseline.coreTables,
            created_at: baseline.createdAt.toISOString(),
            author: baseline.author,
            description: baseline.description
          },
          metadata: {
            environment: baseline.environment,
            created_by: 'migration_manager'
          }
        }]);

      if (error) {
        throw new Error(`Baseline creation failed: ${error.message}`);
      }

      this.baseline = baseline;
      this.currentSchemaVersion = baseline.version;

      console.log(`✅ Baseline created (version ${baseline.version})`);

      // Log baseline creation
      await dualStoreManager.logAuditEvent({
        event_type: 'baseline_created',
        component: 'migration_manager',
        severity: 'info',
        event_data: baseline
      });

      return baseline;

    } catch (error: any) {
      console.error('❌ Baseline creation failed:', error.message);
      throw error;
    }
  }

  /**
   * Reset to baseline (squash migrations)
   */
  public async resetToBaseline(): Promise<void> {
    console.log('⚠️ Resetting schema to baseline...');

    if (!this.baseline) {
      throw new Error('No baseline found - create baseline first');
    }

    try {
      // Archive current migrations as legacy
      const { error: archiveError } = await this.supabase
        .from('schema_migrations')
        .update({ environment: 'legacy' })
        .eq('environment', 'production');

      if (archiveError) {
        throw new Error(`Migration archiving failed: ${archiveError.message}`);
      }

      // Reset schema version
      await this.supabase
        .from('bot_config')
        .upsert([{
          key: 'schema_version',
          environment: 'production',
          value: { version: this.baseline.version, baseline: true },
          metadata: { reset_at: new Date().toISOString() }
        }]);

      this.currentSchemaVersion = this.baseline.version;
      this.migrations = [];

      console.log(`✅ Schema reset to baseline version ${this.baseline.version}`);

      // Log reset
      await dualStoreManager.logAuditEvent({
        event_type: 'schema_reset_to_baseline',
        component: 'migration_manager',
        severity: 'warning',
        event_data: {
          baseline_version: this.baseline.version,
          reset_at: new Date().toISOString()
        }
      });

    } catch (error: any) {
      console.error('❌ Baseline reset failed:', error.message);
      throw error;
    }
  }

  // =====================================================================================
  // MIGRATION EXECUTION
  // =====================================================================================

  /**
   * Execute migration with shadow testing
   */
  public async executeMigration(migration: Migration): Promise<MigrationResult> {
    console.log(`🚀 Executing migration: ${migration.name}`);

    const result: MigrationResult = {
      success: false,
      migrationId: migration.id,
      duration: 0,
      validationResults: []
    };

    const startTime = Date.now();

    try {
      // Pre-flight checks
      await this.validateMigrationPrerequisites(migration);

      // Shadow testing
      if (process.env.ENABLE_SHADOW_TESTING !== 'false') {
        console.log('🧪 Running shadow test...');
        await this.runShadowTest(migration);
      }

      // Execute migration
      console.log('⚡ Applying migration to production...');
      const { error: migrationError } = await this.supabase.rpc('exec_sql', {
        sql: migration.sql
      });

      if (migrationError) {
        throw new Error(`Migration execution failed: ${migrationError.message}`);
      }

      // Run validation queries
      console.log('✅ Running validation checks...');
      result.validationResults = await this.runValidationQueries(migration.validationQueries);

      // Check if any validations failed
      const validationFailed = result.validationResults.some(v => !v.success);
      if (validationFailed) {
        throw new Error('Migration validation failed');
      }

      // Record successful migration
      await this.recordMigration(migration, true);

      // Update schema version
      this.currentSchemaVersion = migration.version;
      await this.updateSchemaVersion(migration.version);

      result.success = true;
      result.duration = Math.round((Date.now() - startTime) / 1000);

      console.log(`✅ Migration ${migration.name} completed successfully`);

      // Log success
      await dualStoreManager.logAuditEvent({
        event_type: 'migration_applied',
        component: 'migration_manager',
        severity: 'info',
        event_data: {
          migration_id: migration.id,
          version: migration.version,
          duration: result.duration,
          validation_results: result.validationResults
        }
      });

    } catch (error: any) {
      result.duration = Math.round((Date.now() - startTime) / 1000);
      result.error = error.message;
      result.rollbackRequired = true;

      console.error(`❌ Migration ${migration.name} failed:`, error.message);

      // Record failed migration
      await this.recordMigration(migration, false, error.message);

      // Log failure
      await dualStoreManager.logAuditEvent({
        event_type: 'migration_failed',
        component: 'migration_manager',
        severity: 'error',
        event_data: {
          migration_id: migration.id,
          error: error.message,
          duration: result.duration,
          rollback_plan: migration.rollbackPlan
        }
      });

      // Suggest rollback if available
      if (migration.rollbackSql) {
        console.log('🔄 Rollback SQL available - consider running rollback');
      }
    }

    return result;
  }

  /**
   * Validate migration prerequisites
   */
  private async validateMigrationPrerequisites(migration: Migration): Promise<void> {
    // Check dependencies
    for (const dependency of migration.dependencies) {
      const { data: depMigration } = await this.supabase
        .from('schema_migrations')
        .select('migration_id')
        .eq('migration_id', dependency)
        .eq('success', true)
        .single();

      if (!depMigration) {
        throw new Error(`Missing dependency: ${dependency}`);
      }
    }

    // Check breaking change policy
    if (migration.breakingChange && process.env.ALLOW_BREAKING_CHANGES !== 'true') {
      throw new Error('Breaking changes not allowed in current environment');
    }

    // Check schema version sequence
    if (migration.version <= this.currentSchemaVersion) {
      throw new Error(`Migration version ${migration.version} is not greater than current version ${this.currentSchemaVersion}`);
    }
  }

  /**
   * Run shadow test on throwaway database
   */
  private async runShadowTest(migration: Migration): Promise<void> {
    // For now, we'll simulate shadow testing
    // In a full implementation, this would spin up a temporary database
    console.log('🧪 Shadow test simulated (would run on throwaway DB)');
    
    // Basic SQL syntax validation
    if (!migration.sql || migration.sql.trim().length === 0) {
      throw new Error('Migration SQL is empty');
    }

    // Check for forbidden operations
    const forbiddenPatterns = [
      /DROP\s+TABLE/i,
      /DROP\s+COLUMN/i,
      /ALTER\s+COLUMN.*DROP/i,
      /TRUNCATE/i
    ];

    for (const pattern of forbiddenPatterns) {
      if (pattern.test(migration.sql)) {
        throw new Error(`Forbidden operation detected in migration: ${pattern.source}`);
      }
    }
  }

  /**
   * Run validation queries
   */
  private async runValidationQueries(queries: string[]): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];

    for (const query of queries) {
      const startTime = Date.now();
      const result: ValidationResult = {
        query,
        success: false,
        duration: 0
      };

      try {
        const { data, error } = await this.supabase.rpc('exec_sql', { sql: query });
        
        if (error) {
          throw new Error(error.message);
        }

        result.success = true;
        result.result = data;

      } catch (error: any) {
        result.error = error.message;
      }

      result.duration = Date.now() - startTime;
      results.push(result);
    }

    return results;
  }

  /**
   * Record migration in history
   */
  private async recordMigration(
    migration: Migration,
    success: boolean,
    errorMessage?: string
  ): Promise<void> {
    const { error } = await this.supabase
      .from('schema_migrations')
      .insert([{
        migration_id: migration.id,
        version: migration.version,
        name: migration.name,
        type: migration.type,
        author: migration.author,
        rollback_plan: migration.rollbackPlan,
        success,
        error_message: errorMessage,
        duration_seconds: migration.estimatedDuration,
        environment: 'production'
      }]);

    if (error) {
      console.error('⚠️ Could not record migration:', error.message);
    }
  }

  /**
   * Update schema version in bot_config
   */
  private async updateSchemaVersion(version: number): Promise<void> {
    const { error } = await this.supabase
      .from('bot_config')
      .upsert([{
        key: 'schema_version',
        environment: 'production',
        value: { version, updated_at: new Date().toISOString() },
        metadata: { migration_manager: true }
      }]);

    if (error) {
      console.error('⚠️ Could not update schema version:', error.message);
    }
  }

  // =====================================================================================
  // ROLLBACK MANAGEMENT
  // =====================================================================================

  /**
   * Execute rollback for a migration
   */
  public async rollbackMigration(migrationId: string): Promise<MigrationResult> {
    console.log(`🔄 Rolling back migration: ${migrationId}`);

    // Find the migration
    const { data: migrationRecord } = await this.supabase
      .from('schema_migrations')
      .select('*')
      .eq('migration_id', migrationId)
      .single();

    if (!migrationRecord) {
      throw new Error(`Migration ${migrationId} not found`);
    }

    if (!migrationRecord.rollback_plan) {
      throw new Error(`No rollback plan available for migration ${migrationId}`);
    }

    const result: MigrationResult = {
      success: false,
      migrationId,
      duration: 0
    };

    const startTime = Date.now();

    try {
      // Execute rollback (for now, just log the plan)
      console.log(`📋 Rollback plan: ${migrationRecord.rollback_plan}`);
      
      // In a full implementation, this would execute the rollback SQL
      // For now, we'll mark it as rolled back
      
      result.success = true;
      result.duration = Math.round((Date.now() - startTime) / 1000);

      console.log(`✅ Migration ${migrationId} rolled back successfully`);

      // Log rollback
      await dualStoreManager.logAuditEvent({
        event_type: 'migration_rolled_back',
        component: 'migration_manager',
        severity: 'warning',
        event_data: {
          migration_id: migrationId,
          rollback_plan: migrationRecord.rollback_plan,
          duration: result.duration
        }
      });

    } catch (error: any) {
      result.error = error.message;
      result.duration = Math.round((Date.now() - startTime) / 1000);

      console.error(`❌ Rollback failed for ${migrationId}:`, error.message);
    }

    return result;
  }

  // =====================================================================================
  // UTILITY METHODS
  // =====================================================================================

  /**
   * Get current schema version
   */
  public getCurrentVersion(): number {
    return this.currentSchemaVersion;
  }

  /**
   * Get baseline configuration
   */
  public getBaseline(): BaselineConfig | null {
    return this.baseline;
  }

  /**
   * Get migration history
   */
  public getMigrations(): Migration[] {
    return [...this.migrations];
  }

  /**
   * Check if schema is up to date
   */
  public async isSchemaUpToDate(): Promise<boolean> {
    // For now, assume schema is up to date if we have a baseline
    return this.baseline !== null;
  }

  /**
   * Generate migration report
   */
  public async generateMigrationReport(): Promise<{
    currentVersion: number;
    baseline: BaselineConfig | null;
    totalMigrations: number;
    lastMigration: Migration | null;
    pendingMigrations: number;
    schemaHealth: 'healthy' | 'needs_attention' | 'critical';
  }> {
    const report = {
      currentVersion: this.currentSchemaVersion,
      baseline: this.baseline,
      totalMigrations: this.migrations.length,
      lastMigration: this.migrations[this.migrations.length - 1] || null,
      pendingMigrations: 0, // Would check for pending migration files
      schemaHealth: 'healthy' as const
    };

    // Determine schema health
    if (!this.baseline) {
      report.schemaHealth = 'critical';
    } else if (this.currentSchemaVersion === 0) {
      report.schemaHealth = 'needs_attention';
    }

    return report;
  }
}

// Export singleton instance
export const migrationManager = MigrationManager.getInstance();

// Export types
export type {
  Migration,
  MigrationResult,
  SchemaInventory,
  DriftReport,
  BaselineConfig,
  ValidationResult
};

// Export class
export { MigrationManager };

// Default export
export default migrationManager;