#!/usr/bin/env tsx
/**
 * 🔍 FORENSIC AUDIT - Check Feature Flags & Config
 */

import { config } from 'dotenv';
config();

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🔍 FORENSIC AUDIT - FEATURE FLAGS & CONFIG');
  console.log('═══════════════════════════════════════════════════════════════\n');

  console.log('CRITICAL ENV VARS:');
  console.log(`  MODE: ${process.env.MODE || 'not set'}`);
  console.log(`  LIVE: ${process.env.LIVE || 'not set'}`);
  console.log(`  ENABLE_POSTING: ${process.env.ENABLE_POSTING || 'not set'}`);
  console.log(`  ENABLE_REPLIES: ${process.env.ENABLE_REPLIES || 'not set'}`);
  console.log(`  ENABLE_PLAN: ${process.env.ENABLE_PLAN || 'not set'}`);
  console.log(`  POST_NOW_ON_COLD_START: ${process.env.POST_NOW_ON_COLD_START || 'not set'}`);
  console.log(`  GRACE_MINUTES: ${process.env.GRACE_MINUTES || 'not set'}`);
  console.log(`  MIN_MINUTES_UNTIL_SLOT: ${process.env.MIN_MINUTES_UNTIL_SLOT || 'not set'}`);

  console.log('\nJOB INTERVALS:');
  console.log(`  JOBS_PLAN_INTERVAL_MIN: ${process.env.JOBS_PLAN_INTERVAL_MIN || '30 (default)'}`);
  console.log(`  JOBS_REPLY_INTERVAL_MIN: ${process.env.JOBS_REPLY_INTERVAL_MIN || '20 (default)'}`);
  console.log(`  JOBS_POSTING_INTERVAL_MIN: ${process.env.JOBS_POSTING_INTERVAL_MIN || '5 (default)'}`);

  console.log('\nQUIET HOURS:');
  console.log(`  QUIET_HOURS_START: ${process.env.QUIET_HOURS_START || 'not set'}`);
  console.log(`  QUIET_HOURS_END: ${process.env.QUIET_HOURS_END || 'not set'}`);
  console.log(`  SCHED_TZ: ${process.env.SCHED_TZ || 'UTC (default)'}`);

  console.log('\n═══════════════════════════════════════════════════════════════');
}

main();

