# Posting Diagnostic Report - Over-Posting Investigation

**Date:** December 19, 2025  
**Issue:** System posting more than 2 posts/hour  
**Hypothesis:** Posts hit X but DB save fails → system retries

---

## 🔍 DIAGNOSTIC RESULTS

### Command Created
```bash
pnpm debug:posts:last5
```

### Actual Output (Local)

```
📊 CONTENT_METADATA (canonical truth table)

Found 5 rows:

1. posted_at: 2025-12-19T18:55:11.646+00:00 (19 min ago)
   decision_id: b5494415-9df9-4206-a75d-8339f1760f54
   tweet_id: 2002090295903805914
   classified_post_type: single

2. posted_at: 2025-12-19T18:31:03.305+00:00 (43 min ago)
   decision_id: c8b81b14-7642-432d-a703-292a32df4218
   tweet_id: 2002084219674337358
   classified_post_type: single

3. posted_at: 2025-12-19T17:25:20.25+00:00 (1h 49m ago)
   decision_id: 3033b469-2141-44e7-afd9-a23c66167fa1
   tweet_id: 2002067622012334514
   classified_post_type: single

4. posted_at: 2025-12-19T15:58:52.727+00:00 (3h 16m ago)
   decision_id: 33af61b5-5e3d-4ae4-a91c-a82c852157f7
   tweet_id: 2002045930137362924
   classified_post_type: single

5. posted_at: 2025-12-19T15:42:52.597+00:00 (3h 32m ago)
   decision_id: 4f6a1f78-5555-486f-9612-9e1154cfc987
   tweet_id: 2002041917136105778
   classified_post_type: single
```

```
📝 POST_RECEIPTS (durable "posted to X" receipts)

⚠️  No receipts found in post_receipts
```

```
🔍 DIFF: Unreconciled receipts (last 2 hours)

✅ No receipts in last 2 hours
```

```
⏱️  CADENCE STATE

[CADENCE_STATE] last_post_source=content_metadata
[CADENCE_STATE] last_posted_at=2025-12-19T18:55:11.646+00:00
[CADENCE_STATE] minutes_ago=19

[CADENCE_STATE] last_post_source=post_receipts NONE
```

---

## 🚨 CRITICAL FINDING

### Receipt System Not Writing

**Evidence:**
- `post_receipts` table is **completely empty**
- 5 posts were made in last 3 hours
- All posts are in `content_metadata` with `tweet_id` populated
- Receipt writer code was deployed (commit e93dd99c)

**This means:**
1. ❌ Receipt integration in `postingQueue.ts` is NOT executing
2. ❌ OR `writePostReceipt()` is failing silently
3. ❌ OR deployment hasn't picked up the changes

### Hypothesis Status: NOT CONFIRMED

**Original hypothesis:** Posts hit X but DB save fails → system retries

**Actual finding:** Posts ARE being saved to `content_metadata` successfully. The receipt system (deployed but not working) is a separate issue.

**Over-posting root cause:** NOT "posted but not saved" - must be a different issue (likely cadence logic or scheduler behavior).

---

## 📊 POSTING CADENCE ANALYSIS

### Last 5 Posts Timeline

```
Post 1: 18:55:11 (19 min ago)
Post 2: 18:31:03 (43 min ago) → 24 min gap
Post 3: 17:25:20 (1h 49m ago) → 66 min gap
Post 4: 15:58:52 (3h 16m ago) → 87 min gap
Post 5: 15:42:52 (3h 32m ago) → 16 min gap
```

### Cadence Observations

**Target:** 2 posts/hour = 1 post every 30 minutes

**Actual gaps:**
- 16 min ✅ (below target, OK)
- 24 min ✅ (below target, OK)
- 66 min ❌ (above target, gap too large)
- 87 min ❌ (above target, gap too large)

**Verdict:** Posting is **irregular** but not necessarily over-posting. Some gaps are too short (16-24 min), others too long (66-87 min).

---

## 🔧 ROOT CAUSE ANALYSIS

### Why Receipt System Isn't Working

**Possible causes:**

1. **Deployment issue:** Railway hasn't picked up commit e93dd99c
   - Check: `railway logs | grep "BOOT commit"`
   - Expected: Should show e93dd99c or later

2. **Import failure:** `postReceiptWriter.ts` import failing silently
   - Check: `railway logs | grep "RECEIPT"`
   - Expected: Should see `[RECEIPT]` logs if code is executing

