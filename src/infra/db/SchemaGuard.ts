import { Pool } from 'pg';

export interface SchemaValidationResult {
  valid: boolean;
  driftDetected: boolean;
  missingColumns: { table: string; columns: string[] }[];
  tablesFound: Record<string, string[]>;
}

export class SchemaGuard {
  private pool: Pool;
  private lastSchemaCheckAt: Date | null = null;

  // Expected schema definition
  private static readonly REQUIRED_SCHEMA = {
    'tweet_metrics': [
      'tweet_id',
      'collected_at', 
      'likes_count',
      'retweets_count',
      'replies_count',
      'bookmarks_count',
      'impressions_count',
      'content'
    ],
    'learning_posts': [
      'id',
      'created_at',
      'tweet_id',
      'format',
      'topic',
      'viral_potential_score',
      'likes_count',
      'retweets_count', 
      'replies_count',
      'bookmarks_count',
      'impressions_count'
    ]
  };

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /**
   * Probe information_schema for all required columns
   */
  private async probeSchema(): Promise<SchemaValidationResult> {
    const result: SchemaValidationResult = {
      valid: true,
      driftDetected: false,
      missingColumns: [],
      tablesFound: {}
    };

    try {
      // Query information_schema for all columns in our tables
      const query = `
        SELECT table_name, column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name IN ('tweet_metrics', 'learning_posts')
        ORDER BY table_name, ordinal_position;
      `;

      const { rows } = await this.pool.query(query);
      
      // Group columns by table
      const actualSchema: Record<string, string[]> = {};
      for (const row of rows) {
        const tableName = row.table_name;
        if (!actualSchema[tableName]) {
          actualSchema[tableName] = [];
        }
        actualSchema[tableName].push(row.column_name);
      }

      result.tablesFound = actualSchema;

      // Check each required table and its columns
      for (const [tableName, requiredColumns] of Object.entries(SchemaGuard.REQUIRED_SCHEMA)) {
        const actualColumns = actualSchema[tableName] || [];
        const missingColumns = requiredColumns.filter(col => !actualColumns.includes(col));

        if (missingColumns.length > 0) {
          result.valid = false;
          result.driftDetected = true;
          result.missingColumns.push({
            table: tableName,
            columns: missingColumns
          });
        }
      }

      return result;
    } catch (error) {
      console.error('❌ Schema probe failed:', error);
      return {
        valid: false,
        driftDetected: true,
        missingColumns: [{ table: 'probe_error', columns: ['schema_query_failed'] }],
        tablesFound: {}
      };
    }
  }

  /**
   * Force PostgREST to reload its schema cache
   */
  private async reloadPostgRESTCache(): Promise<void> {
    try {
      await this.pool.query("SELECT pg_notify('pgrst', 'reload schema')");
      console.log('🔄 PostgREST schema cache reload triggered');
      
      // Wait for PostgREST to process the notification
      await new Promise(resolve => setTimeout(resolve, 1500));
    } catch (error) {
      console.warn('⚠️ Failed to reload PostgREST cache:', error);
    }
  }

  /**
   * Ensure database schema matches code requirements
   * This is the main entry point called at startup
   */
  public async ensureSchema(): Promise<SchemaValidationResult> {
    console.log('🔍 SCHEMA_GUARD: Probing database schema...');
    
    let result = await this.probeSchema();
    this.lastSchemaCheckAt = new Date();

    if (result.driftDetected) {
      console.warn('⚠️ SCHEMA_DRIFT_DETECTED', {
        missingColumns: result.missingColumns,
        tablesFound: Object.keys(result.tablesFound)
      });

      // Always reload PostgREST cache when drift is detected
      await this.reloadPostgRESTCache();

      // Re-probe after cache reload to see if migrations helped
      result = await this.probeSchema();
      this.lastSchemaCheckAt = new Date();
    } else {
      // Even if no drift, ensure PostgREST cache is fresh at startup
      await this.reloadPostgRESTCache();
    }

    if (result.valid) {
      const columnCounts = Object.entries(result.tablesFound)
        .map(([table, cols]) => `${table}(${cols.length})`)
        .join(', ');
        
      console.log(`✅ DB_SCHEMA_OK - Tables verified: ${columnCounts}`);
    } else {
      console.error('❌ SCHEMA_VALIDATION_FAILED', {
        missingColumns: result.missingColumns,
        suggestion: 'Run migrations or check database connectivity'
      });
    }

    return result;
  }

  /**
   * Get the last schema check timestamp
   */
  public getLastSchemaCheckAt(): Date | null {
    return this.lastSchemaCheckAt;
  }

  /**
   * Quick schema validation without cache reload (for status checks)
   */
  public async validateSchema(): Promise<boolean> {
    const result = await this.probeSchema();
    return result.valid;
  }
}

/**
 * Convenience function for startup integration
 */
export async function ensureSchema(pool: Pool): Promise<SchemaValidationResult> {
  const guard = new SchemaGuard(pool);
  return await guard.ensureSchema();
}
