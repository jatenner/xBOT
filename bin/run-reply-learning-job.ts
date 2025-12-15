#!/usr/bin/env tsx
import 'dotenv/config';
import { replyLearningJob } from '../src/jobs/replyLearningJob';

replyLearningJob()
  .then(() => {
    console.log('[REPLY_LEARNING_JOB] ✅ Completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('[REPLY_LEARNING_JOB] ❌ Failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  });

