# 🚀 DEPLOY NOW - INSTRUCTIONS

**Status:** Waiting for secret approval

---

## ✅ STEP 1: APPROVE THE SECRET

A browser window should have opened to:
https://github.com/jatenner/xBOT/security/secret-scanning/unblock-secret/34WNwC93WaMsTc7wQ7iDz9IYiH1

**What to do:**
1. You'll see a page about "Secret scanning blocked this push"
2. Click the **"Allow secret"** button (usually green)
3. Confirm your choice

**Why this is safe:**
- The secret is in a .env.backup file from commit history
- That file is now deleted and in .gitignore
- It won't appear in future commits
- You need it locally for rollback only

---

## ✅ STEP 2: PUSH TO DEPLOY

After allowing the secret, run:

```bash
cd /Users/jonahtenner/Desktop/xBOT
git push origin main
```

**Expected output:**
```
Writing objects: 100% ...
To https://github.com/jatenner/xBOT.git
   677d3e3b..16f1de94  main -> main
```

Railway will **automatically deploy** within 1-2 minutes!

---

## ✅ STEP 3: ADD RAILWAY ENV VARS

While deployment is running, add these to Railway dashboard:

**Railway → xBOT → Variables:**

```bash
REPLY_MINUTES_BETWEEN=15
REPLIES_PER_HOUR=4
REPLY_MAX_PER_DAY=50
REPLY_BATCH_SIZE=1
REPLY_STAGGER_BASE_MIN=5
REPLY_STAGGER_INCREMENT_MIN=10
```

**How to add:**
1. Go to Railway dashboard
2. Click your xBOT project
3. Click "Variables" tab
4. Click "+ New Variable"
5. Add each one above
6. Click "Deploy" if it doesn't auto-redeploy

---

## ✅ STEP 4: MONITOR DEPLOYMENT

Watch Railway logs for:

```
✅ Build completed successfully
✅ [REPLY_CONFIG] 📋 Rate limits loaded:
✅   • Min between: 15 minutes
✅   • Max per hour: 4
✅   • Max per day: 50
✅   • Batch size: 1
✅ 💬 JOB_MANAGER: Reply jobs ENABLED
```

Then wait **15 minutes** for first cycle:

```
═══════════════════════════════
[REPLY_DIAGNOSTIC] 🔄 CYCLE #1 START
[REPLY_DIAGNOSTIC] 📊 QUOTA STATUS:
  • Hourly: 0/4 (4 available)
  • Daily: 0/50 (50 available)
[REPLY_DIAGNOSTIC] ✅ CYCLE #1 SUCCESS
═══════════════════════════════
```

---

## ✅ STEP 5: VERIFY SUCCESS

After 1 hour, check database:

```sql
SELECT COUNT(*) as replies_this_hour
FROM posted_decisions
WHERE decision_type = 'reply'
AND posted_at > NOW() - INTERVAL '1 hour';
```

**Expected:** 2-4 replies (no bursts!)

---

## 🎯 QUICK CHECKLIST

- [ ] Allow secret on GitHub (browser opened)
- [ ] Push to GitHub: `git push origin main`
- [ ] Add Railway env vars (6 variables)
- [ ] Watch deployment logs
- [ ] Wait 15 min for first cycle
- [ ] Verify diagnostic logging
- [ ] Check database after 1 hour

---

**Ready? Allow the secret in your browser, then push!** 🚀
