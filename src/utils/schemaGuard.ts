/**
 * 🛡️ SCHEMA VERSION GUARD
 * 
 * PURPOSE: Prevents app startup with mismatched database schema
 * STRATEGY: Compare APP_SCHEMA_VERSION env with database schema_version
 */

import { createClient } from '@supabase/supabase-js';

interface SchemaVersion {
  version: string;
  migration: string;
  timestamp: string;
}

export class SchemaGuard {
  private supabase;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('❌ Missing Supabase credentials for schema guard');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Check if database schema version matches app requirements
   */
  async checkSchemaVersion(): Promise<{ compatible: boolean; dbVersion?: string; appVersion: string; error?: string }> {
    const appVersion = process.env.APP_SCHEMA_VERSION || '1.0.0';

    try {
      console.log('🛡️  Schema Guard: Checking database compatibility...');

      // Get schema version from database
      const { data, error } = await this.supabase
        .from('bot_config')
        .select('config_value')
        .eq('environment', process.env.APP_ENV || 'production')
        .eq('config_key', 'schema_version')
        .single();

      if (error) {
        return {
          compatible: false,
          appVersion,
          error: `Failed to read schema version from database: ${error.message}`
        };
      }

      if (!data || !data.config_value) {
        return {
          compatible: false,
          appVersion,
          error: 'No schema version found in database'
        };
      }

      const dbSchemaVersion = data.config_value as SchemaVersion;
      const dbVersion = dbSchemaVersion.version;

      console.log(`🛡️  Database Schema Version: ${dbVersion}`);
      console.log(`🛡️  App Schema Version: ${appVersion}`);

      // Simple version comparison (you can make this more sophisticated)
      const compatible = this.isVersionCompatible(dbVersion, appVersion);

      return {
        compatible,
        dbVersion,
        appVersion
      };

    } catch (error: any) {
      return {
        compatible: false,
        appVersion,
        error: `Schema guard error: ${error.message}`
      };
    }
  }

  /**
   * Compare versions - simple implementation
   * In production, you might want semver comparison
   */
  private isVersionCompatible(dbVersion: string, appVersion: string): boolean {
    // For now, require exact match
    // You can implement more sophisticated logic here
    return dbVersion === appVersion;
  }

  /**
   * Guard function to call at app startup
   */
  async guardStartup(): Promise<void> {
    console.log('🛡️  Schema Guard: Starting compatibility check...');

    const result = await this.checkSchemaVersion();

    if (!result.compatible) {
      const errorMsg = result.error || 
        `Schema version mismatch - DB: ${result.dbVersion || 'unknown'}, App: ${result.appVersion}`;
      
      console.error('❌ SCHEMA GUARD FAILED:', errorMsg);
      console.error('');
      console.error('🚨 DATABASE SCHEMA IS NOT COMPATIBLE WITH THIS APP VERSION');
      console.error('');
      console.error('Please either:');
      console.error('1. Run database migrations to update schema');
      console.error('2. Deploy the correct app version for this database');
      console.error('3. Set APP_SCHEMA_VERSION environment variable correctly');
      console.error('');
      
      process.exit(1);
    }

    console.log('✅ Schema Guard: Database is compatible');
  }
}

/**
 * Convenience function for startup
 */
export async function checkSchemaCompatibility(): Promise<void> {
  const guard = new SchemaGuard();
  await guard.guardStartup();
}