require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');

async function createTable() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    console.log('🔗 Connecting to Supabase database...\n');
    await client.connect();
    console.log('✅ Connected!\n');

    const sql = fs.readFileSync('create_reply_opportunities_table.sql', 'utf8');
    
    console.log('🔧 Creating reply_opportunities table...\n');
    await client.query(sql);
    console.log('✅ Table created successfully!\n');

    // Verify
    console.log('🔍 Verifying table exists...\n');
    const result = await client.query('SELECT COUNT(*) FROM reply_opportunities');
    console.log('✅ Table verified! Current row count:', result.rows[0].count);
    
    // Check structure
    const structure = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'reply_opportunities'
      ORDER BY ordinal_position
      LIMIT 10
    `);
    
    console.log('\n📊 Table structure (first 10 columns):');
    structure.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type}${col.is_nullable === 'NO' ? ' (required)' : ''}`);
    });

    console.log('\n🎉 SUCCESS! Reply system is now ready to work!\n');
    
    await client.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('\nFull error:', error);
    await client.end();
    process.exit(1);
  }
}

createTable();
