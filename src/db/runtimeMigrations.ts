import { Client } from 'pg';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { getPgSSL, logSafeConnectionInfo } from './pgSSL';

/**
 * Run migrations at application boot if enabled
 * Controlled by MIGRATIONS_RUNTIME_ENABLED environment variable
 */
export async function runRuntimeMigrations(): Promise<void> {
  const enabled = process.env.MIGRATIONS_RUNTIME_ENABLED === 'true';
  
  if (!enabled) {
    console.log('runtime migrations disabled');
    return;
  }

  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is required for runtime migrations');
    process.exit(1);
  }

  try {
    console.log('🗃️  Running runtime migrations...');
    logSafeConnectionInfo(DATABASE_URL);

    const client = new Client({
      connectionString: DATABASE_URL,
      ssl: getPgSSL()
    });

    await client.connect();

    // Get all migration files
    const migrationsDir = join(process.cwd(), 'supabase', 'migrations');
    
    if (!existsSync(migrationsDir)) {
      console.log('ℹ️  No migrations directory found, skipping');
      await client.end();
      return;
    }

    const migrationFiles = readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();

    if (migrationFiles.length === 0) {
      console.log('ℹ️  No migration files found');
      await client.end();
      return;
    }

    console.log(`📋 Found ${migrationFiles.length} migration files`);

    // Execute each migration
    for (const filename of migrationFiles) {
      const filePath = join(migrationsDir, filename);
      try {
        process.stdout.write(`→ Applying ${filename} ... `);
        const sql = readFileSync(filePath, 'utf8');
        await client.query(sql);
        console.log('OK');
      } catch (error: any) {
        console.log('FAILED:', error.message);
        await client.end();
        console.error('💥 Runtime migration failed, exiting');
        process.exit(1);
      }
    }

    await client.end();
    console.log('✅ Runtime migrations completed');
  } catch (error: any) {
    console.error('💥 Runtime migration error:', error.message);
    process.exit(1);
  }
}
