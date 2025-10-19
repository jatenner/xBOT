/**
 * Script to manually trigger the plan job on Railway
 */

import { planContent } from './dist/src/jobs/planJobUnified.js';

console.log('🚀 Manually triggering plan job to generate content...');

planContent()
  .then(() => {
    console.log('✅ Plan job completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Plan job failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  });

