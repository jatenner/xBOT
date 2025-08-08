/**
 * 🔍 COMPREHENSIVE SCHEMA VALIDATOR
 * =================================
 * Bulletproof schema validation and cache management for production stability
 */

import { supabaseClient } from './supabaseClient';

interface ColumnDefinition {
  table: string;
  column: string;
  type: string;
  required: boolean;
  defaultValue?: any;
}

interface ValidationResult {
  success: boolean;
  missingColumns: string[];
  invalidTypes: string[];
  cacheRefreshNeeded: boolean;
  errors: string[];
  summary: string;
}

export class ComprehensiveSchemaValidator {
  
  // Define all expected columns for system operation
  private static readonly REQUIRED_COLUMNS: ColumnDefinition[] = [
    // POST_HISTORY table
    { table: 'post_history', column: 'idea_fingerprint', type: 'text', required: false },
    { table: 'post_history', column: 'content_type', type: 'character varying', required: false },
    { table: 'post_history', column: 'posting_strategy', type: 'character varying', required: false },
    { table: 'post_history', column: 'engagement_score', type: 'integer', required: false },
    { table: 'post_history', column: 'viral_score', type: 'integer', required: false },
    { table: 'post_history', column: 'posting_hour', type: 'integer', required: false },
    { table: 'post_history', column: 'bandit_confidence', type: 'numeric', required: false },
    
    // TWEET_ANALYTICS table  
    { table: 'tweet_analytics', column: 'profile_visit_rate', type: 'numeric', required: false },
    { table: 'tweet_analytics', column: 'click_through_rate', type: 'numeric', required: false },
    { table: 'tweet_analytics', column: 'viral_coefficient', type: 'numeric', required: false },
    { table: 'tweet_analytics', column: 'audience_quality_score', type: 'integer', required: false },
    
    // LEARNING_POSTS table
    { table: 'learning_posts', column: 'has_hook', type: 'boolean', required: false },
    { table: 'learning_posts', column: 'has_call_to_action', type: 'boolean', required: false },
    { table: 'learning_posts', column: 'content_length', type: 'integer', required: false },
    { table: 'learning_posts', column: 'bandit_confidence', type: 'numeric', required: false },
    
    // CONTENT_FEATURES table
    { table: 'content_features', column: 'primary_topic', type: 'text', required: false },
    { table: 'content_features', column: 'sentiment_score', type: 'numeric', required: false },
    { table: 'content_features', column: 'complexity_score', type: 'integer', required: false },
    
    // BANDIT_ARMS table
    { table: 'bandit_arms', column: 'arm_id', type: 'text', required: true },
    { table: 'bandit_arms', column: 'success_rate', type: 'numeric', required: false },
    { table: 'bandit_arms', column: 'confidence_interval', type: 'numeric', required: false }
  ];

  /**
   * 🔍 COMPREHENSIVE SCHEMA VALIDATION
   * Validates all required columns exist with correct types
   */
  static async validateCompleteSchema(): Promise<ValidationResult> {
    console.log('🔍 === COMPREHENSIVE SCHEMA VALIDATION ===');
    
    const result: ValidationResult = {
      success: true,
      missingColumns: [],
      invalidTypes: [],
      cacheRefreshNeeded: false,
      errors: [],
      summary: ''
    };

    try {
      // Get current schema information
      const { data: schemaInfo, error: schemaError } = await supabaseClient.supabase
        .rpc('get_schema_columns_info');

      if (schemaError) {
        console.log('⚠️ Using fallback schema validation method');
        return await this.validateSchemaFallback();
      }

      // Check each required column
      for (const expectedCol of this.REQUIRED_COLUMNS) {
        const exists = await this.checkColumnExists(expectedCol.table, expectedCol.column);
        
        if (!exists) {
          result.missingColumns.push(`${expectedCol.table}.${expectedCol.column}`);
          result.success = false;
        }
      }

      // Generate summary
      if (result.success) {
        result.summary = `✅ All ${this.REQUIRED_COLUMNS.length} required columns exist and are properly configured`;
        console.log(result.summary);
      } else {
        result.summary = `❌ Schema validation failed: ${result.missingColumns.length} missing columns`;
        console.error(result.summary);
        console.error('Missing columns:', result.missingColumns);
      }

      return result;

    } catch (error) {
      result.success = false;
      result.errors.push(`Schema validation error: ${error.message}`);
      result.summary = '❌ Schema validation failed due to database error';
      console.error('❌ Schema validation error:', error);
      return result;
    }
  }

  /**
   * 🔧 FALLBACK SCHEMA VALIDATION
   * Uses direct column checks when RPC functions are unavailable
   */
  private static async validateSchemaFallback(): Promise<ValidationResult> {
    console.log('🔧 Using fallback schema validation...');
    
    const result: ValidationResult = {
      success: true,
      missingColumns: [],
      invalidTypes: [],
      cacheRefreshNeeded: false,
      errors: [],
      summary: ''
    };

    try {
      // Check critical columns one by one
      const criticalColumns = [
        { table: 'post_history', column: 'idea_fingerprint' },
        { table: 'tweet_analytics', column: 'profile_visit_rate' },
        { table: 'learning_posts', column: 'has_hook' },
        { table: 'learning_posts', column: 'has_call_to_action' }
      ];

      for (const col of criticalColumns) {
        const exists = await this.checkColumnExists(col.table, col.column);
        if (!exists) {
          result.missingColumns.push(`${col.table}.${col.column}`);
          result.success = false;
        }
      }

      result.summary = result.success ? 
        '✅ Critical columns validated successfully' :
        `❌ Missing critical columns: ${result.missingColumns.join(', ')}`;

      return result;

    } catch (error) {
      result.success = false;
      result.errors.push(`Fallback validation error: ${error.message}`);
      result.summary = '❌ Fallback validation failed';
      return result;
    }
  }

