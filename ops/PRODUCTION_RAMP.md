# 🚀 PRODUCTION RAMP MODE — OPERATIONS RUNBOOK

**Purpose:** Safely resume autonomous posting with gradual ramp-up and monitoring

**Last Updated:** 2026-01-06

---

## Overview

Production Ramp Mode allows controlled, gradual increase in posting/reply rates with comprehensive monitoring. The system starts conservatively and can be upgraded through levels as confidence builds.

### Ramp Levels

- **Level 1:** 1 post/hr, 1 reply/hr (conservative start)
- **Level 2:** 2 posts/hr, 2 replies/hr (moderate)
- **Level 3:** 2 posts/hr, 4 replies/hr (full production)

---

## Starting Ramp Mode (Level 1)

### Step 1: Set Ramp Mode Variables

```bash
railway variables --set "RAMP_MODE=true"
railway variables --set "RAMP_LEVEL=1"
```

### Step 2: Enable Posting (Keep Replies Disabled Initially)

```bash
railway variables --set "POSTING_ENABLED=true"
railway variables --set "REPLIES_ENABLED=false"
railway variables --set "DRAIN_QUEUE=false"
```

### Step 3: Monitor Logs

Watch for ramp mode summary logs:

```
[RAMP_MODE] ramp_enabled=true ramp_level=1 posts_last_hour=0 replies_last_hour=0 blocked_self_reply=0 blocked_reply_to_reply=0 blocked_freshness=0 blocked_generic=0 NOT_IN_DB_count=0
```

**What to watch:**
- `posts_last_hour` should not exceed `ramp_level` quota
- `NOT_IN_DB_count` should remain `0` (no ghost posts)
- `blocked_*` counts show guardrail effectiveness

### Step 4: Verify First Post

After first post appears:
1. Check tweet appears in DB: `pnpm exec tsx scripts/query-tweet-details.ts <tweet_id>`
2. Verify `build_sha` is set (not NULL/dev/unknown)
3. Verify `pipeline_source` is correct
4. Check no ghost posts: `pnpm exec tsx scripts/verify-not-in-db.ts --since-hours=1`

---

## Upgrading to Level 2

**Wait:** At least 2 hours of clean Level 1 operation before upgrading

### Step 1: Upgrade Ramp Level

```bash
railway variables --set "RAMP_LEVEL=2"
```

### Step 2: Enable Replies

```bash
railway variables --set "REPLIES_ENABLED=true"
```

### Step 3: Monitor

Watch for:
- `posts_last_hour` should not exceed `2`
- `replies_last_hour` should not exceed `2`
- All guardrails still functioning

---

## Upgrading to Level 3 (Full Production)

**Wait:** At least 4 hours of clean Level 2 operation before upgrading

### Step 1: Upgrade Ramp Level

```bash
railway variables --set "RAMP_LEVEL=3"
```

### Step 2: Monitor

Watch for:
- `posts_last_hour` should not exceed `2`
- `replies_last_hour` should not exceed `4`
- All guardrails still functioning

---

## Emergency Rollback

If any issues detected:

### Immediate Lockdown

```bash
railway variables --set "POSTING_ENABLED=false"
railway variables --set "REPLIES_ENABLED=false"
railway variables --set "DRAIN_QUEUE=true"
railway variables --set "RAMP_MODE=false"
```

### Verify Lockdown

```bash
railway variables | grep -E "POSTING_ENABLED|REPLIES_ENABLED|DRAIN_QUEUE|RAMP_MODE"
```

Should show:
- `POSTING_ENABLED=false`
- `REPLIES_ENABLED=false`
- `DRAIN_QUEUE=true`
- `RAMP_MODE=false` (or unset)

### Check for Ghost Posts

```bash
pnpm exec tsx scripts/verify-not-in-db.ts --since-hours=1
```

Should show `0` NOT_IN_DB tweets.

---

## Monitoring Checklist

### Every Hour (During Ramp)

- [ ] Check `[RAMP_MODE]` summary log
- [ ] Verify `posts_last_hour` ≤ quota
- [ ] Verify `replies_last_hour` ≤ quota
- [ ] Verify `NOT_IN_DB_count=0`
- [ ] Check blocked counts (should be reasonable)
- [ ] Verify no errors in logs

### Daily Checks

- [ ] Review all posted tweets for quality
- [ ] Check reply engagement metrics
- [ ] Verify no ghost posts
- [ ] Review guardrail effectiveness

---

## Guardrails Active

1. **Self-Reply Guard:** Blocks replies to our own tweets
2. **Root-Only Guard:** Only replies to root tweets (no reply-to-reply)
3. **Freshness Gate:** Blocks replies to tweets > 3 hours old
4. **Specificity Gate:** Reply must reference target tweet content
5. **Thread-Like Check:** Blocks thread markers in replies
6. **Build SHA Tracking:** All posts traceable via `build_sha`

---

## Troubleshooting

### Issue: Posts not appearing

**Check:**
1. `POSTING_ENABLED=true`?
2. `DRAIN_QUEUE=false`?
3. `RAMP_MODE=true`?
4. Check logs for errors

### Issue: Quota exceeded

**Check:**
1. `RAMP_LEVEL` matches expected quota
2. `posts_last_hour` / `replies_last_hour` in logs
3. Previous hour's posts still counting

### Issue: Ghost posts detected

**Immediate action:**
1. Lock down immediately (see Emergency Rollback)
2. Investigate source of ghost posts
3. Check `build_sha` values in DB
4. Review Railway logs for bypass paths

---

## Success Criteria

**Level 1 → Level 2:**
- ✅ 2+ hours clean operation
- ✅ 0 ghost posts
- ✅ All guardrails functioning
- ✅ Quality acceptable

**Level 2 → Level 3:**
- ✅ 4+ hours clean operation
- ✅ 0 ghost posts
- ✅ All guardrails functioning
- ✅ Quality acceptable
- ✅ Reply engagement positive

---

## Notes

- Ramp mode **overrides** `MAX_POSTS_PER_HOUR` and `MAX_REPLIES_PER_HOUR` env vars
- Keep `RAMP_MODE=true` until confident in full production
- Can disable ramp mode after Level 3 is stable (system uses normal config)
- All changes logged to `ops/ghost-investigation-log.md`

