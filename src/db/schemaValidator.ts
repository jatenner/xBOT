/**
 * Database Schema Validator
 * 
 * This system validates that the actual database schema matches what our code expects.
 * Runs on startup to catch schema mismatches before they cause errors in production.
 */

import { getSupabaseClient } from '../lib/supabaseClient';

// =====================================================================================
// SCHEMA DEFINITIONS - SINGLE SOURCE OF TRUTH
// =====================================================================================

export const EXPECTED_SCHEMA = {
  content_metadata: [
    'id', 'decision_id', 'content', 'content_hash', 'content_type', 
    'topic_cluster', 'generator_used', 'hook_pattern', 'posted_at', 
    'scheduled_at', 'status', 'metadata', 'target_username', 
    'target_tweet_id', 'target_tweet_content', 'created_at', 'updated_at'
  ],
  
  posted_decisions: [
    'id', 'decision_id', 'tweet_id', 'content', 'decision_type',
    'topic_cluster', 'target_tweet_id', 'target_username',
    'bandit_arm', 'timing_arm', 'predicted_er', 'quality_score',
    'posted_at', 'created_at', 'generation_source'
  ],
  
  outcomes: [
    'id', 'decision_id', 'tweet_id', 'likes', 'retweets', 'replies',
    'bookmarks', 'quotes', 'impressions', 'views', 'profile_clicks',
    'engagement_rate', 'followers_gained', 'followers_before', 
    'followers_after', 'collected_at', 'collected_pass', 'data_source',
    'simulated', 'created_at'
  ],
  
  reply_opportunities: [
    'id', 'target_username', 'target_tweet_id', 'target_tweet_content',
    'tweet_posted_at', 'opportunity_score', 'engagement_potential',
    'follower_count', 'relevance_score', 'status', 'created_at', 'updated_at'
  ],
  
  discovered_accounts: [
    'id', 'username', 'follower_count', 'following_count', 'tweet_count',
    'bio', 'verified', 'discovery_method', 'discovery_date', 'quality_score',
    'engagement_score', 'content_score', 'audience_relevance', 'growth_score',
    'final_score', 'last_scored', 'last_updated', 'created_at'
  ],
  
  content_violations: [
    'id', 'generator_name', 'topic', 'format', 'violation_type', 'severity',
    'detected_phrase', 'context_snippet', 'content_preview', 'full_content',
    'specificity_score', 'specificity_matches', 'action_taken', 'retry_succeeded',
    'metadata', 'created_at'
  ],

  post_attribution: [
    'id', 'post_id', 'decision_id', 'followers_before', 'followers_2h_after',
    'followers_24h_after', 'followers_48h_after', 'followers_gained', 'posted_at',
    'last_check', 'created_at', 'updated_at', 'engagement_rate', 'impressions'
  ]
} as const;

export const EXPECTED_VIEWS = {
  content_with_outcomes: [
    'decision_id', 'tweet_id', 'content', 'decision_type', 'posted_at',
    'decision_created_at', 'topic_cluster', 'quality_score', 'predicted_er',
    'generation_source', 'target_tweet_id', 'target_username',
    'likes', 'retweets', 'replies', 'bookmarks', 'quotes', 'impressions',
    'views', 'profile_clicks', 'engagement_rate', 'followers_gained',
    'followers_before', 'followers_after', 'collected_at', 'collected_pass',
    'data_source'
  ]
} as const;

// =====================================================================================
// VALIDATION LOGIC
// =====================================================================================

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  missingTables: string[];
  missingColumns: { table: string; columns: string[] }[];
  extraColumns: { table: string; columns: string[] }[];
}

/**
 * Validate entire database schema
 */
