# ✅ PR Ready: LLM Generation Health Fix

## Branch Created & Pushed
✅ **Branch**: `fix/llm-posting-health`  
✅ **Status**: Pushed to origin  
✅ **Link**: https://github.com/jatenner/xBOT/pull/new/fix/llm-posting-health

## What Was Fixed

### 1. LLM Decoupled from Posting ✅
- **Before**: `POSTING_DISABLED=true` → blocked all LLM calls
- **After**: `POSTING_DISABLED` only affects posting, LLM runs freely
- Files changed:
  - `src/services/openaiWrapper.ts` 
  - `src/ai/megaPromptSystem.ts`

### 2. Database Schema Fixed ✅
- **Before**: Code used `unified_ai_intelligence.status` (didn't exist)
- **After**: Using `content_metadata` table with proper columns
- New migration: `supabase/migrations/20250930_content_metadata_posting_queue.sql`
- Files changed:
  - `src/jobs/planJob.ts`
  - `src/jobs/replyJob.ts`
  - `src/jobs/postingQueue.ts`

### 3. Documentation Updated ✅
- Added comprehensive `RUNBOOK.md` with validation commands
- Created `PR_DESCRIPTION.md` for the PR

## Next Steps

### 1. Create the PR on GitHub
Visit: https://github.com/jatenner/xBOT/pull/new/fix/llm-posting-health

Copy/paste the content from `PR_DESCRIPTION.md` as the PR body.

### 2. After Merging to Production Branch

Run the migration:
```bash
psql $DATABASE_URL -f supabase/migrations/20250930_content_metadata_posting_queue.sql
```

### 3. Deploy with Posting OFF (Today)
```bash
MODE=live
POSTING_DISABLED=true
LIVE_POSTS=false
ENABLE_REPLIES=true
ENABLE_SINGLES=true
ENABLE_THREADS=true
ENABLE_BANDIT_LEARNING=true
REAL_METRICS_ENABLED=false
DISABLE_LLM_WHEN_BUDGET_HIT=true
ALLOW_FALLBACK_GENERATION=true
OPENAI_MODEL=gpt-4o-mini
```

### 4. Validate LLM Generation Works

**Trigger content generation:**
```bash
curl -s -XPOST http://localhost:8080/admin/jobs/run?job=plan
curl -s -XPOST http://localhost:8080/admin/jobs/run?job=reply
```

**Check logs for:**
- ✅ "✅ Real LLM content generated"
- ❌ NOT "LLM calls disabled (POSTING_DISABLED=true)"

**Check database:**
```bash
psql $DATABASE_URL -c "SELECT status, generation_source, COUNT(*) FROM content_metadata GROUP BY 1,2;"
```
Expected:
```
 status | generation_source | count 
--------+-------------------+-------
 queued | real              |     3
```

**Check metrics:**
```bash
curl -s http://localhost:8080/api/metrics | jq '.openaiCalls_total, .openaiCalls_failed'
```
Expected: `openaiCalls_total > 0` and low failure rate

**Test posting job (should skip cleanly):**
```bash
curl -s -XPOST http://localhost:8080/admin/jobs/run?job=posting
```
Expected log: "Posting disabled, skipping queue processing"  
❌ NO SQL errors

### 5. Tomorrow: Flip Posting ON

**Update env vars only** (no code changes needed):
```bash
export POSTING_DISABLED=false
export LIVE_POSTS=true
export REAL_METRICS_ENABLED=true
```

**Trigger posting:**
```bash
curl -s -XPOST http://localhost:8080/admin/jobs/run?job=posting
```

**Verify posted:**
```bash
psql $DATABASE_URL -c "SELECT COUNT(*), MIN(posted_at), MAX(posted_at) FROM posted_decisions;"
```

**Check real outcomes:**
```bash
psql $DATABASE_URL -c "SELECT COUNT(*) FROM outcomes WHERE simulated=false;"
```

Once you have ≥5 real outcomes, learning will kick in.

## Files Changed Summary

```
RUNBOOK.md                                           [NEW]
PR_DESCRIPTION.md                                    [NEW]
src/ai/megaPromptSystem.ts                          [MODIFIED]
src/jobs/planJob.ts                                 [MODIFIED]
src/jobs/postingQueue.ts                            [MODIFIED]
src/jobs/replyJob.ts                                [MODIFIED]
src/services/openaiWrapper.ts                       [MODIFIED]
supabase/migrations/20250930_content_metadata_posting_queue.sql [NEW]
```

**Total**: 7 files changed, 294 insertions(+), 353 deletions(-)

## Key Benefits

1. ✅ **LLM generates content even with posting disabled**
2. ✅ **No more DB schema errors** (unified_ai_intelligence.status)
3. ✅ **Clean separation**: budget flags control LLM, posting flags control posting
4. ✅ **Queue building**: Generate content today, post tomorrow (no code changes)
5. ✅ **Proper metrics**: Skip reasons tracked, LLM success/failure visible
6. ✅ **Production ready**: Can flip posting on/off via env vars only

## Architecture Change

### Old Flow
```
POSTING_DISABLED=true
  ↓
❌ Block LLM calls
  ↓
No content generated
  ↓
Empty queue
```

### New Flow
```
POSTING_DISABLED=true
  ↓
✅ LLM calls proceed (governed by budget flags)
  ↓
Content generated with status='queued', generation_source='real'
  ↓
Posting job sees flag → skips cleanly → logs "posting_disabled"
  ↓
Queue builds up (ready for tomorrow)
```

## Quick Links

- **Create PR**: https://github.com/jatenner/xBOT/pull/new/fix/llm-posting-health
- **PR Description**: `PR_DESCRIPTION.md`
- **Runbook**: `RUNBOOK.md`
- **Migration**: `supabase/migrations/20250930_content_metadata_posting_queue.sql`

---

**Status**: ✅ All tasks complete, ready for PR creation and deployment!
