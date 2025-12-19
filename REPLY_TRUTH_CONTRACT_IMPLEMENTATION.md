# Reply Truth Contract Implementation

**Date:** December 19, 2025  
**Status:** ✅ COMPLETE - Enhanced existing systems

---

## 📋 FILES CHANGED

### 1. `src/contracts/ReplyContextContract.ts` (NEW)
- **Purpose:** Validate reply context before generation (fail-closed)
- **Features:**
  - Validates parent text (20-400 chars, no JSON/HTML)
  - Blocks political keywords and certain handles
  - Requires meaningful keywords (non-stopwords)
  - Topic detection for allowed domains only
  - Self-reply blocking (ALLOW_SELF_REPLIES=false default)

### 2. `src/generators/replyQualityGate.ts` (ENHANCED)
- **Purpose:** Validate generated reply quality (fail-closed)
- **Added:**
  - JSON/code artifact detection
  - Stricter length limit (220 chars, not 280)
  - Generic template detection
  - Semantic mismatch detection
  - Regeneration attempt tracking

### 3. `src/jobs/postingQueue.ts` (ENHANCED)
- **Purpose:** Add truth contract logging to reply posting
- **Changes:**
  - Added `[REPLY_TRUTH] step=POSTED` after Playwright posts
  - Added receipt write (fail-closed) with `[REPLY_TRUTH] step=RECEIPT_OK`
  - Added `[REPLY_TRUTH] step=DB_OK` after content_metadata save
  - Added `[REPLY_TRUTH] step=SUCCESS` after full pipeline
  - Added `[REPLY_TRUTH] step=FAIL reason=...` on any failure

### 4. `scripts/debug-replies-last60m.ts` (NEW)
- **Purpose:** DB-only audit of reply truth (no Railway CLI needed)
- **Features:**
  - Shows successful replies (last 60 min)
  - Shows reply receipts
  - Identifies unreconciled receipts
  - Shows skipped/failed replies from system_events
  - Summary with truth contract verdict

### 5. `package.json` (ENHANCED)
- **Added:** `"debug:replies:last60m": "NODE_TLS_REJECT_UNAUTHORIZED=0 tsx scripts/debug-replies-last60m.ts"`

---

## 🎯 TRUTH CONTRACT IMPLEMENTATION

### Success Definition:
```
Posted to X + Receipt saved + content_metadata updated = SUCCESS
Anything else = FAIL/RETRY
```

### Logging Flow:
```
[REPLY_TRUTH] step=POSTED tweet_id=... parent_id=...
[REPLY_TRUTH] step=RECEIPT_OK receipt_id=...
[REPLY_TRUTH] step=DB_OK decision_id=... tweet_id=...
[REPLY_TRUTH] step=SUCCESS decision_id=... tweet_id=... parent_id=...
```

### On Failure:
```
[REPLY_TRUTH] step=FAIL reason=receipt_write_failed
[REPLY_TRUTH] step=FAIL reason=db_save_returned_false
```

---

## 🚀 COMMANDS TO RUN LOCALLY

### 1. Debug Replies (Last 60 Minutes)
```bash
pnpm debug:replies:last60m
```

**Output:**
```
📊 REPLY TRUTH AUDIT (Last 60 Minutes)

Time window: 12/19/2025, 2:13:10 PM ET to now

✅ Successful replies: 0

📝 Reply receipts: 0

✅ No skipped/failed replies

═══════════════════════════════════════════════════════
📊 SUMMARY
═══════════════════════════════════════════════════════
✓ Successful replies: 0
✓ Reply receipts: 0
✓ Unreconciled receipts: 0
✓ Skipped/Failed: 0

ℹ️  No replies in last 60 minutes
```

### 2. Verify Database Schema
```bash
pnpm db:doctor
```

**Output:**
```
[DB_VERIFY] Target: host=aws-0-us-east-1.pooler.supabase.com dbname=postgres
[DB_VERIFY] ✅ Connection successful
[DB_VERIFY] ✅ content_metadata.decision_id
[DB_VERIFY] ✅ content_metadata.tweet_id
[DB_VERIFY] ✅ content_metadata.thread_tweet_ids
[DB_VERIFY] ✅ system_events.component
[DB_VERIFY] ✅ system_events.message
[DB_VERIFY] ✅ post_receipts.receipt_id
[DB_VERIFY] ✅ post_receipts.tweet_ids

[DB_VERIFY] ✅ PASS - All required schema elements present
```

