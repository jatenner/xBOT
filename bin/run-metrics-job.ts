#!/usr/bin/env tsx
import { metricsScraperJob } from '../src/jobs/metricsScraperJob';

metricsScraperJob()
  .then(() => {
    console.log('[METRICS_JOB] ✅ Completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('[METRICS_JOB] ❌ Failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  });

