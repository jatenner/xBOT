# 🔍 COMPLETE SYSTEM AUDIT: Post → Tweet ID → Data Flow

## CRITICAL REQUIREMENTS

1. ✅ **Every post/reply MUST get a tweet_id**
2. ✅ **Every post/reply MUST be marked status='posted'**
3. ✅ **Scraper MUST find and collect engagement data**
4. ✅ **Learning system MUST process this data**
5. ✅ **Rate limiting MUST count ALL actual posts**

---

## 🔄 CURRENT SYSTEM FLOW (What SHOULD Happen)

### **Step 1: Content Generation**
```
planJob.ts → Generates content
           → Stores in content_metadata with status='queued'
           → scheduled_at = NOW() + random offset
```

### **Step 2: Posting Queue**
```
postingQueue.ts → Finds queued posts
                → Checks rate limits (status='posted' count)
                → Posts to Twitter via Playwright
                → Gets tweet_id
                → Updates: status='posted', tweet_id='123456', posted_at=NOW()
```

### **Step 3: Data Scraping**
```
metricsScraperJob.ts → Finds posts WHERE status='posted' AND tweet_id IS NOT NULL
                     → Scrapes engagement (views, likes, retweets)
                     → Stores in outcomes table
                     → Updates actual_views, actual_likes, etc.
```

### **Step 4: Learning**
```
learningSystem.ts → Reads from content_with_outcomes view
                  → Analyzes patterns (topic, tone, visual format)
                  → Feeds insights back to generators
                  → Improves future content
```

---

## 🚨 WHERE THE SYSTEM IS BREAKING

### **Current Broken Flow:**

```
1. Post to Twitter → ✅ SUCCESS (tweet is live!)
2. Verify posting → ❌ FAILS (can't find tweet on profile)
3. Throw error → ❌ Marks status='failed'
4. NO tweet_id saved → ❌ Can't scrape engagement
5. Rate limit check → ❌ Doesn't count this post
6. Posts again → ❌ Over-posting
7. Scraper → ❌ Can't find tweet (no tweet_id)
8. Learning → ❌ No data to learn from
```

---

## 🔬 DETAILED INVESTIGATION NEEDED

Let me trace through EACH component to find ALL the breaks...