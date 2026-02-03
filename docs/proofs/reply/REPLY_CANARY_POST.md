# 💬 REPLY CANARY POST PROOF

**Date:** February 3, 2026  
**Status:** Ready for Testing  
**Purpose:** Prove single reply can be posted safely

---

## 📋 OVERVIEW

This document proves that:
1. ✅ One approved draft can be loaded and posted
2. ✅ Reply is posted to Twitter successfully
3. ✅ Reply URL and status are stored
4. ✅ Screenshot artifact is generated
5. ✅ Database is updated correctly

---

## 🔧 CONFIGURATION

**Railway Environment Variables:**
```bash
railway variables --set "REPLIES_ENABLED=true"
railway variables --set "REPLIES_DRY_RUN=false"
railway variables --set "MAX_REPLIES_PER_RUN=1"
```

---

## 🧪 TESTING STEPS

### Step 1: Ensure Drafts Exist

```bash
# Run dry-run first if no drafts exist
REPLIES_ENABLED=true REPLIES_DRY_RUN=true \
pnpm tsx scripts/ops/run-reply-dry-run.ts
```

### Step 2: Post Canary Reply

```bash
railway run pnpm exec tsx scripts/ops/run-reply-post-once.ts
```

### Step 3: Verify Posting

**Check posted reply:**
```sql
SELECT 
  decision_id,
  tweet_id,
  tweet_url,
  target_tweet_id,
  target_username,
  content,
  status,
  posted_at
FROM content_metadata
WHERE decision_type = 'reply'
  AND status = 'posted'
ORDER BY posted_at DESC
LIMIT 1;
```

**Expected:** 
- `status='posted'`
- `tweet_id` is not NULL
- `posted_at` is recent timestamp

**Check opportunity marked:**
```sql
SELECT 
  tweet_id,
  replied_to,
  reply_decision_id,
  replied_at
FROM reply_opportunities
WHERE replied_to = true
ORDER BY replied_at DESC
LIMIT 1;
```

**Expected:** `replied_to=true` and `reply_decision_id` matches posted reply

---

## ✅ SUCCESS CRITERIA

- [ ] Script completes without errors
- [ ] `posted=true` in JSON output
- [ ] `tweet_id` is not null
- [ ] `tweet_url` is valid Twitter URL
- [ ] Draft status updated to 'posted'
- [ ] Opportunity marked as `replied_to=true`
- [ ] Screenshot artifact saved to `docs/proofs/reply/canary-<timestamp>/`

---

## 📊 EXPECTED OUTPUT

**JSON Summary:**
```json
{
  "mode": "canary_post",
  "draft_loaded": true,
  "draft_id": "<uuid>",
  "posted": true,
  "tweet_id": "1234567890123456789",
  "tweet_url": "https://x.com/i/status/1234567890123456789",
  "error": null,
  "screenshot_path": "docs/proofs/reply/canary-<timestamp>/posted.png"
}
```

**Log Patterns:**
- `[REPLY_CANARY] 📋 Loaded draft`
- `[REPLY_CANARY] 🚀 Posting reply...`
- `[REPLY_CANARY] ✅ Reply posted successfully!`
- `✅ SUCCESS: Reply posted (canary)`

---

## 🔒 SAFETY CHECKS

**Pre-Post Validation:**
- ✅ Draft exists and is valid
- ✅ Target tweet hasn't been replied to already
- ✅ `REPLIES_ENABLED=true`
- ✅ `REPLIES_DRY_RUN=false`

**Post-Post Updates:**
- ✅ Draft status → 'posted'
- ✅ `tweet_id` assigned
- ✅ `posted_at` timestamp set
- ✅ Opportunity marked as `replied_to=true`

---

## 📸 PROOF ARTIFACTS

**Saved to:** `docs/proofs/reply/canary-<timestamp>/`
- `posted.png` - Screenshot of posted reply
- `posted.html` - HTML snapshot of page

---

**Status:** ⏳ Ready for Testing
