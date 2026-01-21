# End-to-End Recent Anchored Reply Report

## Summary

Upgraded xBOT reply quality and timeliness with:
1. **Normalized bypasses** into single `RUNNER_TEST_MODE` flag
2. **Freshness enforcement** (48h max by default, configurable)
3. **Anchor/context enforcement** (replies must reference tweet content)
4. **Improved reply generation** (tweet-aware with anchor extraction)

## Changes Made

### Step A: Normalized Bypasses into TEST_MODE

**Files Modified:**
- `src/jobs/postingQueue.ts`
- `src/posting/UltimateTwitterPoster.ts`

**Changes:**
- Replaced all individual bypass flags (`POSTING_BYPASS_FRESHNESS_CHECK`, `POSTING_BYPASS_ANCHOR_CHECK`, `POSTING_BYPASS_ANCESTRY_CHECK`, `POSTING_BYPASS_SERVICE_ROLE_CHECK`, `POSTING_BYPASS_RETRY_DEFERRAL`) with single `RUNNER_TEST_MODE=true` flag
- All bypasses now require: `RUNNER_TEST_MODE=true AND RUNNER_MODE=true`
- Added loud logging: `BYPASS_ACTIVE: <CHECK_NAME>` when any bypass is active

**Example Log:**
```
[INVARIANT] 🧪 TEST MODE: BYPASS_ACTIVE: FRESHNESS_CHECK
[ANCHOR_CHECK] 🧪 TEST MODE: BYPASS_ACTIVE: ANCHOR_CHECK
```

### Step B: Enforced Freshness Policy (48h Default)

**Files Modified:**
- `src/jobs/postingQueue.ts` (posting-time check)
- `src/jobs/replySystemV2/tieredScheduler.ts` (scheduler-time check)

**Changes:**
- Added `REPLY_MAX_TWEET_AGE_HOURS` environment variable (default: `48`)
- Enforced at scheduler time: checks `tweet_posted_at` from `reply_opportunities` before creating decision
- Enforced at posting time: re-checks as safety net
- If tweet is older than threshold, records `DENY` with `deny_reason_code: 'TWEET_TOO_OLD'`
- Bypass available in `RUNNER_TEST_MODE=true`

**Example Log:**
```
[SCHEDULER] ✅ Freshness check passed: 12.5h (max=48h)
[SCHEDULER] 🚫 Tweet too old: 52.3h (max=48h)
```

### Step C: Enforced Anchor/Context Policy

**Files Modified:**
- `src/jobs/postingQueue.ts` (anchor check)
- `src/ai/replyGeneratorAdapter.ts` (anchor extraction + prompt)

**Changes:**
- Improved anchor extraction: extracts 3-8 meaningful terms (hashtags, numbers, unique words 4+ chars)
- Requires reply to contain at least one anchor term (substring match)
- Enhanced logging shows extracted anchors and matched count
- Bypass available in `RUNNER_TEST_MODE=true`

**Example Log:**
```
[ANCHOR_CHECK] pass=true matched=2/5 anchors=sleep,quality number_overlap=0
[REPLY_ADAPTER] Chosen anchors (5): sleep, quality, sunlight, timing, matter
[REPLY_ADAPTER] Anchor check: matched=2/5 anchors=sleep,quality
```

### Step D: Improved Reply Generation

**Files Modified:**
- `src/ai/replyGeneratorAdapter.ts`

**Changes:**
- Extracts anchor terms from target tweet and includes them in prompt
- Prompt explicitly requires referencing at least one anchor
- Added logging: tweet text (truncated), chosen anchors, generated reply, anchor match results
- Enhanced prompt instructions for tweet-aware replies

**Example Log:**
```
[REPLY_ADAPTER] Tweet text (truncated): "Sleep quality and sunlight timing matter more than most people think..."
[REPLY_ADAPTER] Chosen anchors (5): sleep, quality, sunlight, timing, matter
[REPLY_ADAPTER] Generated reply: "That's a great point about sleep quality! Sunlight timing is often overlooked."
[REPLY_ADAPTER] Anchor check: matched=2/5 anchors=sleep,quality
```

## Documentation

