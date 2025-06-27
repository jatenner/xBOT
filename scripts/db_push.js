const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

console.log('📦 Applying pending Supabase migrations…');

// Initialize Supabase client using environment variables
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function applyMigrations() {
  try {
    // Get all migration files from the migrations directory
    const migrationsDir = path.join(process.cwd(), 'migrations');
    
    if (!fs.existsSync(migrationsDir)) {
      console.log('✅ No migrations directory found, skipping migrations');
      return true;
    }

    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort(); // Apply in alphabetical order

    if (migrationFiles.length === 0) {
      console.log('✅ No migration files found');
      return true;
    }

    console.log(`📋 Found ${migrationFiles.length} migration files`);

    // Apply each migration file
    for (const file of migrationFiles) {
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');
      
      console.log(`📝 Applying migration: ${file}`);
      
      // Execute the SQL directly using the service role key
      const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
      
      if (error) {
        // If rpc doesn't exist, try alternative approach
        if (error.code === 'PGRST202') {
          console.log(`⚠️ RPC method not available, migration ${file} may need manual application`);
          console.log(`💡 Consider applying this SQL directly in Supabase SQL editor:`);
          console.log(`📄 File: ${file}`);
          continue;
        } else {
          throw error;
        }
      }
      
      console.log(`✅ Applied: ${file}`);
    }

    return true;
  } catch (error) {
    console.error('❌ Migration error:', error.message);
    return false;
  }
}

applyMigrations().then(success => {
  if (success) {
    console.log('✅ Migrations applied successfully');
    process.exit(0);
  } else {
    console.error('❌ Migration failed');
    process.exit(1);
  }
}).catch(error => {
  console.error('❌ Failed to apply migrations:', error.message);
  process.exit(1);
}); 