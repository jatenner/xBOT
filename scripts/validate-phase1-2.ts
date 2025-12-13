#!/usr/bin/env tsx
/**
 * Validate Phase 1 & 2 deployment in production
 */

import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

function getPgSSL(connectionString: string) {
  if (connectionString.includes('supabase') || connectionString.includes('pooler') || connectionString.includes('sslmode')) {
    return { rejectUnauthorized: false };
  }
  return undefined;
}

async function validate() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL not found in environment');
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: getPgSSL(databaseUrl),
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000
  });

  console.log('🔍 Validating Phase 1 & 2 Deployment...\n');

  try {
    // 1. Check content_metadata schema
    console.log('1️⃣ Checking content_metadata schema...');
    const schemaCheck = await pool.query(`
      SELECT table_type, table_schema
      FROM information_schema.tables 
      WHERE table_name = 'content_metadata'
    `);
    
    if (schemaCheck.rows.length === 0) {
      console.log('   ❌ content_metadata not found');
    } else {
      const row = schemaCheck.rows[0];
      console.log(`   ✅ Found: ${row.table_type} in schema ${row.table_schema}`);
      
      if (row.table_type === 'VIEW') {
        console.log('   ⚠️  content_metadata is a VIEW - need to find underlying table');
        // Try to find underlying table
        const viewDef = await pool.query(`
          SELECT view_definition 
          FROM information_schema.views 
          WHERE table_name = 'content_metadata'
        `);
        if (viewDef.rows.length > 0) {
          console.log('   📋 View definition preview:', viewDef.rows[0].view_definition.substring(0, 200));
        }
      }
    }

    // 2. Check if content_slot column exists
    console.log('\n2️⃣ Checking content_slot column...');
    const columnCheck = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'content_metadata' 
        AND column_name = 'content_slot'
    `);
    
    if (columnCheck.rows.length === 0) {
      console.log('   ❌ content_slot column does NOT exist');
      console.log('   ⚠️  Migration needs to be applied manually');
    } else {
      console.log('   ✅ content_slot column exists:', columnCheck.rows[0]);
    }

    // 3. Check v2 outcomes fields
    console.log('\n3️⃣ Checking v2 outcomes fields...');
    const outcomesFields = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns 
      WHERE table_name = 'outcomes' 
        AND column_name IN ('followers_gained_weighted', 'primary_objective_score', 'hook_type', 'cta_type', 'structure_type')
      ORDER BY column_name
    `);
    
    console.log(`   Found ${outcomesFields.rows.length}/5 v2 fields:`);
    outcomesFields.rows.forEach(row => {
      console.log(`   ✅ ${row.column_name} (${row.data_type})`);
    });
    
    if (outcomesFields.rows.length < 5) {
      const missing = ['followers_gained_weighted', 'primary_objective_score', 'hook_type', 'cta_type', 'structure_type']
        .filter(field => !outcomesFields.rows.some(r => r.column_name === field));
      console.log(`   ⚠️  Missing fields: ${missing.join(', ')}`);
    }

    // 4. Check if v2 metrics are being calculated
    console.log('\n4️⃣ Checking v2 metrics data...');
    const v2MetricsCheck = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(followers_gained_weighted) as has_weighted,
        COUNT(primary_objective_score) as has_score,
        MAX(collected_at) as latest_collection
      FROM outcomes
      WHERE collected_at > NOW() - INTERVAL '7 days'
    `);
    
    if (v2MetricsCheck.rows.length > 0) {
      const stats = v2MetricsCheck.rows[0];
      console.log(`   📊 Last 7 days:`);
      console.log(`      Total outcomes: ${stats.total}`);
      console.log(`      With weighted followers: ${stats.has_weighted}`);
      console.log(`      With primary score: ${stats.has_score}`);
      console.log(`      Latest collection: ${stats.latest_collection || 'N/A'}`);
      
      if (parseInt(stats.has_weighted) > 0 || parseInt(stats.has_score) > 0) {
        console.log('   ✅ v2 metrics are being calculated!');
      } else {
        console.log('   ⚠️  v2 metrics not yet populated (may need to wait for metricsScraperJob to run)');
      }
    }

    // 5. Check vw_learning view
    console.log('\n5️⃣ Checking vw_learning view...');
    const viewCheck = await pool.query(`
      SELECT table_type
      FROM information_schema.tables 
      WHERE table_name = 'vw_learning'
    `);
    
    if (viewCheck.rows.length === 0) {
      console.log('   ❌ vw_learning view does NOT exist');
      console.log('   ⚠️  Need to apply migration: 20251205_create_vw_learning.sql');
    } else {
      console.log('   ✅ vw_learning view exists');
      
      // Try to query it
      try {
        const sampleQuery = await pool.query('SELECT COUNT(*) as count FROM vw_learning LIMIT 1');
        console.log(`   ✅ View is queryable: ${sampleQuery.rows[0]?.count || 0} rows`);
      } catch (error: any) {
        console.log(`   ⚠️  View exists but query failed: ${error.message}`);
      }
    }

    // 6. Check learning_model_weights table
    console.log('\n6️⃣ Checking learning_model_weights table...');
    const weightsTableCheck = await pool.query(`
      SELECT table_type
      FROM information_schema.tables 
      WHERE table_name = 'learning_model_weights'
    `);
    
    if (weightsTableCheck.rows.length === 0) {
      console.log('   ❌ learning_model_weights table does NOT exist');
    } else {
      console.log('   ✅ learning_model_weights table exists');
      
      const weightsCount = await pool.query(`
        SELECT COUNT(*) as count, MAX(computed_at) as latest
        FROM learning_model_weights
      `);
      
      if (weightsCount.rows.length > 0) {
        const stats = weightsCount.rows[0];
        console.log(`   📊 Weight maps: ${stats.count} total`);
        console.log(`   📅 Latest computation: ${stats.latest || 'N/A'}`);
        
        if (parseInt(stats.count) > 0) {
          console.log('   ✅ Weight maps are being generated!');
        } else {
          console.log('   ⚠️  No weight maps yet (offlineWeightMapJob may need to run)');
        }
      }
    }

    // 7. Check content slots in recent content
    console.log('\n7️⃣ Checking content slots in recent content...');
    const contentSlotsCheck = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(content_slot) as has_slot,
        COUNT(DISTINCT content_slot) as unique_slots,
        MAX(created_at) as latest_creation
      FROM content_metadata
      WHERE created_at > NOW() - INTERVAL '7 days'
    `);
    
    if (contentSlotsCheck.rows.length > 0) {
      const stats = contentSlotsCheck.rows[0];
      console.log(`   📊 Last 7 days:`);
      console.log(`      Total content: ${stats.total}`);
      console.log(`      With content_slot: ${stats.has_slot}`);
      console.log(`      Unique slots: ${stats.unique_slots}`);
      console.log(`      Latest creation: ${stats.latest_creation || 'N/A'}`);
      
      if (parseInt(stats.has_slot) > 0) {
        console.log('   ✅ Content slots are being populated!');
        
        // Show slot distribution
        const slotDist = await pool.query(`
          SELECT content_slot, COUNT(*) as count
          FROM content_metadata
          WHERE created_at > NOW() - INTERVAL '7 days'
            AND content_slot IS NOT NULL
          GROUP BY content_slot
          ORDER BY count DESC
          LIMIT 10
        `);
        
        if (slotDist.rows.length > 0) {
          console.log('   📊 Slot distribution:');
          slotDist.rows.forEach(row => {
            console.log(`      ${row.content_slot}: ${row.count}`);
          });
        }
      } else {
        console.log('   ⚠️  Content slots not yet populated (may need to wait for planJob to run)');
      }
    }

    // 8. Check medical safety guard logs
    console.log('\n8️⃣ Checking medical safety guard activity...');
    const safetyCheck = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN severity = 'error' THEN 1 END) as errors,
        COUNT(CASE WHEN severity = 'warning' THEN 1 END) as warnings,
        MAX(created_at) as latest_event
      FROM system_events
      WHERE event_type = 'medical_safety_check'
        AND created_at > NOW() - INTERVAL '7 days'
    `);
    
    if (safetyCheck.rows.length > 0) {
      const stats = safetyCheck.rows[0];
      console.log(`   📊 Last 7 days:`);
      console.log(`      Total events: ${stats.total}`);
      console.log(`      Errors: ${stats.errors}`);
      console.log(`      Warnings: ${stats.warnings}`);
      console.log(`      Latest event: ${stats.latest_event || 'N/A'}`);
      
      if (parseInt(stats.total) > 0) {
        console.log('   ✅ Medical safety guard is active!');
      } else {
        console.log('   ⚠️  No safety events yet (may need to wait for planJob to generate content)');
      }
    }

    console.log('\n✅ Validation complete!\n');

  } catch (error: any) {
    console.error('❌ Validation error:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

validate().catch(error => {
  console.error('❌ Validation failed:', error);
  process.exit(1);
});

