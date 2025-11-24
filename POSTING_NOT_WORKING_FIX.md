# 🚨 POSTING NOT WORKING - Diagnosis & Fix

## Current Status

✅ **Build:** Passing  
✅ **3 posts ready** (154min, 92min, 31min overdue)  
❌ **Not posting** to Twitter

---

## Most Likely Causes

### 1. ❌ MODE Environment Variable (MOST COMMON)

**Problem:** `MODE` is not set to `live` in Railway (or set to `shadow`)

**Check:**
```bash
railway variables | grep MODE
```

**Fix:**
```bash
railway variables --set MODE=live
railway restart
```

**Code Evidence:**
```typescript
// src/config/envFlags.ts
export function isPostingAllowed(): { allowed: boolean; reason?: string } {
  const config = getEnvConfig();
  
  if (config.MODE === 'shadow') {
    return { allowed: false, reason: 'MODE=shadow (no posting in shadow mode)' };
  }
  
  if (config.MODE === 'live') {
    return { allowed: true };
  }
  
  return { allowed: false, reason: 'Unknown mode' };
}
```

---

### 2. ⚠️ Circuit Breaker Open

**Problem:** Too many failures triggered circuit breaker

**Check Railway logs:**
```bash
railway logs --lines 200 | grep -E "Circuit breaker|circuit_breaker"
```

**If open:**
- Wait 60 seconds for auto-reset
- Or restart service: `railway restart`

---

### 3. ⚠️ Posting Queue Job Not Running

**Problem:** Job manager not starting posting queue

**Check Railway logs:**
```bash
railway logs --lines 200 | grep "posting_queue_start"
```

**If missing:**
- Service might have crashed
- Restart: `railway restart`

---

### 4. ⚠️ Rate Limit Reached

**Check:**
- Posts in last hour should be < 1 (default limit)
- If limit reached, wait 1 hour

---

## Quick Fix Steps

### Step 1: Check Environment Variables
```bash
railway variables | grep -E "MODE|POSTING_DISABLED"
```

**Should see:**
- `MODE=live` ✅ (this is the key one!)
- `POSTING_DISABLED` not set or `false` ✅

### Step 2: Set MODE=live if Missing/Wrong
```bash
railway variables --set MODE=live
```

### Step 3: Restart Service
```bash
railway restart
```

### Step 4: Check Logs
```bash
railway logs --lines 100 | grep -E "POSTING_QUEUE|isPostingAllowed|Circuit breaker"
```

**Look for:**
- ✅ `[POSTING_QUEUE] 📝 Found X decisions ready`
- ✅ `isPostingAllowed(): ALLOWED`
- ❌ `Circuit breaker OPEN` (if this, wait 60s)

---

## Manual Trigger (Test)

If environment is correct, manually trigger posting:

```bash
railway run node -e "require('./dist/jobs/postingQueue').processPostingQueue()"
```

**Expected output:**
- `[POSTING_QUEUE] 📝 Found 3 decisions ready`
- `[POSTING_QUEUE] ✅ Tweet posted successfully`

---

## If Still Not Working

1. **Check Railway deployment status:**
   - Is service running?
   - Any crashes?

2. **Check for errors in logs:**
   ```bash
   railway logs --lines 500 | grep -E "ERROR|FAILED|Exception"
   ```

3. **Verify database connection:**
   - Can service connect to Supabase?
   - Check `DATABASE_URL` is set

4. **Check browser/Playwright:**
   - Is Twitter session valid?
   - Any browser errors?

---

## Most Common Fix

**90% of cases:** Set `MODE=live` in Railway variables

```bash
railway variables --set MODE=live
railway restart
```

Wait 5 minutes, then check if posts go out.

**Note:** The system now uses `MODE` instead of `LIVE_POSTS`. 
- `MODE=live` = posting enabled ✅
- `MODE=shadow` = posting disabled ❌

