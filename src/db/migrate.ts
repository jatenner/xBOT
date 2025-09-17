import { Client } from 'pg';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { getPgSSL, logSafeConnectionInfo } from './pgSSL';

/**
 * Run migrations - shared implementation for both runtime and CLI
 */
export async function runMigrations(): Promise<void> {
  const enabled = process.env.MIGRATIONS_RUNTIME_ENABLED === 'true';
  
  if (!enabled) {
    console.log('runtime migrations disabled');
    return;
  }

  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is required');
    process.exit(1);
  }

  const migrationsDir = join(process.cwd(), 'supabase', 'migrations');
  
  if (!existsSync(migrationsDir)) {
    console.log('ℹ️  No migrations directory found');
    return;
  }

  const files = readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
  
  if (files.length === 0) {
    console.log('ℹ️  No migration files found');
    return;
  }

  console.log(`🗃️  Found ${files.length} migration files`);
  logSafeConnectionInfo(DATABASE_URL);

  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: getPgSSL(DATABASE_URL)
  });

  try {
    await client.connect();
  } catch (error: any) {
    if (error.message.includes('self-signed certificate')) {
      console.log('Retrying connection with same SSL options...');
      try {
        await client.connect();
      } catch (retryError: any) {
        console.error('💥 Migration connection failed after retry:', retryError.message);
        process.exit(1);
      }
    } else {
      console.error('💥 Migration connection failed:', error.message);
      process.exit(1);
    }
  }

  for (const filename of files) {
    const filePath = join(migrationsDir, filename);
    try {
      process.stdout.write(`→ Applying ${filename} ... `);
      const sql = readFileSync(filePath, 'utf8');
      await client.query(sql);
      console.log('OK');
    } catch (error: any) {
      console.log('FAILED:', error.message);
      await client.end();
      process.exit(1);
    }
  }

  await client.end();
  console.log('✅ All migrations applied');
}
