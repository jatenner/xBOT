#!/usr/bin/env tsx
/**
 * Prove nav heartbeat: run 5 times with 2 min spacing.
 * Prints summary: ok count, fail count, cooldown skips, reasons.
 * Queries last 10 nav_heartbeat rows from system_events.
 */
import 'dotenv/config';
import { getSupabaseClient } from '../../src/db/index';
import { runNavHeartbeat } from '../../src/rateController/hourlyTick';

const RUNS = 5;
const SPACING_MS = 2 * 60 * 1000;

async function runOneHeartbeat(): Promise<{ ok: boolean; reason: string; cooldownSkip: boolean }> {
  const supabase = getSupabaseClient();
  const { getConsentWallCooldown } = await import('../../src/utils/consentWallCooldown');

  if (getConsentWallCooldown().isCooldownActive()) {
    return { ok: false, reason: 'SKIP_HEARTBEAT_CONSENT_COOLDOWN', cooldownSkip: true };
  }

  const ok = await runNavHeartbeat(supabase);
  const { data } = await supabase
    .from('system_events')
    .select('event_data')
    .eq('event_type', 'nav_heartbeat')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  const ed = (data?.event_data as Record<string, unknown>) || {};
  const reason = (ed.reason as string) ?? (ok ? 'ok' : 'unknown');
  return { ok, reason, cooldownSkip: false };
}

async function main(): Promise<void> {
  console.log(`[PROVE_NAV_HEARTBEAT_LOOP] Running ${RUNS} heartbeats with ${SPACING_MS / 1000}s spacing...`);

  const results: Array<{ ok: boolean; reason: string; cooldownSkip: boolean }> = [];

  for (let i = 0; i < RUNS; i++) {
    const r = await runOneHeartbeat();
    results.push(r);
    console.log(`[PROVE_NAV_HEARTBEAT_LOOP] Run ${i + 1}/${RUNS}: ok=${r.ok} reason=${r.reason} cooldownSkip=${r.cooldownSkip}`);

    if (i < RUNS - 1) {
      await new Promise((resolve) => setTimeout(resolve, SPACING_MS));
    }
  }

  const okCount = results.filter((r) => r.ok).length;
  const failCount = results.filter((r) => !r.ok && !r.cooldownSkip).length;
  const cooldownSkips = results.filter((r) => r.cooldownSkip).length;
  const reasons: Record<string, number> = {};
  for (const r of results) {
    reasons[r.reason] = (reasons[r.reason] || 0) + 1;
  }

  console.log('\n[PROVE_NAV_HEARTBEAT_LOOP] Summary:');
  console.log(`  ok: ${okCount}  fail: ${failCount}  cooldown_skips: ${cooldownSkips}`);
  console.log(`  reasons: ${JSON.stringify(reasons)}`);

  const supabase = getSupabaseClient();
  const { data } = await supabase
    .from('system_events')
    .select('id, event_data, created_at')
    .eq('event_type', 'nav_heartbeat')
    .order('created_at', { ascending: false })
    .limit(10);

  console.log('\n[PROVE_NAV_HEARTBEAT_LOOP] Last 10 nav_heartbeat rows:');
  for (const row of data || []) {
    const ed = (row.event_data as Record<string, unknown>) || {};
    console.log(`  created_at=${row.created_at} success=${ed.success} reason=${ed.reason ?? 'n/a'}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
