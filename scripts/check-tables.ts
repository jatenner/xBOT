import 'dotenv/config';
import { pool } from '../src/db/client';

async function main() {
  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE '%content%' 
      ORDER BY table_name
    `);
    console.log('Tables:', res.rows);
    
    // Check if content_metadata exists
    const check = await client.query(`
      SELECT EXISTS (
        SELECT 1 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'content_metadata'
      )
    `);
    console.log('content_metadata exists:', check.rows[0].exists);
  } finally {
    client.release();
  }
}

main().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
