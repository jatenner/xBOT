# Reply Quality Gates

This document describes the freshness and anchor/context policies for reply generation, and how to bypass them in test mode.

## Freshness Policy

**Default**: Replies are only allowed to tweets that are **≤ 48 hours old**.

### Configuration

- **Environment Variable**: `REPLY_MAX_TWEET_AGE_HOURS` (default: `48`)
- **Enforcement Points**:
  1. **Scheduler** (`tieredScheduler.ts`): Checks `tweet_posted_at` from `reply_opportunities` before creating a decision
  2. **Posting Queue** (`postingQueue.ts`): Re-checks freshness as a safety net before posting

### Behavior

- If a tweet is older than the threshold, the scheduler will:
  - Record a `DENY` decision with `deny_reason_code: 'TWEET_TOO_OLD'`
  - Log the age in hours and the configured maximum
  - Skip generation and posting

- If `tweet_posted_at` is missing, the system will:
  - In **production mode**: Fail closed (block the reply)
  - In **test mode** (`RUNNER_TEST_MODE=true`): Allow with a warning

### Logging

```
[SCHEDULER] ✅ Freshness check passed: 12.5h (max=48h)
[SCHEDULER] 🚫 Tweet too old: 52.3h (max=48h)
```

## Anchor/Context Policy

**Default**: Replies must include **at least one anchor term** from the target tweet.

### Anchor Extraction

The system extracts **3-8 anchor terms** from the target tweet:
- Hashtags (e.g., `#health`, `#fitness`)
- Numbers/percentages (e.g., `42`, `15%`)
- Meaningful words (4+ chars, not stopwords)
- Prioritizes unique, longer words

### Enforcement

- **Anchor Check** (`postingQueue.ts`): Verifies reply contains at least one anchor term (substring match)
- **Reply Generation** (`replyGeneratorAdapter.ts`): Prompt includes extracted anchors and requires referencing at least one

### Behavior

- If a reply doesn't match any anchors:
  - Posting is blocked with `deny_reason_code: 'no_content_anchor'`
  - Logs show extracted anchors and matched count
  - Reply generation may skip if no concrete detail can be referenced

### Logging

```
[ANCHOR_CHECK] pass=true matched=2/5 anchors=sleep,quality number_overlap=0
[ANCHOR_CHECK] FAIL: no_content_anchor matched=0/5 anchors=sleep,quality,circadian number_overlap=0
[REPLY_ADAPTER] Chosen anchors (5): sleep, quality, circadian, sunlight, timing
[REPLY_ADAPTER] Anchor check: matched=2/5 anchors=sleep,quality
```

## Test Mode Bypasses

**Single Flag**: `RUNNER_TEST_MODE=true` (requires `RUNNER_MODE=true`)

When test mode is enabled, all quality gates can be bypassed:
- **Freshness Check**: Bypassed (logs show age but allow posting)
- **Anchor Check**: Bypassed (logs show anchors but allow posting)
- **Ancestry Check**: Bypassed (allows non-root tweets)
- **Service Role Check**: Bypassed (allows non-worker environments)
- **Retry Deferral**: Bypassed (allows immediate posting)

### Usage

```bash
# Enable test mode for local testing
RUNNER_MODE=true RUNNER_TEST_MODE=true pnpm run runner:once -- --once
```

### Logging

When any bypass is active, you'll see:
```
[INVARIANT] 🧪 TEST MODE: BYPASS_ACTIVE: FRESHNESS_CHECK
[ANCHOR_CHECK] 🧪 TEST MODE: BYPASS_ACTIVE: ANCHOR_CHECK
[POSTING_QUEUE] 🧪 TEST MODE: BYPASS_ACTIVE: RETRY_DEFERRAL
[ULTIMATE_POSTER] 🧪 TEST MODE: BYPASS_ACTIVE: ANCESTRY_CHECK
[ULTIMATE_POSTER] 🧪 TEST MODE: BYPASS_ACTIVE: SERVICE_ROLE_CHECK
```

## Production Safety

- **All bypasses are OFF by default**
- **Bypasses only work when `RUNNER_TEST_MODE=true AND RUNNER_MODE=true`**
- **All bypass usage is loudly logged** for audit trails
- **Freshness and anchor checks are enforced at multiple points** (scheduler + posting queue)

## Reply Generation Improvements

The reply generation prompt now:
1. **Extracts and displays anchor terms** in the prompt
2. **Requires referencing at least one anchor** explicitly
3. **Logs extracted anchors** before generation
4. **Logs matched anchors** after generation
5. **Includes tweet text (truncated)** in logs for debugging

Example log output:
```
[REPLY_ADAPTER] Tweet text (truncated): "Sleep quality and sunlight timing matter more than most people think..."
[REPLY_ADAPTER] Chosen anchors (5): sleep, quality, sunlight, timing, matter
[REPLY_ADAPTER] Generated reply: "That's a great point about sleep quality! Sunlight timing is often overlooked."
[REPLY_ADAPTER] Anchor check: matched=2/5 anchors=sleep,quality
```
