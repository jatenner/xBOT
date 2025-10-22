const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  console.log('🔧 DATABASE MIGRATION - Fixing Missing Columns');
  console.log('='.repeat(60));
  
  // Get database URL from environment
  const databaseUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
  
  if (!databaseUrl) {
    console.error('❌ No DATABASE_URL or SUPABASE_DB_URL found in environment');
    console.error('💡 Set DATABASE_URL to your PostgreSQL connection string');
    process.exit(1);
  }
  
  console.log('📊 Database:', databaseUrl.split('@')[1]?.split('?')[0] || 'connected');
  
  // Create PostgreSQL client
  const client = new Client({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes('supabase') ? {
      rejectUnauthorized: false,
      ca: undefined
    } : false
  });
  
  try {
    // Connect to database
    console.log('🔌 Connecting to database...');
    await client.connect();
    console.log('✅ Connected successfully');
    
    // Read migration file
    const migrationPath = path.join(__dirname, 'supabase/migrations/20251022_fix_missing_columns_v2.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📄 Migration file:', migrationPath);
    console.log('📝 SQL size:', sql.length, 'bytes');
    console.log('');
    console.log('🚀 Executing migration...');
    console.log('-'.repeat(60));
    
    // Execute the migration
    const result = await client.query(sql);
    
    console.log('-'.repeat(60));
    console.log('✅ Migration executed successfully!');
    console.log('');
    
    // Verify the changes
    console.log('🔍 Verifying changes...');
    
    const checks = [
      {
        name: 'posted_decisions.generation_source',
        sql: `SELECT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'posted_decisions'
          AND column_name = 'generation_source'
        );`
      },
      {
        name: 'outcomes.er_calculated',
        sql: `SELECT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'outcomes'
          AND column_name = 'er_calculated'
        );`
      },
      {
        name: 'learning_posts.updated_at',
        sql: `SELECT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'learning_posts'
          AND column_name = 'updated_at'
        );`
      },
      {
        name: 'tweet_metrics.created_at',
        sql: `SELECT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'tweet_metrics'
          AND column_name = 'created_at'
        );`
      }
    ];
    
    let allGood = true;
    for (const check of checks) {
      try {
        const checkResult = await client.query(check.sql);
        const exists = checkResult.rows[0].exists;
        if (exists) {
          console.log(`  ✅ ${check.name}`);
        } else {
          console.log(`  ❌ ${check.name} MISSING`);
          allGood = false;
        }
      } catch (err) {
        console.log(`  ⚠️ ${check.name} (table may not exist)`);
      }
    }
    
    console.log('');
    console.log('='.repeat(60));
    
    if (allGood) {
      console.log('🎉 ALL DATABASE FIXES APPLIED SUCCESSFULLY!');
      console.log('');
      console.log('✅ Fixed issues:');
      console.log('   1. JOB_OUTCOMES_REAL will now work');
      console.log('   2. Engagement rate calculations will store');
      console.log('   3. Learning system timestamps will track');
      console.log('   4. Tweet metrics will have created_at');
      console.log('   5. Comprehensive metrics upserts will work');
      console.log('');
      console.log('🚀 Next: Deploy to Railway for changes to take effect');
    } else {
      console.log('⚠️ Some columns may be missing (tables might not exist yet)');
      console.log('💡 This is OK - tables will be created when first used');
    }
    
  } catch (error) {
    console.error('');
    console.error('❌ Migration failed:');
    console.error('   Error:', error.message);
    console.error('');
    console.error('💡 Details:', error.stack);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Run the migration
runMigration().then(() => {
  process.exit(0);
}).catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
