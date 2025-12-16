/**
 * 🔄 ONE-SHOT RESTART SCRIPT
 * Safely exits the process to trigger Railway restart and schema cache refresh
 * Only runs once per deployment
 */

console.log('[RESTART] 🔄 Initiating controlled restart for schema cache refresh...');
console.log('[RESTART] 📋 Reason: Force Supabase client schema cache refresh');
console.log('[RESTART] ⏱️ Process will exit in 2 seconds...');

setTimeout(() => {
  console.log('[RESTART] ✅ Exiting process (exit code 0)');
  process.exit(0);
}, 2000);

