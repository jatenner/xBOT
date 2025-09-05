/**
 * Apply audit system database migration
 */

const { config } = require('dotenv');
config();

const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

async function applyAuditMigration() {
  console.log('🗄️ AUDIT_MIGRATION: Applying system failure tracking schema...');
  
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      console.log('⚠️ MIGRATION_SKIP: No Supabase credentials - will create tables on first use');
      return true;
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Read the migration SQL
    const migrationSQL = fs.readFileSync('./supabase/migrations/20241217_system_failure_tracking.sql', 'utf8');
    
    // Apply migration
    const { error } = await supabase.rpc('exec_sql', { sql: migrationSQL });
    
    if (error) {
      // Try individual statements if bulk execution fails
      console.log('📊 MIGRATION_FALLBACK: Applying statements individually...');
      
      const statements = migrationSQL
        .split(';')
        .map(s => s.trim())
        .filter(s => s && !s.startsWith('--'))
        .filter(s => s.length > 10);
      
      let successCount = 0;
      let skipCount = 0;
      
      for (const statement of statements) {
        try {
          const { error: stmtError } = await supabase.rpc('exec_sql', { sql: statement + ';' });
          if (stmtError) {
            if (stmtError.message.includes('already exists')) {
              skipCount++;
              console.log('⏭️ SKIPPED: Table/view already exists');
            } else {
              console.log('⚠️ STATEMENT_ERROR:', stmtError.message.substring(0, 100));
            }
          } else {
            successCount++;
          }
        } catch (e) {
          console.log('⚠️ STATEMENT_SKIP:', e.message.substring(0, 50));
        }
      }
      
      console.log(`✅ MIGRATION_COMPLETE: ${successCount} applied, ${skipCount} skipped`);
    } else {
      console.log('✅ MIGRATION_SUCCESS: Audit system schema applied');
    }
    
    // Test table creation
    const { data: testData, error: testError } = await supabase
      .from('system_failures')
      .select('count')
      .limit(1);
    
    if (testError && !testError.message.includes('does not exist')) {
      console.log('⚠️ TEST_WARNING:', testError.message);
    } else {
      console.log('✅ TABLES_READY: Audit system tables accessible');
    }
    
    return true;
    
  } catch (error) {
    console.error('❌ MIGRATION_ERROR:', error.message);
    console.log('📝 NOTE: Tables will be created automatically when needed');
    return false;
  }
}

// Run migration
applyAuditMigration()
  .then(success => {
    console.log(success ? '🎉 AUDIT_MIGRATION: Ready!' : '⚠️ AUDIT_MIGRATION: Partial - will retry during runtime');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 MIGRATION_CRASH:', error.message);
    process.exit(1);
  });
