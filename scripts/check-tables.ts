import 'dotenv/config';
import { pool } from '../src/db/client';

async function main() {
  const client = await pool.connect();
  try {
    // Check tables and views
    const res = await client.query(`
      SELECT table_name, table_type
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND (table_name LIKE '%content_metadata%' OR table_name = 'content_metadata')
      ORDER BY table_name
    `);
    console.log('Tables/Views matching content_metadata:', res.rows);
    
    // Check if content_metadata exists as table or view
    const check = await client.query(`
      SELECT EXISTS (
        SELECT 1 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'content_metadata'
      ) as exists_as_table,
      EXISTS (
        SELECT 1 
        FROM information_schema.views 
        WHERE table_schema = 'public' 
        AND table_name = 'content_metadata'
      ) as exists_as_view
    `);
    console.log('content_metadata check:', check.rows[0]);
    
    // Try to query it directly
    try {
      const testQuery = await client.query('SELECT COUNT(*) FROM content_metadata LIMIT 1');
      console.log('✅ content_metadata is queryable, count:', testQuery.rows[0].count);
    } catch (err: any) {
      console.log('❌ Cannot query content_metadata:', err.message);
    }
  } finally {
    client.release();
  }
}

main().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
