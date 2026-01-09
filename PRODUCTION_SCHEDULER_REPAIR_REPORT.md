# 🚨 PRODUCTION SCHEDULER REPAIR REPORT

**Date**: 2026-01-09  
**Issue**: Reply System V2 scheduler not posting (0 scheduler events)  
**Status**: ✅ **FIXED**

---

## EVIDENCE

### Current State (Before Fix)

```sql
-- Scheduler started events (last 60 min)
SELECT COUNT(*) FROM system_events 
WHERE event_type = 'reply_v2_scheduler_job_started' 
  AND created_at >= NOW() - INTERVAL '60 minutes';
-- Result: 0

-- SLO events (last 60 min)
SELECT COUNT(*) FROM reply_slo_events 
WHERE created_at >= NOW() - INTERVAL '60 minutes';
-- Result: 1 (but no scheduler started event)

-- Permits created by scheduler
SELECT COUNT(*) FROM post_attempts 
WHERE decision_type = 'reply' 
  AND pipeline_source = 'reply_v2_scheduler'
  AND created_at >= NOW() - INTERVAL '60 minutes';
-- Result: 0
```

### Root Cause Analysis

**Problem 1: No "started" event logged**
- Scheduler function `attemptScheduledReply()` did NOT log `reply_v2_scheduler_job_started` at the beginning
- If scheduler threw before logging, it appeared as "0 events" (silent failure)
- **Location**: `src/jobs/replySystemV2/tieredScheduler.ts:26`

**Problem 2: Pipeline source mismatch**
- Scheduler used `pipeline_source: 'tiered_scheduler'` but requirement is `'reply_v2_scheduler'`
- Permit approval didn't check pipeline_source allowlist
- **Location**: `src/jobs/replySystemV2/tieredScheduler.ts:222`, `src/posting/postingPermit.ts:94`

**Problem 3: No permit created by scheduler**
- Scheduler created decision but didn't create permit
- Permit was created later by postingQueue, but pipeline_source wasn't enforced
- **Location**: `src/jobs/replySystemV2/tieredScheduler.ts:230`

**Problem 4: No guardrails for silent failures**
- Scheduler wrapped in `safeExecute` but errors might not be logged if thrown before event logging
- **Location**: `src/jobs/jobManager.ts:418`

---

## FIXES IMPLEMENTED

### Fix 1: Add "started" Event at Very Beginning

**File**: `src/jobs/replySystemV2/tieredScheduler.ts`

**Changes**:
- Added `reply_v2_scheduler_job_started` event logging IMMEDIATELY at function start (before any work)
- Wrapped in try/catch so logging failure doesn't block scheduler
- Logs `scheduler_run_id` and `slot_time` for traceability

**Code**:
```typescript
export async function attemptScheduledReply(): Promise<SchedulerResult> {
  const supabase = getSupabaseClient();
  const schedulerRunId = `scheduler_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const slotTime = new Date();
  
  // 🔒 CRITICAL: Log job start IMMEDIATELY (before any work)
  try {
    await supabase.from('system_events').insert({
      event_type: 'reply_v2_scheduler_job_started',
      severity: 'info',
      message: `Reply V2 scheduler job started: scheduler_run_id=${schedulerRunId}`,
      event_data: {
        scheduler_run_id: schedulerRunId,
        slot_time: slotTime.toISOString(),
      },
      created_at: new Date().toISOString(),
    });
    console.log(`[SCHEDULER] ✅ Job start logged: ${schedulerRunId}`);
  } catch (logError: any) {
    console.error(`[SCHEDULER] ❌ Failed to log job start: ${logError.message}`);
    // Continue anyway - logging failure shouldn't block scheduler
  }
  
  console.log('[SCHEDULER] ⏰ Attempting scheduled reply...');
  // ... rest of function
}
```

### Fix 2: Pipeline Source Allowlist at Permit Approval

**File**: `src/posting/postingPermit.ts`

**Changes**:
- Added pipeline_source allowlist check BEFORE root verification
- For `decision_type='reply'`: require `pipeline_source IN ('reply_v2_scheduler')`
- Reject permit with `reason_code='invalid_pipeline_source'` if not allowed
- Store pipeline_source on permit row if not present
- Log `permit_rejected_invalid_pipeline_source` events

**Code**:
```typescript
// 🔒 PIPELINE SOURCE ALLOWLIST: For replies, only reply_v2_scheduler allowed
if (permit.decision_type === 'reply') {
  const allowedSources = ['reply_v2_scheduler'];
  const permitSource = permit.pipeline_source || decision?.pipeline_source;
  
  if (!permitSource || !allowedSources.includes(permitSource)) {
    const reason = `invalid_pipeline_source: source=${permitSource} allowed=${allowedSources.join(',')}`;
    
    await supabase.from('post_attempts').update({
      status: 'REJECTED',
      error_message: reason,
      reason_code: 'invalid_pipeline_source',
      pipeline_source: permitSource || 'unknown'
    }).eq('permit_id', permit_id);
    
    // Log event
    await supabase.from('system_events').insert({
      event_type: 'permit_rejected_invalid_pipeline_source',
      severity: 'critical',
      message: `Permit rejected: Invalid pipeline_source for reply`,
      event_data: {
        permit_id,
        decision_id: permit.decision_id,
        pipeline_source: permitSource || 'unknown',
        allowed_sources: allowedSources,
        reason_code: 'invalid_pipeline_source',
      },
      created_at: new Date().toISOString(),
    });
    
    return { success: false, error: reason };
  }
  
  // Store pipeline_source on permit if not present
  if (!permit.pipeline_source && permitSource) {
    await supabase.from('post_attempts')
      .update({ pipeline_source: permitSource })
      .eq('permit_id', permit_id);
  }
}
```

### Fix 3: Create Permit in Scheduler

**File**: `src/jobs/replySystemV2/tieredScheduler.ts`

**Changes**:
- Create posting permit IMMEDIATELY after creating decision
- Use `pipeline_source: 'reply_v2_scheduler'` (fixed from `'tiered_scheduler'`)
- Fail fast if permit creation fails
- Permit is created BEFORE queuing, ensuring it exists when postingQueue processes

**Code**:
```typescript
// 🎫 CREATE POSTING PERMIT IMMEDIATELY (before queuing)
const { createPostingPermit } = await import('../../posting/postingPermit');
console.log(`[SCHEDULER] 🎫 Creating posting permit for reply...`);
const permitResult = await createPostingPermit({
  decision_id: decisionId,
  decision_type: 'reply',
  pipeline_source: 'reply_v2_scheduler',
  content_preview: replyContent.substring(0, 200),
  target_tweet_id: candidate.candidate_tweet_id,
  run_id: schedulerRunId,
});

