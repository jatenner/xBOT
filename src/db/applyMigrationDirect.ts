/**
 * 🔧 DIRECT MIGRATION APPLIER
 * Applies migration SQL directly via PostgreSQL connection
 */

import { readFileSync } from 'fs';
import { join } from 'path';

export async function applyReplySchemaColumnsDirectly(): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('[SCHEMA] 📝 Applying migration directly via PostgreSQL...');
    
    // Read the migration SQL file
    const migrationPath = join(__dirname, '../../supabase/migrations/20260101_add_root_tweet_fields.sql');
    let sql: string;
    
    try {
      sql = readFileSync(migrationPath, 'utf-8');
    } catch (readError: any) {
      console.error(`[SCHEMA] ❌ Could not read migration file: ${readError.message}`);
      return { success: false, error: `migration file not found: ${readError.message}` };
    }
    
    // Use pg client directly
    const { Client } = await import('pg');
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    
    await client.connect();
    console.log('[SCHEMA] Connected to PostgreSQL');
    
    // Execute the migration SQL
    await client.query(sql);
    console.log('[SCHEMA] ✅ Migration SQL executed successfully');
    
    await client.end();
    
    return { success: true };
  } catch (error: any) {
    console.error('[SCHEMA] ❌ Migration failed:', error.message);
    return { success: false, error: error.message };
  }
}

