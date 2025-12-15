/**
 * Verify Phase 4 Schema
 * 
 * Checks that all Phase 4 columns and views exist
 */

import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

function getPgSSL(connectionString: string) {
  if (connectionString.includes('supabase') || connectionString.includes('sslmode=require') || connectionString.includes('pooler.supabase.com')) {
    return {
      rejectUnauthorized: false
    };
  }
  return undefined;
}

async function verifySchema() {
  console.log('='.repeat(60));
  console.log('PHASE 4 SCHEMA VERIFICATION');
  console.log('='.repeat(60));
  console.log('');

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL not found in environment');
  }

  const cleanUrl = databaseUrl.replace(/[?&]sslmode=[^&]*/g, '');
  const pool = new Pool({
    connectionString: cleanUrl,
    ssl: {
      rejectUnauthorized: false
    },
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000
  });

  try {
    const client = await pool.connect();

    try {
      // Check base table columns
      console.log('1. Checking base table columns...');
      const baseTableQuery = `
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'content_generation_metadata_comprehensive'
          AND column_name IN ('content_slot', 'experiment_group', 'hook_variant')
        ORDER BY column_name;
      `;
      const baseResult = await client.query(baseTableQuery);
      const baseColumns = baseResult.rows.map((r: any) => r.column_name);
      console.log(`   Found: ${baseColumns.join(', ')}`);
      console.log(`   ✅ content_slot: ${baseColumns.includes('content_slot') ? 'YES' : 'NO'}`);
      console.log(`   ✅ experiment_group: ${baseColumns.includes('experiment_group') ? 'YES' : 'NO'}`);
      console.log(`   ✅ hook_variant: ${baseColumns.includes('hook_variant') ? 'YES' : 'NO'}`);
      console.log('');

      // Check content_metadata view columns
      console.log('2. Checking content_metadata VIEW columns...');
      const viewQuery = `
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'content_metadata'
          AND column_name IN ('content_slot', 'experiment_group', 'hook_variant')
        ORDER BY column_name;
      `;
      const viewResult = await client.query(viewQuery);
      const viewColumns = viewResult.rows.map((r: any) => r.column_name);
      console.log(`   Found: ${viewColumns.join(', ')}`);
      console.log(`   ✅ content_slot: ${viewColumns.includes('content_slot') ? 'YES' : 'NO'}`);
      console.log(`   ✅ experiment_group: ${viewColumns.includes('experiment_group') ? 'YES' : 'NO'}`);
      console.log(`   ✅ hook_variant: ${viewColumns.includes('hook_variant') ? 'YES' : 'NO'}`);
      console.log('');

      // Check vw_learning view
      console.log('3. Checking vw_learning VIEW...');
      try {
        const vwQuery = `
          SELECT COUNT(*) AS row_count
          FROM vw_learning
          WHERE posted_at >= NOW() - INTERVAL '3 days';
        `;
        const vwResult = await client.query(vwQuery);
        const vwRows = parseInt(vwResult.rows[0].row_count);
        console.log(`   ✅ vw_learning exists and is queryable`);
        console.log(`   Rows in last 3 days: ${vwRows}`);
      } catch (vwError: any) {
        console.log(`   ❌ vw_learning error: ${vwError.message}`);
      }
      console.log('');

      // Check recent content rows
      console.log('4. Checking recent content rows...');
      const contentQuery = `
        SELECT
          COUNT(*) AS total,
          COUNT(content_slot) AS with_slot,
          COUNT(experiment_group) AS with_experiment,
          COUNT(hook_variant) AS with_variant
        FROM content_metadata
        WHERE created_at >= NOW() - INTERVAL '3 days';
      `;
      const contentResult = await client.query(contentQuery);
      const stats = contentResult.rows[0];
      console.log(`   Total rows (last 3 days): ${stats.total}`);
      console.log(`   With content_slot: ${stats.with_slot}`);
      console.log(`   With experiment_group: ${stats.with_experiment}`);
      console.log(`   With hook_variant: ${stats.with_variant}`);
      console.log('');

      // Sample rows
      const sampleQuery = `
        SELECT
          decision_id,
          content_slot,
          experiment_group,
          hook_variant,
          created_at
        FROM content_metadata
        ORDER BY created_at DESC
        LIMIT 5;
      `;
      const sampleResult = await client.query(sampleQuery);
      console.log('5. Sample rows (last 5):');
      sampleResult.rows.forEach((row: any, i: number) => {
        console.log(`   ${i + 1}. decision_id=${row.decision_id?.substring(0, 8)}...`);
        console.log(`      content_slot=${row.content_slot || 'NULL'}`);
        console.log(`      experiment_group=${row.experiment_group || 'NULL'}`);
        console.log(`      hook_variant=${row.hook_variant || 'NULL'}`);
        console.log(`      created_at=${row.created_at}`);
        console.log('');
      });

      console.log('='.repeat(60));
      console.log('VERIFICATION COMPLETE');
      console.log('='.repeat(60));

    } finally {
      client.release();
    }

  } catch (error: any) {
    console.error('❌ Verification failed:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

verifySchema().catch(console.error);

