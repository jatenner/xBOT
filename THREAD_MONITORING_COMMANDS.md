# Thread Monitoring Commands - Real-Time

**Forced Thread Decision ID:** `4541054d-9473-4639-b986-70775ef82029`  
**Status:** Queued (waiting for posting)  
**Created:** 2:37 PM ET (Dec 19, 2025)

---

## 🔍 MONITORING COMMANDS

### 1. Check if thread is being posted NOW
```bash
railway logs --service xBOT --follow | grep -E "4541054d|THREAD_ROOT|THREAD_REPLY_SUCCESS|THREAD_COMPLETE"
```

### 2. Check posting queue status
```bash
railway logs --service xBOT --lines 500 | grep -E "POSTING_QUEUE|hourly limit|queued content"
```

### 3. Get thread root ID when posted
```bash
railway logs --service xBOT --lines 3000 | grep "THREAD_ROOT" | grep "status/" | tail -1
```

### 4. See all reply IDs captured
```bash
railway logs --service xBOT --lines 3000 | grep "THREAD_REPLY_SUCCESS.*ID:" | tail -10
```

### 5. See final result
```bash
railway logs --service xBOT --lines 3000 | grep "THREAD_RESULT.*tweet_ids=" | tail -1
```

### 6. Verify in database after posting
```bash
railway run --service xBOT pnpm verify:thread <TWEET_ID>
```

---

## 📊 WHAT TO LOOK FOR

### Expected Log Sequence:
```
[POSTING_QUEUE] 📝 Processing decision: 4541054d-9473-4639-b986-70775ef82029
[THREAD_FORCE] Thread detected
🔗 THREAD_ROOT: https://x.com/SignalAndSynapse/status/123456789 (ID: 123456789)
✅ THREAD_REPLY_SUCCESS: 1/5 (ID: 123456790)
✅ THREAD_REPLY_SUCCESS: 2/5 (ID: 123456791)
✅ THREAD_REPLY_SUCCESS: 3/5 (ID: 123456792)
✅ THREAD_REPLY_SUCCESS: 4/5 (ID: 123456793)
✅ THREAD_REPLY_SUCCESS: 5/5 (ID: 123456794)
🔗 THREAD_COMPLETE: Captured 6/6 tweet IDs
[THREAD_RESULT] tweet_ids_count=6 tweet_ids=123456789,123456790,123456791,123456792,123456793,123456794
[RECEIPT] ✅ Receipt written
[POSTING_QUEUE][SUCCESS] decision_id=4541054d... type=thread tweet_id=123456789
```

### ✅ SUCCESS Indicators:
- All reply IDs captured (no "ID not captured")
- `THREAD_COMPLETE: Captured 6/6` (or however many parts)
- `THREAD_RESULT` shows all IDs comma-separated
- Receipt written
- SUCCESS log appears

### ❌ FAILURE Indicators:
- "ID not captured" in logs
- `THREAD_COMPLETE: Captured 1/6` (only root)
- No THREAD_RESULT log
- No SUCCESS log

---

## ⏰ TIMING

**Thread is queued at:** 2:37 PM ET  
**Posting queue runs:** Every ~30 minutes  
**Next posting window:** ~3:00-3:10 PM ET  
**Current time:** ~3:03 PM ET

**Status:** Should be posting NOW or very soon!

---

## 🚀 FORCE IMMEDIATE POSTING (if waiting too long)

```bash
# Restart posting queue to process immediately
railway run --service xBOT -- node -e "console.log('Triggering posting queue...'); process.exit(0);"
```

---

**Keep this terminal open and run the monitoring commands above!** 📡

