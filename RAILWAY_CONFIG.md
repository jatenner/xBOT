# 🚀 RAILWAY CONFIGURATION - REPLY SYSTEM (UPDATED)

**Target:** 4 replies/hour guaranteed, ~96 replies/day

---

## ✅ SET THESE IN RAILWAY DASHBOARD

**Railway → xBOT Project → Variables → Add these:**

```bash
# Core rate limits (for guaranteed 4 replies/hour)
REPLY_MINUTES_BETWEEN=15      # Min gap between replies (safety ceiling)
REPLIES_PER_HOUR=4            # Hourly cap (safety ceiling)
REPLY_MAX_PER_DAY=100         # Daily cap (allows 96/day + buffer)

# Smart batch control (UPDATED - generates 2 per cycle)
REPLY_BATCH_SIZE=2            # Generate 2 per 30-min cycle = 4/hour
JOBS_REPLY_INTERVAL_MIN=30    # Job runs every 30 minutes

# Smart scheduling (UPDATED - 5 min and 20 min spacing)
REPLY_STAGGER_BASE_MIN=5      # First reply: 5min delay
REPLY_STAGGER_INCREMENT_MIN=15 # Second reply: 20min delay (5 + 15)

# Enable the system
ENABLE_REPLIES=true           # Should already be set
```

---

## 📊 WHAT THIS GIVES YOU (UPDATED)

### Hourly Pattern (GUARANTEED):
```
00:00 - Reply job runs → Generates 2 replies
        Reply 1: Scheduled at 00:05
        Reply 2: Scheduled at 00:20

00:30 - Reply job runs → Generates 2 replies
        Reply 3: Scheduled at 00:35
        Reply 4: Scheduled at 00:50

Result: Exactly 4 replies/hour, evenly spaced ~15 min apart
```

### Daily Breakdown:
- **Guaranteed:** 96 replies/day (4/hour × 24 hours)
- **Maximum:** 100 replies/day (hard cap for safety)
- **Spacing:** ~15 minutes between each reply (natural pattern)

---

## ⚙️ HOW IT WORKS (UPDATED - SMART SCHEDULING)

### Every 30 Minutes:
1. ✅ **Preflight Check:** Ensure opportunity pool has 10+ targets
   - If low: Run harvesters to populate pool
   - If critical: Surface alert
2. ✅ **Generate:** Create exactly 2 replies per cycle
   - Select best opportunities from pool
   - Use AI to generate strategic replies
   - Quality validation
3. ✅ **Smart Schedule:** Space replies evenly
   - Reply 1: NOW + 5 minutes
   - Reply 2: NOW + 20 minutes
4. ✅ **Queue:** Store in database with scheduled_at timestamp
5. ✅ **Post:** Posting queue processes every 5 minutes

### Result:
- ✅ Guaranteed 4 replies/hour (no gaps, no bursts)
- ✅ Even spacing (~15 min between each)
- ✅ Preflight ensures pool never runs dry
- ✅ SLA tracking alerts on misses
- ✅ Railway-controlled (no secrets in git!)

---

## 🎯 NEW SYSTEM vs OLD SYSTEM

### Old System (Had Issues):
```
❌ Generated 1-4 replies (depended on opportunity count)
❌ Random scheduling (could bunch up)
❌ Often only 2-3 replies/hour (inconsistent)
❌ No preflight checks (pool could run dry)
```

### New System (Fixed):
```
✅ Generates exactly 2 replies per cycle (guaranteed)
✅ Smart scheduling (5 min, 20 min spacing)
✅ Exactly 4 replies/hour (consistent)
✅ Preflight checks (ensures pool has 10+ opportunities)
✅ SLA tracking (alerts on misses)
```

**Same fix as posting system!** ✅

---

## 🚨 IMPORTANT - NO SECRETS IN GIT

**All configuration is in Railway only!**
- ✅ .env file is gitignored
- ✅ No secrets in commits
- ✅ Railway dashboard controls everything
- ✅ Local .env is for testing only

---

## 📝 HOW TO ADD IN RAILWAY

1. Go to: https://railway.app
2. Select your xBOT project
3. Click "Variables" tab
4. Click "+ New Variable"
5. Add each one from the list above
6. Railway auto-redeploys

**Or use Railway CLI:**
```bash
railway variables set REPLY_MINUTES_BETWEEN=15
railway variables set REPLIES_PER_HOUR=4
railway variables set REPLY_MAX_PER_DAY=100
railway variables set REPLY_BATCH_SIZE=1
railway variables set REPLY_STAGGER_BASE_MIN=5
railway variables set REPLY_STAGGER_INCREMENT_MIN=10
```

---

## ✅ VERIFICATION

After Railway deploys, check logs for:

```
[REPLY_CONFIG] 📋 Rate limits loaded:
  • Min between: 15 minutes
  • Max per hour: 4
  • Max per day: 100          ← Should show 100!
  • Batch size: 1
  • Stagger: 5min base + 10min/reply
```

Then wait 15 minutes for first cycle:

```
═══════════════════════════════
[REPLY_DIAGNOSTIC] 🔄 CYCLE #1 START
[REPLY_DIAGNOSTIC] 📊 QUOTA STATUS:
  • Hourly: 0/4 (4 available)
  • Daily: 0/100 (100 available)   ← Should show /100!
  • Time since last: 120 min (required: 15 min) ✅
═══════════════════════════════
```

---

## 🎉 READY TO DEPLOY!

**Steps:**
1. ✅ Code pushed to GitHub (NO SECRETS)
2. ⏳ Railway auto-deploys
3. ⏳ Add environment variables (above)
4. ⏳ Monitor first hour
5. ⏳ Verify 100/day target

**Your system will handle 3-4 replies/hour and 100/day perfectly!** ✅

