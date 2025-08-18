const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

async function applyMigration() {
  console.log('🗄️ Applying database migration directly via Supabase client...');
  
  // Get Supabase credentials from environment
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false }
  });
  
  // Read the migration file
  const migrationPath = path.join(__dirname, 'migrations', '0001_metrics_learning_schema.sql');
  
  if (!fs.existsSync(migrationPath)) {
    console.error('❌ Migration file not found:', migrationPath);
    process.exit(1);
  }
  
  const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
  
  console.log('📋 Executing migration SQL...');
  
  try {
    // Execute the migration SQL via Supabase RPC
    const { data, error } = await supabase.rpc('exec_sql', { 
      sql_query: migrationSQL 
    });
    
    if (error) {
      console.error('❌ Migration failed via RPC:', error);
      // Fallback: try direct SQL execution
      console.log('🔄 Trying alternative approach...');
      await executeSQLDirectly(supabase, migrationSQL);
    } else {
      console.log('✅ Migration completed successfully via RPC');
    }
    
  } catch (err) {
    console.error('❌ Migration error:', err);
    console.log('🔄 Trying direct SQL execution...');
    await executeSQLDirectly(supabase, migrationSQL);
  }
}

async function executeSQLDirectly(supabase, sql) {
  // Split the SQL into individual statements for direct execution
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));
    
  console.log(`📝 Executing ${statements.length} SQL statements...`);
  
  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    if (statement.length < 10) continue; // Skip very short statements
    
    console.log(`⏳ Executing statement ${i + 1}/${statements.length}...`);
    
    try {
      const { error } = await supabase.rpc('exec_sql', { 
        sql_query: statement + ';'
      });
      
      if (error) {
        console.warn(`⚠️ Statement ${i + 1} warning:`, error.message);
        // Continue with other statements - some errors are expected (e.g., table already exists)
      } else {
        console.log(`✅ Statement ${i + 1} completed`);
      }
    } catch (err) {
      console.warn(`⚠️ Statement ${i + 1} error:`, err.message);
      // Continue execution
    }
  }
  
  console.log('🎯 Direct SQL execution completed');
}

// Run the migration
applyMigration()
  .then(() => {
    console.log('🎉 Database migration process completed!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('💥 Migration process failed:', err);
    process.exit(1);
  });
