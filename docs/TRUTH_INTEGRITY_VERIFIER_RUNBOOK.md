# Truth Integrity Verifier - Runbook

**Purpose:** Automated monitoring of truth invariants to ensure xBOT never learns from false data.

---

## What It Checks

### Critical Invariants (FAIL if violated)

1. **No False Success**: Status is `posted` but no tweet IDs exist
2. **Idempotency Correctness**: `tweet_id` matches `thread_tweet_ids[0]` when both exist

### Warnings (reported but not FAIL)

3. **Salvageable Rows**: Tweet IDs exist but status is `failed`/`retry` (can be recovered)
4. **Suspect Tweets**: Tweets marked posted but not found on X (optional, requires Playwright)

---

## How to Run Locally

### Quick Start

```bash
# Last 24 hours (default)
pnpm truth:verify:last24h

# Last 7 days
pnpm truth:verify:last7d

# With X verification (checks sample of tweets on X)
pnpm truth:verify:with-x
```

### Custom Time Window

```bash
# Last 6 hours
TRUTH_VERIFY_HOURS=6 pnpm truth:verify

# Last 30 days
TRUTH_VERIFY_HOURS=720 pnpm truth:verify
```

### With X Verification

```bash
# Verify 20 tweets on X
TRUTH_VERIFY_ON_X=true TRUTH_VERIFY_SAMPLE=20 pnpm truth:verify:last24h
```

**Note:** X verification requires `TWITTER_SESSION_B64` in `.env` (authenticated session).

---

## How to Run in Railway

### One-Off Check

```bash
# SSH into Railway container
railway run bash

# Run verification
pnpm truth:verify:last24h

# Or with custom window
TRUTH_VERIFY_HOURS=48 pnpm truth:verify
```

### As a Scheduled Job

**Enable in Railway environment:**

```bash
# Set via Railway CLI
railway variables --service xBOT --set "ENABLE_TRUTH_INTEGRITY_CHECK=true"

# Or via Railway dashboard:
# Go to xBOT service → Variables → Add:
# ENABLE_TRUTH_INTEGRITY_CHECK=true
```

**Schedule:**
- Runs every 15 minutes (configurable in `jobManager.ts`)
- Results logged to console (visible in Railway logs)
- Critical failures logged to `system_events` table

**To check results:**

```bash
# View logs
railway logs --service xBOT --lines 500 | grep "TRUTH_INTEGRITY"

# Check system_events table
# In Supabase SQL editor:
SELECT * FROM system_events 
WHERE component = 'truth_integrity' 
ORDER BY timestamp DESC 
LIMIT 10;
```

---

## Understanding the Report

### Example Output

```
======================================================================
TRUTH INTEGRITY VERIFICATION REPORT
======================================================================
Time Window: last 24 hours
Generated: 2025-12-19T18:30:00.000Z

SUMMARY:
  Total Decisions: 142
  Success: 98
  Failed: 12
  Retry/Queued: 32

INVARIANT CHECKS:
  ❌ False Success: 0
  ⚠️  Salvageable: 3
  ❌ Idempotency Violations: 0
  ⚠️  Suspect (X verification): 1

TOP VIOLATIONS (up to 20):
----------------------------------------------------------------------
Decision: abc12345...
  Reason: SALVAGEABLE: has tweet IDs but status=failed
  Status: failed
  Tweet ID: 1234567890
  Thread IDs: null

======================================================================
FINAL RESULT: ✅ PASS
======================================================================
```

### Exit Codes

- **0 (PASS)**: All critical invariants satisfied
- **1 (FAIL)**: Critical violation detected (false success or idempotency)

---

## What to Do if FAIL

### False Success Detected

**Symptom:** Status is `posted` but no tweet IDs

**What it means:** System marked a decision as successful without capturing tweet IDs. This is a **critical bug** in the posting pipeline.

**Action:**
1. Find the decision_id(s) from the report
2. Check logs for that decision:
   ```bash
   railway logs --service xBOT --lines 10000 | grep "decision_id=abc12345"
   ```
3. Look for:
   - `[LIFECYCLE] step=POST_CLICKED` (did posting succeed?)
   - `[LIFECYCLE] step=ID_CAPTURED` (were IDs extracted?)
   - `[LIFECYCLE] step=DB_CONFIRMED` (was DB save confirmed?)
