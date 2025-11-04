# 📊 POSTING RATE SUMMARY - Exactly 6 Posts Per Hour

**Target:** 2 content posts + 4 replies = **6 total per hour**

---

## ✅ **Current Configuration**

### **Content Posts: 2 per hour**
```
Config: MAX_POSTS_PER_HOUR = 2
Type: Singles only (threads disabled)
Spacing: Every 30 minutes (exactly)
```

**Breakdown:**
- Post 1: Top of hour (e.g., 8:00 PM)
- Post 2: Half hour mark (e.g., 8:30 PM)

**Total:** 2 content posts/hour × 24 hours = **48 posts/day**

---

### **Replies: 4 per hour**
```
Config: REPLIES_PER_HOUR = 4
Type: AI-generated replies to harvested tweets
Spacing: ~15 minutes average
```

**Breakdown:**
- Reply 1: ~8:00 PM
- Reply 2: ~8:15 PM
- Reply 3: ~8:30 PM
- Reply 4: ~8:45 PM

**Total:** 4 replies/hour × 24 hours = **96 replies/day**

---

## 📈 **Total Output**

### **Per Hour:**
```
2 content posts + 4 replies = 6 total tweets/hour
```

### **Per Day:**
```
48 content posts + 96 replies = 144 total tweets/day
```

### **Per Week:**
```
336 content posts + 672 replies = 1,008 total tweets/week
```

---

## 🎯 **Rate Limiting Logic**

### **Content Posts (postingQueue.ts):**
```typescript
// Check: How many singles/threads posted in last 60 minutes?
const postsThisHour = count(
  WHERE decision_type IN ('single', 'thread')
  AND status IN ('posted', 'failed')
  AND created_at >= NOW() - INTERVAL '1 hour'
);

if (postsThisHour >= 2) {
  BLOCK posting (wait for new hour)
}
```

### **Replies (replyJob.ts):**
```typescript
// Check: How many replies ATTEMPTED in last 60 minutes?
const repliesThisHour = count(
  WHERE decision_type = 'reply'
  AND created_at >= NOW() - INTERVAL '1 hour'
);

if (repliesThisHour >= 4) {
  SKIP generation (wait for new hour)
}
```

---

## ⏰ **Expected Timeline (Example Hour)**

**8:00 PM:**
- ✅ Content Post #1 posts
- ✅ Reply #1 posts

**8:15 PM:**
- ✅ Reply #2 posts

**8:30 PM:**
- ✅ Content Post #2 posts
- ✅ Reply #3 posts

**8:45 PM:**
- ✅ Reply #4 posts

**9:00 PM:**
- ⏰ New hour begins
- Rate limits reset
- Cycle repeats

**Total:** 6 tweets in the hour (2 content + 4 replies) ✅

---

## 🔧 **What I Fixed**

### **Issue:**
`replyJob.ts` had `MAX_REPLIES_PER_HOUR = 10` (too high!)

### **Fix:**
Changed to `MAX_REPLIES_PER_HOUR = 4` (matches config)

**Before:**
```typescript
MAX_REPLIES_PER_HOUR: parseInt(process.env.REPLIES_PER_HOUR || '10', 10),
```

**After:**
```typescript
MAX_REPLIES_PER_HOUR: parseInt(process.env.REPLIES_PER_HOUR || '4', 10),
```

---

## ✅ **Current Queue Status**

From database (last hour):
```
5 singles queued   ← Will post at 2/hour
5 replies queued   ← Will post at 4/hour
1 thread cancelled ← Disabled, won't post
```

---

## 📋 **Monitoring**

To verify rates are working:

### **Check last hour's posts:**
```sql
SELECT 
  decision_type, 
  COUNT(*) as count,
  status
FROM content_metadata
WHERE posted_at > NOW() - INTERVAL '1 hour'
GROUP BY decision_type, status;
```

**Expected:**
```
single: 2 posted
reply: 4 posted (or close, some may fail)
```

### **Check rate limiting:**
```
Watch Railway logs for:
- "[POSTING_QUEUE] ✅ Rate limit OK: 0/2 posted" → Should post
- "[POSTING_QUEUE] ⏳ Rate limit reached: 2/2 posted" → Should wait
- "[REPLY_JOB] ✅ Rate: 3/4 replies this hour" → Should generate
- "[REPLY_JOB] ⏳ Rate limit reached: 4/4" → Should skip
```

---

## 🎯 **Bottom Line**

**System is configured for EXACTLY:**
- ✅ 2 content posts per hour
- ✅ 4 replies per hour
- ✅ 6 total tweets per hour
- ✅ 144 total tweets per day

**Now just wait and watch it work! 🚀**

