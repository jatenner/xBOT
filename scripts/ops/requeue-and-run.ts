/**
 * Requeue a decision and immediately execute it via controlled-live-timeline-once.
 *
 * Usage:
 *   pnpm tsx scripts/ops/requeue-and-run.ts <decision_id>
 *
 * What it does:
 *   1. Validates CDP mode environment (fails fast if misconfigured)
 *   2. Checks Chrome remote debugging is reachable on configured port
 *   3. Finds the decision in content_metadata or content_generation_metadata_comprehensive
 *   4. Resets status='queued', scheduled_at=now(), clears error fields
 *   5. Expires any APPROVED/PENDING permits in post_attempts
 *   6. Verifies the update took effect
 *   7. Spawns controlled-live-timeline-once.ts with ALL required env vars explicitly set
 */

import 'dotenv/config';
import { spawnSync } from 'child_process';
import * as http from 'http';
import * as path from 'path';
import { getSupabaseClient } from '../../src/db/index';

const P = '[REQUEUE]';
const ROOT = path.resolve(__dirname, '..', '..');

// ─── CDP configuration (mirrors UnifiedBrowserPool logic) ─────────────────

const CDP_PORT = process.env.RUNNER_CDP_PORT || process.env.CDP_PORT || '9222';
const CDP_HOST = process.env.RUNNER_CDP_HOST || '127.0.0.1';
const CDP_ENDPOINT = `http://${CDP_HOST}:${CDP_PORT}`;

// ─── Required execution env vars (explicitly set on every spawn) ───────────

const REQUIRED_ENV: Record<string, string> = {
  EXECUTION_MODE: 'executor',
  SHADOW_MODE: 'false',
  X_ACTIONS_ENABLED: 'true',
  POSTING_ENABLED: 'true',
  RUNNER_MODE: 'true',
  RUNNER_BROWSER: 'cdp',
};

// ─── CDP readiness check ───────────────────────────────────────────────────

function checkCdpReady(): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(`${CDP_ENDPOINT}/json/version`, { timeout: 3000 }, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}

// ─── Pre-flight env validation ─────────────────────────────────────────────

async function preflight(decisionId: string): Promise<void> {
  console.log('');
  console.log('[ENV CHECK]');
  console.log(`  EXECUTION_MODE   = ${REQUIRED_ENV.EXECUTION_MODE}`);
  console.log(`  RUNNER_BROWSER   = ${REQUIRED_ENV.RUNNER_BROWSER}`);
  console.log(`  SHADOW_MODE      = ${REQUIRED_ENV.SHADOW_MODE}`);
  console.log(`  POSTING_ENABLED  = ${REQUIRED_ENV.POSTING_ENABLED}`);
  console.log(`  CDP endpoint     = ${CDP_ENDPOINT}`);

  // Hard block: must be CDP mode
  if (REQUIRED_ENV.RUNNER_BROWSER !== 'cdp') {
    console.error(`${P} ❌ CDP_REQUIRED_FOR_EXECUTOR: RUNNER_BROWSER must be "cdp", got "${REQUIRED_ENV.RUNNER_BROWSER}"`);
    process.exit(1);
  }

  if (REQUIRED_ENV.EXECUTION_MODE !== 'executor') {
    console.error(`${P} ❌ MISCONFIG: EXECUTION_MODE must be "executor", got "${REQUIRED_ENV.EXECUTION_MODE}"`);
    process.exit(1);
  }

  // Auth session check (warning only — do not block)
  const hasSession = !!(process.env.TWITTER_SESSION_B64 || '').trim();
  if (!hasSession) {
    console.warn(`  ⚠️  TWITTER_SESSION_B64 not set — UNAUTHENTICATED SESSION — posting will likely fail`);
  } else {
    console.log(`  TWITTER_SESSION_B64 = present (${process.env.TWITTER_SESSION_B64!.length} chars)`);
  }

  // CDP readiness check — hard block if Chrome is not reachable
  process.stdout.write(`  CDP reachable    = `);
  const cdpReady = await checkCdpReady();
  if (!cdpReady) {
    console.log('NO');
    console.error('');
    console.error(`${P} ❌ CDP NOT AVAILABLE — START CHROME WITH REMOTE DEBUGGING`);
    console.error(`${P}    Expected: ${CDP_ENDPOINT}/json/version`);
    console.error(`${P}    Command:  open -a "Google Chrome" --args --remote-debugging-port=${CDP_PORT}`);
    console.error(`${P}    Or set RUNNER_CDP_PORT / RUNNER_CDP_HOST if using a non-default port.`);
    process.exit(1);
  }
  console.log(`YES (${CDP_ENDPOINT})`);
  console.log('');
}

