#!/usr/bin/env node

/**
 * 🔍 COMPREHENSIVE DATABASE SCHEMA DIAGNOSIS
 * 
 * This script will thoroughly examine your current Supabase database
 * to understand exactly what exists and what's missing.
 */

const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function diagnoseDatabaseSchema() {
  try {
    console.log('🔍 COMPREHENSIVE DATABASE SCHEMA DIAGNOSIS');
    console.log('=' .repeat(70));
    console.log(`🔗 Connected to: ${supabaseUrl}`);
    console.log('');

    // 1. Get all tables in the public schema
    console.log('📊 EXISTING TABLES IN PUBLIC SCHEMA:');
    console.log('-' .repeat(50));
    
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name, table_type')
      .eq('table_schema', 'public')
      .order('table_name');

    if (tablesError) {
      console.error('❌ Could not fetch tables:', tablesError.message);
      return;
    }

    if (!tables || tables.length === 0) {
      console.log('⚠️  No tables found in public schema!');
    } else {
      tables.forEach((table, index) => {
        console.log(`${index + 1}. ${table.table_name} (${table.table_type})`);
      });
    }

    console.log(`\n✅ Total tables found: ${tables.length}\n`);

    // 2. Look for core bot-related tables
    console.log('🤖 LOOKING FOR CORE BOT TABLES:');
    console.log('-' .repeat(50));
    
    const expectedTables = [
      'posts', 'tweets', 'bot_posts', 'learning_posts',
      'contextual_bandit_arms', 'contextual_bandit_history',
      'enhanced_timing_stats', 'engagement_metrics',
      'budget_optimization_log', 'content_generation_sessions'
    ];

    const existingTableNames = tables.map(t => t.table_name);
    
    expectedTables.forEach(tableName => {
      const exists = existingTableNames.includes(tableName);
      console.log(`${exists ? '✅' : '❌'} ${tableName} ${exists ? 'EXISTS' : 'MISSING'}`);
    });

    // 3. Get detailed schema for existing bot-related tables
    console.log('\n📋 DETAILED SCHEMA FOR EXISTING TABLES:');
    console.log('-' .repeat(50));

    for (const table of tables.filter(t => 
      t.table_name.includes('post') || 
      t.table_name.includes('tweet') || 
      t.table_name.includes('bot') ||
      t.table_name.includes('bandit') ||
      t.table_name.includes('learning') ||
      t.table_name.includes('engagement')
    )) {
      console.log(`\n🔍 Table: ${table.table_name}`);
      
      // Get columns for this table
      const { data: columns, error: columnsError } = await supabase
        .from('information_schema.columns')
        .select('column_name, data_type, is_nullable, column_default')
        .eq('table_schema', 'public')
        .eq('table_name', table.table_name)
        .order('ordinal_position');

      if (columnsError) {
        console.log(`   ❌ Could not fetch columns: ${columnsError.message}`);
        continue;
      }

      if (columns && columns.length > 0) {
        columns.forEach(col => {
          const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
          const defaultVal = col.column_default ? ` DEFAULT ${col.column_default}` : '';
          console.log(`   - ${col.column_name}: ${col.data_type} ${nullable}${defaultVal}`);
        });
        
        // Get row count
        try {
          const { count, error: countError } = await supabase
            .from(table.table_name)
            .select('*', { count: 'exact', head: true });
            
          if (!countError) {
            console.log(`   📊 Row count: ${count}`);
          }
        } catch (err) {
          console.log(`   📊 Row count: Could not determine`);
        }
      } else {
        console.log(`   ⚠️  No columns found`);
      }
    }

    // 4. Check for existing functions
    console.log('\n🔧 EXISTING FUNCTIONS:');
    console.log('-' .repeat(50));
    
    const { data: functions, error: functionsError } = await supabase
      .from('information_schema.routines')
      .select('routine_name, routine_type')
      .eq('routine_schema', 'public')
      .order('routine_name');

    if (functionsError) {
      console.log('❌ Could not fetch functions:', functionsError.message);
    } else if (functions && functions.length > 0) {
      functions.forEach((func, index) => {
        console.log(`${index + 1}. ${func.routine_name} (${func.routine_type})`);
      });
      console.log(`\n✅ Total functions found: ${functions.length}`);
    } else {
      console.log('⚠️  No custom functions found');
    }

    // 5. Check for constraints and indexes
    console.log('\n🔒 TABLE CONSTRAINTS:');
    console.log('-' .repeat(50));
    
    const { data: constraints, error: constraintsError } = await supabase
      .from('information_schema.table_constraints')
      .select('table_name, constraint_name, constraint_type')
      .eq('table_schema', 'public')
      .order('table_name');

    if (constraintsError) {
      console.log('❌ Could not fetch constraints:', constraintsError.message);
    } else if (constraints && constraints.length > 0) {
      const constraintsByTable = {};
      constraints.forEach(constraint => {
        if (!constraintsByTable[constraint.table_name]) {
          constraintsByTable[constraint.table_name] = [];
        }
        constraintsByTable[constraint.table_name].push(constraint);
      });

      Object.keys(constraintsByTable).forEach(tableName => {
        console.log(`\n📋 ${tableName}:`);
        constraintsByTable[tableName].forEach(constraint => {
          console.log(`   - ${constraint.constraint_name}: ${constraint.constraint_type}`);
        });
      });
    } else {
      console.log('⚠️  No constraints found');
    }

    // 6. Test database connectivity and permissions
    console.log('\n🧪 DATABASE CONNECTIVITY TESTS:');
    console.log('-' .repeat(50));
    
    try {
      // Test basic read
      const { data: testRead, error: readError } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .limit(1);
        
      console.log(`✅ READ access: ${readError ? 'FAILED - ' + readError.message : 'OK'}`);
      
      // Test if we can create a simple table
      const testTableSQL = `
        CREATE TABLE IF NOT EXISTS test_table_temp (
          id SERIAL PRIMARY KEY,
          test_column TEXT
        );
        DROP TABLE IF EXISTS test_table_temp;
      `;
      
      // Note: We can't test this with RPC since exec doesn't exist
      console.log(`⚠️  WRITE access: Cannot test (no exec function available)`);
      
    } catch (err) {
      console.log(`❌ Connectivity test failed: ${err.message}`);
    }

    // 7. Recommendations
    console.log('\n💡 RECOMMENDATIONS:');
    console.log('-' .repeat(50));
    
    const recommendations = [];
    
    if (!existingTableNames.includes('posts') && !existingTableNames.includes('tweets') && !existingTableNames.includes('bot_posts')) {
      recommendations.push('🔴 CRITICAL: No main posts/tweets table found. Need to create core posting table.');
    }
    
    if (!existingTableNames.includes('contextual_bandit_arms')) {
      recommendations.push('🟡 Missing: Bandit learning system tables for content optimization.');
    }
    
    if (!existingTableNames.includes('enhanced_timing_stats')) {
      recommendations.push('🟡 Missing: Timing optimization tables for posting schedule learning.');
    }
    
    if (functions.length === 0) {
      recommendations.push('🟡 Missing: Custom database functions for analytics and learning.');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('✅ Database structure looks good for enhanced learning system!');
    }
    
    recommendations.forEach(rec => console.log(rec));

    console.log('\n🎯 NEXT STEPS:');
    console.log('-' .repeat(50));
    console.log('1. Based on the diagnosis above, we can now create the correct SQL');
    console.log('2. We\'ll use the actual table names that exist in your database');
    console.log('3. We\'ll avoid any conflicting constraints or missing references');
    console.log('4. We\'ll create a targeted migration that works with your specific schema');

    console.log('\n' + '=' .repeat(70));
    console.log('🔍 DIAGNOSIS COMPLETE');
    console.log('=' .repeat(70));

    return {
      tables: existingTableNames,
      functions: functions?.map(f => f.routine_name) || [],
      hasPostsTable: existingTableNames.includes('posts'),
      hasTweetsTable: existingTableNames.includes('tweets'),
      hasBotPostsTable: existingTableNames.includes('bot_posts'),
      hasLearningTables: existingTableNames.some(name => name.includes('learning') || name.includes('bandit'))
    };

  } catch (error) {
    console.error('❌ Diagnosis failed:', error);
    console.error('Stack trace:', error.stack);
    return null;
  }
}

// Run the diagnosis
if (require.main === module) {
  diagnoseDatabaseSchema()
    .then(result => {
      if (result) {
        console.log('\n🚀 Ready to create targeted SQL migration based on findings!');
        process.exit(0);
      } else {
        console.log('\n❌ Diagnosis failed. Please check connection and permissions.');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('❌ Unexpected error:', error);
      process.exit(1);
    });
}

module.exports = { diagnoseDatabaseSchema }; 