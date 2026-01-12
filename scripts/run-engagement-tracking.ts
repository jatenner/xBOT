#!/usr/bin/env tsx
/**
 * Run engagement tracking job
 */

import 'dotenv/config';
import { fetchPendingEngagementMetrics } from '../src/jobs/replySystemV2/engagementTracker';

async function runEngagementTracking() {
  console.log('📊 Running engagement tracking job...\n');

  try {
    const result = await fetchPendingEngagementMetrics();
    
    console.log('✅ Engagement tracking complete:');
    console.log(`   Checked: ${result.checked}`);
    console.log(`   Updated: ${result.updated}`);
    console.log(`   Errors: ${result.errors}`);
    
    if (result.errors > 0) {
      console.warn(`   ⚠️  ${result.errors} errors occurred`);
    }
  } catch (error: any) {
    console.error('❌ Engagement tracking failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

runEngagementTracking().catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
