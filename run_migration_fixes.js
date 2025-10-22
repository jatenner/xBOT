/**
 * Run migration fixes directly using DATABASE_URL
 */

require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');

async function runMigrationFixes() {
  console.log('🔧 Running migration fixes...');
  
  // CRITICAL: Bypass SSL verification (same as working migrations)
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  
  // Use DATABASE_URL from .env
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL not found in .env file');
    process.exit(1);
  }
  
  console.log(`📊 Connecting to database...`);
  console.log(`🔓 SSL verification: DISABLED (bypassing certificate chain issues)`);
  
  const client = new Client({
    connectionString: databaseUrl,
    ssl: {
      rejectUnauthorized: false // This alone doesn't work - need NODE_TLS_REJECT_UNAUTHORIZED too
    }
  });
  
  try {
    await client.connect();
    console.log('✅ Connected to database');
    
    // Read the SQL file
    const sql = fs.readFileSync('fix_migration_issues.sql', 'utf8');
    
    console.log('📝 Executing migration fixes...');
    
    // Execute the SQL
    await client.query(sql);
    
    console.log('✅ Migration fixes completed successfully!');
    
    // Verify the view exists
    const viewCheck = await client.query(`
      SELECT COUNT(*) as count 
      FROM information_schema.views 
      WHERE table_name = 'content_with_outcomes'
    `);
    
    if (viewCheck.rows[0].count > 0) {
      console.log('✅ content_with_outcomes view created');
      
      // Get count of rows in view
      const viewCount = await client.query('SELECT COUNT(*) FROM content_with_outcomes');
      console.log(`📊 View contains ${viewCount.rows[0].count} records`);
    } else {
      console.log('❌ content_with_outcomes view not found');
    }
    
    // Verify the constraint
    const constraintCheck = await client.query(`
      SELECT COUNT(*) as count 
      FROM information_schema.table_constraints 
      WHERE constraint_name = 'content_violations_violation_type_check'
      AND table_name = 'content_violations'
    `);
    
    if (constraintCheck.rows[0].count > 0) {
      console.log('✅ content_violations constraint updated');
    } else {
      console.log('❌ content_violations constraint not found');
    }
    
  } catch (error) {
    console.error('❌ Migration fixes failed:', error.message);
    console.error('Error details:', error);
    process.exit(1);
  } finally {
    await client.end();
    console.log('🔌 Database connection closed');
  }
}

runMigrationFixes();

