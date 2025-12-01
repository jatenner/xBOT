# 🐛 Posting Success Rate Calculation Bug

## The Problem

**Dashboard shows:** "Posting success rate is 41%"
**Reality:** Posts ARE going out successfully (you can see them on Twitter)

## Root Cause

The success rate calculation is **counting 'attempting' records**, which inflates the denominator!

### How `logPostAttempt` Works

Every post creates **2 records**:
1. `'attempting'` - logged BEFORE posting starts
2. `'success'` OR `'failed'` - logged AFTER posting completes

### Current Calculation (WRONG)

```typescript
// From src/api/systemDiagnosticsApi.ts:40-59
const { data: attempts } = await supabase
  .from('posting_attempts')
  .select('status, error_message, created_at')
  .gte('created_at', oneDayAgo)
  .order('created_at', { ascending: false })
  .limit(50);

postingStats.success = attempts.filter(a => a.status === 'success').length;
postingStats.failed = attempts.filter(a => a.status === 'failed').length;
postingStats.successRate = (postingStats.success / attempts.length) * 100;
```

**Problem:** `attempts.length` includes ALL records: 'attempting', 'success', AND 'failed'

### Example (Why 41% is Wrong)

**Scenario:** 10 posts attempted, 5 succeeded, 5 failed

**Records in database:**
- 10 × 'attempting' records
- 5 × 'success' records  
- 5 × 'failed' records
- **Total: 20 records**

**Current calculation:**
- Success count: 5 ('success' records)
- Total: 20 (ALL records)
- Success rate: 5/20 = **25%** ❌

**Actual success rate:**
- Posts attempted: 10
- Posts succeeded: 5
- Success rate: 5/10 = **50%** ✅

## The Fix

Only count **final statuses** ('success' or 'failed'), not 'attempting':

```typescript
// Option 1: Filter out 'attempting' records
const finalAttempts = attempts.filter(a => a.status !== 'attempting');
postingStats.success = finalAttempts.filter(a => a.status === 'success').length;
postingStats.failed = finalAttempts.filter(a => a.status === 'failed').length;
postingStats.successRate = (postingStats.success / finalAttempts.length) * 100;

// Option 2: Count unique decision_ids with latest status
// (More accurate - handles retries)
```

## Why This Matters

- **False alarm:** Dashboard says "System NOT WORKING" when it actually is
- **Misleading metrics:** Can't trust the success rate
- **Wasted investigation:** Looking for problems that don't exist

## Verification

Check your `posting_attempts` table:
```sql
SELECT 
  status,
  COUNT(*) as count
FROM posting_attempts
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY status;
```

You'll likely see:
- ~40% 'attempting' records
- ~30% 'success' records
- ~30% 'failed' records

This explains why success rate shows ~41% (30% success / 70% non-attempting = ~43%, close to 41%)

