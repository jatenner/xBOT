#!/usr/bin/env tsx

/**
 * Manually trigger the harvester (bypasses scheduler)
 */

import('./src/jobs/replyOpportunityHarvester').then(({ replyOpportunityHarvester }) => {
  console.log('🔥 MANUAL TRIGGER: Starting harvester...\n');
  return replyOpportunityHarvester();
}).then(() => {
  console.log('\n✅ MANUAL TRIGGER: Harvester complete!');
  process.exit(0);
}).catch((err) => {
  console.error('\n❌ MANUAL TRIGGER: Error:', err.message);
  console.error(err.stack);
  process.exit(1);
});

