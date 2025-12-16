# Posting Pipeline Recovery Report - December 16, 2025

**Status:** ⚠️ **Partial Recovery** - Migration needs manual application

---

## Step 1: Migration Application

### Attempted Methods:

1. **Railway CLI:** `railway run supabase migration up`
   - ❌ Failed: Local Supabase CLI not configured

2. **Local Supabase CLI:** `supabase migration up`
   - ❌ Failed: Local database connection refused

3. **Railway + Node.js:** Direct SQL execution via Railway
   - ❌ Failed: SSL certificate chain error (self-signed cert)

### **Manual Application Required:**

The migration must be applied manually via **Supabase SQL Editor**:

**File:** `supabase/migrations/20251216_fix_phase5_schema_columns.sql`

**SQL Content:**
```sql
BEGIN;

-- Add structure_type column to underlying table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'content_generation_metadata_comprehensive' 
    AND column_name = 'structure_type'
  ) THEN
    ALTER TABLE content_generation_metadata_comprehensive 
    ADD COLUMN structure_type TEXT DEFAULT NULL;
    
    COMMENT ON COLUMN content_generation_metadata_comprehensive.structure_type IS 
      'Content structure type (single, thread, reply) for Phase 5 voice guide';
  END IF;
END $$;

-- Ensure hook_type exists (should already exist, but check)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'content_generation_metadata_comprehensive' 
    AND column_name = 'hook_type'
  ) THEN
    ALTER TABLE content_generation_metadata_comprehensive 
    ADD COLUMN hook_type TEXT DEFAULT NULL;
    
    COMMENT ON COLUMN content_generation_metadata_comprehensive.hook_type IS 
      'Hook type (question, statistic, etc.) for Phase 5 voice guide';
  END IF;
END $$;

-- Recreate view to include hook_type and structure_type
DROP VIEW IF EXISTS content_metadata CASCADE;

CREATE VIEW content_metadata AS
SELECT 
  id,
  decision_id,
  content,
  thread_parts,
  topic_cluster,
  generation_source,
  generator_name,
  generator_confidence,
  bandit_arm,
  timing_arm,
  angle,
  style,
  content_slot,
  hook_type, -- ✅ Phase 5: Voice guide hook type
  structure_type, -- ✅ Phase 5: Voice guide structure type
  quality_score,
  predicted_er,
  status,
  scheduled_at,
  posted_at,
  created_at,
  updated_at,
  tweet_id,
  target_tweet_id,
  target_username,
  decision_type,
  format_strategy,
  raw_topic,
  tone,
  actual_impressions,
  actual_likes,
  actual_retweets,
  actual_replies,
  actual_engagement_rate
FROM content_generation_metadata_comprehensive;

-- Restore permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON content_metadata TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON content_metadata TO service_role;

COMMENT ON VIEW content_metadata IS 
  'Unified view of content metadata including Phase 5 voice guide columns (hook_type, structure_type)';

COMMIT;
```

**Instructions:**
1. Open Supabase Dashboard → SQL Editor
2. Paste the SQL above
3. Execute
4. Verify with query below

---

## Step 2: Schema Verification

**Query to Run:**
```sql
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'content_metadata'
ORDER BY ordinal_position;
```

**Expected Columns:**
- ✅ `hook_type` (must exist)
- ✅ `structure_type` (must exist)

**Status:** ⏳ **Pending** - Awaiting manual migration application

---

## Step 3: Runtime Recovery Verification

### Log Analysis (Last 2000 lines):

**Schema Errors:**
```
[PLAN_JOB] ❌ Failed to queue content: {
  error="Could not find the 'structure_type' column of 'content_metadata' in the schema cache"
[REPLY_JOB] ❌ Failed to queue reply: Could not find the 'structure_type' column
```

**Status:** ⚠️ **Still Present** - Migration not yet applied

**Plan Job Activity:**
- ✅ planJob is running and generating content
- ❌ Content queue insert failing due to schema errors
- ❌ All 3 attempts failing with same error

**Reply Job Activity:**
- ✅ Reply job is running
- ❌ Reply queue insert also failing (same schema error)

**Posting Queue Activity:**
- ✅ Posting queue is running
- ❌ Finding 0 decisions ready (nothing queued due to insert failures)
- Logs show: `[POSTING_QUEUE] 📊 Total decisions ready: 0`

**Posting Activity:**
- ⚠️ No recent successful posts (blocked by queue insert failures)
- Last posts were before schema errors started

---

## Step 4: Reliability Guards

**Current Status:**
```bash
railway variables | grep ENABLE_DEAD_LETTER
railway variables | grep ENABLE_WATCHDOG
```

**Enabled:**
```bash
✅ ENABLE_DEAD_LETTER_HANDLING=true
✅ ENABLE_WATCHDOG_JOB=true
```

**Status:** ✅ **Enabled** - Reliability guards active (will take effect after migration)

---

## Step 5: Health Check

**Command:** `railway run pnpm health:check` (requires Railway environment)

**Local Attempt:**
- ❌ Failed: Missing environment variables (DATABASE_URL, SUPABASE_URL, etc.)
- Script requires Railway environment to access database

**Expected After Fix:**
- ✅ Last planJob run: Recent (< 30 min ago)
- ✅ Queue depth: Non-zero, then draining
- ✅ Last post time: Recent (< 2 hours ago)
- ✅ No fatal errors

**Status:** ⏳ **Pending** - Run via Railway after migration applied

---

## Step 6: Final Verdict

### Current Status: ⚠️ **Partial Recovery**

**What's Working:**
- ✅ Code fixes applied (numeric overflow, dead-letter handling)
- ✅ Reliability features created (watchdog, health check)
- ✅ planJob generating content successfully
- ✅ Posting queue running correctly

**What's Blocked:**
- ❌ Schema migration not applied (CLI methods failed)
- ❌ Content queue insert failing (schema cache errors)
- ❌ No posts queued (insert failures)
- ❌ No recent posts (downstream effect)

**Root Cause:**
Schema cache errors preventing content from being queued. Migration must be applied manually via Supabase SQL Editor.

**Next Steps:**
1. **Apply migration manually** via Supabase SQL Editor (SQL provided above)
2. **Verify schema** with query (provided above)
3. **Monitor logs** for disappearance of schema errors
4. **Enable reliability guards** once posting resumes
5. **Run health check** to confirm recovery

**Expected Outcome After Migration:**
- ✅ Schema errors disappear
- ✅ Content successfully queued
- ✅ Posting queue finds ready decisions
- ✅ Tweets posted successfully
- ✅ System fully operational

---

## Recovery Timeline

- **2025-12-16 03:00 UTC:** Issue identified (no posts in 4 hours)
- **2025-12-16 03:30 UTC:** Root cause identified (schema cache errors)
- **2025-12-16 04:00 UTC:** Fixes implemented (code + migration)
- **2025-12-16 04:30 UTC:** Migration application attempted (CLI failed)
- **2025-12-16 05:00 UTC:** Manual migration instructions provided

**Estimated Recovery:** Within 15 minutes of manual migration application

---

## Files Changed

- `supabase/migrations/20251216_fix_phase5_schema_columns.sql` (new)
- `src/jobs/planJob.ts` (numeric overflow fix)
- `src/jobs/postingQueue.ts` (dead-letter handling)
- `src/jobs/watchdogJob.ts` (new)
- `src/main-bulletproof.ts` (watchdog integration)
- `scripts/health-check.ts` (new)
- `package.json` (health:check script)

---

**Report Generated:** 2025-12-16T05:00:00Z  
**Next Update:** After manual migration application

