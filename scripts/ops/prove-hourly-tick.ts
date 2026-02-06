#!/usr/bin/env tsx
/**
 * PROVE HOURLY TICK
 *
 * Calls executeHourlyTick once; logs start/done; confirms rate_controller_state
 * write or explains why not.
 *
 * Usage:
 *   railway run --service xBOT pnpm exec tsx scripts/ops/prove-hourly-tick.ts
 */

import 'dotenv/config';
import { executeHourlyTick } from '../../src/rateController/hourlyTick';
import { getSupabaseClient } from '../../src/db/index';

async function main(): Promise<void> {
  console.log('[PROVE_HOURLY_TICK] Starting: call executeHourlyTick once\n');

  const supabase = getSupabaseClient();
  const hourStart = new Date();
  hourStart.setMinutes(0, 0, 0);
  const hourStartIso = hourStart.toISOString();

  const { data: before } = await supabase
    .from('rate_controller_state')
    .select('hour_start, updated_at, executed_replies, executed_posts')
    .eq('hour_start', hourStartIso)
    .maybeSingle();

  console.log('[PROVE_HOURLY_TICK] HOURLY_TICK_START: Invoking executeHourlyTick...\n');

  try {
    await executeHourlyTick();
  } catch (error: any) {
    console.error('[PROVE_HOURLY_TICK] HOURLY_TICK_DONE: Failed - ' + error.message);
    console.log('[PROVE_HOURLY_TICK] rate_controller_state: Not checked (execution failed)');
    process.exit(1);
  }

  console.log('\n[PROVE_HOURLY_TICK] HOURLY_TICK_DONE: executeHourlyTick completed\n');

  const { data: after } = await supabase
    .from('rate_controller_state')
    .select('hour_start, updated_at, executed_replies, executed_posts, mode, target_replies_this_hour')
    .eq('hour_start', hourStartIso)
    .maybeSingle();

  if (after) {
    console.log('[PROVE_HOURLY_TICK] rate_controller_state: Row exists (write confirmed)');
    console.log('  hour_start: ' + after.hour_start);
    console.log('  updated_at: ' + after.updated_at);
    console.log('  executed_replies: ' + (after.executed_replies ?? 0));
    console.log('  executed_posts: ' + (after.executed_posts ?? 0));
    console.log('  mode: ' + (after.mode ?? 'N/A'));
    console.log('  target_replies_this_hour: ' + (after.target_replies_this_hour ?? 0));
  } else {
    console.log('[PROVE_HOURLY_TICK] rate_controller_state: No row for current hour');
    console.log('  Reason: computeRateTargets upserts; hourlyTick updates existing row.');
    console.log('  If schema preflight failed or SAFE_MODE is active, execution skips before DB write.');
    console.log('  Check logs for [HOURLY_TICK] Schema preflight / SAFE_MODE messages.');
  }

  const { count } = await supabase
    .from('rate_controller_state')
    .select('*', { count: 'exact', head: true });
  console.log('\n[PROVE_HOURLY_TICK] rate_controller_state total rows: ' + (count ?? 0));

  process.exit(0);
}

main().catch((e) => {
  console.error('[PROVE_HOURLY_TICK] Fatal:', e.message);
  process.exit(1);
});