// ─── CLI arg ───────────────────────────────────────────────────────────────

const decisionId = process.argv[2]?.trim();
if (!decisionId) {
  console.error(`${P} ❌ Usage: pnpm tsx scripts/ops/requeue-and-run.ts <decision_id>`);
  process.exit(1);
}

// Basic UUID format guard (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if (!UUID_RE.test(decisionId)) {
  console.error(`${P} ❌ decision_id does not look like a UUID: ${decisionId}`);
  process.exit(1);
}

// ─── Table search ──────────────────────────────────────────────────────────

const TABLES = [
  'content_metadata',
  'content_generation_metadata_comprehensive',
] as const;
type TableName = typeof TABLES[number];

interface DecisionRow {
  decision_id: string;
  decision_type: string;
  status: string;
  scheduled_at: string | null;
  error_message: string | null;
}

async function findDecision(): Promise<{ table: TableName; row: DecisionRow } | null> {
  const supabase = getSupabaseClient();
  for (const table of TABLES) {
    const { data, error } = await supabase
      .from(table)
      .select('decision_id, decision_type, status, scheduled_at, error_message')
      .eq('decision_id', decisionId)
      .maybeSingle();

    if (error) {
      // Schema mismatch or column not found — skip this table silently
      if (
        error.message.includes('does not exist') ||
        error.message.includes('column') ||
        error.message.includes('invalid input syntax for type uuid')
      ) {
        continue;
      }
      console.error(`${P} ❌ DB error querying ${table}: ${error.message}`);
      process.exit(1);
    }

    if (data) {
      return { table, row: data as DecisionRow };
    }
  }
  return null;
}

// ─── Requeue ───────────────────────────────────────────────────────────────

async function requeue(table: TableName): Promise<number> {
  const supabase = getSupabaseClient();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from(table)
    .update({
      status: 'queued',
      scheduled_at: now,
      error_message: null,
      skip_reason: null,          // clear any gate-denial reason
      updated_at: now,
    } as any)
    .eq('decision_id', decisionId)
    .select('decision_id');

  if (error) {
    console.error(`${P} ❌ Update failed on ${table}: ${error.message}`);
    process.exit(1);
  }

  return data?.length ?? 0;
}

// ─── Expire permits ────────────────────────────────────────────────────────

async function expirePermits(): Promise<number> {
  const supabase = getSupabaseClient();

  // Supabase JS doesn't support .in() combined with .eq() in a single update cleanly
  // Use two separate updates (APPROVED, PENDING) and sum the counts.
  let total = 0;

  for (const status of ['APPROVED', 'PENDING'] as const) {
    const { data, error } = await supabase
      .from('post_attempts')
      .update({ status: 'EXPIRED' } as any)
      .eq('decision_id', decisionId)
      .eq('status', status)
      .select('permit_id');

    if (error) {
      // post_attempts may not exist in all envs — warn but continue
      console.warn(`[ATTEMPTS] ⚠️  Could not expire ${status} permits: ${error.message}`);
      return 0;
    }
    total += data?.length ?? 0;
  }

  return total;
}

// ─── Verify ────────────────────────────────────────────────────────────────

