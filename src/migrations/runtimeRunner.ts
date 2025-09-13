/**
 * Runtime Migration Runner
 * Runs in background to retry failed prestart migrations
 */

import { runRuntimeMigrations } from '../../scripts/migrate';

let isRunning = false;
let runnerInterval: NodeJS.Timeout | null = null;

/**
 * Start the runtime migration runner
 */
export function startRuntimeMigrationRunner(): void {
  if (isRunning) {
    console.log('🔄 RUNTIME_MIGRATIONS: Already running');
    return;
  }
  
  isRunning = true;
  console.log('🚀 RUNTIME_MIGRATIONS: Starting background runner');
  
  // Run immediately, then every 5 minutes until successful
  runRuntimeMigrations()
    .then(() => {
      console.log('✅ RUNTIME_MIGRATIONS: Completed successfully');
      isRunning = false;
    })
    .catch((error) => {
      console.error('❌ RUNTIME_MIGRATIONS: Failed:', error.message);
      
      // Schedule retry in 5 minutes
      runnerInterval = setTimeout(() => {
        if (isRunning) {
          startRuntimeMigrationRunner();
        }
      }, 300000); // 5 minutes
    });
}

/**
 * Stop the runtime migration runner
 */
export function stopRuntimeMigrationRunner(): void {
  if (runnerInterval) {
    clearTimeout(runnerInterval);
    runnerInterval = null;
  }
  isRunning = false;
  console.log('🛑 RUNTIME_MIGRATIONS: Stopped');
}

/**
 * Get runner status
 */
export function getRuntimeMigrationStatus(): { running: boolean } {
  return { running: isRunning };
}
