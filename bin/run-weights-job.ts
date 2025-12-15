#!/usr/bin/env tsx
import 'dotenv/config';
import { offlineWeightMapJob } from '../src/jobs/offlineWeightMapJob';

offlineWeightMapJob()
  .then(() => {
    console.log('[WEIGHTS_JOB] ✅ Completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('[WEIGHTS_JOB] ❌ Failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  });

