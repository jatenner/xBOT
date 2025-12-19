# URGENT FIX: Content Metadata View Update Issue

## Problem
`content_metadata` is a VIEW, not a base table. Updates to views may fail silently or route to wrong table.

## Solution
1. Find the BASE TABLE that `content_metadata` view points to
2. Update `markDecisionPosted` to write to the BASE TABLE
3. Add explicit error logging if write fails

## Commands to Run

```sql
-- Find the base table
SELECT 
  schemaname,
  tablename,
  viewname,
  definition
FROM pg_views
WHERE viewname = 'content_metadata';
```

Expected result: Shows the underlying table (likely `content_generation_metadata_comprehensive`)

## Code Fix Required

In `src/jobs/postingQueue.ts`, line ~3129-3132, change:

```typescript
// OLD (writes to view - may fail)
const { error: updateError } = await supabase
  .from('content_metadata')  // ← VIEW
  .update(updateData)
  .eq('decision_id', decisionId);

// NEW (writes to base table - guaranteed to work)
const { error: updateError } = await supabase
  .from('content_generation_metadata_comprehensive')  // ← BASE TABLE
  .update(updateData)
  .eq('decision_id', decisionId);
```

## Verification
After fix, orphan receipts should stop appearing:
```bash
pnpm exec tsx scripts/check-truth-gap.ts
```

Expected: 0 orphans

