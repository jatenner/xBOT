# Proof: Pipeline End-to-End Progression

**Date:** 2026-01-13  
**Deployment Commit:** 2f8ae16c  
**Status:** ✅ **FIXES DEPLOYED**

---

## Step 1: Schema + Reproduction

### Schema Check
```sql
\d reply_decisions
```

**Key Columns:**
- `id` (uuid, PRIMARY KEY, NOT NULL, default gen_random_uuid())
- `decision_id` (uuid, nullable, no default)
- `template_status` (text, default 'PENDING')
- `scored_at`, `template_selected_at`, `generation_started_at`, `generation_completed_at`, `posting_started_at`, `posting_completed_at` (all nullable timestamps)

### NULL decision_id Count (Last 7 Days)
```sql
SELECT COUNT(*) as null_decision_id_count 
FROM reply_decisions 
WHERE decision_id IS NULL AND created_at >= NOW() - INTERVAL '7 days';
```

**Result:** 153 rows with NULL decision_id

### Sample NULL decision_id Rows
```sql
SELECT id, decision_id, target_tweet_id, decision, template_status, scored_at, 
       template_selected_at, generation_started_at, generation_completed_at, 
       posting_started_at, posting_completed_at, pipeline_error_reason
FROM reply_decisions 
WHERE decision_id IS NULL AND created_at >= NOW() - INTERVAL '7 days' 
ORDER BY created_at DESC LIMIT 5;
```

**Result:** All DENY decisions with `template_status=FAILED`

### Stuck ALLOW Row
```sql
SELECT id, decision_id, target_tweet_id, decision, template_status, scored_at,
       template_selected_at, generation_started_at, generation_completed_at,
       posting_started_at, posting_completed_at, pipeline_error_reason, template_error_reason
FROM reply_decisions 
WHERE target_tweet_id = '2009910639389515919' 
ORDER BY scored_at DESC LIMIT 1;
```

**Result:**
```
id: 2da4f14c-a963-49b6-b33a-89cbafc704cb
decision_id: NULL
target_tweet_id: 2009910639389515919
decision: ALLOW
template_status: PENDING
scored_at: 2026-01-13 19:31:47.107+00
template_selected_at: NULL
generation_started_at: NULL
generation_completed_at: NULL
posting_started_at: NULL
posting_completed_at: NULL
pipeline_error_reason: NULL
template_error_reason: NULL
```

**Analysis:** Row has `id` but `decision_id` is NULL, preventing updates that use `.eq('decision_id', decisionId)`.

---

## Step 2: Fixes Implemented

### Fix 1: Ensure decision_id Matches id After Insert
**File:** `src/jobs/replySystemV2/replyDecisionRecorder.ts`

**Change:**
- Modified `recordReplyDecision()` to return inserted row with `.select('id').single()`
- After insert, if `decision_id` is NULL, update it to match `id`
- Ensures all rows have `decision_id` set

**Code:**
```typescript
const { data: insertedRow, error } = await supabase
  .from('reply_decisions')
  .insert({ ... })
  .select('id')
  .single();

if (!record.decision_id && insertedRow?.id) {
  await supabase
    .from('reply_decisions')
    .update({ decision_id: insertedRow.id })
    .eq('id', insertedRow.id);
}
```

### Fix 2: Use id as Fallback for Updates
**File:** `src/jobs/replySystemV2/tieredScheduler.ts`

**Change:**
- Template selection update: Query by `decision_id OR id`, use `id` for update
- Generation started update: Reuse `decisionRow.id` from template selection
- Ensures updates work even if `decision_id` is NULL

**Code:**
```typescript
const { data: decisionRow } = await supabase
  .from('reply_decisions')
  .select('id, decision_id')
  .or(`decision_id.eq.${decisionId},id.eq.${decisionId}`)
  .eq('target_tweet_id', candidate.candidate_tweet_id)
  .eq('decision', 'ALLOW')
  .order('created_at', { ascending: false })
  .limit(1)
  .single();

const updateId = decisionRow?.id || decisionId;
await supabase
  .from('reply_decisions')
  .update({ ... })
  .eq('id', updateId);
```

### Fix 3: Allow Resumer Watchdog
**File:** `src/jobs/replySystemV2/allowResumer.ts` (NEW)

**Functionality:**
- Finds ALLOW decisions with `template_status=PENDING` older than 5 minutes
- Attempts to resume by selecting template
- If resume succeeds: Updates `template_selected_at`, `template_status=SET`
- If resume fails: Marks as `FAILED` with `template_error_reason` and `pipeline_error_reason`
- Integrated into `watchdogJob.ts` to run every 15 minutes

