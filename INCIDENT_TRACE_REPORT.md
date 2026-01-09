# 🚨 INCIDENT TRACE REPORT

**Date**: 2026-01-09  
**Incident**: Two bad replies posted (replies-to-replies, not root tweets)  
**Tweet IDs**: `2009613043710456073`, `2009611762119881177`

---

## EVIDENCE

### Lineage Table

| Field | Tweet 1 | Tweet 2 |
|-------|---------|---------|
| **posted_tweet_id** | 2009613043710456073 | 2009611762119881177 |
| **permit_id** | ❌ NONE | ❌ NONE |
| **decision_id** | ❌ NONE | ❌ NONE |
| **pipeline_source** | ❌ NONE | ❌ NONE |
| **railway_service_name** | ❌ NONE | ❌ NONE |
| **git_sha** | ❌ NONE | ❌ NONE |
| **run_id** | ❌ NONE | ❌ NONE |
| **target_tweet_id** | ❌ UNKNOWN | ❌ UNKNOWN |
| **target_is_root** | ❌ UNKNOWN | ❌ UNKNOWN |
| **job_origin** | ❌ UNKNOWN | ❌ UNKNOWN |

### Database Queries

```sql
-- Check permits
SELECT * FROM post_attempts WHERE actual_tweet_id IN ('2009613043710456073', '2009611762119881177');
-- Result: 0 rows

-- Check content metadata
SELECT * FROM content_generation_metadata_comprehensive WHERE tweet_id IN ('2009613043710456073', '2009611762119881177');
-- Result: 0 rows

-- Check ghost_tweets
SELECT * FROM ghost_tweets WHERE tweet_id IN ('2009613043710456073', '2009611762119881177');
-- Result: 0 rows (not yet detected)

-- Check system_events
SELECT * FROM system_events 
WHERE event_data->>'tweet_id' IN ('2009613043710456073', '2009611762119881177')
   OR event_data->>'posted_tweet_id' IN ('2009613043710456073', '2009611762119881177');
-- Result: 0 rows
```

---

## ROOT CAUSE

### Primary Issue: Reply Chain Fallback Bypasses Permit System

**Location**: `src/posting/BulletproofThreadComposer.ts:869` (`postViaReplies` method)

**Problem**:
1. Thread composer has a **reply chain fallback** mode when native composer fails
2. This fallback posts replies **directly** without permit checks
3. The fallback can reply to **any tweet** (including replies, not just roots)
4. No permit_id is passed to `postViaReplies()` method
5. No root verification occurs in fallback path

**Evidence**:
- Both tweets have **zero permits** (complete ghosts)
- Both tweets have **zero metadata** (no decision_id, no pipeline_source)
- Reply chain fallback doesn't require `permit_id` parameter (was optional)
- Fallback posts replies without checking if target is root

### Secondary Issue: Permit Approval Doesn't Enforce Root-Only

**Location**: `src/posting/postingPermit.ts:94` (`approvePostingPermit` function)

**Problem**:
1. Permit approval only checks if decision exists
2. **No root verification** at permit approval time
3. Permits can be APPROVED for replies to non-root tweets
4. No `target_is_root` or `target_in_reply_to_tweet_id` stored in permit

---

## FIXES IMPLEMENTED

### Fix 1: Add Permit Check to Reply Chain Fallback

**File**: `src/posting/BulletproofThreadComposer.ts`

**Changes**:
- Added `permit_id` as **required** parameter to `postViaReplies()` method
- Added permit verification at start of reply chain fallback
- Blocks reply chain if permit is missing or invalid
- Logs `reply_chain_fallback_blocked_no_permit` events

**Code**:
```typescript
private static async postViaReplies(page: Page, segments: string[], pool: any, permit_id?: string): Promise<...> {
  // 🔒 PERMIT CHECK: Reply chain fallback must have permit
  if (!permit_id) {
    throw new Error('BLOCKED: Reply chain fallback requires permit_id');
  }
  
  const permitCheck = await verifyPostingPermit(permit_id);
  if (!permitCheck.valid) {
    throw new Error(`BLOCKED: Permit not valid (${permitCheck.error})`);
  }
  // ... rest of method
}
```

### Fix 2: Enforce Root-Only at Permit Approval

**File**: `src/posting/postingPermit.ts`

**Changes**:
- Added root verification in `approvePostingPermit()` function
- For `decision_type='reply'`, checks:
  - `root_tweet_id === target_tweet_id` (structural check)
  - `is_root_tweet === true` from `reply_opportunities` (metadata check)
  - `target_in_reply_to_tweet_id IS NULL` (conversation check)
- Rejects permit with `reason_code='target_not_root'` if target is not root
- Stores `target_is_root` and `target_in_reply_to_tweet_id` in permit record
- Logs `permit_rejected_target_not_root` events

