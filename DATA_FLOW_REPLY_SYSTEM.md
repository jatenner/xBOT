# 📊 REPLY SYSTEM DATA FLOW

## ❓ **YOUR QUESTIONS ANSWERED:**

### **1. Is #health the only hashtag?**

**NO!** Your system scrapes **19 different health hashtags:**

```javascript
// src/ai/accountDiscovery.ts Line 62-67
HEALTH_HASHTAGS = [
  'longevity',        'biohacking',      'nutrition',
  'sleep',            'mentalhealth',    'fitness',
  'wellness',         'health',          'sleepscience',
  'neuroscience',     'exercise',        'diet',
  'fasting',          'meditation',      'breathwork',
  'supplements',      'antiaging',       'healthspan',
  'metabolichealth'
]
```

**How it works:**
- **Every cycle:** Scrapes 3 random hashtags from the list
- **Rotates through:** Different hashtags each time
- **Result:** Discovers diverse health accounts across all niches

---

### **2. Where Does Data Get Saved?**

## 🗄️ **COMPLETE DATA FLOW MAP:**

```
┌─────────────────────────────────────────────────────────────────┐
│                    PHASE 1: DISCOVERY                            │
└─────────────────────────────────────────────────────────────────┘

Twitter Scraping
  ↓
  Searches: #longevity, #biohacking, #nutrition...
  ↓
  Finds Accounts: @drmarkhyman, @daveasprey...
  ↓
  Scrapes Profiles: follower_count, bio, verified
  ↓
┌──────────────────────────────────────────────────────────┐
│ SAVED TO: discovered_accounts table                      │
├──────────────────────────────────────────────────────────┤
│ • username: "drmarkhyman"                                │
│ • follower_count: 341300                                 │
│ • bio: "Functional medicine doctor..."                   │
│ • verified: true                                         │
│ • discovery_method: "hashtag"                            │
│ • discovery_date: "2025-10-22T01:18:22Z"                 │
│ • last_updated: "2025-10-22T01:18:22Z"                   │
└──────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    PHASE 2: TARGETING                            │
└─────────────────────────────────────────────────────────────────┘

Query Database
  ↓
  SELECT * FROM discovered_accounts
  WHERE follower_count >= 10000
  AND follower_count <= 500000
  LIMIT 20
  ↓
Gets: @drmarkhyman, @daveasprey, @PeterAttiaMD...
  ↓
For Each Account:
  ↓
  Opens Twitter Timeline
  ↓
  Scrapes Last 20 Tweets
  ↓
  Extracts:
    • tweet_id: "1234567890"
    • tweet_content: "Fascinating research on NAD+..."
    • tweet_author: "drmarkhyman"
    • like_count: 87
    • reply_count: 15
    • posted_minutes_ago: 120 (2 hours)
  ↓
  Filters: <24 hours, >5 likes, <100 replies
  ↓
┌──────────────────────────────────────────────────────────┐
│ SAVED TO: reply_opportunities table                      │
├──────────────────────────────────────────────────────────┤
│ • tweet_id: "1234567890"                                 │
│ • tweet_url: "https://x.com/drmarkhyman/status/..."     │
│ • tweet_content: "Fascinating research on NAD+..."      │
│ • tweet_author: "drmarkhyman"                            │
│ • account_username: "drmarkhyman"                        │
│ • reply_count: 15                                        │
│ • like_count: 87                                         │
│ • posted_minutes_ago: 120                                │
│ • opportunity_score: 89                                  │
│ • discovered_at: "2025-10-22T02:30:00Z"                  │
│ • status: "pending"                                      │
└──────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                  PHASE 3: REPLY GENERATION                       │
└─────────────────────────────────────────────────────────────────┘

Query Top Opportunities
  ↓
  SELECT * FROM reply_opportunities
  WHERE status = 'pending'
  ORDER BY opportunity_score DESC
  LIMIT 5
  ↓
Generate AI Reply with GPT-4
  ↓
  Input: Original tweet content
  Output: "The data on NAD+ supplementation is compelling..."
  ↓
Validate Quality (not spam, adds value)
  ↓
Run Gate Chain (brand safety, relevance)
  ↓
┌──────────────────────────────────────────────────────────┐
│ SAVED TO: content_generation_metadata_comprehensive      │
├──────────────────────────────────────────────────────────┤
│ • decision_id: "uuid-123"                                │
│ • content: "The data on NAD+ supplementation..."         │
│ • decision_type: "reply"                                 │
│ • target_tweet_id: "1234567890"                          │
│ • target_username: "drmarkhyman"                         │
│ • status: "approved"                                     │
│ • quality_score: 0.92                                    │
│ • predicted_er: 0.045                                    │
│ • generation_source: "gpt-4"                             │
│ • generator_name: "scientific_communicator"              │
│ • created_at: "2025-10-22T02:35:00Z"                     │
└──────────────────────────────────────────────────────────┘
  ↓
Add to Posting Queue
  ↓
┌──────────────────────────────────────────────────────────┐
│ SAVED TO: posting_queue table                            │
├──────────────────────────────────────────────────────────┤
│ • decision_id: "uuid-123"                                │
│ • scheduled_at: "2025-10-22T02:35:00Z" (NOW)             │
│ • priority: 1 (high - replies are priority)              │
│ • status: "queued"                                       │
│ • created_at: "2025-10-22T02:35:00Z"                     │
└──────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                     PHASE 4: POSTING                             │
└─────────────────────────────────────────────────────────────────┘

Posting Queue Job Runs (Every 5 min)
  ↓
  SELECT * FROM posting_queue
  WHERE scheduled_at <= NOW()
  AND status = 'queued'
  ↓
Opens Twitter with Browser
  ↓
Navigates to: https://x.com/drmarkhyman/status/1234567890
  ↓
Types Reply in Reply Box
  ↓
Clicks "Reply" Button
  ↓
Waits for Confirmation
  ↓
Extracts Reply Tweet ID
  ↓
┌──────────────────────────────────────────────────────────┐
│ UPDATED IN: posted_tweets_comprehensive                  │
│ (via posted_decisions view)                              │
├──────────────────────────────────────────────────────────┤
│ • id: auto-generated                                     │
│ • tweet_id: "9876543210" (the REPLY'S ID)               │
│ • decision_id: "uuid-123"                                │
│ • content: "The data on NAD+ supplementation..."         │
│ • decision_type: "reply"                                 │
│ • target_tweet_id: "1234567890"                          │
│ • target_username: "drmarkhyman"                         │
│ • posted_at: "2025-10-22T02:40:00Z"                      │
│ • created_at: "2025-10-22T02:40:00Z"                     │
└──────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                   PHASE 5: METRICS TRACKING                      │
└─────────────────────────────────────────────────────────────────┘

Metrics Scraper Runs (Every 30 min)
  ↓
  SELECT * FROM posted_decisions
  WHERE decision_type = 'reply'
  AND posted_at > (NOW() - interval '7 days')
  ↓
For Each Posted Reply:
  ↓
  Opens: https://x.com/SignalAndSynapse/status/9876543210
  ↓
  Scrapes Engagement:
    • likes: 12
    • retweets: 3
    • replies: 2
    • views: 450
  ↓
┌──────────────────────────────────────────────────────────┐
│ SAVED TO: tweet_engagement_metrics_comprehensive         │
│ (via real_tweet_metrics view)                            │
├──────────────────────────────────────────────────────────┤
│ • tweet_id: "9876543210"                                 │
│ • likes: 12                                              │
│ • retweets: 3                                            │
│ • replies: 2                                             │
│ • views: 450                                             │
│ • bookmarks: 1                                           │
│ • profile_clicks: 8                                      │
│ • collection_phase: "T+30min"                            │
│ • collected_at: "2025-10-22T03:10:00Z"                   │
└──────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    PHASE 6: LEARNING                             │
└─────────────────────────────────────────────────────────────────┘

Learning Job Runs (Every 60 min)
  ↓
Queries All Recent Replies + Metrics
  ↓
  SELECT 
    pd.content,
    pd.target_username,
    cgm.generator_name,
    cgm.quality_score,
    tem.likes,
    tem.retweets,
    tem.replies
  FROM posted_decisions pd
  JOIN content_generation_metadata_comprehensive cgm
    ON pd.decision_id = cgm.decision_id
  JOIN tweet_engagement_metrics_comprehensive tem
    ON pd.tweet_id = tem.tweet_id
  WHERE pd.decision_type = 'reply'
  ↓
Analyzes Performance:
  • Which generators work best?
  • Which accounts respond well?
  • Which reply strategies get engagement?
  • What timing works best?
  ↓
Updates ML Models
  ↓
Adjusts Future Reply Strategy
```