Created `docs/REPLY_QUALITY_GATES.md` documenting:
- Freshness policy (48h default, configurable)
- Anchor/context policy (3-8 terms, require match)
- Test mode bypasses (single flag: `RUNNER_TEST_MODE=true`)
- Production safety (all bypasses OFF by default)

## Environment Variables

**New:**
- `RUNNER_TEST_MODE=true` - Enables all test bypasses (requires `RUNNER_MODE=true`)
- `REPLY_MAX_TWEET_AGE_HOURS=48` - Maximum tweet age in hours (default: 48)

**Deprecated (still work but use `RUNNER_TEST_MODE` instead):**
- `POSTING_BYPASS_FRESHNESS_CHECK`
- `POSTING_BYPASS_ANCHOR_CHECK`
- `POSTING_BYPASS_ANCESTRY_CHECK`
- `POSTING_BYPASS_SERVICE_ROLE_CHECK`
- `POSTING_BYPASS_RETRY_DEFERRAL`

## Testing Commands

### End-to-End Test (Real Recent Tweet)

```bash
# 1. Ensure Chrome CDP is running
# Kill existing Chrome on port 9222 if needed
pkill -f "chrome.*9222" || true

# Start Chrome with CDP
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-port=9222 \
  --user-data-dir="$PWD/.runner-profile/chrome-cdp-profile" \
  --no-first-run \
  --no-default-browser-check \
  > /dev/null 2>&1 &

# Verify CDP is reachable
curl -s http://127.0.0.1:9222/json | head -5

# 2. Check session
RUNNER_MODE=true RUNNER_PROFILE_DIR=./.runner-profile RUNNER_BROWSER=cdp pnpm run runner:session

# 3. Run one-shot (harvests recent tweets, evaluates, schedules, posts)
RUNNER_MODE=true RUNNER_PROFILE_DIR=./.runner-profile RUNNER_BROWSER=cdp pnpm run runner:one-shot

# 4. Verify POST_SUCCESS
pnpm exec tsx scripts/verify-post-success.ts --minutes=60

# 5. Check diagnostics
pnpm run runner:diagnostics
```

### Expected Output

The pipeline should:
1. **Harvest** recent tweets (<24h old)
2. **Evaluate** candidates and create evaluations
3. **Schedule** decisions (freshness check passes for recent tweets)
4. **Generate** replies with anchor extraction and matching
5. **Post** via CDP (anchor check passes if reply references tweet)
6. **Log** `POST_SUCCESS` event

**Key Logs to Look For:**
```
[SCHEDULER] ✅ Freshness check passed: 12.5h (max=48h)
[REPLY_ADAPTER] Chosen anchors (5): sleep, quality, sunlight, timing, matter
[REPLY_ADAPTER] Generated reply: "..."
[REPLY_ADAPTER] Anchor check: matched=2/5 anchors=sleep,quality
[ANCHOR_CHECK] pass=true matched=2/5 anchors=sleep,quality number_overlap=0
[POST_SUCCESS] decision_id=... target_tweet_id=... posted_reply_tweet_id=...
```

## Verification Checklist

- [ ] Freshness check blocks tweets > 48h (unless `RUNNER_TEST_MODE=true`)
- [ ] Anchor check blocks replies without anchor match (unless `RUNNER_TEST_MODE=true`)
- [ ] Reply generation extracts and uses anchor terms
- [ ] Logging shows tweet text, anchors, generated reply, and match results
- [ ] `POST_SUCCESS` is logged after successful post
- [ ] Posted reply contains at least one anchor term from target tweet

## Next Steps

1. **Run end-to-end test** with a real recent tweet (<24h old)
2. **Verify** the posted reply contains anchor terms from the target tweet
3. **Confirm** `POST_SUCCESS` is logged
4. **Review** logs to ensure freshness and anchor checks are working

## Files Changed

1. `src/jobs/postingQueue.ts` - Freshness + anchor enforcement, bypass normalization
2. `src/jobs/replySystemV2/tieredScheduler.ts` - Freshness check at scheduler time
3. `src/posting/UltimateTwitterPoster.ts` - Bypass normalization
4. `src/ai/replyGeneratorAdapter.ts` - Anchor extraction + improved prompt
5. `docs/REPLY_QUALITY_GATES.md` - Documentation (new file)
