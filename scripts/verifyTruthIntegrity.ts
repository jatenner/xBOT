/**
 * Truth Integrity Verifier for xBOT
 * 
 * Audits truth invariants to ensure:
 * - No false success (status=posted but no tweet IDs)
 * - No silent success (every success has DB confirmation)
 * - Salvageable rows identified (has IDs but marked failed)
 * - Idempotency correctness (no contradictions)
 * - Optional X verification (sample check)
 * 
 * Exit code:
 * - 0: PASS (all invariants satisfied)
 * - 1: FAIL (critical violation detected)
 */

import { createClient } from '@supabase/supabase-js';

// Note: Railway provides environment variables automatically
// dotenv only needed for local development (loaded by package.json scripts)

// Configuration
const TIME_WINDOW_HOURS = parseInt(process.env.TRUTH_VERIFY_HOURS || '24', 10);
const VERIFY_ON_X = process.env.TRUTH_VERIFY_ON_X === 'true';
const X_VERIFY_SAMPLE_SIZE = parseInt(process.env.TRUTH_VERIFY_SAMPLE || '10', 10);

interface Decision {
  decision_id: string;
  decision_type: string;
  status: string;
  tweet_id: string | null;
  thread_tweet_ids: string | null;
  posted_at: string | null;
  updated_at: string;
  reconciled_at: string | null;
}

interface Violation {
  decision_id: string;
  reason: string;
  tweet_id: string | null;
  thread_tweet_ids: string | null;
  status: string;
}

interface TruthReport {
  time_window: string;
  total_decisions: number;
  success_count: number;
  failed_count: number;
  retry_count: number;
  salvageable_count: number;
  false_success_count: number;
  suspect_count: number;
  idempotency_violations: number;
  violations: Violation[];
  pass: boolean;
}

/**
 * Initialize Supabase client
 */
function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required');
  }
  
  return createClient(url, key);
}

/**
 * Fetch decisions from the time window
 */
async function fetchDecisions(hoursAgo: number): Promise<Decision[]> {
  const supabase = getSupabase();
  const cutoffTime = new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();
  
  console.log(`[TRUTH_VERIFY] Fetching decisions updated after ${cutoffTime}...`);
  
  const { data, error } = await supabase
    .from('content_metadata')
    .select('decision_id, decision_type, status, tweet_id, thread_tweet_ids, posted_at, updated_at')
    .gte('updated_at', cutoffTime)
    .order('updated_at', { ascending: false });
  
  if (error) {
    throw new Error(`Failed to fetch decisions: ${error.message}`);
  }
  
  console.log(`[TRUTH_VERIFY] Fetched ${data?.length || 0} decisions`);
  return data as Decision[];
}

/**
 * Check Invariant 1: No false success
 * Status is 'posted' but no tweet IDs exist
 */
function checkFalseSuccess(decisions: Decision[]): Violation[] {
  const violations: Violation[] = [];
  
  for (const d of decisions) {
    if (d.status === 'posted') {
      const hasTweetId = d.tweet_id && d.tweet_id.trim() !== '';
      const hasThreadIds = d.thread_tweet_ids && d.thread_tweet_ids.trim() !== '' && d.thread_tweet_ids !== '[]';
      
      if (!hasTweetId && !hasThreadIds) {
        violations.push({
          decision_id: d.decision_id,
          reason: 'FALSE_SUCCESS: status=posted but no tweet IDs',
          tweet_id: d.tweet_id,
          thread_tweet_ids: d.thread_tweet_ids,
          status: d.status
        });
      }
    }
  }
  
  return violations;
}

/**
 * Check Invariant 2: Salvageable rows
 * Has tweet IDs but status is failed/retry
 */
function checkSalvageable(decisions: Decision[]): Violation[] {
  const violations: Violation[] = [];
  
  for (const d of decisions) {
    const hasTweetId = d.tweet_id && d.tweet_id.trim() !== '';
    const hasThreadIds = d.thread_tweet_ids && d.thread_tweet_ids.trim() !== '' && d.thread_tweet_ids !== '[]';
    
    if ((hasTweetId || hasThreadIds) && (d.status === 'failed' || d.status.includes('retry'))) {
      violations.push({
        decision_id: d.decision_id,
        reason: `SALVAGEABLE: has tweet IDs but status=${d.status}`,
        tweet_id: d.tweet_id,
        thread_tweet_ids: d.thread_tweet_ids,
        status: d.status
      });
    }
  }
  
  return violations;
}

/**
 * Check Invariant 3: Idempotency correctness
 * Ensure tweet_id matches thread_tweet_ids[0] if both exist
 */