---

## 📋 **SUMMARY OF ALL TABLES:**

### **Input Tables (What Gets Scraped):**

1. **`discovered_accounts`**
   - **Stores:** Target accounts to reply to
   - **Source:** Twitter hashtag searches + profile scraping
   - **Columns:** username, follower_count, bio, verified, discovery_method
   - **Updated:** Every 30 min by account discovery job

2. **`reply_opportunities`**
   - **Stores:** Specific tweets to reply to
   - **Source:** Twitter timeline scraping
   - **Columns:** tweet_id, tweet_url, tweet_content, opportunity_score, posted_minutes_ago
   - **Updated:** Every 60 min by reply job

### **Processing Tables (Generated Content):**

3. **`content_generation_metadata_comprehensive`**
   - **Stores:** Generated reply content (before posting)
   - **Source:** GPT-4 AI generation
   - **Columns:** decision_id, content, target_tweet_id, quality_score, generator_name
   - **Updated:** Every 60 min by reply job

4. **`posting_queue`**
   - **Stores:** Replies waiting to be posted
   - **Source:** Approved replies from generation
   - **Columns:** decision_id, scheduled_at, priority, status
   - **Updated:** Every 60 min (add), Every 5 min (process)

### **Output Tables (Posted & Tracked):**

5. **`posted_tweets_comprehensive`** (via `posted_decisions` view)
   - **Stores:** Posted replies with tweet IDs
   - **Source:** Twitter posting + ID extraction
   - **Columns:** tweet_id, decision_id, content, target_tweet_id, posted_at
   - **Updated:** Every 5 min by posting queue