export async function validateDatabaseSchema(): Promise<ValidationResult> {
  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
    missingTables: [],
    missingColumns: [],
    extraColumns: []
  };

  console.log('\n🔍 DB_SCHEMA_VALIDATOR: Starting validation...');

  try {
    // Validate tables
    for (const [tableName, expectedColumns] of Object.entries(EXPECTED_SCHEMA)) {
      await validateTable(tableName, expectedColumns, result);
    }

    // Validate views
    for (const [viewName, expectedColumns] of Object.entries(EXPECTED_VIEWS)) {
      await validateView(viewName, expectedColumns, result);
    }

    // Determine if valid
    result.valid = result.errors.length === 0 && result.missingTables.length === 0;

    // Print summary
    if (result.valid) {
      console.log('✅ DB_SCHEMA_VALIDATOR: All schema validations passed!');
    } else {
      console.error('❌ DB_SCHEMA_VALIDATOR: Schema validation FAILED!');
      console.error(`   Missing tables: ${result.missingTables.length}`);
      console.error(`   Missing columns: ${result.missingColumns.length}`);
      console.error(`   Errors: ${result.errors.length}`);
    }

    if (result.warnings.length > 0) {
      console.warn(`⚠️  DB_SCHEMA_VALIDATOR: ${result.warnings.length} warnings`);
    }

  } catch (error: any) {
    result.valid = false;
    result.errors.push(`Fatal validation error: ${error.message}`);
    console.error('❌ DB_SCHEMA_VALIDATOR: Fatal error:', error.message);
  }

  return result;
}

/**
 * Validate a single table
 */
async function validateTable(
  tableName: string,
  expectedColumns: readonly string[],
  result: ValidationResult
): Promise<void> {
  const supabase = getSupabaseClient();

  try {
    // Check if table exists by trying to query it
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .limit(1);

    if (error) {
      if (error.message.includes('does not exist') || error.code === '42P01') {
        result.missingTables.push(tableName);
        result.errors.push(`Table '${tableName}' does not exist`);
        console.error(`❌ Table missing: ${tableName}`);
        return;
      }
      
      // Check for missing columns
      const match = error.message.match(/column "?([^"\s]+)"? does not exist/i);
      if (match) {
        const missingCol = match[1];
        result.missingColumns.push({ table: tableName, columns: [missingCol] });
        result.errors.push(`Table '${tableName}' missing column: ${missingCol}`);
        console.error(`❌ ${tableName}: missing column '${missingCol}'`);
        return;
      }
    }

    // If we got data, check columns
    if (data && data.length > 0) {
      const actualColumns = Object.keys(data[0]);
      
      // Check for missing expected columns
      const missing = expectedColumns.filter(col => !actualColumns.includes(col));
      if (missing.length > 0) {
        result.missingColumns.push({ table: tableName, columns: missing });
        result.errors.push(`Table '${tableName}' missing columns: ${missing.join(', ')}`);
        console.error(`❌ ${tableName}: missing columns: ${missing.join(', ')}`);
      }

      // Check for extra columns (warning only)
      const extra = actualColumns.filter(col => !expectedColumns.includes(col));
      if (extra.length > 0) {
        result.extraColumns.push({ table: tableName, columns: extra });
        result.warnings.push(`Table '${tableName}' has extra columns: ${extra.join(', ')}`);
        console.warn(`⚠️  ${tableName}: extra columns: ${extra.join(', ')}`);
      }

      if (missing.length === 0 && extra.length === 0) {
        console.log(`✅ ${tableName}: ${actualColumns.length} columns validated`);
      }
    } else {
      // Table exists but is empty - just check if we can select expected columns
      const { error: selectError } = await supabase
        .from(tableName)
        .select(expectedColumns.join(','))
        .limit(0);

      if (selectError) {
        const match = selectError.message.match(/column "?([^"\s]+)"? does not exist/i);
        if (match) {
          const missingCol = match[1];
          result.missingColumns.push({ table: tableName, columns: [missingCol] });
          result.errors.push(`Table '${tableName}' missing column: ${missingCol}`);
          console.error(`❌ ${tableName}: missing column '${missingCol}'`);
        }
      } else {
        console.log(`✅ ${tableName}: schema validated (empty table)`);
      }
    }

  } catch (error: any) {
    result.errors.push(`Error validating table '${tableName}': ${error.message}`);
    console.error(`❌ ${tableName}: validation error:`, error.message);
  }
}

/**
 * Validate a view
 */
