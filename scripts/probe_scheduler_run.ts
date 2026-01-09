/**
 * 🔍 PROBE SCHEDULER RUN
 * One-time probe to immediately try posting one reply from queue
 */

import 'dotenv/config';
import { attemptScheduledReply } from '../src/jobs/replySystemV2/tieredScheduler';

async function probeScheduler() {
  console.log('========================================');
  console.log('PROBE SCHEDULER RUN');
  console.log('========================================\n');
  
  console.log('🚀 Running scheduler probe (1 attempt only)...');
  
  try {
    const result = await attemptScheduledReply();
    
    console.log('\n========================================');
    console.log('PROBE RESULT');
    console.log('========================================\n');
    
    console.log(`Posted: ${result.posted}`);
    console.log(`Candidate Tweet ID: ${result.candidate_tweet_id || 'N/A'}`);
    console.log(`Tier: ${result.tier || 'N/A'}`);
    console.log(`Reason: ${result.reason}`);
    console.log(`Behind Schedule: ${result.behind_schedule}`);
    
    if (result.posted) {
      console.log('\n✅ PROBE SUCCESS: Reply queued for posting');
    } else {
      console.log(`\n⚠️  PROBE: No reply posted (reason: ${result.reason})`);
    }
    
    process.exit(result.posted ? 0 : 1);
  } catch (error: any) {
    console.error('\n❌ PROBE FAILED:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

probeScheduler().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});

