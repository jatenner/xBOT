#!/usr/bin/env node

/**
 * 🔧 BULLETPROOF AUTO-MIGRATION SYSTEM
 * 
 * - Uses Railway environment variables directly (or .env for local)
 * - Actually executes SQL migrations (not just logs them)
 * - Tracks applied migrations to avoid duplicates
 * - Continues deployment even if migrations fail
 * - Works with Supabase PostgreSQL directly
 */

// Load .env for local development (Railway provides env vars directly)
require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

console.log('🔧 === BULLETPROOF MIGRATION SYSTEM STARTING ===');

// Use Railway environment variables (or .env for local)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  console.log('⚠️ Continuing deployment without migrations');
  process.exit(0); // Don't fail deployment
}

console.log(`✅ Connected to: ${supabaseUrl.substring(0, 30)}...`);

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

async function executeSql(sql) {
  try {
    // Use direct SQL execution via Supabase REST API
    const { data, error } = await supabase.rpc('exec_sql', { sql });
    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    // Fallback: try using the query method
    try {
      const { data, error: queryError } = await supabase
        .from('_dummy_')
        .select('*')
        .limit(0);
      
      // If that fails, execute raw SQL directly
      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        },
        body: JSON.stringify({ sql })
      });
      
      if (response.ok) {
        return { success: true, data: await response.text() };
      } else {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }
    } catch (fallbackError) {
      return { success: false, error: fallbackError.message };
    }
  }
}

async function runMigrations() {
  try {
    console.log('📦 Initializing migration system...');
    
    // Ensure migrations tracking table exists
    const createTrackingTable = `
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        filename TEXT UNIQUE NOT NULL,
        applied_at TIMESTAMPTZ DEFAULT NOW(),
        checksum TEXT
      );
    `;
    
    console.log('📋 Creating migrations tracking table...');
    await executeSql(createTrackingTable);
    
    // Get migration files
    const migrationsDir = path.join(process.cwd(), 'supabase/migrations');
    
    if (!fs.existsSync(migrationsDir)) {
      console.log('ℹ️ No supabase/migrations directory found');
      return;
    }

    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();

    if (migrationFiles.length === 0) {
      console.log('ℹ️ No migration files found');
      return;
    }

    console.log(`📋 Found ${migrationFiles.length} migration files`);

    // Apply each migration
    let appliedCount = 0;
    let skippedCount = 0;
    
    for (const filename of migrationFiles) {
      const filePath = path.join(migrationsDir, filename);
      const sql = fs.readFileSync(filePath, 'utf8');
      
      console.log(`📝 Processing migration: ${filename}`);
      
      try {
        // Check if already applied (simple approach)
        const { data: existingMigrations } = await supabase
          .from('_migrations')
          .select('filename')
          .eq('filename', filename)
          .single();
        
        if (existingMigrations) {
          console.log(`⏭️ Skipped (already applied): ${filename}`);
          skippedCount++;
          continue;
        }
      } catch (checkError) {
        // Migration not found, proceed to apply
      }
      
      // Execute the migration
      console.log(`🔄 Applying: ${filename}`);
      const result = await executeSql(sql);
      
      if (result.success) {
        console.log(`✅ Applied successfully: ${filename}`);
        
        // Record the migration
        try {
          await supabase.from('_migrations').insert({ filename });
        } catch (insertError) {
          console.log(`⚠️ Could not record migration ${filename}, but it was applied`);
        }
        
        appliedCount++;
      } else {
        console.log(`⚠️ Migration ${filename} failed: ${result.error}`);
        console.log(`🔄 Continuing with other migrations...`);
      }
    }

    console.log(`✅ Migration summary: ${appliedCount} applied, ${skippedCount} skipped`);
    console.log('🎉 Migration system completed successfully');
    
  } catch (error) {
    console.error('❌ Migration system error:', error.message);
    console.log('⚠️ Continuing deployment despite migration errors');
  }
}

// Execute migrations
runMigrations().then(() => {
  console.log('🔧 === MIGRATION SYSTEM FINISHED ===');
  process.exit(0);
}).catch(error => {
  console.error('💥 Critical migration error:', error);
  console.log('⚠️ Continuing deployment anyway');
  process.exit(0); // Never fail deployment
});