async function verify(table: TableName): Promise<string> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(table)
    .select('status')
    .eq('decision_id', decisionId)
    .maybeSingle();

  if (error || !data) {
    return `unknown (${error?.message ?? 'row disappeared'})`;
  }
  return (data as any).status;
}

// ─── Spawn controlled run ──────────────────────────────────────────────────

function runControlled(decisionId: string): void {
  const scriptPath = path.join(ROOT, 'scripts', 'ops', 'controlled-live-timeline-once.ts');

  // Explicit env — do NOT rely solely on inherited env for execution-critical vars.
  // REQUIRED_ENV is always set to CDP mode values above; spread after process.env
  // so our values WIN over any inherited conflicting values.
  const spawnEnv: NodeJS.ProcessEnv = {
    ...process.env,
    ...REQUIRED_ENV,
    CONTROLLED_DECISION_ID: decisionId,
    // Preserve CDP routing env if set
    RUNNER_CDP_PORT: CDP_PORT,
    RUNNER_CDP_HOST: CDP_HOST,
  };

  console.log('');
  console.log('[RUN] Starting controlled execution...');
  console.log(`[RUN] Script            : ${scriptPath}`);
  console.log(`[RUN] CONTROLLED_DECISION_ID = ${decisionId}`);
  console.log(`[RUN] RUNNER_BROWSER    = ${spawnEnv.RUNNER_BROWSER}`);
  console.log(`[RUN] EXECUTION_MODE    = ${spawnEnv.EXECUTION_MODE}`);
  console.log(`[RUN] CDP endpoint      = ${CDP_ENDPOINT}`);
  console.log('───────────────────────────────────────────────────────────────────────────────');

  const result = spawnSync('pnpm', ['tsx', scriptPath], {
    stdio: 'inherit',
    env: spawnEnv,
    cwd: ROOT,
  });

  console.log('───────────────────────────────────────────────────────────────────────────────');

  if (result.error) {
    console.error(`[RUN] ❌ Failed to spawn controlled run: ${result.error.message}`);
    process.exit(1);
  }

  if (result.status !== 0) {
    console.error(`[RUN] ❌ Controlled run exited with code ${result.status}`);
    process.exit(result.status ?? 1);
  }

  console.log('[RUN] ✅ Controlled run completed successfully.');
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('🔁 REQUEUE-AND-RUN');
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log(`${P} decision_id = ${decisionId}`);

  // 0. Pre-flight: validate CDP mode and Chrome reachability
  await preflight(decisionId);

  // 1. Find
  const found = await findDecision();
  if (!found) {
    console.error(
      `${P} ❌ decision_id not found in any table.\n` +
      `       Checked: ${TABLES.join(', ')}`
    );
    process.exit(1);
  }

  const { table, row } = found;
  console.log(`${P} Found in ${table}`);
  console.log(`${P} Current state: status=${row.status} type=${row.decision_type} error=${row.error_message ?? 'none'}`);
  console.log('');

  // 2. Requeue
  const rowsUpdated = await requeue(table);
  if (rowsUpdated === 0) {
    console.error(`${P} ❌ UPDATE matched 0 rows — nothing changed. Aborting.`);
    process.exit(1);
  }
  console.log(`${P} Updated ${rowsUpdated} row → status=queued, scheduled_at=now()`);

  // 3. Expire permits
  const permitsExpired = await expirePermits();
  console.log(`[ATTEMPTS] Expired ${permitsExpired} APPROVED/PENDING permit(s)`);

  // 4. Verify
  const finalStatus = await verify(table);
  console.log(`[VERIFY] status=${finalStatus}`);
  if (finalStatus !== 'queued') {
    console.error(`${P} ❌ Verification failed — status is "${finalStatus}", expected "queued". Aborting.`);
    process.exit(1);
  }
  console.log('');

  // 5. Run
  runControlled(decisionId);
}

main().catch((err: any) => {
  console.error(`${P} Fatal: ${err?.message ?? err}`);
  process.exit(1);
});