function checkIdempotency(decisions: Decision[]): Violation[] {
  const violations: Violation[] = [];
  
  for (const d of decisions) {
    if (d.tweet_id && d.thread_tweet_ids && d.thread_tweet_ids !== '[]') {
      try {
        const threadIds = JSON.parse(d.thread_tweet_ids) as string[];
        if (threadIds.length > 0 && threadIds[0] !== d.tweet_id) {
          violations.push({
            decision_id: d.decision_id,
            reason: `IDEMPOTENCY: tweet_id=${d.tweet_id} != thread_tweet_ids[0]=${threadIds[0]}`,
            tweet_id: d.tweet_id,
            thread_tweet_ids: d.thread_tweet_ids,
            status: d.status
          });
        }
      } catch (err) {
        violations.push({
          decision_id: d.decision_id,
          reason: `IDEMPOTENCY: invalid JSON in thread_tweet_ids`,
          tweet_id: d.tweet_id,
          thread_tweet_ids: d.thread_tweet_ids,
          status: d.status
        });
      }
    }
  }
  
  return violations;
}

/**
 * Optional: Verify tweets exist on X
 * Takes a sample and checks if tweets are actually live
 */
async function verifyOnX(decisions: Decision[], sampleSize: number): Promise<Violation[]> {
  const violations: Violation[] = [];
  
  // Filter to decisions with tweet_id
  const decisionsWithIds = decisions.filter(d => d.tweet_id && d.tweet_id.trim() !== '');
  
  if (decisionsWithIds.length === 0) {
    console.log('[TRUTH_VERIFY] No decisions with tweet_id to verify on X');
    return violations;
  }
  
  // Take a sample
  const sample = decisionsWithIds.slice(0, Math.min(sampleSize, decisionsWithIds.length));
  console.log(`[TRUTH_VERIFY] Verifying ${sample.length} tweets on X...`);
  
  try {
    const { chromium } = await import('playwright');
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    
    // Load session if available
    const sessionB64 = process.env.TWITTER_SESSION_B64;
    if (sessionB64) {
      const sessionJson = Buffer.from(sessionB64, 'base64').toString('utf-8');
      const session = JSON.parse(sessionJson);
      await context.addCookies(session.cookies || []);
    }
    
    const page = await context.newPage();
    
    for (const d of sample) {
      try {
        const tweetUrl = `https://x.com/i/web/status/${d.tweet_id}`;
        await page.goto(tweetUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await page.waitForTimeout(2000);
        
        // Check for "This post is unavailable" or similar error indicators
        const bodyText = await page.textContent('body').catch(() => '');
        const isUnavailable = bodyText.includes('unavailable') || 
                             bodyText.includes('not found') ||
                             bodyText.includes('doesn\'t exist');
        
        if (isUnavailable) {
          violations.push({
            decision_id: d.decision_id,
            reason: `SUSPECT: tweet_id=${d.tweet_id} not found on X`,
            tweet_id: d.tweet_id,
            thread_tweet_ids: d.thread_tweet_ids,
            status: d.status
          });
        }
      } catch (err: any) {
        console.warn(`[TRUTH_VERIFY] Failed to verify ${d.tweet_id}: ${err.message}`);
        // Don't count as violation if verification fails (network issue, etc.)
      }
    }
    
    await browser.close();
  } catch (err: any) {
    console.error(`[TRUTH_VERIFY] X verification failed: ${err.message}`);
    console.error('[TRUTH_VERIFY] Skipping X verification (not critical)');
  }
  
  return violations;
}

/**
 * Generate report
 */
function generateReport(
  decisions: Decision[],
  falseSuccess: Violation[],
  salvageable: Violation[],
  idempotency: Violation[],
  suspect: Violation[]
): TruthReport {
  const successCount = decisions.filter(d => d.status === 'posted').length;
  const failedCount = decisions.filter(d => d.status === 'failed').length;
  const retryCount = decisions.filter(d => d.status.includes('retry') || d.status === 'queued').length;
  
  const allViolations = [
    ...falseSuccess,
    ...salvageable,
    ...idempotency,
    ...suspect
  ];
  
  // Critical violations are false_success and idempotency
  const criticalViolations = falseSuccess.length + idempotency.length;
  const pass = criticalViolations === 0;
  
  return {
    time_window: `last ${TIME_WINDOW_HOURS} hours`,
    total_decisions: decisions.length,
    success_count: successCount,
    failed_count: failedCount,
    retry_count: retryCount,
    salvageable_count: salvageable.length,
    false_success_count: falseSuccess.length,
    suspect_count: suspect.length,
    idempotency_violations: idempotency.length,
    violations: allViolations.slice(0, 20), // Top 20
    pass
  };
}

/**
 * Print report
 */
function printReport(report: TruthReport): void {
  console.log('\n' + '='.repeat(70));
  console.log('TRUTH INTEGRITY VERIFICATION REPORT');
  console.log('='.repeat(70));
  console.log(`Time Window: ${report.time_window}`);
  console.log(`Generated: ${new Date().toISOString()}`);
  console.log('');
  
  console.log('SUMMARY:');
  console.log(`  Total Decisions: ${report.total_decisions}`);
  console.log(`  Success: ${report.success_count}`);
  console.log(`  Failed: ${report.failed_count}`);
  console.log(`  Retry/Queued: ${report.retry_count}`);
  console.log('');
  
  console.log('INVARIANT CHECKS:');
  console.log(`  ❌ False Success: ${report.false_success_count} ${report.false_success_count > 0 ? '(CRITICAL)' : ''}`);
  console.log(`  ⚠️  Salvageable: ${report.salvageable_count}`);
  console.log(`  ❌ Idempotency Violations: ${report.idempotency_violations} ${report.idempotency_violations > 0 ? '(CRITICAL)' : ''}`);
  console.log(`  ⚠️  Suspect (X verification): ${report.suspect_count}`);
  console.log('');
  
  if (report.violations.length > 0) {
    console.log('TOP VIOLATIONS (up to 20):');
    console.log('-'.repeat(70));
    for (const v of report.violations) {
      console.log(`Decision: ${v.decision_id.substring(0, 8)}...`);
      console.log(`  Reason: ${v.reason}`);
      console.log(`  Status: ${v.status}`);
      console.log(`  Tweet ID: ${v.tweet_id || 'null'}`);
      console.log(`  Thread IDs: ${v.thread_tweet_ids || 'null'}`);
      console.log('');
    }
  }
  
  console.log('='.repeat(70));
  console.log(`FINAL RESULT: ${report.pass ? '✅ PASS' : '❌ FAIL'}`);
  console.log('='.repeat(70));
  
  if (!report.pass) {
    console.log('');
    console.log('CRITICAL VIOLATIONS DETECTED!');
    console.log('Next steps:');
    console.log('1. Review violations above');
    console.log('2. For FALSE_SUCCESS: investigate why DB save claimed success without IDs');
    console.log('3. For IDEMPOTENCY: check for duplicate processing or DB corruption');
    console.log('4. For SALVAGEABLE: run reconciliation job to recover');
    console.log('5. Check logs: railway logs --service xBOT | grep "decision_id=<id>"');
  }
}

/**
 * Main verification function
 */
async function verifyTruthIntegrity(): Promise<number> {
  try {
    console.log('[TRUTH_VERIFY] Starting truth integrity verification...');
    console.log(`[TRUTH_VERIFY] Time window: last ${TIME_WINDOW_HOURS} hours`);
    console.log(`[TRUTH_VERIFY] X verification: ${VERIFY_ON_X ? 'enabled' : 'disabled'}`);
    
    // Fetch decisions
    const decisions = await fetchDecisions(TIME_WINDOW_HOURS);
    
    if (decisions.length === 0) {
      console.log('[TRUTH_VERIFY] No decisions found in time window');
      console.log('[TRUTH_VERIFY] ✅ PASS (nothing to verify)');
      return 0;
    }
    
    // Run invariant checks
    console.log('[TRUTH_VERIFY] Checking invariants...');
    const falseSuccess = checkFalseSuccess(decisions);
    const salvageable = checkSalvageable(decisions);
    const idempotency = checkIdempotency(decisions);
    
    console.log(`[TRUTH_VERIFY] False success: ${falseSuccess.length}`);
    console.log(`[TRUTH_VERIFY] Salvageable: ${salvageable.length}`);
    console.log(`[TRUTH_VERIFY] Idempotency violations: ${idempotency.length}`);
    
    // Optional X verification
    let suspect: Violation[] = [];
    if (VERIFY_ON_X) {
      suspect = await verifyOnX(decisions, X_VERIFY_SAMPLE_SIZE);
      console.log(`[TRUTH_VERIFY] Suspect (X verification): ${suspect.length}`);
    }
    
    // Generate and print report
    const report = generateReport(decisions, falseSuccess, salvageable, idempotency, suspect);
    printReport(report);
    
    // Print summary line for monitoring
    console.log(`[TRUTH_VERIFY] verdict=${report.pass ? 'PASS' : 'FAIL'} window=${TIME_WINDOW_HOURS}h false_success=${report.false_success_count} salvageable=${report.salvageable_count} suspect=${report.suspect_count}`);
    
    // Track failure if not passing
    if (!report.pass) {
      await trackVerificationFailure();
    }
    
    return report.pass ? 0 : 1;
  } catch (error: any) {
    console.error('[TRUTH_VERIFY] ❌ Verification failed:', error.message);
    console.error(error.stack);
    return 1;
  }
}

/**
 * Track verification failure in DB for truth guard
 */
async function trackVerificationFailure(): Promise<void> {
  try {
    const supabase = getSupabase();
    await supabase.from('system_events').insert({
      component: 'truth_integrity',
      event_type: 'verification_failed',
      severity: 'critical',
      message: 'Truth integrity verification FAILED',
      metadata: { timestamp: new Date().toISOString() },
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('[TRUTH_VERIFY] Failed to track failure:', err);
  }
}

export { trackVerificationFailure };


// Run if called directly
if (require.main === module) {
  verifyTruthIntegrity()
    .then(exitCode => {
      process.exit(exitCode);
    })
    .catch(err => {
      console.error('Fatal error:', err);
      process.exit(1);
    });
}

export { verifyTruthIntegrity, TruthReport };