4. If tweet exists on X:
   - Manually update DB with tweet_id
   - Investigate why ID capture failed
5. If tweet doesn't exist on X:
   - Mark decision as `failed`
   - Investigate why success was marked

### Idempotency Violation

**Symptom:** `tweet_id` doesn't match `thread_tweet_ids[0]`

**What it means:** Data corruption or duplicate processing

**Action:**
1. Check `thread_tweet_ids` format:
   ```sql
   SELECT decision_id, tweet_id, thread_tweet_ids 
   FROM content_metadata 
   WHERE decision_id = 'abc12345...';
   ```
2. Determine correct IDs:
   - Check tweet on X: `https://x.com/i/web/status/<tweet_id>`
   - If thread, verify all IDs are correct
3. Fix manually:
   ```sql
   -- If tweet_id is correct, fix thread_tweet_ids
   UPDATE content_metadata 
   SET thread_tweet_ids = '["1234567890"]'
   WHERE decision_id = 'abc12345...';
   
   -- Or vice versa
   UPDATE content_metadata 
   SET tweet_id = '1234567890'
   WHERE decision_id = 'abc12345...';
   ```

### Salvageable Rows

**Symptom:** Tweet IDs exist but status is `failed`/`retry`

**What it means:** Tweet was posted to X and IDs were captured, but DB marking failed. **This is recoverable.**

**Action:**

**Option 1: Auto-repair (recommended)**
```bash
# Repair last 24 hours (requires ENABLE_TRUTH_AUTO_REPAIR=true)
pnpm truth:repair:last24h

# With X verification (slower but safer)
pnpm truth:repair:with-verify
```

**Option 2: Manual reconciliation**
```bash
# Run reconciliation job (automatic if ENABLE_TRUTH_RECONCILE=true)
pnpm reconcile

# Or manually fix in Supabase SQL editor:
UPDATE content_metadata 
SET status = 'posted', posted_at = NOW(), reconciled_at = NOW()
WHERE decision_id IN (
  -- decision_ids from report
  'abc12345...', 'def67890...'
);
```

### Suspect Tweets

**Symptom:** X verification found tweet doesn't exist

**What it means:** Tweet was marked posted but is not on X (deleted, suspended, or DB corruption)

**Action:**
1. Manually check tweet: `https://x.com/SignalAndSynapse/status/<tweet_id>`
2. If truly missing:
   - Mark decision as `failed`
   - Investigate logs for what happened
3. If tweet exists (verification false positive):
   - Re-run verification
   - Check Playwright session is valid

---

## Configuration

### Environment Variables

```bash
# ===== Verification =====
# Enable scheduled checks (jobManager integration)
ENABLE_TRUTH_INTEGRITY_CHECK=true

# Time window in hours (default: 24)
TRUTH_VERIFY_HOURS=24

# Enable X verification (default: false)
TRUTH_VERIFY_ON_X=true

# X verification sample size (default: 10)
TRUTH_VERIFY_SAMPLE=10

# Required for X verification
TWITTER_SESSION_B64=<base64-encoded-session>

# ===== Truth Guard =====
# Pause posting on repeated failures (default: true)
ENABLE_TRUTH_GUARD=true

# ===== Auto-Repair =====
# Enable automatic repair of salvageable rows (default: false)
ENABLE_TRUTH_AUTO_REPAIR=false

# Verify on X before repairing (default: false)
TRUTH_REPAIR_VERIFY_X=false
```

### Job Registration

**Where:** `src/jobs/jobManager.ts` (line ~940)  
**Schedule:** Every 15 minutes (staggered start after 10 min)  
**Mechanism:** `scheduleStaggeredJob()` with setInterval  
**Enabled by:** `ENABLE_TRUTH_INTEGRITY_CHECK=true`

### Changing Schedule

Edit `src/jobs/jobManager.ts`:

```typescript
this.scheduleStaggeredJob(
  'truth_integrity',
  async () => { ... },
  15 * MINUTE, // Change frequency here (e.g., 30 * MINUTE)
  10 * MINUTE  // Change start delay here
);
```

---

## Monitoring

### Check Last Run

```bash
# View recent verification results
railway logs --service xBOT --lines 1000 | grep -A 20 "TRUTH INTEGRITY VERIFICATION"
```

### Alert on Failures

