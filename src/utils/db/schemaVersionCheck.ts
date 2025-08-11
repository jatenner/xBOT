/**
 * 🛡️ SCHEMA VERSION CHECK
 * 
 * PURPOSE: Prevents app startup when database schema doesn't match expected version
 * STRATEGY: Compare APP_SCHEMA_VERSION env with database schema_version in bot_config
 * SAFETY: Exit with clear error message if mismatch detected
 */

import { createClient } from '@supabase/supabase-js';

interface SchemaVersion {
  version: string;
  migration: string;
  timestamp: string;
}

interface SchemaCheckResult {
  compatible: boolean;
  dbVersion?: string;
  appVersion: string;
  environment: string;
  error?: string;
}

export class SchemaVersionGuard {
  private supabase;
  private appVersion: string;
  private environment: string;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('❌ Missing Supabase credentials (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.appVersion = process.env.APP_SCHEMA_VERSION || '1.0.0';
    this.environment = process.env.APP_ENV || 'production';
  }

  /**
   * Check schema compatibility between app and database
   */
  async checkSchemaVersion(): Promise<SchemaCheckResult> {
    try {
      console.log(`🛡️  Schema Guard: Checking compatibility (env: ${this.environment}, app: ${this.appVersion})`);

      // Get schema version from bot_config table
      const { data, error } = await this.supabase
        .from('bot_config')
        .select('config_value')
        .eq('environment', this.environment)
        .eq('config_key', 'schema_version')
        .maybeSingle();

      if (error) {
        return {
          compatible: false,
          appVersion: this.appVersion,
          environment: this.environment,
          error: `Database query failed: ${error.message}`
        };
      }

      if (!data || !data.config_value) {
        return {
          compatible: false,
          appVersion: this.appVersion,
          environment: this.environment,
          error: `No schema version found for environment '${this.environment}'`
        };
      }

      const dbSchemaVersion = data.config_value as SchemaVersion;
      const dbVersion = dbSchemaVersion.version;

      console.log(`🛡️  Database Schema: ${dbVersion} | App Schema: ${this.appVersion}`);

      // Check compatibility
      const compatible = this.isVersionCompatible(dbVersion, this.appVersion);

      return {
        compatible,
        dbVersion,
        appVersion: this.appVersion,
        environment: this.environment
      };

    } catch (error: any) {
      return {
        compatible: false,
        appVersion: this.appVersion,
        environment: this.environment,
        error: `Schema guard error: ${error.message}`
      };
    }
  }

  /**
   * Compare versions - simple major.minor.patch comparison
   */
  private isVersionCompatible(dbVersion: string, appVersion: string): boolean {
    // For production safety, require exact match
    // You can implement more sophisticated semver logic here if needed
    return dbVersion === appVersion;
  }

  /**
   * Schema guard function - call at app startup
   */
  async guardStartup(): Promise<void> {
    console.log('🛡️  Schema Guard: Starting database compatibility check...');

    const result = await this.checkSchemaVersion();

    if (!result.compatible) {
      const errorMsg = result.error || 
        `Schema version mismatch - Database: ${result.dbVersion || 'unknown'}, App: ${result.appVersion}`;
      
      console.error('');
      console.error('🚨 ═══════════════════════════════════════════════════════════');
      console.error('🚨 SCHEMA GUARD: DATABASE COMPATIBILITY CHECK FAILED');
      console.error('🚨 ═══════════════════════════════════════════════════════════');
      console.error('');
      console.error(`❌ ${errorMsg}`);
      console.error('');
      console.error('📊 Details:');
      console.error(`   Environment: ${result.environment}`);
      console.error(`   App Version: ${result.appVersion}`);
      console.error(`   DB Version:  ${result.dbVersion || 'NOT FOUND'}`);
      console.error('');
      console.error('🔧 Possible Solutions:');
      console.error('   1. Run database migrations: supabase db push');
      console.error('   2. Deploy correct app version for this database');
      console.error('   3. Update APP_SCHEMA_VERSION environment variable');
      console.error('   4. Check database connectivity and bot_config table');
      console.error('');
      console.error('🚨 APPLICATION STARTUP BLOCKED FOR SAFETY');
      console.error('🚨 ═══════════════════════════════════════════════════════════');
      console.error('');
      
      process.exit(1);
    }

    console.log(`✅ Schema Guard: Database compatible (${result.dbVersion})`);
  }
}

/**
 * Convenience function for app startup
 */
export async function schemaVersionCheck(): Promise<void> {
  const guard = new SchemaVersionGuard();
  await guard.guardStartup();
}

/**
 * Non-blocking version check for health endpoints
 */
export async function getSchemaStatus(): Promise<SchemaCheckResult> {
  const guard = new SchemaVersionGuard();
  return await guard.checkSchemaVersion();
}