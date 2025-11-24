# 🚀 GET SYSTEM RUNNING - Quick Guide

## Current Status

✅ **2 posts ready to post** (66min and 60min overdue)  
✅ **Rate limit OK** (0/1 posts in last hour)  
⚠️ **No posts in last 6 hours**

---

## Immediate Actions

### Option 1: Wait for Next Posting Cycle (Automatic)
The posting queue runs **every 5 minutes** automatically. The 2 queued posts should be picked up in the next cycle.

**Expected:** Posts should go out within 5 minutes

---

### Option 2: Manual Trigger via Railway (Recommended)

If posts aren't going out automatically, manually trigger:

```bash
# Trigger posting queue directly
railway run node -e "require('./dist/jobs/postingQueue').processPostingQueue()"

# Or trigger via admin API (if server is running)
curl -X POST http://localhost:3000/admin/jobs?name=posting&token=YOUR_ADMIN_TOKEN
```

---

### Option 3: Check Circuit Breaker

If circuit breaker is open, it blocks all posting:

```bash
# Check Railway logs for circuit breaker status
railway logs --lines 200 | grep -E "Circuit breaker|circuit_breaker"
```

**If circuit breaker is open:**
- Wait 60 seconds for auto-reset
- Or restart the service to reset it

---

### Option 4: Generate New Content

If queue is empty or posts keep failing:

```bash
# Trigger plan job to generate new content
railway run node -e "require('./dist/jobs/planJob').planContent()"

# Or via admin API
curl -X POST http://localhost:3000/admin/jobs?name=plan&token=YOUR_ADMIN_TOKEN
```

---

## What Should Happen

1. **Posting queue runs** (every 5 min automatically)
2. **Finds 2 queued posts** (ready, overdue)
3. **Checks rate limit** (0/1 = OK)
4. **Posts to Twitter** via UltimateTwitterPoster
5. **Saves tweet_id** to database
6. **Marks as posted**

---

## Troubleshooting

### If Posts Still Don't Go Out:

1. **Check Railway logs:**
   ```bash
   railway logs --lines 200 | grep -E "\[POSTING_QUEUE\]|Circuit breaker|ERROR"
   ```

2. **Check for errors:**
   - Circuit breaker open?
   - Browser/Playwright errors?
   - Database connection issues?

3. **Verify job is running:**
   ```bash
   railway logs --lines 200 | grep "posting_queue_start"
   ```

4. **Check queued posts:**
   ```bash
   # Should show 2 posts ready
   railway run node -e "require('dotenv').config(); const {getSupabaseClient} = require('./dist/src/db/index'); (async()=>{const s=getSupabaseClient(); const {data}=await s.from('content_metadata').select('decision_id,status,scheduled_at').eq('status','queued').in('decision_type',['single','thread']).lte('scheduled_at',new Date().toISOString()); console.log('Ready:',data?.length||0);})();"
   ```

---

## Expected Timeline

- **0-5 min:** Posting queue should pick up queued posts
- **5-10 min:** Posts should appear on Twitter
- **10-15 min:** Database should show status='posted' with tweet_id

---

## Success Indicators

✅ Logs show: `[POSTING_QUEUE] 📝 Found 2 decisions ready`  
✅ Logs show: `[POSTING_QUEUE] ✅ Tweet posted successfully`  
✅ Database shows: `status='posted'` with `tweet_id`  
✅ Twitter shows: New posts on your account

---

## If Still Not Working

1. Check Railway deployment status
2. Verify environment variables are set
3. Check for service crashes
4. Review error logs for specific issues

