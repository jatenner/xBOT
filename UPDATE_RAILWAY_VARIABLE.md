# 🔧 PERMANENT FIX: Update Railway Environment Variable

## What We're Fixing

**Problem**: Railway has wrong variable name
- Current: `ENABLE_REPLY_BOT=true` ❌
- Needed: `ENABLE_REPLIES=true` ✅

## How to Fix (Railway Dashboard)

### Step 1: Open Railway Dashboard
1. Go to https://railway.app
2. Click on your project
3. Click on "Variables" tab

### Step 2: Add Correct Variable
1. Click "+ New Variable"
2. Variable name: `ENABLE_REPLIES`
3. Value: `true`
4. Click "Add"

### Step 3: Remove Old Variable (Optional)
1. Find `ENABLE_REPLY_BOT` in the list
2. Click the trash icon
3. Confirm deletion

### Step 4: Redeploy
Railway will automatically redeploy with new variable.

---

## What This Fixes

✅ Reply harvester will run (every 30 min)
✅ Reply posting will run (every 15 min)  
✅ Replies will post at 4/hour
✅ No more variable name confusion
✅ System validates on startup (warns if wrong variable detected)

---

## Validation

After deployment, check logs for:
```
✅ REPLIES: Enabled (ENABLE_REPLIES=true)
```

If you see:
```
⚠️  DEPRECATED: ENABLE_REPLY_BOT is no longer used
   → Use ENABLE_REPLIES=true instead
```

Then you still have the old variable set (it won't break anything, just a warning).

---

## Code Changes (Already Made)

1. **Removed bandaid** - No more dual variable checks
2. **Added validation** - `src/config/envValidation.ts`
   - Validates on server startup
   - Warns if deprecated variables detected
   - Errors if critical config missing
3. **Clean code** - Only checks `ENABLE_REPLIES` (canonical)

**This is a permanent, proper fix.**
