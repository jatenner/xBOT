/**
 * Test 2: ONE live action.
 * X_MAX_ACTIONS_PER_DAY=1 ensures only one action happens.
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';

if (!process.env.TWITTER_SESSION_B64) {
  const p = path.join(process.cwd(), 'twitter_session.b64');
  if (fs.existsSync(p)) process.env.TWITTER_SESSION_B64 = fs.readFileSync(p, 'utf-8').trim();
}

async function main() {
  console.log('=== TEST 2: ONE LIVE ACTION ===');
  console.log(`LIVE_POSTS=${process.env.LIVE_POSTS}`);
  console.log(`SHADOW_MODE=${process.env.SHADOW_MODE}`);
  console.log(`X_ACTIONS_ENABLED=${process.env.X_ACTIONS_ENABLED}`);
  console.log(`X_MAX_ACTIONS_PER_DAY=${process.env.X_MAX_ACTIONS_PER_DAY}`);
  console.log('');

  const { executeHourlyTick } = await import('../../src/rateController/hourlyTick');
  console.log('Starting hourly tick...');
  await executeHourlyTick();
  console.log('Tick complete.');
}

main().catch(e => {
  console.error('TICK FAILED:', e.message);
  console.error(e.stack?.substring(0, 500));
  process.exit(1);
});
