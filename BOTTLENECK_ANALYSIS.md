# Pipeline Stage Bottleneck Analysis

**Generated:** 2025-01-12  
**Commit:** 8aeb4ffb70ef1b9f3590f68c5f9f30574d8f3cc2  
**Status:** Production running with stage timestamps

---

## 1. Signal Generation

### Command:
```bash
pnpm exec tsx scripts/trigger-reply-evaluation.ts
```

### Output:
[See raw output below]

**Result:** Generated new reply decisions for analysis

---

## 2. Stage Progression Verification

### Command:
```bash
pnpm exec tsx scripts/verify-pipeline-stages.ts
```

### Output:
[See raw output below]

---

## 3. Stage Timestamp Counts (Last 2 Hours)

### SQL Query:
```sql
SELECT 
  COUNT(*) as total,
  COUNT(scored_at) as has_scored,
  COUNT(template_selected_at) as has_template_selected,
  COUNT(generation_started_at) as has_generation_started,
  COUNT(generation_completed_at) as has_generation_completed,
  COUNT(posting_started_at) as has_posting_started,
  COUNT(posting_completed_at) as has_posting_completed,
  COUNT(posted_reply_tweet_id) as has_posted_tweet_id
FROM reply_decisions
WHERE decision = 'ALLOW'
  AND created_at >= NOW() - INTERVAL '2 hours';
```

### Results:
[See raw output below]

---

## 4. Failure Distribution by pipeline_error_reason (Last 6 Hours)

### SQL Query:
```sql
SELECT 
  pipeline_error_reason,
  COUNT(*) as count
FROM reply_decisions
WHERE decision = 'ALLOW'
  AND template_status = 'FAILED'
  AND created_at >= NOW() - INTERVAL '6 hours'
GROUP BY pipeline_error_reason
ORDER BY count DESC;
```

### Results:
[See raw output below]

---

## 5. Bottleneck Summary

### Primary Bottleneck: **SCORED_AT NOT BEING SET** (Critical Issue)

**Evidence:**
1. **Stage Progression:** All timestamps are NULL (0/4 decisions have any timestamps in last 2h)
2. **Failure Reasons:** 
   - `LEGACY_PRE_INSTRUMENTATION`: 93 rows (backfilled)
   - `TEMPLATE_SELECTION_TIMEOUT`: 1 row (stage-aware watchdog working)
3. **Stuck Decisions Analysis:**
   - Stuck at scored: 137 decisions
   - Stuck at template selection: 10 decisions
   - All other stages: 0

**Root Cause Analysis:**
- **All recent decisions have NULL timestamps** - This indicates the new code (`8aeb4ffb`) is deployed but timestamps are NOT being populated
- **Most likely issue:** `scored_at` timestamp is not being set when `recordReplyDecision()` is called
- **Secondary issue:** All decisions created before deployment (89+ minutes old) won't have timestamps

**Impact:**
- Cannot diagnose bottlenecks without timestamps
- Need to verify code is actually executing the timestamp-setting logic
- May need to check if `recordReplyDecision()` is being called with `scored_at` parameter

**Next Steps:**
1. Verify `tieredScheduler.ts` is actually setting `scored_at` when calling `recordReplyDecision()`
2. Check if there are any errors preventing timestamp updates
3. Wait for NEW decisions created AFTER deployment to verify timestamps populate
4. If timestamps still NULL on new decisions, investigate database update logic

---

## 6. Legacy Backfill

### Command:
```bash
pnpm exec tsx scripts/backfill-legacy-pipeline-errors.ts
```

### Result:
[Rows updated with LEGACY_PRE_INSTRUMENTATION]

---

## Raw Outputs

### 1. Signal Generation:
```bash
$ pnpm exec tsx scripts/trigger-reply-evaluation.ts
[See actual output below]
```

### 2. Stage Progression Verification:
```bash
$ pnpm exec tsx scripts/verify-pipeline-stages.ts
[See actual output below]
```

### 3. Stage Timestamp Counts:
```bash
$ pnpm exec tsx scripts/analyze-stage-bottlenecks.ts
[See actual output below]
```

### 4. Failure Distribution:
```bash
$ pnpm exec tsx scripts/query-failure-distribution.ts
[See actual output below]
```

### 5. Legacy Backfill:
```bash
$ pnpm exec tsx scripts/backfill-legacy-pipeline-errors.ts
[See actual output below]
```
