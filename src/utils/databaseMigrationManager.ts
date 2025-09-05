/**
 * 🗄️ DATABASE MIGRATION MANAGER
 * 
 * Fixes the critical issue where setup_production_database.sql was never executed.
 * This ensures all required tables exist and the database is properly configured.
 */

import { unifiedDb } from '../lib/unifiedDatabaseManager';
import { readFileSync } from 'fs';
import { join } from 'path';

interface MigrationResult {
  success: boolean;
  tablesCreated: string[];
  errors: string[];
  message: string;
}

export class DatabaseMigrationManager {
  private readonly migrationPath = join(__dirname, '../../setup_production_database.sql');

  async executeProductionMigration(): Promise<MigrationResult> {
    console.log('🗄️ MIGRATION: Starting production database setup...');
    
    const result: MigrationResult = {
      success: false,
      tablesCreated: [],
      errors: [],
      message: ''
    };

    try {
      // Read the migration file
      console.log('📖 MIGRATION: Reading setup_production_database.sql...');
      const migrationSql = readFileSync(this.migrationPath, 'utf8');
      
      // Split into individual statements
      const statements = migrationSql
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

      console.log(`🔧 MIGRATION: Found ${statements.length} SQL statements to execute`);

      // Execute each statement
      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i];
        
        try {
          console.log(`⚙️ MIGRATION: Executing statement ${i + 1}/${statements.length}`);
          
          const { error } = await unifiedDb.executeQuery(
            async (supabase) => await supabase.rpc('exec_sql', { sql_query: statement }),
            null
          );

          if (error) {
            // Some errors are expected (like "table already exists")
            if (error.message.includes('already exists')) {
              console.log(`ℹ️ MIGRATION: Skipping existing object (${error.message})`);
            } else {
              result.errors.push(`Statement ${i + 1}: ${error.message}`);
              console.warn(`⚠️ MIGRATION: Error in statement ${i + 1}:`, error.message);
            }
          } else {
            // Track table creation
            if (statement.toLowerCase().includes('create table')) {
              const tableMatch = statement.match(/create table (?:if not exists )?(\w+)/i);
              if (tableMatch) {
                result.tablesCreated.push(tableMatch[1]);
              }
            }
          }
        } catch (err: any) {
          result.errors.push(`Statement ${i + 1}: ${err.message}`);
          console.error(`❌ MIGRATION: Failed to execute statement ${i + 1}:`, err.message);
        }
      }

      // Verify critical tables exist
      const criticalTables = ['tweets', 'bot_config', 'content_performance', 'analytics', 'learning_data'];
      const verificationResults = await this.verifyTablesExist(criticalTables);
      
      result.success = verificationResults.allExist;
      result.message = result.success 
        ? `Migration completed successfully. ${result.tablesCreated.length} tables processed.`
        : `Migration completed with issues. Missing tables: ${verificationResults.missing.join(', ')}`;

      console.log(result.success ? '✅ MIGRATION: Production database setup complete' : '⚠️ MIGRATION: Setup completed with warnings');
      