**Code**:
```typescript
// 🔒 ROOT-ONLY ENFORCEMENT: For replies, target MUST be root
if (permit.decision_type === 'reply' && permit.target_tweet_id) {
  const targetIsRoot = rootTweetId === targetTweetId;
  const isRootFromMetadata = opportunity?.is_root_tweet === true;
  const hasInReplyTo = opportunity?.target_in_reply_to_tweet_id !== null;
  
  if (!targetIsRoot || !isRootFromMetadata || hasInReplyTo) {
    // Reject permit
    await supabase.from('post_attempts').update({
      status: 'REJECTED',
      reason_code: 'target_not_root'
    }).eq('permit_id', permit_id);
    return { success: false, error: 'target_not_root' };
  }
}
```

### Fix 3: Database Migration for Root Enforcement

**File**: `supabase/migrations/20260109_add_root_enforcement_to_permits.sql`

**Changes**:
- Adds `target_is_root BOOLEAN` column to `post_attempts`
- Adds `target_in_reply_to_tweet_id TEXT` column to `post_attempts`
- Adds `reason_code TEXT` column to `post_attempts`
- Creates indexes for root enforcement queries

### Fix 4: Ghost Reconciliation Script

**File**: `scripts/ghost_reconciliation.ts`

**Purpose**:
- Detects tweets posted without permits
- Inserts into `ghost_tweets` table
- Logs `ghost_tweet_detected` events
- Can be run periodically to catch bypasses

---

## PROOF QUERIES

### Query 1: Verify Permits Exist for Incident Tweets

```sql
SELECT permit_id, decision_id, status, target_tweet_id, target_is_root, reason_code
FROM post_attempts
WHERE actual_tweet_id IN ('2009613043710456073', '2009611762119881177');
```

**Expected**: 0 rows (ghosts confirmed)

### Query 2: Verify Root Enforcement at Permit Approval

```sql
SELECT permit_id, decision_id, decision_type, target_tweet_id, target_is_root, reason_code, status
FROM post_attempts
WHERE decision_type = 'reply'
  AND status = 'REJECTED'
  AND reason_code = 'target_not_root'
ORDER BY created_at DESC
LIMIT 10;
```

**Expected**: Rejected permits with `reason_code='target_not_root'` after fix deployment

### Query 3: Verify Reply V2 System is Active

```sql
-- Fetch jobs
SELECT COUNT(*) FROM system_events
WHERE event_type = 'reply_v2_fetch_job_started'
  AND created_at >= NOW() - INTERVAL '30 minutes';

-- Scheduler jobs
SELECT COUNT(*) FROM system_events
WHERE event_type = 'reply_v2_scheduler_job_started'
  AND created_at >= NOW() - INTERVAL '30 minutes';

-- AI judge calls
SELECT COUNT(*) FROM llm_usage_log
WHERE purpose = 'target_judge'
  AND timestamp >= NOW() - INTERVAL '30 minutes';
```

**Expected**: All counts > 0 (system operational)

### Query 4: Verify Old Reply Job is Disabled

```sql
SELECT COUNT(*) FROM system_events
WHERE event_type LIKE '%reply_job%'
  AND created_at >= NOW() - INTERVAL '1 hour';
```

**Expected**: 0 (old system disabled)

### Query 5: Check for Ghost Detection Events

```sql
SELECT * FROM system_events
WHERE event_type = 'ghost_tweet_detected'
ORDER BY created_at DESC
LIMIT 10;
```

**Expected**: Incident tweets detected after reconciliation script runs

---

## NEXT MONITORING CHECKLIST

- [ ] Deploy migration: `20260109_add_root_enforcement_to_permits.sql`
- [ ] Deploy code fixes (permit enforcement + reply chain permit check)
- [ ] Run ghost reconciliation script to detect incident tweets
- [ ] Verify permits are rejected for non-root targets
- [ ] Verify reply chain fallback requires permit
- [ ] Monitor `permit_rejected_target_not_root` events
- [ ] Monitor `reply_chain_fallback_blocked_no_permit` events
- [ ] Monitor `ghost_tweet_detected` events
- [ ] Verify Reply System V2 is only active reply producer
- [ ] Set up alert for `ghost_tweet_detected` events

---

## CODE DIFFS SUMMARY

### `src/posting/postingPermit.ts`
- Added root verification in `approvePostingPermit()` (lines 122-180)
- Checks `root_tweet_id === target_tweet_id`
- Checks `is_root_tweet === true` from metadata
- Checks `target_in_reply_to_tweet_id IS NULL`
- Rejects permit with `reason_code='target_not_root'` if violation

### `src/posting/BulletproofThreadComposer.ts`
- Made `permit_id` required in `postViaReplies()` signature
- Added permit verification at start of reply chain fallback (lines 869-920)
- Blocks fallback if permit missing or invalid
- Passes `permit_id` from `post()` method to `postViaReplies()` (line 659)

### `supabase/migrations/20260109_add_root_enforcement_to_permits.sql`
- New migration adding `target_is_root`, `target_in_reply_to_tweet_id`, `reason_code` columns

### `scripts/ghost_reconciliation.ts`
- New script to detect and log ghost tweets

---

## CONCLUSION

**Root Cause**: Reply chain fallback in thread composer bypassed permit system and could reply to non-root tweets.

**Fix**: Hard enforcement at permit approval (root-only check) + permit requirement in reply chain fallback.

**Status**: Fixes implemented, awaiting deployment and verification.

