# Post One Golden Reply - Production Report

## Commands Run

### 1. Main Script
```bash
railway run -s xBOT -- pnpm exec tsx scripts/post-one-golden-reply.ts --maxCandidates=25
```

### 2. Verification
```bash
railway run -s xBOT -- pnpm exec tsx scripts/verify-latest-post.ts
```

### 3. Posting Queue (if needed)
```bash
railway run -s xBOT -- pnpm exec tsx scripts/run-posting-once.ts
```

---

## Raw Outputs

### Script Output
(See /tmp/post-golden-final.log)

### Verification Output
(See verify-latest-post.ts output)

### Database Query
```sql
SELECT decision_id, target_tweet_id, posted_reply_tweet_id, 
       posting_completed_at, pipeline_error_reason 
FROM reply_decisions 
WHERE decision='ALLOW' 
ORDER BY created_at DESC LIMIT 1;
```

---

## Results

### Chosen Target Tweet
- **target_tweet_id:** (See script output)
- **decision_id:** (See script output)
- **preflight gates:** (See PREFLIGHT GATE REPORT)

### Post Result
- **Status:** POST_SUCCESS / POST_FAILED
- **posted_reply_tweet_id:** (If success)
- **Tweet URL:** https://x.com/i/status/{posted_reply_tweet_id} (If success)
- **Failure Reason:** (If failed)

---

## Code Changes

### New Files
1. `scripts/post-one-golden-reply.ts` - Deterministic posting script
2. `scripts/verify-latest-post.ts` - Verification script

### Key Features
- Uses cached candidate data to avoid browser dependency
- Handles generation failures gracefully
- Tries next candidate if generation fails
- Preflight gate report before enqueueing
- Automatic posting queue execution
