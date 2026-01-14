# Manual Post Instructions

## Quick Start

To post a reply to a specific tweet ID:

```bash
railway run -s xBOT -- pnpm exec tsx scripts/post-one-golden-reply.ts --tweetId=<TWEET_ID>
```

Then verify:

```bash
railway run -s xBOT -- pnpm exec tsx scripts/verify-post-success.ts
```

## What It Does

1. **Validates ONLY the specified tweet** (no candidate sourcing)
2. **Checks all gates** (target exists, is root, semantic similarity)
3. **Generates reply content**
4. **Enqueues for posting**
5. **Runs posting queue once**
6. **Verifies POST_SUCCESS**
7. **Prints tweet URL** if successful

## Success Output

If successful, you'll see:
```
✅ POST_SUCCESS: Tweet posted!
   Tweet ID: <posted_reply_tweet_id>
   URL: https://x.com/i/status/<posted_reply_tweet_id>
```

## Failure Output

If it fails, you'll see the exact failure stage:
- `Consent wall detected` → Try a different tweet ID
- `Target not found or deleted` → Tweet may have been deleted
- `Preflight gates failed` → Check details (similarity, root status, etc.)
- `Generation failed` → Content generation issue

## Example

```bash
# Post to a specific tweet
railway run -s xBOT -- pnpm exec tsx scripts/post-one-golden-reply.ts --tweetId=2010421788086604256

# Verify success
railway run -s xBOT -- pnpm exec tsx scripts/verify-post-success.ts
```

## Finding Valid Tweet IDs

Look for tweet IDs in:
- `reply_candidate_queue` (last 60 minutes)
- `candidate_evaluations` (last 7 days, `is_root_tweet=true`)
- `reply_opportunities` (last 24 hours, `is_root_tweet=true`)

Avoid tweet IDs that:
- Had `CONSENT_WALL_SEEN` events in last 24h
- Had `target_not_found_or_deleted` failures ever
