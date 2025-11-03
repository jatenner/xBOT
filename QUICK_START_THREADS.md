# 🚀 QUICK START: Test Thread Posting

## Run This Command:
```bash
./scripts/force-thread-post.sh
```

## What It Does:
1. Checks thread health
2. Tests posting a real thread
3. Shows you exactly what's working

## Expected Output:
```
🏥 Running thread health check...
📊 Thread generation rate: ~25%
✅ Thread system is working!

🧪 Testing thread posting...
✅ Thread posted successfully!
   Root URL: https://x.com/Signal_Synapse/status/...
```

## If It Works:
Your thread system is **fully operational**! 🎉

Deploy to production and monitor logs for:
- `🧵 ✨ THREAD GENERATED` (threads being created)
- `⚡ THREAD DETECTED FOR POSTING ⚡` (threads being posted)

## If It Fails:
The test will show you the exact error. Most common:
- Browser session expired (re-authenticate)
- Rate limit reached (wait 15 minutes)
- Network timeout (retry)

## More Info:
- Full guide: `THREAD_POSTING_FIXED.md`
- Detailed fixes: `THREAD_FIXES_SUMMARY.md`
- Diagnostic report: `THREAD_POSTING_DIAGNOSTIC_REPORT.md`
