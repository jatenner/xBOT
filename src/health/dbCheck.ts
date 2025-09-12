/**
 * Database health check utility
 * Performs a smoke test insert into api_usage table
 */

import { pgPool, query } from '../db/pg';

/**
 * Run a health check on the database connection
 * Performs a simple insert and delete to verify write access
 */
export async function checkDatabaseHealth(): Promise<{ 
  healthy: boolean; 
  message: string;
  details?: any;
}> {
  try {
    // Simple connectivity test
    const client = await pgPool.connect();
    await client.query('SELECT 1');
    client.release();
    
    // Smoke test insert and delete
    try {
      const result = await query(`
        INSERT INTO api_usage (provider, model, cost_usd, tokens_in, tokens_out)
        VALUES ('health-check', 'test', 0, 0, 0)
        RETURNING id
      `);
      
      if (result.rows && result.rows.length > 0) {
        const testId = result.rows[0].id;
        await query('DELETE FROM api_usage WHERE id = $1', [testId]);
        console.log('✅ DB_HEALTH_CHECK: Smoke test insert/delete successful');
        
        return {
          healthy: true,
          message: 'Database connection healthy with write access'
        };
      } else {
        return {
          healthy: false,
          message: 'Database insert test failed - no rows returned'
        };
      }
    } catch (insertError: any) {
      // If table doesn't exist yet, that's okay - migrations will create it
      if (insertError.code === '42P01') { // undefined_table
        console.log('⚠️ DB_HEALTH_CHECK: api_usage table not found (migrations pending)');
        return {
          healthy: true,
          message: 'Database connected but api_usage table not found (migrations pending)'
        };
      }
      
      return {
        healthy: false,
        message: `Database insert test failed: ${insertError.message}`,
        details: {
          code: insertError.code,
          error: insertError.message
        }
      };
    }
  } catch (error: any) {
    console.error(`❌ DB_HEALTH_CHECK: Failed - ${error.code || 'UNKNOWN'}: ${error.message}`);
    
    return {
      healthy: false,
      message: `Database connection failed: ${error.message}`,
      details: {
        code: error.code,
        error: error.message
      }
    };
  }
}

/**
 * Run database health check on startup
 */
export function runStartupHealthCheck(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(async () => {
      try {
        const health = await checkDatabaseHealth();
        
        if (health.healthy) {
          console.log('✅ STARTUP_DB_CHECK: Database connection healthy');
        } else {
          console.warn(`⚠️ STARTUP_DB_CHECK: ${health.message}`);
        }
      } catch (error) {
        console.error('❌ STARTUP_DB_CHECK: Failed to run health check', error);
      }
      
      resolve();
    }, 2000); // Wait 2 seconds after app start
  });
}