6. **`tweet_engagement_metrics_comprehensive`** (via `real_tweet_metrics` view)
   - **Stores:** Reply performance metrics
   - **Source:** Twitter metrics scraping
   - **Columns:** tweet_id, likes, retweets, replies, views, collected_at
   - **Updated:** Every 30 min by metrics scraper

---

## 🔍 **CURRENT STATUS (From Your Database):**

```
✅ discovered_accounts: 20+ accounts
   • @kwadwo777: 17,800 followers ✅
   • @DrJasonFung: 200,000 followers ✅
   • ... 18 more

⚠️  reply_opportunities: 0 (not run yet)
   • Will populate in next reply job cycle (within 60 min)

❌ posted_decisions: 0 replies
   • Will populate after first replies post

❌ tweet_engagement_metrics: 0
   • Will populate after first replies post + metrics scrape
```

---

## ⏰ **WHEN DATA FLOWS:**

```
Minute :00 - Account Discovery
  └─ Updates: discovered_accounts ✅

Minute :30 - Account Discovery
  └─ Updates: discovered_accounts ✅

Minute :00 - Reply Job (next hour mark)
  └─ Updates: reply_opportunities ✅
  └─ Updates: content_generation_metadata ✅
  └─ Updates: posting_queue ✅

Minute :05 - Posting Queue
  └─ Updates: posted_decisions ✅

Minute :35 - Metrics Scraper
  └─ Updates: real_tweet_metrics ✅

Minute :00 - Learning Job
  └─ Reads: ALL tables
  └─ Updates: ML models
```

---

## 🎯 **KEY TAKEAWAYS:**

1. **19 Hashtags Scraped** - Not just #health! Covers all health niches
2. **6 Core Tables** - Each phase has its own storage
3. **Scraped Tweets Saved** - In `reply_opportunities` table
4. **Posted Replies Saved** - In `posted_tweets_comprehensive` table
5. **Metrics Tracked** - In `tweet_engagement_metrics_comprehensive` table
6. **Complete Audit Trail** - Every step from discovery → posting → metrics

Your system has **full data persistence** and **learning capability**! ✅