      return result;

    } catch (error: any) {
      result.errors.push(`Migration failed: ${error.message}`);
      result.message = `Migration failed: ${error.message}`;
      console.error('❌ MIGRATION: Production database setup failed:', error.message);
      return result;
    }
  }

  async verifyTablesExist(tableNames: string[]): Promise<{ allExist: boolean; existing: string[]; missing: string[] }> {
    console.log('🔍 MIGRATION: Verifying table existence...');
    
    const existing: string[] = [];
    const missing: string[] = [];

    for (const tableName of tableNames) {
      try {
        const { data, error } = await unifiedDb.executeQuery(
          async (supabase) => await supabase.from(tableName).select('*').limit(1),
          null
        );

        if (!error) {
          existing.push(tableName);
          console.log(`✅ MIGRATION: Table '${tableName}' exists`);
        } else {
          missing.push(tableName);
          console.warn(`❌ MIGRATION: Table '${tableName}' missing`);
        }
      } catch (err) {
        missing.push(tableName);
        console.warn(`❌ MIGRATION: Cannot access table '${tableName}'`);
      }
    }

    return {
      allExist: missing.length === 0,
      existing,
      missing
    };
  }

  async createEmergencyTables(): Promise<void> {
    console.log('🚨 MIGRATION: Creating emergency audit tables...');
    
    const emergencyTables = [
      {
        name: 'system_failures',
        sql: `
          CREATE TABLE IF NOT EXISTS system_failures (
            id SERIAL PRIMARY KEY,
            failure_id VARCHAR(255) UNIQUE NOT NULL,
            component VARCHAR(100) NOT NULL,
            failure_type VARCHAR(100) NOT NULL,
            error_message TEXT,
            context TEXT,
            timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            resolved BOOLEAN DEFAULT FALSE,
            resolution_timestamp TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
        `
      },
      {
        name: 'emergency_system_usage',
        sql: `
          CREATE TABLE IF NOT EXISTS emergency_system_usage (
            id SERIAL PRIMARY KEY,
            event_id VARCHAR(255) UNIQUE NOT NULL,
            primary_system VARCHAR(100) NOT NULL,
            emergency_system VARCHAR(100) NOT NULL,
            reason TEXT,
            success BOOLEAN NOT NULL,
            performance_impact INTEGER DEFAULT 50,
            timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
        `
      },
      {
        name: 'autonomous_improvements',
        sql: `
          CREATE TABLE IF NOT EXISTS autonomous_improvements (
            id SERIAL PRIMARY KEY,
            improvement_id VARCHAR(255) UNIQUE NOT NULL,
            component VARCHAR(100) NOT NULL,
            issue TEXT,
            recommendation TEXT,
            implementation_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            confidence_score INTEGER,
            success BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
        `
      }
    ];

    for (const table of emergencyTables) {
      try {
        await unifiedDb.executeQuery(
          async (supabase) => await supabase.rpc('exec_sql', { sql_query: table.sql }),
          null
        );
        console.log(`✅ MIGRATION: Emergency table '${table.name}' created`);
      } catch (error: any) {
        console.warn(`⚠️ MIGRATION: Could not create emergency table '${table.name}':`, error.message);
      }
    }
  }

  async insertCriticalBotConfig(): Promise<void> {
    console.log('⚙️ MIGRATION: Ensuring critical bot configuration exists...');
    
    const criticalConfig = [
      { key: 'system_health_monitoring', value: 'true', type: 'boolean' },
      { key: 'circuit_breaker_enabled', value: 'true', type: 'boolean' },
      { key: 'emergency_fallback_enabled', value: 'true', type: 'boolean' },
      { key: 'unified_database_manager', value: 'active', type: 'string' },
      { key: 'redis_cache_enabled', value: 'true', type: 'boolean' },
      { key: 'health_check_interval', value: '900', type: 'integer' }, // 15 minutes
      { key: 'last_database_migration', value: new Date().toISOString(), type: 'datetime' }
    ];

    for (const config of criticalConfig) {
      try {
        await unifiedDb.executeQuery(
          async (supabase) => await supabase
            .from('bot_config')
            .upsert([config])
            .select(),
          null
        );
        console.log(`✅ MIGRATION: Config '${config.key}' set`);
      } catch (error: any) {
        console.warn(`⚠️ MIGRATION: Could not set config '${config.key}':`, error.message);
      }
    }
  }

  async runCompleteMigration(): Promise<MigrationResult> {
    console.log('🚀 MIGRATION: Running complete database migration...');
    
    // Step 1: Execute main production migration
    const migrationResult = await this.executeProductionMigration();
    
    // Step 2: Create emergency audit tables
    await this.createEmergencyTables();
    
    // Step 3: Insert critical configuration
    await this.insertCriticalBotConfig();
    
    // Step 4: Final verification
    const verificationResult = await this.verifyTablesExist([
      'tweets', 'bot_config', 'content_performance', 'analytics', 'learning_data',
      'system_failures', 'emergency_system_usage', 'autonomous_improvements'
    ]);
    
    migrationResult.success = verificationResult.allExist;
    migrationResult.message = verificationResult.allExist
      ? 'Complete migration successful - all systems ready'
      : `Migration completed but missing tables: ${verificationResult.missing.join(', ')}`;
    
    console.log('🎯 MIGRATION: Complete migration finished');
    return migrationResult;
  }
}

export const migrationManager = new DatabaseMigrationManager();