async function validateView(
  viewName: string,
  expectedColumns: readonly string[],
  result: ValidationResult
): Promise<void> {
  const supabase = getSupabaseClient();

  try {
    // Try to query the view
    const { data, error } = await supabase
      .from(viewName)
      .select('*')
      .limit(1);

    if (error) {
      if (error.message.includes('does not exist') || error.code === '42P01') {
        result.missingTables.push(viewName);
        result.errors.push(`View '${viewName}' does not exist`);
        console.error(`❌ View missing: ${viewName}`);
        return;
      }

      const match = error.message.match(/column "?([^"\s]+)"? does not exist/i);
      if (match) {
        const missingCol = match[1];
        result.missingColumns.push({ table: viewName, columns: [missingCol] });
        result.errors.push(`View '${viewName}' missing column: ${missingCol}`);
        console.error(`❌ ${viewName}: missing column '${missingCol}'`);
        return;
      }
    }

    if (data && data.length > 0) {
      const actualColumns = Object.keys(data[0]);
      
      const missing = expectedColumns.filter(col => !actualColumns.includes(col));
      if (missing.length > 0) {
        result.missingColumns.push({ table: viewName, columns: missing });
        result.errors.push(`View '${viewName}' missing columns: ${missing.join(', ')}`);
        console.error(`❌ ${viewName}: missing columns: ${missing.join(', ')}`);
      } else {
        console.log(`✅ ${viewName}: view validated`);
      }
    } else {
      // View exists but no data - check expected columns
      const { error: selectError } = await supabase
        .from(viewName)
        .select(expectedColumns.join(','))
        .limit(0);

      if (selectError) {
        const match = selectError.message.match(/column "?([^"\s]+)"? does not exist/i);
        if (match) {
          const missingCol = match[1];
          result.missingColumns.push({ table: viewName, columns: [missingCol] });
          result.errors.push(`View '${viewName}' missing column: ${missingCol}`);
          console.error(`❌ ${viewName}: missing column '${missingCol}'`);
        }
      } else {
        console.log(`✅ ${viewName}: view validated (no data)`);
      }
    }

  } catch (error: any) {
    result.errors.push(`Error validating view '${viewName}': ${error.message}`);
    console.error(`❌ ${viewName}: validation error:`, error.message);
  }
}

/**
 * Get detailed schema report
 */
export async function generateSchemaReport(): Promise<string> {
  const result = await validateDatabaseSchema();
  
  let report = '\n';
  report += '═══════════════════════════════════════════════════════════════\n';
  report += '                    DATABASE SCHEMA REPORT                     \n';
  report += '═══════════════════════════════════════════════════════════════\n\n';

  report += `Status: ${result.valid ? '✅ VALID' : '❌ INVALID'}\n\n`;

  if (result.errors.length > 0) {
    report += '🔴 ERRORS:\n';
    result.errors.forEach(err => report += `   • ${err}\n`);
    report += '\n';
  }

  if (result.warnings.length > 0) {
    report += '⚠️  WARNINGS:\n';
    result.warnings.forEach(warn => report += `   • ${warn}\n`);
    report += '\n';
  }

  if (result.missingTables.length > 0) {
    report += '📋 MISSING TABLES/VIEWS:\n';
    result.missingTables.forEach(table => report += `   • ${table}\n`);
    report += '\n';
  }

  if (result.missingColumns.length > 0) {
    report += '📊 MISSING COLUMNS:\n';
    result.missingColumns.forEach(({ table, columns }) => {
      report += `   • ${table}: ${columns.join(', ')}\n`;
    });
    report += '\n';
  }

  if (result.extraColumns.length > 0) {
    report += '➕ EXTRA COLUMNS (not in expected schema):\n';
    result.extraColumns.forEach(({ table, columns }) => {
      report += `   • ${table}: ${columns.join(', ')}\n`;
    });
    report += '\n';
  }

  report += '═══════════════════════════════════════════════════════════════\n';
  
  return report;
}

/**
 * Throw error if schema is invalid (for use in startup validation)
 */
export async function ensureValidSchema(): Promise<void> {
  const result = await validateDatabaseSchema();
  
  if (!result.valid) {
    const report = await generateSchemaReport();
    console.error(report);
    throw new Error(
      `Database schema validation failed! ` +
      `${result.errors.length} errors, ` +
      `${result.missingTables.length} missing tables, ` +
      `${result.missingColumns.length} missing columns. ` +
      `See log above for details.`
    );
  }
}

