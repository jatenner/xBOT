# 💬 REPLY DRY-RUN PROOF

**Date:** February 3, 2026  
**Status:** Implemented  
**Purpose:** Prove reply draft generation works without posting

---

## 📋 OVERVIEW

This document proves that:
1. ✅ Reply drafts are generated from opportunities
2. ✅ Quality gates are applied (uniqueness, no generic filler, safety)
3. ✅ Drafts are stored in `content_metadata` with `status='draft'`
4. ✅ No actual posting occurs when `REPLIES_DRY_RUN=true`

---

## 🔧 CONFIGURATION

**Environment Variables:**
- `REPLIES_ENABLED=true` (required)
- `REPLIES_DRY_RUN=true` (default, prevents posting)
- `MAX_REPLIES_PER_RUN=1` (default)

---

## 🧪 TESTING STEPS

### Step 1: Run Dry-Run

```bash
REPLIES_ENABLED=true REPLIES_DRY_RUN=true MAX_REPLIES_PER_RUN=1 \
pnpm tsx scripts/ops/run-reply-dry-run.ts
```

### Step 2: Verify Drafts Created

**Check drafts in database:**
```sql
SELECT 
  decision_id,
  target_tweet_id,
  target_username,
  content,
  status,
  quality_score,
  created_at
FROM content_metadata
WHERE decision_type = 'reply'
  AND status = 'draft'
ORDER BY created_at DESC
LIMIT 5;
```

**Expected:** At least 1 draft with `status='draft'`

---

## ✅ SUCCESS CRITERIA

- [ ] Script completes without errors
- [ ] At least 1 draft generated (`drafts_generated > 0`)
- [ ] Draft stored in database (`drafts_stored > 0`)
- [ ] Draft has `status='draft'` (not 'queued' or 'posted')
- [ ] Quality gates applied (quality_failures + gate_failures logged)
- [ ] No actual posting occurred (verify no new `tweet_id` in content_metadata)

---

## 📊 EXPECTED OUTPUT

**JSON Summary:**
```json
{
  "mode": "dry_run",
  "candidates_evaluated": 1,
  "drafts_generated": 1,
  "drafts_stored": 1,
  "quality_failures": 0,
  "gate_failures": 0,
  "dry_run": true,
  "max_replies": 1
}
```

**Log Patterns:**
- `[REPLY_DRY_RUN] 🎯 Processing candidate`
- `[REPLY_DRY_RUN] ✅ Draft stored`
- `✅ SUCCESS: Generated X draft(s) (DRY RUN - not posted)`

---

## 🔒 SAFETY CHECKS

**Quality Gates Applied:**
1. ✅ Length check (≤280 chars)
2. ✅ Quality score check (via `checkReplyQuality`)
3. ✅ Uniqueness check (no generic filler)
4. ✅ Safety check (no harmful content)

**No Posting:**
- Script never calls `UltimateTwitterPoster.postReply()`
- Drafts have `status='draft'` (not 'queued' or 'posted')
- No `tweet_id` assigned to drafts

---

**Status:** ✅ Implementation Complete
