/**
 * Run pattern tracking table migration
 * Creates the content_patterns table for pattern analysis
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

export async function runPatternMigration(): Promise<void> {
  console.log('🔄 Running pattern tracking table migration...');
  
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );
    const migrationPath = path.join(__dirname, '../migrations/create_pattern_tracking.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Split SQL into individual statements
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    for (const statement of statements) {
      if (!statement.trim()) continue;
      
      try {
        const { error } = await supabase.rpc('exec_sql', { sql_query: statement });
        
        if (error) {
          // Ignore "already exists" errors
          if (error.message?.includes('already exists')) {
            console.log('ℹ️ Table/index already exists - skipping');
          } else {
            console.warn(`⚠️ Migration warning: ${error.message}`);
          }
        } else {
          console.log('✅ Migration statement executed');
        }
      } catch (err: any) {
        console.warn(`⚠️ Migration statement warning: ${err.message}`);
      }
    }
    
    // Verify table exists
    const { data, error: verifyError } = await supabase
      .from('content_patterns')
      .select('id')
      .limit(1);
    
    if (verifyError) {
      console.error('❌ Migration failed - table not accessible:', verifyError.message);
      throw new Error(`Migration failed: ${verifyError.message}`);
    }
    
    console.log('✅ Pattern tracking table migration completed successfully!');
    
  } catch (error: any) {
    console.error('❌ Pattern migration error:', error.message);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  runPatternMigration().catch(console.error);
}