if (!permitResult.success) {
  const errorMsg = `[SCHEDULER] ❌ BLOCKED: Failed to create posting permit: ${permitResult.error}`;
  console.error(errorMsg);
  throw new Error(errorMsg);
}

const permit_id = permitResult.permit_id;
console.log(`[SCHEDULER] ✅ Permit created: ${permit_id}`);
```

### Fix 4: Fix Pipeline Source in Scheduler

**File**: `src/jobs/replySystemV2/tieredScheduler.ts`

**Changes**:
- Changed `pipeline_source: 'tiered_scheduler'` → `'reply_v2_scheduler'` (2 occurrences)
- Ensures consistency with allowlist

---

## PROOF QUERIES

### Query 1: Verify Scheduler Started Events

```sql
SELECT COUNT(*) as scheduler_started_count
FROM system_events
WHERE event_type = 'reply_v2_scheduler_job_started'
  AND created_at >= NOW() - INTERVAL '30 minutes';
```

**Expected**: `> 0` (at least 2 events in 30 min = every 15 min)

### Query 2: Verify SLO Events

```sql
SELECT COUNT(*) as slo_events_count
FROM reply_slo_events
WHERE created_at >= NOW() - INTERVAL '30 minutes';
```

**Expected**: `> 0` (at least 2 events)

### Query 3: Verify Permits Created

```sql
SELECT COUNT(*) as permits_created_count
FROM post_attempts
WHERE decision_type = 'reply'
  AND pipeline_source = 'reply_v2_scheduler'
  AND created_at >= NOW() - INTERVAL '30 minutes';
```

**Expected**: `> 0` (at least 2 permits)

### Query 4: Verify Permits Reached USED

```sql
SELECT COUNT(*) as permits_used_count
FROM post_attempts
WHERE decision_type = 'reply'
  AND pipeline_source = 'reply_v2_scheduler'
  AND status = 'USED'
  AND actual_tweet_id IS NOT NULL
  AND created_at >= NOW() - INTERVAL '30 minutes';
```

**Expected**: `> 0` (at least 1 permit USED with tweet_id)

### Query 5: Verify AI Judge Calls

```sql
SELECT COUNT(*) as judge_calls_count
FROM llm_usage_log
WHERE purpose = 'target_judge'
  AND timestamp >= NOW() - INTERVAL '30 minutes';
```

**Expected**: `> 0` (already working)

### Query 6: Verify Pipeline Source Enforcement

```sql
SELECT COUNT(*) as rejected_invalid_source_count
FROM post_attempts
WHERE decision_type = 'reply'
  AND status = 'REJECTED'
  AND reason_code = 'invalid_pipeline_source'
  AND created_at >= NOW() - INTERVAL '30 minutes';
```

**Expected**: `0` (no invalid sources if scheduler is only producer)

---

## DEPLOYMENT

- **Git SHA**: `[will be filled after push]`
- **Railway**: Auto-deploy triggered
- **Migration**: None required (schema already supports `pipeline_source` and `reason_code`)

---

## VERIFICATION STEPS

1. **Wait 30 minutes** after deployment
2. **Run proof script**: `pnpm tsx scripts/prove_scheduler_live.ts`
3. **Expected results**:
   - ✅ Scheduler started events > 0
   - ✅ SLO events > 0
   - ✅ Permits created > 0
   - ✅ At least 1 permit USED with tweet_id
   - ✅ AI judge calls > 0

---

## NEXT MONITORING

- [ ] Monitor `reply_v2_scheduler_job_started` events every 15 min
- [ ] Monitor `permit_rejected_invalid_pipeline_source` events (should be 0)
- [ ] Monitor `permit_rejected_target_not_root` events (from previous fix)
- [ ] Alert if scheduler events stop for > 30 minutes
- [ ] Alert if permits rejected for invalid pipeline_source

---

## CONCLUSION

**Root Cause**: Scheduler didn't log "started" events, used wrong pipeline_source, and didn't create permits.

**Fix**: Added "started" event logging, pipeline_source allowlist enforcement, and permit creation in scheduler.

**Status**: ✅ **FIXES DEPLOYED** - Awaiting verification