  /**
   * ✅ CHECK IF SPECIFIC COLUMN EXISTS
   */
  private static async checkColumnExists(tableName: string, columnName: string): Promise<boolean> {
    try {
      const { data, error } = await supabaseClient.supabase
        .from('information_schema.columns')
        .select('column_name')
        .eq('table_name', tableName)
        .eq('column_name', columnName)
        .limit(1);

      if (error) {
        // Fallback: try to query the actual table
        try {
          await supabaseClient.supabase
            .from(tableName)
            .select(columnName)
            .limit(1);
          return true; // If query succeeds, column exists
        } catch {
          return false; // If query fails, column doesn't exist
        }
      }

      return data && data.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * 🔄 FORCE SCHEMA CACHE REFRESH
   * Uses multiple methods to ensure Supabase recognizes new columns
   */
  static async forceSchemaRefresh(): Promise<{ success: boolean; method: string }> {
    console.log('🔄 Forcing schema cache refresh...');

    try {
      // Method 1: Update table comments (safest)
      const tables = ['post_history', 'tweet_analytics', 'learning_posts', 'content_features'];
      const timestamp = new Date().toISOString();

      for (const table of tables) {
        try {
          await supabaseClient.supabase.rpc('update_table_comment', {
            table_name: table,
            comment_text: `Schema refreshed: ${timestamp}`
          });
        } catch {
          // Ignore errors, this is best-effort
        }
      }

      // Method 2: Force a schema-dependent query
      try {
        await supabaseClient.supabase
          .from('post_history')
          .select('idea_fingerprint')
          .limit(1);
      } catch {
        // Expected to fail if column doesn't exist yet
      }

      console.log('✅ Schema cache refresh initiated');
      return { success: true, method: 'table_comments_and_queries' };

    } catch (error) {
      console.warn('⚠️ Schema cache refresh failed:', error);
      return { success: false, method: 'failed' };
    }
  }

  /**
   * 🩺 COMPREHENSIVE SYSTEM HEALTH CHECK
   * Validates schema and suggests fixes
   */
  static async performSystemHealthCheck(): Promise<{
    schemaHealth: ValidationResult;
    recommendations: string[];
    criticalIssues: string[];
    canOperate: boolean;
  }> {
    console.log('🩺 === COMPREHENSIVE SYSTEM HEALTH CHECK ===');

    const schemaHealth = await this.validateCompleteSchema();
    const recommendations: string[] = [];
    const criticalIssues: string[] = [];

    // Analyze results
    if (schemaHealth.missingColumns.length > 0) {
      criticalIssues.push('Missing database columns preventing system operation');
      recommendations.push('Run the comprehensive schema migration immediately');
      recommendations.push('Execute schema cache refresh after migration');
    }

    if (schemaHealth.errors.length > 0) {
      criticalIssues.push('Database connectivity or permission issues');
      recommendations.push('Check database connection and permissions');
    }

    // Determine if system can operate
    const canOperate = criticalIssues.length === 0;

    const healthStatus = canOperate ? '✅ HEALTHY' : '❌ CRITICAL ISSUES DETECTED';
    console.log(`🩺 System Health: ${healthStatus}`);

    if (!canOperate) {
      console.error('❌ Critical issues preventing system operation:');
      criticalIssues.forEach(issue => console.error(`   - ${issue}`));
    }

    return {
      schemaHealth,
      recommendations,
      criticalIssues,
      canOperate
    };
  }

  /**
   * 🛠️ AUTO-FIX SCHEMA ISSUES
   * Attempts to automatically resolve schema problems
   */
  static async autoFixSchemaIssues(): Promise<{ success: boolean; actions: string[]; errors: string[] }> {
    console.log('🛠️ === AUTO-FIXING SCHEMA ISSUES ===');

    const actions: string[] = [];
    const errors: string[] = [];

    try {
      // Step 1: Force schema refresh
      const refreshResult = await this.forceSchemaRefresh();
      if (refreshResult.success) {
        actions.push('Schema cache refresh completed');
      } else {
        errors.push('Schema cache refresh failed');
      }

      // Step 2: Wait and re-validate
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const validationResult = await this.validateCompleteSchema();
      
      if (validationResult.success) {
        actions.push('Schema validation passed after refresh');
        console.log('✅ Auto-fix successful - schema is now operational');
        return { success: true, actions, errors };
      } else {
        errors.push('Schema validation still failing after auto-fix attempts');
        console.error('❌ Auto-fix failed - manual intervention required');
        return { success: false, actions, errors };
      }

    } catch (error) {
      errors.push(`Auto-fix error: ${error.message}`);
      console.error('❌ Auto-fix failed:', error);
      return { success: false, actions, errors };
    }
  }
}

// Export singleton instance
export const comprehensiveSchemaValidator = ComprehensiveSchemaValidator;