const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function applyMigrations() {
  console.log('🔧 APPLYING ALL MIGRATIONS TO PRODUCTION DATABASE\n');
  
  const migrationsDir = path.join(__dirname, 'supabase', 'migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();
  
  console.log(`📋 Found ${files.length} migration files\n`);
  
  for (const file of files) {
    console.log(`📄 Applying: ${file}`);
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    
    try {
      // Execute the SQL
      const { error } = await supabase.rpc('exec_sql', { sql_query: sql }).catch(() => ({ error: 'rpc not available' }));
      
      // If RPC doesn't work, try direct query (won't work for DDL but let's try)
      if (error === 'rpc not available') {
        // We need to use a proper postgres client for DDL
        console.log('   ⚠️  Needs manual application (DDL statements)');
      } else if (error) {
        console.log(`   ❌ Error: ${error.message}`);
      } else {
        console.log('   ✅ Applied successfully');
      }
    } catch (err) {
      console.log(`   ⚠️  ${err.message}`);
    }
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('⚠️  Supabase JS client cannot run DDL statements directly');
  console.log('💡 You need to either:');
  console.log('   1. Run migrations via Supabase Dashboard SQL Editor');
  console.log('   2. Use: supabase link --project-ref YOUR_PROJECT_REF');
  console.log('   3. Apply manually via psql');
  console.log('='.repeat(70) + '\n');
}

applyMigrations().then(() => process.exit(0)).catch(console.error);
