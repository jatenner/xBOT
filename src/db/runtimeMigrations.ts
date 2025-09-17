import { runMigrations } from './migrate';

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

  try {
    await runMigrations();
  } catch (error: any) {
    console.error('💥 Runtime migration error:', error.message);
    process.exit(1);
  }
}
