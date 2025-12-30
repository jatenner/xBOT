import 'dotenv/config';
import pkg from 'pg';
const { Client } = pkg;

async function checkColumn() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  await client.connect();
  
  // Check for structure_type or structural_type columns
  const result = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'content_generation_metadata_comprehensive' 
    AND column_name LIKE '%structure%'
    ORDER BY column_name
  `);
  
  console.log('\n📊 Structure-related columns in content_generation_metadata_comprehensive:');
  if (result.rows.length === 0) {
    console.log('❌ No structure-related columns found!');
  } else {
    result.rows.forEach(row => {
      console.log(`  ✅ ${row.column_name} (${row.data_type})`);
    });
  }
  
  await client.end();
}

checkColumn();