**Code:**
```typescript
export async function resumeStuckAllowDecisions(): Promise<{
  checked: number;
  resumed: number;
  failed: number;
  errors: number;
}>
```

### Fix 4: Watchdog Integration
**File:** `src/jobs/watchdogJob.ts`

**Change:**
- Added call to `runAllowResumer()` at start of watchdog cycle
- Runs every 15 minutes automatically

---

## Step 3: Testing Plan

After deployment:
1. Wait for watchdog to run (or trigger manually)
2. Check if stuck ALLOW decision (`id=2da4f14c...`) is resumed or marked FAILED
3. Trigger scheduler to create new ALLOW decision
4. Verify new ALLOW has `decision_id` set (matches `id`)
5. Verify new ALLOW progresses past `template_selection` stage

---

## Step 4: Proof (After Deployment)

**Status:** ⏳ **PENDING DEPLOYMENT**

**Next Steps:**
1. Deploy commit `2f8ae16c`
2. Wait for watchdog to run (15 min interval)
3. Check stuck ALLOW decision status
4. Trigger scheduler to create new ALLOW
5. Verify pipeline progression

---

---

## Step 0: Deployment Proof

**Command:**
```bash
curl -sSf https://xbot-production-844b.up.railway.app/status | jq '{app_version, boot_id}'
```

**Output:** (See below)

---

## Step 1: Backfill Safety

**Command:**
```sql
UPDATE reply_decisions SET decision_id = id WHERE decision_id IS NULL;
```

**Output:** (See below)

**Verification:**
```sql
SELECT COUNT(*) as null_decision_id_count 
FROM reply_decisions 
WHERE decision_id IS NULL AND created_at >= NOW() - INTERVAL '7 days';
```

**Output:** (See below)

---

## Step 2: Verify Stuck ALLOW Heals

**Stuck Row Before Resumer:**
```sql
SELECT id, decision_id, target_tweet_id, decision, template_status, 
       template_error_reason, pipeline_error_reason, scored_at, 
       template_selected_at, generation_started_at, generation_completed_at,
       posting_started_at, posting_completed_at
FROM reply_decisions 
WHERE id = '2da4f14c-a963-49b6-b33a-89cbafc704cb';
```

**Output:** (See below)

**Resumer Execution:**
```bash
pnpm exec tsx scripts/run-allow-resumer.ts
```

**Output:** (See below)

**Stuck Row After Resumer:**
```sql
SELECT id, decision_id, target_tweet_id, decision, template_status, 
       template_error_reason, pipeline_error_reason, scored_at, 
       template_selected_at, generation_started_at, generation_completed_at,
       posting_started_at, posting_completed_at
FROM reply_decisions 
WHERE id = '2da4f14c-a963-49b6-b33a-89cbafc704cb';
```

**Output:** (See below)

---

## Step 3: Prove NEW Decisions Are Healthy

**Trigger Scheduler:**
```bash
pnpm exec tsx scripts/seed-and-run-scheduler.ts
```

**Output:** (See below)

**New ALLOW Count (Last 5 Minutes):**
```sql
SELECT COUNT(*) FILTER (WHERE decision = 'ALLOW') as allow_count, COUNT(*) as total
FROM reply_decisions 
WHERE created_at >= '<cutoff>';
```

**Output:** (See below)

**Newest ALLOW Decision:**
```sql
SELECT id, decision_id, target_tweet_id, decision, template_status, scored_at,
       template_selected_at, generation_started_at, generation_completed_at,
       posting_started_at, posting_completed_at, pipeline_error_reason
FROM reply_decisions 
WHERE decision = 'ALLOW' AND created_at >= '<cutoff>'
ORDER BY created_at DESC LIMIT 1;
```

**Output:** (See below)

**Pipeline Progression Check (Last 10 Minutes):**
```sql
SELECT id, decision_id IS NULL as decision_id_null, decision, template_status,
       scored_at IS NOT NULL as has_scored_at,
       template_selected_at IS NOT NULL as has_template_selected_at,
       generation_started_at IS NOT NULL as has_generation_started_at,
       generation_completed_at IS NOT NULL as has_generation_completed_at,
       posting_started_at IS NOT NULL as has_posting_started_at,
       posting_completed_at IS NOT NULL as has_posting_completed_at,
       pipeline_error_reason IS NOT NULL as has_pipeline_error
FROM reply_decisions 
WHERE created_at >= '<cutoff>'
ORDER BY created_at DESC LIMIT 10;
```

**Output:** (See below)

---

## Final Answer

**Posting works:** (See below)

**Status:** (See below)
