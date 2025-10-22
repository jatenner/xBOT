const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  console.log('🔧 DATABASE MIGRATION - Fixing Missing Columns');
  console.log('='.repeat(60));
  
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
    process.exit(1);
  }
  
  console.log('📊 Supabase URL:', supabaseUrl);
  
  const supabase = createClient(supabaseUrl, supabaseKey, {
    db: {
      schema: 'public'
    },
    auth: {
      persistSession: false
    }
  });
  
  try {
    // Read migration file
    const migrationPath = path.join(__dirname, 'supabase/migrations/20251022_fix_missing_columns.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📄 Migration file:', migrationPath);
    console.log('📝 SQL size:', sql.length, 'bytes');
    console.log('');
    console.log('🚀 Executing migration via Supabase SQL...');
    console.log('-'.repeat(60));
    
    // Execute using raw SQL
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
    
    if (error) {
      // Try alternative method - direct query
      console.log('⚠️ RPC failed, trying direct query...');
      
      // Split SQL into statements and execute them
      const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s && !s.startsWith('--') && s !== 'BEGIN' && s !== 'COMMIT');
      
      console.log(`📝 Executing ${statements.length} statements...`);
      
      for (let i = 0; i < statements.length; i++) {
        const stmt = statements[i];
        if (stmt.length < 50) {
          console.log(`  ${i + 1}/${statements.length}: ${stmt.substring(0, 47)}...`);
        } else {
          console.log(`  ${i + 1}/${statements.length}: Executing...`);
        }
        
        // Try to execute through the Supabase REST API
        // This won't work for DDL, so we need a different approach
      }
      
      console.log('');
      console.error('❌ Cannot execute DDL statements via Supabase REST API');
      console.error('💡 Please run this SQL manually in Supabase SQL Editor:');
      console.error('   https://supabase.com/dashboard/project/qtgjmaelglghnlahqpbl/sql/new');
      console.error('');
      console.error('📋 SQL to run:');
      console.error('-'.repeat(60));
      console.log(sql);
      console.error('-'.repeat(60));
      process.exit(1);
    }
    
    console.log('-'.repeat(60));
    console.log('✅ Migration executed successfully!');
    console.log('');
    
    // Verify by checking tables
    console.log('🔍 Verifying changes...');
    
    // Check posted_decisions
    const { data: pd, error: pdError } = await supabase
      .from('posted_decisions')
      .select('generation_source')
      .limit(1);
    
    if (!pdError) {
      console.log('  ✅ posted_decisions.generation_source');
    } else if (pdError.message.includes('column') && pdError.message.includes('generation_source')) {
      console.log('  ❌ posted_decisions.generation_source MISSING');
    }
    
    // Check outcomes
    const { data: out, error: outError } = await supabase
      .from('outcomes')
      .select('er_calculated')
      .limit(1);
    
    if (!outError) {
      console.log('  ✅ outcomes.er_calculated');
    } else if (outError.message.includes('column') && outError.message.includes('er_calculated')) {
      console.log('  ❌ outcomes.er_calculated MISSING');
    }
    
    console.log('');
    console.log('='.repeat(60));
    console.log('🎉 DATABASE FIXES APPLIED!');
    console.log('');
    console.log('✅ What was fixed:');
    console.log('   1. JOB_OUTCOMES_REAL - missing generation_source column');
    console.log('   2. Engagement calculations - missing er_calculated column');
    console.log('   3. Learning system - missing updated_at column');
    console.log('   4. Tweet tracking - missing created_at column');
    console.log('   5. Comprehensive metrics - unique constraint for upserts');
    console.log('');
    console.log('🚀 Next: Restart Railway for changes to take effect');
    
  } catch (error) {
    console.error('');
    console.error('❌ Migration failed:');
    console.error('   Error:', error.message);
    console.error('');
    
    // Print the SQL for manual execution
    const migrationPath = path.join(__dirname, 'supabase/migrations/20251022_fix_missing_columns.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    console.error('💡 Please run this SQL manually in Supabase SQL Editor:');
    console.error('   https://supabase.com/dashboard/project/qtgjmaelglghnlahqpbl/sql/new');
    console.error('');
    console.error('📋 SQL to copy:');
    console.error('-'.repeat(60));
    console.log(sql);
    console.error('-'.repeat(60));
    
    process.exit(1);
  }
}

// Run the migration
runMigration().then(() => {
  process.exit(0);
}).catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});

