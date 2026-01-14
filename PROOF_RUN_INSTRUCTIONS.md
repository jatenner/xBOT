# Proof Run Instructions

## Manual Override Mode

To test with a specific tweet ID:

```bash
railway run -s xBOT -- pnpm exec tsx scripts/post-one-golden-reply.ts --tweetId=<TWEET_ID>
```

Example:
```bash
railway run -s xBOT -- pnpm exec tsx scripts/post-one-golden-reply.ts --tweetId=2010421788086604256
```

## Verification

After running the manual override, verify success:

```bash
railway run -s xBOT -- pnpm exec tsx scripts/verify-post-success.ts
```

## Expected Output

### Success Case:
```
✅ POST_SUCCESS
   Target tweet: <tweet_id>
   Posted reply tweet ID: <posted_id>
   URL: https://x.com/i/status/<posted_id>
```

### Failure Case:
```
❌ POST_FAILED
   Stage: <stage_name>
   pipeline_error_reason: <reason>
```

Or:
```
❌ Validation failed: <reason>
   Stage: <stage_name>
   deny_reason_code: <code>
```

## Stages

The script validates in these stages:
1. `ancestry_resolution` - Tweet exists and can be resolved
2. `root_verification` - Tweet is a root tweet (not a reply)
3. `content_fetch` - Live content can be fetched
4. `template_selection` - Reply template can be selected
5. `reply_generation` - Reply content can be generated
6. `semantic_gate` - Semantic similarity >= 0.25
7. `posting_queue` - Posting queue execution
8. `verification` - POST_SUCCESS event verification

## DB-First Prefiltering

The script now:
- Only queries candidates from last 60 minutes (was 24h)
- Excludes tweet IDs with CONSENT_WALL_SEEN events in last 24h
- Excludes tweet IDs with target_not_found_or_deleted errors ever
- Limits to 12 candidates by default (was 25)

## Consent Wall Sticky Skip

When a consent wall is detected:
- Records `CONSENT_WALL_SEEN` event in `system_events`
- Future runs skip that tweet ID for 24h without Playwright calls
