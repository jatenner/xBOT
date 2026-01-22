# 🔒 PROD/TEST LANES: Growth-Safe Operation

**Purpose:** Separate test posts from production posts to prevent verification/regression tweets from polluting the public timeline.

---

## Overview

The xBOT system uses a **test lane guardrail** to ensure that test posts (created by verification scripts, regression tests, etc.) cannot accidentally be posted to production unless explicitly enabled.

### Key Concepts

- **`is_test_post` flag:** A boolean column in `content_metadata` that marks a decision as a test post
- **Default behavior:** Test posts are **blocked by default** (fail-closed)
- **Override:** Set `ALLOW_TEST_POSTS=true` environment variable to allow test posts
- **Fail-closed:** If `is_test_post` is missing/unknown, treat as PROD (false) for existing rows

---

## How It Works

### 1. Decision Creation

**Production Decisions:**
- All normal pipeline-generated content has `is_test_post=false` (or NULL, which defaults to false)
- No special handling required

**Test Decisions:**
- All scripts under `scripts/verify/*` and `scripts/test/*` **MUST** set `is_test_post=true`
- Example:
  ```typescript
  await supabase.from('content_metadata').insert({
    decision_id: decisionId,
    decision_type: 'single',
    content: content,
    is_test_post: true, // 🔒 TEST LANE: Mark as test post
    // ... other fields
  });
  ```

### 2. PostingQueue Guardrail

The `PostingQueue` automatically filters out test posts unless `ALLOW_TEST_POSTS=true` is set:

```typescript
// In getReadyDecisions()
const allowTestPosts = process.env.ALLOW_TEST_POSTS === 'true';
if (!allowTestPosts) {
  // Filter out test posts
  contentQuery = contentQuery.or('is_test_post.is.null,is_test_post.eq.false');
}
```

**Blocking Behavior:**
- When a test post is blocked, the system logs:
  ```
  [TEST_LANE_BLOCK] decision_id=... reason=ALLOW_TEST_POSTS_not_enabled
  ```
- A `TEST_LANE_BLOCK` event is written to `system_events` for audit trail

---

## Running Verification Posts Safely

### Option 1: Enable Test Posts Temporarily (Recommended)

1. **Set environment variable:**
   ```bash
   export ALLOW_TEST_POSTS=true
   ```

2. **Run verification script:**
   ```bash
   pnpm exec tsx scripts/verify/truth_pipeline_happy_path.ts
   ```

3. **Run posting queue:**
   ```bash
   RUNNER_MODE=true RUNNER_BROWSER=cdp RUNNER_PROFILE_DIR=./.runner-profile \
   ALLOW_TEST_POSTS=true pnpm run runner:once -- --once
   ```

4. **Verify POST_SUCCESS:**
   ```bash
   pnpm exec tsx scripts/verify-post-success.ts --minutes=60
   ```

5. **Disable test posts:**
   ```bash
   unset ALLOW_TEST_POSTS
   ```

### Option 2: Use Railway Environment Variable

For Railway deployments:

```bash
railway variables set ALLOW_TEST_POSTS=true
railway up --detach
```

**⚠️ IMPORTANT:** Remember to disable after testing:
```bash
railway variables set ALLOW_TEST_POSTS=false
railway up --detach
```

---

## Monitoring

### Bake Reports

The daily bake report (`docs/BAKE_DAY1_REPORT.md`) includes:

- **POST_SUCCESS_PROD:** Count of production posts
- **POST_SUCCESS_TEST:** Count of test posts (if any)
- **TEST_LANE_BLOCK Events:** Count of blocked test posts

### System Events

Query blocked test posts:
```sql
SELECT * FROM system_events 
WHERE event_type = 'TEST_LANE_BLOCK' 
ORDER BY created_at DESC;
```

---

## Database Schema

### Migration

The `is_test_post` column was added via migration:
```sql
ALTER TABLE content_metadata
ADD COLUMN IF NOT EXISTS is_test_post BOOLEAN NOT NULL DEFAULT false;
```

### Index

An index exists for efficient filtering:
```sql
CREATE INDEX idx_content_metadata_is_test_post 
ON content_metadata (is_test_post) 
WHERE is_test_post = true;
```

---

## Safety Guarantees

1. **Fail-Closed:** Missing `is_test_post` defaults to `false` (PROD)
2. **Explicit Override Required:** `ALLOW_TEST_POSTS=true` must be set to allow test posts
3. **Audit Trail:** All blocked test posts are logged to `system_events`
4. **No Cadence Impact:** Test lane guardrail does not affect production posting cadence
5. **No Safety Gate Weakening:** All existing safety gates (freshness/anchor/off-limits) remain unchanged

---

## Examples

### Creating a Test Decision

```typescript
const { error } = await supabase
  .from('content_metadata')
  .insert({
    decision_id: uuidv4(),
    decision_type: 'single',
    content: 'Test post for verification',
    status: 'queued',
    scheduled_at: new Date().toISOString(),
    generation_source: 'real',
    is_test_post: true, // 🔒 Required for test posts
  });
```

### Verifying Test Post Was Blocked

```bash
# Check logs for TEST_LANE_BLOCK
grep "TEST_LANE_BLOCK" .runner-profile/runner.log

# Or query system_events
pnpm exec tsx -e "
import { getSupabaseClient } from './src/db/index';
const supabase = getSupabaseClient();
const { data } = await supabase
  .from('system_events')
  .select('*')
  .eq('event_type', 'TEST_LANE_BLOCK')
  .order('created_at', { ascending: false })
  .limit(5);
console.log(data);
"
```

---

## Troubleshooting

### Test Post Not Blocked

**Check:**
1. Is `is_test_post=true` set in the decision?
2. Is `ALLOW_TEST_POSTS` unset or `false`?
3. Check PostingQueue logs for `[TEST_LANE_BLOCK]` messages

### Test Post Blocked When It Shouldn't Be

**Check:**
1. Is `ALLOW_TEST_POSTS=true` set in the environment?
2. Is the environment variable available to the posting queue process?
3. For Railway: Verify with `railway variables`

---

**Last Updated:** 2026-01-22  
**Status:** ✅ Active
