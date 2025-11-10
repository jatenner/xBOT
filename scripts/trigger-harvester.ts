#!/usr/bin/env tsx
/**
 * Manually trigger the mega_viral_harvester job
 */

import { replyOpportunityHarvester } from '../src/jobs/replyOpportunityHarvester';

console.log('🔥 Manually triggering mega_viral_harvester...\n');

replyOpportunityHarvester()
  .then(() => {
    console.log('\n✅ Harvester completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Harvester failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  });

