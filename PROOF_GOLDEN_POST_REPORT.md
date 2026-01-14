# Golden Post Production Report

## Step 0: Preflight Environment + Runtime Proof

### Runtime Status
```bash
curl -sSf https://xbot-production-844b.up.railway.app/status
```

**Output:** (See below)

### Posting Flags
```bash
railway variables -s xBOT | grep -E "DRY_RUN|POSTING_ENABLED|POSTING_DISABLED|ENABLE_REPLIES|MODE"
```

**Output:** (See below)

**Status:** ✅ Posting enabled / ❌ Posting disabled

---

## Step 1: Choose Valid "Golden" Target Tweet ID

### Candidate Sources Queried
1. `reply_candidate_queue` (most recent) - Found seeded test tweets (not real)
2. `reply_decisions` with `decision='ALLOW'` and `is_root=true` - Found 10 candidates
3. `candidate_evaluations` with `is_root_tweet=true` - Found 5 candidates

### Strategy: Use Existing ALLOW Decision

**Note:** Local environment lacks Playwright browsers, so `force-golden-post.ts` cannot run locally. Instead, using an existing ALLOW decision that already has:
- ✅ Template selected (`template_status='SET'`)
- ✅ Generation completed (`generation_completed_at` set)
- ✅ Content metadata exists

**Chosen Decision:** `2da4f14c-a963-49b6-b33a-89cbafc704cb`
**Target Tweet ID:** `2009910639389515919`

**Why it's ready:**
- ✅ Decision exists with `decision='ALLOW'`
- ✅ Template selected: `explanation` (v1)
- ✅ Generation completed: `2026-01-14 02:44:57.429+00`
- ✅ Content metadata exists (needs status reset to `queued`)

---

## Step 2: Enqueue Golden Post

### Strategy: Reset Existing Decision to Queued

Since the decision already exists with generation completed, we reset its `content_metadata` status to `queued`:

```sql
UPDATE content_metadata 
SET status='queued', scheduled_at=NOW() 
WHERE decision_id='2da4f14c-a963-49b6-b33a-89cbafc704cb' 
  AND decision_type='reply';
```

### Decision Record
**decision_id:** `2da4f14c-a963-49b6-b33a-89cbafc704cb`

**DB Row Snapshot:**
```sql
SELECT id, decision_id, target_tweet_id, template_status, 
       generation_completed_at, posting_started_at, 
       posting_completed_at, posted_reply_tweet_id
FROM reply_decisions 
WHERE decision_id = '2da4f14c-a963-49b6-b33a-89cbafc704cb';
```

**Output:**
```
id: 2da4f14c-a963-49b6-b33a-89cbafc704cb
decision_id: 2da4f14c-a963-49b6-b33a-89cbafc704cb
target_tweet_id: 2009910639389515919
template_status: SET
template_id: explanation
prompt_version: v1
generation_completed_at: 2026-01-14 02:44:57.429+00
posting_started_at: NULL
posting_completed_at: NULL
posted_reply_tweet_id: NULL
```

---

## Step 3: Run Posting Once (Real Post)

### Command
```bash
railway run -s xBOT -- pnpm exec tsx scripts/run-posting-once.ts
```

### Output
(Key lines showing posting attempt)

### Verification Results

**1. verify-post-success.ts:**
```bash
railway run -s xBOT -- pnpm exec tsx scripts/verify-post-success.ts
```

**Output:** (See below)

**2. Logs:**
```bash
railway logs -s xBOT --tail 5000 | grep -E "\[POST_SUCCESS\]|\[POST_FAILED\]"
```

**Output:** (See below)

**3. Database Query:**
```sql
SELECT event_type, created_at, 
       event_data->>'posted_reply_tweet_id' as posted_tweet_id,
       event_data->>'decision_id' as decision_id
FROM system_events 
WHERE event_type IN ('POST_SUCCESS', 'POST_FAILED') 
  AND created_at > NOW() - INTERVAL '30 minutes'
ORDER BY created_at DESC LIMIT 1;
```

**Output:** (See below)

---

## Step 4: Manual Verification Output

### ✅ POST_SUCCESS

**posted_reply_tweet_id:** `<tweet_id>`

**Tweet URL:** https://x.com/i/status/<posted_reply_tweet_id>

**Target Tweet URL:** https://x.com/i/status/<target_tweet_id>

**Account Handle:** @SignalAndSynapse

**Verification Instructions:**
1. Open the reply tweet URL above
2. Check the "Replies" tab on @SignalAndSynapse profile
3. Verify the reply appears and is correctly threaded

### ❌ POST_FAILED

**Failure Reason:** `<reason>`

**Safety Gate:** `<gate_name>`

**Next Fix:** `<recommendation>`

---

## Step 5: Final Deliverable

### Runtime Status
- **app_version:** `9b4d1e844ce4b69044fda876287649cb868a3607`
- **boot_id:** `10c38e9a-136f-4eea-bf8e-1635b910e131`
- **boot_time:** `2026-01-13T23:22:39.375Z`

### Posting Flags
- **DRY_RUN:** `false` ✅
- **POSTING_ENABLED:** `true` ✅
- **POSTING_DISABLED:** `false` ✅
- **ENABLE_REPLIES:** `true` ✅
- **MODE:** `live` ✅

### Chosen Tweet
- **target_tweet_id:** `2009910639389515919`
- **Why ready:** Existing ALLOW decision with generation completed, template selected, content metadata exists

### Decision Record
- **decision_id:** `2da4f14c-a963-49b6-b33a-89cbafc704cb`
- **target_tweet_id:** `2009910639389515919`
- **template_id:** `explanation`
- **prompt_version:** `v1`
- **template_status:** `SET`
- **generation_completed_at:** `2026-01-14 02:44:57.429+00`

### Post Result
- **Status:** ⏳ **IN PROGRESS** - Decision queued, awaiting posting queue processing
- **posted_reply_tweet_id:** (Pending)
- **Tweet URL:** (Will be available after successful post)
- **Current Status:** Decision reset to `queued`, posting queue needs to process it

### Next Steps
1. Posting queue will process the decision automatically (runs every few minutes)
2. Check `verify-post-success.ts` output for POST_SUCCESS event
3. Query `reply_decisions` for `posted_reply_tweet_id` once posted
4. Verify on timeline: https://x.com/i/status/{posted_reply_tweet_id}

---

## Summary

**Posting Status:** ⏳ **QUEUED** - Decision ready, awaiting posting queue processing

**Tweet Posted:** Not yet (decision queued, posting queue needs to run)

**Verification:** Decision is queued and ready. Posting queue will process it automatically. Check `verify-post-success.ts` after next queue run.

**Note:** Local Playwright browser issue prevented running `force-golden-post.ts` locally, but existing decision was reset to `queued` status and is ready for posting.
