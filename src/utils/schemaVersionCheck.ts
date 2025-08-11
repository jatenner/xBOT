/**
 * 🛡️ SCHEMA VERSION GUARD
 * 
 * PURPOSE: Prevents app startup with mismatched database schema
 * STRATEGY: Compare APP_SCHEMA_VERSION env with database schema_version in bot_config
 */

import { createClient } from '@supabase/supabase-js';

interface SchemaVersion {
  version: string;
  migration: string;
  timestamp: string;
}

export class SchemaVersionCheck {
  private supabase;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('❌ Missing Supabase credentials for schema version check');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Check if database schema version matches app requirements
   */
  async checkSchemaVersion(): Promise<{ 
    compatible: boolean; 
    dbVersion?: string; 
    appVersion: string; 
    error?: string;
    environment: string;
  }> {
    const appVersion = process.env.APP_SCHEMA_VERSION || '1.0.0';
    const environment = process.env.APP_ENV || 'production';

    try {
      console.log('🛡️  Schema Guard: Checking database compatibility...');
      console.log(`🛡️  Environment: ${environment}`);
      console.log(`🛡️  Expected App Version: ${appVersion}`);

      // Get schema version from database
      const { data, error } = await this.supabase
        .from('bot_config')
        .select('config_value')
        .eq('environment', environment)
        .eq('config_key', 'schema_version')
        .single();

      if (error) {
        return {
          compatible: false,
          appVersion,
          environment,
          error: `Failed to read schema version from database: ${error.message}`
        };
      }

      if (!data || !data.config_value) {
        return {
          compatible: false,
          appVersion,
          environment,
          error: `No schema version found in database for environment: ${environment}`
        };
      }

      const dbSchemaVersion = data.config_value as SchemaVersion;
      const dbVersion = dbSchemaVersion.version;

      console.log(`🛡️  Database Schema Version: ${dbVersion}`);

      // Version compatibility check
      const compatible = this.isVersionCompatible(dbVersion, appVersion);

      if (compatible) {
        console.log('✅ Schema versions are compatible');
      } else {
        console.log('❌ Schema version mismatch detected');
      }

      return {
        compatible,
        dbVersion,
        appVersion,
        environment
      };

    } catch (error: any) {
      return {
        compatible: false,
        appVersion,
        environment,
        error: `Schema version check error: ${error.message}`
      };
    }
  }

  /**
   * Compare versions - simple implementation
   * In production, you might want semver comparison
   */
  private isVersionCompatible(dbVersion: string, appVersion: string): boolean {
    // For now, require exact match or database version >= app version
    // You can implement more sophisticated semver logic here
    if (dbVersion === appVersion) {
      return true;
    }

    // Simple version comparison (assumes X.Y.Z format)
    const dbParts = dbVersion.split('.').map(Number);
    const appParts = appVersion.split('.').map(Number);

    // Database major version must match app major version
    if (dbParts[0] !== appParts[0]) {
      return false;
    }

    // Database minor version must be >= app minor version
    if (dbParts[1] < appParts[1]) {
      return false;
    }

    // If minor versions match, database patch must be >= app patch
    if (dbParts[1] === appParts[1] && dbParts[2] < appParts[2]) {
      return false;
    }

    return true;
  }

  /**
   * Guard function to call at app startup - exits process if incompatible
   */
  async guardStartup(): Promise<void> {
    console.log('🛡️  Schema Guard: Starting database compatibility check...');

    // Skip schema guard in development if explicitly disabled
    if (process.env.SKIP_SCHEMA_GUARD === 'true') {
      console.log('⚠️  Schema Guard: SKIPPED (SKIP_SCHEMA_GUARD=true)');
      console.log('🚨 This should only be used in development/emergency situations');
      return;
    }

    const result = await this.checkSchemaVersion();

    if (!result.compatible) {
      const errorMsg = result.error || 
        `Schema version mismatch - DB: ${result.dbVersion || 'unknown'}, App: ${result.appVersion}`;
      
      console.error('');
      console.error('🚨 ========================================');
      console.error('🚨 DATABASE SCHEMA COMPATIBILITY FAILURE');
      console.error('🚨 ========================================');
      console.error('');
      console.error('❌ Error:', errorMsg);
      console.error('🏷️  Environment:', result.environment);
      console.error('📱 App Version:', result.appVersion);
      console.error('🗄️  DB Version:', result.dbVersion || 'unknown');
      console.error('');
      console.error('🔧 Resolution Options:');
      console.error('1. Run database migrations to update schema:');
      console.error('   supabase db push');
      console.error('');
      console.error('2. Deploy the correct app version for this database');
      console.error('');
      console.error('3. Set APP_SCHEMA_VERSION environment variable correctly');
      console.error('');
      console.error('4. Emergency bypass (development only):');
      console.error('   export SKIP_SCHEMA_GUARD=true');
      console.error('');
      console.error('🚨 Application startup blocked for safety');
      console.error('🚨 ========================================');
      console.error('');
      
      process.exit(1);
    }

    console.log('✅ Schema Guard: Database schema is compatible with application');
    console.log(`✅ Environment: ${result.environment}, DB Version: ${result.dbVersion}, App Version: ${result.appVersion}`);
  }
}

/**
 * Convenience function for startup - creates instance and runs guard
 */
export async function schemaVersionCheck(): Promise<void> {
  const guard = new SchemaVersionCheck();
  await guard.guardStartup();
}

/**
 * Check compatibility without exiting process
 */
export async function checkSchemaCompatibility(): Promise<{ 
  compatible: boolean; 
  dbVersion?: string; 
  appVersion: string; 
  error?: string;
  environment: string;
}> {
  const guard = new SchemaVersionCheck();
  return await guard.checkSchemaVersion();
}