---

## 📊 SAMPLE OUTPUT (With Replies)

When replies are posted, `pnpm debug:replies:last60m` will show:

```
📊 REPLY TRUTH AUDIT (Last 60 Minutes)

Time window: 12/19/2025, 3:00:00 PM ET to now

✅ Successful replies: 3

📝 Most recent 4 replies:

1. Tweet ID: 2002123456789
   URL: https://x.com/SignalAndSynapse/status/2002123456789
   Parent: @healthguru (2002123456700)
   Posted: 3:15 PM ET
   Reply: "Great point about sleep! Research shows 7-9 hours is optimal for most adults..."

2. Tweet ID: 2002123456790
   URL: https://x.com/SignalAndSynapse/status/2002123456790
   Parent: @fitnessfan (2002123456701)
   Posted: 3:10 PM ET
   Reply: "Exactly! Progressive overload is key for muscle growth. Start with lighter weights..."

3. Tweet ID: 2002123456791
   URL: https://x.com/SignalAndSynapse/status/2002123456791
   Parent: @wellnesscoach (2002123456702)
   Posted: 3:05 PM ET
   Reply: "This aligns with recent studies on mindfulness. Even 5 minutes daily makes a difference..."

📝 Reply receipts: 3

✅ All receipts reconciled (3/3)

✅ No skipped/failed replies

═══════════════════════════════════════════════════════
📊 SUMMARY
═══════════════════════════════════════════════════════
✓ Successful replies: 3
✓ Reply receipts: 3
✓ Unreconciled receipts: 0
✓ Skipped/Failed: 0

🎉 TRUTH CONTRACT: PASSING
   All replies have receipts and DB entries
```

---

## 🔒 FAIL-CLOSED BEHAVIOR

### Context Validation (ReplyContextContract):
- Missing fields → SKIP
- Text too short/long → SKIP
- JSON/HTML artifacts → SKIP
- No meaningful keywords → SKIP
- Political content → SKIP
- Blocked handles → SKIP
- Off-topic (not health/wellness) → SKIP

### Quality Gate (ReplyQualityGate):
- JSON/code artifacts → REJECT
- Too long (>220 chars) → REJECT
- Too short (<20 chars) → REJECT
- Too many sentences (>2) → REJECT
- Low context relevance (<10% overlap) → REJECT
- Generic template (unless requested) → REJECT
- No keyword match → REJECT

### Posting (postingQueue):
- Receipt write fails → THROW (triggers retry)
- DB save fails → THROW (triggers retry)
- Never counted as success unless all 3 steps pass

---

## 🎯 ENVIRONMENT VARIABLES

### New:
- `ALLOW_SELF_REPLIES=false` (default) - Block replies to own tweets

### Existing (unchanged):
- All existing posting/browser/rate limit vars still work

---

## ✅ VERIFICATION CHECKLIST

- [x] Build successful
- [x] `pnpm debug:replies:last60m` runs locally
- [x] `pnpm db:doctor` passes
- [x] No new dependencies added
- [x] Enhanced existing systems (not new architecture)
- [x] Fail-closed at every step
- [x] Truth contract logging in place
- [x] Receipt system integrated
- [x] DB-only reporting (no Railway CLI needed)

---

## 🚀 DEPLOYMENT

```bash
# Build
pnpm build

# Commit
git add -A
git commit -m "feat: reply truth contract + context gates (fail-closed)"

# Deploy
railway up
```

---

## 📝 NOTES

- **No new architecture** - Enhanced existing postingQueue, receipt system, quality gate
- **Minimal diffs** - Focused changes only where needed
- **Fail-closed** - Every validation step blocks on failure
- **Truth contract** - Posted + Receipt + DB = Success, else fail
- **DB-only audit** - Works locally without Railway CLI
- **Context gates** - Block political, off-topic, low-quality replies
- **Self-reply blocking** - Default off, can enable with env var

---

**Ready to deploy!** 🚀

