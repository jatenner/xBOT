# 🚀 RAILWAY CONFIGURATION - REPLY SYSTEM

**Target:** 3-4 replies/hour, ~100 replies/day

---

## ✅ SET THESE IN RAILWAY DASHBOARD

**Railway → xBOT Project → Variables → Add these:**

```bash
# Core rate limits (for 3-4 replies/hour, 100/day)
REPLY_MINUTES_BETWEEN=15      # Min gap between replies (15min = 4/hour max)
REPLIES_PER_HOUR=4            # Hourly cap (backup limit)
REPLY_MAX_PER_DAY=100         # Daily cap (your target!)

# Batch control (prevents bursts)
REPLY_BATCH_SIZE=1            # Generate 1 at a time (natural pattern)

# Stagger delays (prevents rapid-fire)
REPLY_STAGGER_BASE_MIN=5      # First reply: 5min delay
REPLY_STAGGER_INCREMENT_MIN=10 # Each additional reply: +10min

# Enable the system
ENABLE_REPLIES=true           # Should already be set
```

---

## 📊 WHAT THIS GIVES YOU

### Hourly Pattern:
```
Hour 1: 4 replies (steady, 15min apart)
Hour 2: 4 replies
Hour 3: 4 replies
...
Hour 24: 4 replies

Total: ~96 replies/day if perfect
Cap: 100/day (allows some flexibility)
```

### Daily Breakdown:
- **Minimum:** 70-80 replies/day (realistic with some hours lower)
- **Target:** 90-100 replies/day (optimal operation)
- **Maximum:** 100 replies/day (hard cap)

---

## ⚙️ HOW IT WORKS

### Every 15 Minutes:
1. ✅ Check: "Last reply was 15+ minutes ago?" 
2. ✅ Check: "Posted < 4 this hour?"
3. ✅ Check: "Posted < 100 today?"
4. ✅ If all pass → Generate 1 reply
5. ✅ Schedule with stagger delay
6. ✅ Post via queue

### Result:
- Natural 15-20 minute gaps
- No burst posting
- Consistent growth
- Railway-controlled (no secrets in git!)

---

## 🎯 CURRENT vs YOUR TARGET

### What You Want:
- 3-4 replies/hour ✅ (we give 4/hour)
- 100 replies/day ✅ (set daily cap to 100)

### What We Configured:
```
15 min between = 4/hour possible
4/hour × 24 hours = 96/day theoretical
Daily cap = 100 (allows slight overrun)
```

**Perfect match!** ✅

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

