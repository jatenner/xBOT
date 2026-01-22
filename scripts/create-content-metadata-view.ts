#!/usr/bin/env tsx
/**
 * 🔧 CREATE content_metadata VIEW
 * 
 * Creates a view that wraps content_generation_metadata_comprehensive
 * so code that references content_metadata continues to work
 */

import 'dotenv/config';
import { pool } from '../src/db/client';

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('     🔧 CREATE content_metadata VIEW');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const client = await pool.connect();
  
  try {
    // Check if view already exists
    const checkView = await client.query(`
      SELECT table_name
      FROM information_schema.views
      WHERE table_schema = 'public'
        AND table_name = 'content_metadata';
    `);

    if (checkView.rows.length > 0) {
      console.log('✅ View content_metadata already exists');
      console.log('⏭️  Skipping creation\n');
      process.exit(0);
    }

    console.log('🔄 Creating view...\n');
    
    // Create view
    await client.query(`
      CREATE VIEW content_metadata AS
      SELECT * FROM content_generation_metadata_comprehensive;
    `);

    // Grant permissions
    await client.query(`
      GRANT SELECT, INSERT, UPDATE, DELETE ON content_metadata TO authenticated;
      GRANT SELECT, INSERT, UPDATE, DELETE ON content_metadata TO service_role;
    `);

    console.log('✅ View created successfully!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ VIEW CREATED SUCCESSFULLY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error: any) {
    console.error('❌ View creation failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    client.release();
  }
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