Check `system_events` for critical entries:

```sql
SELECT * FROM system_events 
WHERE component = 'truth_integrity' 
  AND severity = 'critical'
  AND timestamp > NOW() - INTERVAL '24 hours'
ORDER BY timestamp DESC;
```

**Set up alerting** (optional):
- Query this table every 5 minutes
- Send alert (email/Slack) if rows exist
- Use Railway's built-in monitoring or external service (PagerDuty, etc.)

---

## Troubleshooting

### "Failed to fetch decisions: ..."

**Problem:** Can't connect to Supabase

**Fix:**
- Check `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set
- Verify Supabase project is running
- Check network connectivity

### "X verification failed: ..."

**Problem:** Playwright can't load tweets

**Fix:**
- Ensure `TWITTER_SESSION_B64` is valid
- Session may have expired → re-extract session:
  ```bash
  pnpm session:extract
  pnpm session:deploy
  ```
- Disable X verification if not needed:
  ```bash
  TRUTH_VERIFY_ON_X=false pnpm truth:verify
  ```

### "No decisions found in time window"

**Problem:** No recent activity

**Fix:**
- Expand time window: `TRUTH_VERIFY_HOURS=168 pnpm truth:verify` (7 days)
- Verify posting system is running
- Check if decisions exist: `SELECT COUNT(*) FROM content_metadata;`

---

## Truth Guard (Posting Pause)

### What It Does

If truth integrity verification fails 3+ times in a rolling 60-minute window, the system **automatically pauses posting** to prevent learning pollution.

### How to Tell if Posting is Paused

Check logs for:
```
[TRUTH_GUARD] 🚫 posting_paused reason=TRUTH_VERIFY_FAIL_STREAK failure_count=3
[TRUTH_GUARD] Truth integrity is failing repeatedly - pausing posting to prevent learning pollution
```

### How to Unpause

1. **Fix the violations**:
   - Review the truth integrity report
   - Fix false success rows (if any)
   - Repair salvageable rows: `pnpm truth:repair:last24h`

2. **Verify integrity is restored**:
   ```bash
   pnpm truth:verify:last24h
   ```
   
3. **If PASS, posting will resume automatically** (failures expire after 60 min)

4. **To force unpause immediately** (not recommended):
   ```bash
   # In Supabase SQL editor:
   DELETE FROM system_events 
   WHERE component = 'truth_integrity' 
     AND event_type = 'verification_failed'
     AND timestamp > NOW() - INTERVAL '60 minutes';
   ```

### Disable Truth Guard (Not Recommended)

```bash
# In Railway:
railway variables --service xBOT --set "ENABLE_TRUTH_GUARD=false"
```

**Warning:** Disabling the guard allows posting even when truth integrity is failing, which can corrupt your learning system.

---

## Best Practices

1. **Run after deployments**: Verify truth integrity after any code changes
2. **Check weekly**: Run 7-day report to catch slow leaks
3. **Monitor scheduled runs**: If enabled, check system_events regularly
4. **Reconcile salvageable**: If salvageable count is high, run reconciliation
5. **Investigate false success immediately**: This indicates a critical bug

---

## Integration with CI/CD

### Pre-Deploy Check (Optional)

Add to your deployment workflow:

```bash
# In CI pipeline or pre-deploy script
pnpm truth:verify:last24h
if [ $? -ne 0 ]; then
  echo "❌ Truth integrity check failed - blocking deployment"
  exit 1
fi
```

### Post-Deploy Verification

```bash
# After Railway deployment
sleep 300  # Wait 5 minutes for warmup
railway run pnpm truth:verify:last24h
```

---

## Quick Reference

```bash
# Local
pnpm truth:verify:last24h        # Last 24h
pnpm truth:verify:last7d         # Last 7 days
pnpm truth:verify:with-x         # With X verification

# Railway one-off
railway run pnpm truth:verify:last24h

# Enable scheduled
railway variables --service xBOT --set "ENABLE_TRUTH_INTEGRITY_CHECK=true"

# Check logs
railway logs --service xBOT | grep "TRUTH_INTEGRITY"

# Query violations
SELECT * FROM system_events WHERE component = 'truth_integrity' AND severity = 'critical';
```

---

**Last Updated:** 2025-12-19  
**Maintained By:** xBOT Engineering Team

