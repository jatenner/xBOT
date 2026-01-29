# E2E Reply V2 PLAN_ONLY Pipeline Status Report

**Generated:** 2026-01-28 23:58:00 EST  
**Commit SHA:** c3b2c7d3da8ba2c7e14d44483334150acd0333dd  
**Railway SHA:** c3b2c7d3da8ba2c7e14d44483334150acd0333dd ✅

---

## Executive Summary

**Status:** ⚠️ **PARTIAL SUCCESS** - Generation working, posting blocked by deleted tweets

**Progress:**
- ✅ Planner creates decisions with strategy attribution
- ✅ Mac Runner generates content successfully (11 decisions generated)
- ✅ Truncation fix prevents "too long" errors
- ❌ Posting blocked by `target_not_found_or_deleted` (8 decisions)
- ❌ No decisions reached `posted` status yet

---

## Fixes Applied (Commit c3b2c7d3)

### 1. Reply Length Truncation
**File:** `src/jobs/replySystemV2/planOnlyContentGenerator.ts`  
**Fix:** Added truncation logic to ensure generated content ≤220 chars at word boundary  
**Status:** ✅ Implemented and deployed

### 2. Preflight Tweet Existence Check
**File:** `src/jobs/replySystemV2/tieredScheduler.ts`  
**Fix:** Added preflight check before creating PLAN_ONLY decisions (8s timeout)  
**Status:** ✅ Implemented and deployed to Railway

### 3. Context-Lock Auto-Heal
**File:** `src/jobs/postingQueue.ts`  
**Fix:** Auto-heal for `context_mismatch` with similarity 0.33-0.45 (0.33 for <20m old decisions)  
**Status:** ✅ Implemented and deployed

### 4. Queue Prioritization
**File:** `src/jobs/postingQueue.ts`  
**Fix:** Prioritize newest `reply_v2_planner` decisions (created within 20 minutes)  
**Status:** ✅ Implemented and deployed

### 5. Stability Heuristics
**Files:** `src/ai/realTwitterDiscovery.ts`, `src/jobs/replySystemV2/queueManager.ts`  
**Fix:** Filter tweets <2min old, prefer 5-45min window, add stability features  
**Status:** ⚠️ Partially implemented (features not persisted - `reply_opportunities` lacks `features` column)

---

## Current Blocker Analysis

### Dominant Blocker: `target_not_found_or_deleted`
**Count:** 8 decisions  
**Root Cause:** Tweets deleted between planning and execution  
**Evidence:**
```sql
SELECT status, COUNT(*) FROM content_generation_metadata_comprehensive 
WHERE pipeline_source='reply_v2_planner' AND created_at > NOW() - INTERVAL '60 minutes' 
GROUP BY status;
```
Result:
- `blocked_permanent`: 8 (all `target_not_found_or_deleted`)
- `failed`: 6 (old "too long" errors from before truncation)
- `blocked`: 3 (1 `context_mismatch` with similarity 0.05)

**Mitigation:** Preflight check deployed, should prevent new decisions for deleted tweets

### Secondary Blocker: `context_mismatch` (Low Similarity)
**Count:** 1 decision  
**Similarity:** 0.05 (too low for auto-heal band 0.33-0.45)  
**Evidence:** Tweet content changed significantly between planning and execution

---

## Generation Success Evidence

**11 decisions successfully generated:**
```sql
SELECT COUNT(*) FROM content_generation_metadata_comprehensive 
WHERE pipeline_source='reply_v2_planner' 
AND created_at > NOW() - INTERVAL '60 minutes'
AND features->>'generated_by' = 'mac_runner';
```
Result: **11 decisions**

**Example generated content:**
- Decision `dd98a322-a631-4713-931e-dea5b7ec9956`: "What most people miss: the potential of reprogrammed fat cells..."
- Decision `3d80d5bf-3a8c-431b-97bc-e365ff3480b9`: "What most people miss: the ability to reverse type 1 diabetes..."
- All generated content is properly truncated (<220 chars)

---

## Next Steps

1. **Wait for Railway planner cycle** to create fresh decisions with preflight check
2. **Monitor new decisions** - preflight should filter out deleted tweets early
3. **Restart Mac Runner daemon** once fresh decisions are queued
4. **Verify posting** - with preflight + auto-heal, should see successful posts

---

## SQL Evidence Queries

### Status Distribution (Last 60 Minutes)
```sql
SELECT status, COUNT(*) AS count, 
       COUNT(CASE WHEN features->>'generated_by' = 'mac_runner' THEN 1 END) AS generated_count 
FROM content_generation_metadata_comprehensive 
WHERE pipeline_source='reply_v2_planner' 
AND created_at > NOW() - INTERVAL '60 minutes' 
GROUP BY status 
ORDER BY count DESC;
```

### Recent Decisions with Generation Status
```sql
SELECT decision_id, status, updated_at, 
       features->>'generated_by' AS generated_by, 
       features->>'strategy_id' AS strategy_id, 
       LEFT(content, 100) AS preview 
FROM content_generation_metadata_comprehensive 
WHERE pipeline_source='reply_v2_planner' 
AND created_at > NOW() - INTERVAL '60 minutes' 
ORDER BY updated_at DESC 
LIMIT 15;
```

---

## Known Issues

1. **`reply_opportunities.features` column missing** - Stability features not persisted
2. **Daemon runtime cap** - Daemon crashes after 300s (expected behavior, but may interrupt monitoring)
3. **Fresh opportunities low** - Only 2 fresh opportunities in last 60 minutes (harvester running)

---

## Conclusion

The pipeline is **functionally working** for generation, but posting is blocked by ephemeral target tweets. The preflight check should mitigate this for new decisions. Once Railway creates fresh decisions with preflight validation, we expect to see successful posts.

**Recommendation:** Monitor next Railway planner cycle (typically runs every 15-30 minutes) and verify preflight check filters deleted tweets before decision creation.
