#!/usr/bin/env node
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { Client } from 'pg';

async function runMigrations(): Promise<void> {
  const DATABASE_URL = process.env.DATABASE_URL;
  
  if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is required');
    process.exit(1);
  }

  console.log('🗃️  Starting database migrations...');
  console.log(`🔗 Connecting to database with SSL...`);

  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: {
      rejectUnauthorized: false // Accept self-signed certificates
    }
  });

  try {
    await client.connect();
    console.log('✅ Database connection established');

    // Get all migration files
    const migrationsDir = join(process.cwd(), 'supabase', 'migrations');
    let migrationFiles: string[];
    
    try {
      migrationFiles = readdirSync(migrationsDir)
        .filter(file => file.endsWith('.sql'))
        .sort(); // Sort alphabetically for consistent ordering
    } catch (error) {
      console.error('❌ Could not read migrations directory:', migrationsDir);
      throw error;
    }

    if (migrationFiles.length === 0) {
      console.log('ℹ️  No migration files found');
      return;
    }

    console.log(`📋 Found ${migrationFiles.length} migration files`);

    // Execute each migration
    for (const filename of migrationFiles) {
      const filePath = join(migrationsDir, filename);
      
      try {
        console.log(`🔄 Executing ${filename}...`);
        const sql = readFileSync(filePath, 'utf8');
        
        // Execute with error handling
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('COMMIT');
        
        console.log(`✅ ${filename} completed successfully`);
      } catch (error: any) {
        await client.query('ROLLBACK');
        console.error(`❌ ${filename} failed:`, error.message);
        throw error;
      }
    }

    console.log('🎉 All migrations completed successfully');

  } catch (error: any) {
    console.error('💥 Migration failed:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Run migrations if this file is executed directly
if (require.main === module) {
  runMigrations().catch(error => {
    console.error('💥 Unhandled migration error:', error);
    process.exit(1);
  });
}

export { runMigrations };
