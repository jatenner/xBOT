import 'dotenv/config';
import pg from 'pg';

async function checkSchema() {
  const client = new pg.Client({ 
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  
  console.log('Checking system_events actual schema...\n');
  
  const result = await client.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'system_events'
    ORDER BY ordinal_position;
  `);
  
  console.log('Columns in system_events:');
  result.rows.forEach(row => {
    console.log(`  - ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
  });
  
  await client.end();
}

checkSchema().catch(console.error);
