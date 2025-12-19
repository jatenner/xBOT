import 'dotenv/config';
import pg from 'pg';

async function findBase() {
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  await client.connect();
  
  // Check if content_metadata is a view
  const viewCheck = await client.query(`
    SELECT table_type 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'content_metadata';
  `);
  
  console.log('content_metadata type:', viewCheck.rows[0]?.table_type);
  
  // If it's a view, find the underlying table
  if (viewCheck.rows[0]?.table_type === 'VIEW') {
    const viewDef = await client.query(`
      SELECT definition 
      FROM pg_views 
      WHERE schemaname = 'public' 
      AND viewname = 'content_metadata';
    `);
    
    console.log('\nView definition (first 500 chars):');
    console.log(viewDef.rows[0]?.definition.substring(0, 500));
    
    // Extract table name from view definition
    const def = viewDef.rows[0]?.definition || '';
    const fromMatch = def.match(/FROM\s+([a-z_]+)/i);
    if (fromMatch) {
      console.log('\nBase table:', fromMatch[1]);
    }
  }
  
  await client.end();
}

findBase().catch(console.error);
