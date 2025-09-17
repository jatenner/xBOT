/**
 * NEUTRALIZED: Runtime migrations controlled only by canonical tools/db/migrate.js
 * Use MIGRATIONS_RUNTIME_ENABLED environment variable
 */
export async function runRuntimeMigrations(): Promise<void> {
  const { runMigrations } = require('../../tools/db/migrate');
  
  try {
    await runMigrations();
  } catch (error: any) {
    // Canonical runner handles all logging and exit codes
    throw error;
  }
}