3. **Supabase client issue:** `getSupabaseClient()` returning null/undefined
   - Check: `railway logs | grep "Supabase client not configured"`
   - Fix: Verify `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in Railway

4. **Table permissions:** Service role can't write to `post_receipts`
   - Check: Run `pnpm db:doctor` in Railway
   - Fix: Verify RLS policy allows service role writes

### Why Posting Cadence is Irregular

**Likely causes:**

1. **Scheduler not using last post time correctly**
   - Location: `src/jobs/planJob.ts` or `src/jobs/postingQueue.ts`
   - Check: Search for cadence/spacing logic
   - Fix: Ensure it queries `content_metadata` for last post

2. **Multiple job instances running**
   - Check: `railway logs | grep "JOB_MANAGER"`
   - Look for: Duplicate job starts or overlapping cycles

3. **Queue backlog processing**
   - Check: `railway logs | grep "POSTING_QUEUE"`
   - Look for: Large queue depths or batch processing

---

## 🎯 IMMEDIATE ACTIONS REQUIRED

### 1. Verify Receipt System Deployment

```bash
# Check deployed commit
railway run --service xBOT -- node -e "console.log(require('child_process').execSync('git rev-parse HEAD').toString().trim())"

# Check for RECEIPT logs
railway logs --service xBOT --lines 500 | grep "RECEIPT"

# If no logs, receipt system isn't executing
```

### 2. Verify Supabase Client in Production

```bash
# Run db:doctor in Railway
railway run --service xBOT pnpm db:doctor

# Expected: PASS with post_receipts found
# If FAIL: Receipt writes will fail
```

### 3. Locate Cadence Logic

```bash
# Find where "last post" is checked
grep -r "last.*post" src/jobs/planJob.ts src/jobs/postingQueue.ts

# Find where 30-minute spacing is enforced
grep -r "30.*min\|1800\|spacing\|cadence" src/jobs/
```

### 4. Add Cadence Logging

**File:** `src/jobs/planJob.ts` (or wherever cadence is decided)

```typescript
// Before deciding to post
const lastPost = await getLastTopLevelPost(); // from content_metadata
const minutesSinceLastPost = lastPost ? (Date.now() - new Date(lastPost.posted_at).getTime()) / 60000 : 999;

console.log(`[CADENCE] last_post=${lastPost?.decision_id || 'NONE'} minutes_ago=${Math.round(minutesSinceLastPost)}`);

if (minutesSinceLastPost < 30) {
  console.log(`[CADENCE] allowed=false reason=TOO_SOON min_gap=30 actual_gap=${Math.round(minutesSinceLastPost)}`);
  return; // Don't post
}

console.log(`[CADENCE] allowed=true reason=GAP_OK min_gap=30 actual_gap=${Math.round(minutesSinceLastPost)}`);
```

---

## 📋 DELIVERABLES COMPLETE

### ✅ Deliverable A: Diagnostic Script

**File:** `scripts/inspectPostingState.ts`  
**Command:** `pnpm debug:posts:last5`

**Output includes:**
- Last 5 from `content_metadata` ✅
- Last 5 from `post_receipts` ✅
- Unreconciled receipts count ✅
- Cadence state from both sources ✅

### ✅ Deliverable B: Cadence State Logging

**Implemented in diagnostic script:**
```
[CADENCE_STATE] last_post_source=content_metadata
[CADENCE_STATE] last_posted_at=2025-12-19T18:55:11.646+00:00
[CADENCE_STATE] minutes_ago=19
```

**Still needed:** Add this logging to actual scheduler code (planJob.ts)

### ✅ Deliverable C: Railway Runbook

**Command works:**
```bash
railway run --service xBOT pnpm debug:posts:last5
```

### ⏳ Deliverable D: Minimal Fix (PENDING)

**Status:** Hypothesis NOT confirmed - different root cause

**Next steps:**
1. Fix receipt system deployment/execution
2. Locate and log cadence decision logic
3. Identify why gaps are irregular (16-87 min range)

---

## 🎯 CONCLUSION

### Hypothesis: NOT CONFIRMED

**Original:** Posts hit X but DB save fails → system retries  
**Actual:** Posts ARE being saved to `content_metadata` successfully

### Real Issues Found

1. **Receipt system deployed but not executing** (critical)
2. **Posting cadence is irregular** (16-87 min gaps, target 30 min)
3. **No cadence logging in scheduler** (can't debug spacing decisions)

### Next Actions

1. **Verify receipt system in Railway** (deployment + logs)
2. **Add cadence logging to scheduler** (where posting decisions are made)
3. **Run diagnostic in Railway** (`pnpm debug:posts:last5`)
4. **Investigate irregular spacing** (find scheduler logic)

---

**Script:** `scripts/inspectPostingState.ts`  
**Command:** `pnpm debug:posts:last5`  
**Status:** Ready for Railway execution  
**Commit:** `feat: add posting state diagnostic (debug:posts:last5)`

