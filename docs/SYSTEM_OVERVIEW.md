# 🤖 xBOT System - Complete Overview
**Last Updated:** November 5, 2025  
**Purpose:** High-level map of how the entire system works

---

## 🎯 The Big Picture

**What xBOT Does:**
Autonomously posts health content to Twitter, replies to relevant tweets, learns from performance, and optimizes over time.

**Tech Stack:**
- Node.js/TypeScript (code)
- Supabase/PostgreSQL (database)
- Railway (hosting)
- Playwright (browser automation for posting/scraping)
- OpenAI (content generation)

---

## 📊 The Complete Flow (5 Main Systems)

```
┌─────────────────────────────────────────────────────────────┐
│                    1. CONTENT GENERATION                     │
│  (What to post? When? How?)                                  │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    2. POSTING TO TWITTER                     │
│  (Actually publish to Twitter)                               │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    3. METRICS SCRAPING                       │
│  (How did it perform?)                                       │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    4. LEARNING & OPTIMIZATION                │
│  (What works? What doesn't?)                                 │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    5. VISUAL INTELLIGENCE (NEW)              │
│  (Learn formatting from viral tweets)                        │
└─────────────────────────────────────────────────────────────┘
```

---

## 1️⃣ **CONTENT GENERATION SYSTEM**

### **What It Does:**
Creates posts and replies using AI

### **How It Works:**

**For Posts:**
```
Every 30-60 minutes:
├─ Pick random TOPIC (sleep, gut health, NAD+, etc.)
├─ Pick random TONE (provocative, data-driven, questioning, etc.)
├─ Pick random ANGLE (Peter Attia style, contrarian, etc.)
├─ Pick random STRUCTURE (timeline, comparison, myth-busting, etc.)
├─ Pick random GENERATOR (13 different personalities)
│   └─ Examples: dataNerd, mythBuster, philosopher, coach
├─ Ask OpenAI to write the content
├─ Run through quality gates:
│   ├─ Medical safety check
│   ├─ Diversity check (not repeating recent topics)
│   └─ Similarity check (not too similar to recent posts)
├─ Store in database with status = 'queued'
└─ Schedule for posting (within next 30 min)
```

**For Replies:**
```
Every 30 minutes:
├─ Find high-engagement tweets from health accounts
├─ Filter for reply opportunities (relevant, not spam)
├─ Generate strategic reply using OpenAI
├─ Quality check (adds value? not spam?)
├─ Store in database with status = 'queued'
└─ Schedule for posting (staggered: 5 min, 20 min, etc.)
```

**Key Files:**
- `src/jobs/planJob.ts` - Generates posts
- `src/jobs/replyJob.ts` - Generates replies
- `src/generators/*.ts` - 13 different content personalities

**Storage:**
- Database: `content_metadata` table
- Columns: content, topic, tone, angle, generator, status='queued'

---

## 2️⃣ **POSTING TO TWITTER SYSTEM**

### **What It Does:**
Takes queued content and posts it to Twitter using browser automation

### **How It Works:**

```
Every 3-5 minutes:
├─ Check database for queued content
├─ Apply rate limits:
│   ├─ Max 2 posts per hour
│   └─ Max 4 replies per hour
├─ Check timing rules (30 min minimum between posts)
├─ For each ready item:
│   ├─ Open browser (Playwright)
│   ├─ Load saved Twitter session (no manual login!)
│   ├─ Navigate to twitter.com
│   ├─ Type content into compose box
│   ├─ Click "Post" button
│   ├─ Wait for URL to appear (x.com/status/TWEET_ID)
│   ├─ Extract tweet ID from URL
│   ├─ Update database:
│   │   ├─ status = 'posted'
│   │   ├─ tweet_id = "1986192671531045142"
│   │   └─ posted_at = NOW()
│   └─ Close browser
└─ Wait for next cycle
```

**For Replies:**
- Same process but navigates to target tweet first
- Clicks "Reply" button instead of compose
- Posts as reply, extracts reply tweet ID

**Key Files:**
- `src/jobs/postingQueue.ts` - Orchestrates posting
- `src/posting/UltimateTwitterPoster.ts` - Browser automation
- `src/browser/UnifiedBrowserPool.ts` - Manages browser sessions

**Storage:**
- Updates `content_metadata` (status, tweet_id, posted_at)
- Adds to `posted_decisions` (archive)

---

## 3️⃣ **METRICS SCRAPING SYSTEM**

### **What It Does:**
Goes back to Twitter, scrapes engagement metrics, stores in database

### **How It Works:**

```
Every 20 minutes:
├─ Query database for recently POSTED tweets:
│   ├─ 8 most recent (last 3 days)
│   └─ 2 historical (3-30 days old)
├─ Skip if already scraped in last hour
├─ For each tweet:
│   ├─ Open browser
│   ├─ Navigate to: twitter.com/i/web/status/{tweet_id}/analytics
│   ├─ Extract metrics from analytics page:
│   │   ├─ Impressions (views)
│   │   ├─ Likes
│   │   ├─ Retweets
│   │   └─ Replies
│   ├─ Validate (reject clearly fake data)
│   ├─ Store in 4 places:
│   │   ├─ outcomes table (raw metrics)
│   │   ├─ learning_posts table (for AI learning)
│   │   ├─ tweet_metrics table (for optimization)
│   │   └─ content_metadata.actual_* (for dashboard)
│   ├─ Verify data reached dashboard
│   ├─ Auto-retry if sync failed
│   └─ Record attempt in scraper_health (NEW - for monitoring)
└─ Close browser
```

**Coverage:**
- Fresh tweets: Every 20 min for 3 days
- Older tweets: 2 per run (less frequent)

**Key Files:**
- `src/jobs/metricsScraperJob.ts` - Orchestrates scraping
- `src/scrapers/bulletproofTwitterScraper.ts` - Does the actual extraction
- `src/metrics/scrapingOrchestrator.ts` - Validation & caching

**Storage:**
- `outcomes` - Raw metrics
- `content_metadata.actual_*` - Dashboard reads this
- `scraper_health` - Tracks scraper performance

---

## 4️⃣ **LEARNING & OPTIMIZATION SYSTEM**

### **What It Does:**
Analyzes what content performs well and adjusts strategy

### **How It Works:**

```
Every 6 hours:
├─ Analyze performance data:
│   ├─ Which topics get most engagement?
│   ├─ Which generators perform best?
│   ├─ What tone works better?
│   └─ What posting times get most views?
├─ Update weights for future decisions:
│   ├─ Boost good performers
│   └─ Reduce bad performers
├─ Track diversity (prevent repetition)
└─ Feed insights back to content generation
```

**Key Files:**
- `src/intelligence/dataCollectionEngine.ts` - Collects data
- `src/learning/*.ts` - Various learning systems
- `src/intelligence/diversityEnforcer.ts` - Prevents repetition

**Storage:**
- Reads from: `outcomes`, `content_metadata`
- Writes to: Various learning/stats tables

---

## 5️⃣ **VISUAL INTELLIGENCE SYSTEM (NEW)**

### **What It Does:**
Scrapes thousands of tweets from popular health accounts, learns what formatting works

### **How It Works:**

```
Every 8 hours:
├─ Scrape tweets from 100 health accounts
│   ├─ Micro-influencers (prioritized 3x)
│   ├─ Growth accounts (prioritized 2x)
│   └─ Established experts (baseline)
├─ Store with real metrics (views, likes, RTs)
└─ Store in: vi_collected_tweets

Every 6 hours:
├─ Classify tweets using OpenAI:
│   ├─ What topic? (sleep, gut health, etc.)
│   ├─ What angle? (research, anecdote, etc.)
│   └─ What tone? (serious, casual, etc.)
├─ Extract visual patterns:
│   ├─ How many emojis?
│   ├─ How many line breaks?
│   ├─ Hook type? (question, stat, story)
│   └─ Character count?
├─ Build intelligence database:
│   └─ "For sleep + provocative + question structure → Use 2 emojis, 3 line breaks"
└─ Feed to content generators (future)
```

**Key Files:**
- `src/intelligence/viAccountScraper.ts` - Scrapes tweets
- `src/intelligence/viProcessor.ts` - Analyzes patterns
- `src/intelligence/viIntelligenceFeed.ts` - Provides recommendations

**Storage:**
- `vi_scrape_targets` - 100 accounts to monitor
- `vi_collected_tweets` - Thousands of scraped tweets
- `vi_format_intelligence` - Pattern recommendations

**Status:** Collecting data, not yet applied to your posts

---

## 🗄️ **Database Architecture (Simple View)**

### **Core Tables (4):**

**1. content_metadata** - Everything about your content
```
What's in it:
├─ Content text
├─ Topic, tone, angle, generator
├─ Status (queued/posted/failed)
├─ tweet_id (Twitter's ID)
├─ actual_impressions, actual_likes, etc. (metrics)
└─ Used by: EVERYTHING

Flow:
Generation → Creates row (status='queued')
Posting → Updates (status='posted', tweet_id='...')
Scraper → Updates (actual_impressions, actual_likes)
Dashboard → Reads (shows metrics)
```

**2. outcomes** - Performance metrics
```
What's in it:
├─ tweet_id
├─ likes, retweets, replies, views
├─ engagement_rate
└─ Used by: Learning systems

Flow:
Scraper → Stores raw metrics
Learning systems → Analyze performance
```

**3. reply_opportunities** - Tweets to reply to
```
What's in it:
├─ target_tweet_id (tweet to reply to)
├─ account info
├─ opportunity score
└─ Used by: Reply generation

Flow:
Discovery jobs → Find high-engagement tweets
Reply job → Picks best opportunities
```

**4. scraper_health** - Scraper performance (NEW)
```
What's in it:
├─ tweet_id scraped
├─ success/failure
├─ strategy used
├─ metrics extracted
└─ Used by: Monitoring

Flow:
Scraper → Records every attempt
Dashboard → Shows success rate
```

---

## ⏰ **Job Schedule (When Things Run)**

**Every 3-5 minutes:**
- Posting Queue (checks for content to post)

**Every 20 minutes:**
- Metrics Scraper (scrapes engagement data)

**Every 30 minutes:**
- Plan Job (generates new posts)
- Reply Job (generates new replies)

**Every 90 minutes:**
- Account Discovery (finds new accounts to reply to)

**Every 4 hours:**
- Viral Scraper (learns from trending tweets)

**Every 6 hours:**
- Data Collection (analyzes performance)
- VI Processor (classifies & analyzes collected tweets)

**Every 8 hours:**
- Peer Scraper (scrapes health accounts for reply opportunities)
- VI Account Scraper (scrapes 100 accounts for format learning)

**Weekly:**
- VI Account Discovery (finds new micro-influencers)

---

## 🔄 **Complete Content Lifecycle (Example)**

### **Example: A Post About Sleep**

**Hour 0:00 - Generation**
```
planJob runs:
├─ Randomly picks: topic=sleep, tone=provocative, angle=contrarian
├─ Picks generator: mythBuster
├─ Asks OpenAI: "Write a provocative post about sleep myths"
├─ OpenAI returns: "Most sleep advice is backwards. Here's why..."
├─ Passes quality gates
├─ Stores in database:
│   └─ content_metadata (status='queued', scheduled_at=0:30)
```

**Hour 0:30 - Posting**
```
postingQueue runs:
├─ Finds queued post (scheduled_at <= NOW)
├─ Checks rate limits (max 2 posts/hour) ✅
├─ Opens browser → Navigates to twitter.com
├─ Types content, clicks "Post"
├─ Extracts tweet_id: "1986200000000000000"
├─ Updates database:
│   └─ content_metadata (status='posted', tweet_id='1986...')
```

**Hour 0:50 - First Metrics**
```
metricsScraperJob runs:
├─ Finds recently posted tweets (posted_at < 3 days)
├─ Opens browser → Goes to analytics page
├─ Scrapes: 147 views, 3 likes, 1 retweet
├─ Stores in:
│   ├─ outcomes table
│   ├─ content_metadata.actual_impressions = 147
│   ├─ content_metadata.actual_likes = 3
│   └─ Verifies dashboard has data ✅
```

**Hour 1:10 - Second Metrics**
```
metricsScraperJob runs again:
├─ Same tweet now has: 289 views, 7 likes, 2 retweets
├─ Updates all tables
└─ Dashboard shows updated metrics
```

**Hour 6:00 - Learning**
```
dataCollectionEngine runs:
├─ Analyzes all recent posts
├─ Finds: "mythBuster on sleep = 2.4% engagement rate"
├─ Compares to other generators
├─ Updates weights: mythBuster on sleep ↑ (good!)
└─ Future posts: More likely to use mythBuster for sleep
```

**Days 1-3:**
- Scraped every 20 minutes
- Metrics update continuously
- Learning systems optimize

**After 3 Days:**
- Scraped less frequently (2 per run)
- Long-term performance tracked
- Data used for strategic decisions

---

## 💬 **Reply System Flow (Example)**

**Hour 0:00 - Opportunity Discovery**
```
peerScraperJob runs:
├─ Scrapes timelines of @PeterAttiaMD, @HubermanLab, etc.
├─ Finds high-engagement tweet: "NAD+ supplements changing lives"
├─ Scores opportunity: 8.7/10 (high engagement, relevant)
├─ Stores in reply_opportunities table
```

**Hour 0:30 - Reply Generation**
```
replyJob runs:
├─ Picks best opportunity from database
├─ Asks OpenAI: "Write strategic reply about NAD+ dosing"
├─ OpenAI returns: "Research shows optimal NAD+ timing is..."
├─ Quality check ✅
├─ Stores in content_metadata (status='queued', decision_type='reply')
├─ Schedules for 5 minutes from now
```

**Hour 0:35 - Reply Posting**
```
postingQueue runs:
├─ Finds queued reply
├─ Opens browser → Navigates to target tweet
├─ Clicks "Reply" button
├─ Types reply, posts
├─ Extracts reply_tweet_id
├─ Updates database (status='posted', tweet_id='...')
```

**Hour 0:55 - Reply Metrics**
```
metricsScraperJob runs:
├─ Finds recently posted replies
├─ Scrapes metrics (same as posts)
├─ Updates dashboard
└─ Reply shows in dashboard with real data
```

---

## 🎨 **Visual Intelligence Flow (Example)**

**Every 8 Hours:**
```
VI Account Scraper runs:
├─ Scrapes @PeterAttiaMD timeline
├─ Gets 30 recent tweets with metrics
├─ Stores in vi_collected_tweets
└─ Now have 3,000+ tweets in database
```

**Every 6 Hours:**
```
VI Processor runs:

STEP 1: Classification
├─ Picks unclassified tweet
├─ Asks OpenAI: "What's the topic, angle, tone?"
├─ Stores in vi_content_classification

STEP 2: Visual Analysis  
├─ Extracts patterns from tweet text:
│   ├─ 2 emojis
│   ├─ 3 line breaks
│   ├─ Hook type: question
│   └─ 247 characters
├─ Stores in vi_visual_formatting

STEP 3: Intelligence Building
├─ Aggregates patterns by topic+angle+tone
├─ Calculates: "Sleep + provocative + question = 2 emojis avg"
└─ Stores in vi_format_intelligence
```

**Future (Not Yet Active):**
```
When generating content:
├─ Content created: "Sleep advice is backwards..."
├─ Query VI system: "How to format sleep + provocative?"
├─ VI returns: "Use 2 emojis, 3 line breaks, start with question"
├─ Apply formatting
└─ Post looks like proven viral tweets
```

---

## 📊 **Dashboard System**

### **What It Does:**
Shows real-time metrics for everything

### **Pages:**

**1. Recent** (`/dashboard/recent`)
- Last 50 posts/replies
- Sortable by time, views, likes
- Real-time metrics

**2. Posts** (`/dashboard/posts`)
- Post-only performance
- Top performers
- Generator breakdown

**3. Replies** (`/dashboard/replies`)
- Reply-only performance
- Tier breakdown (10k+ likes = platinum, etc.)
- Account breakdown

**4. Formatting** (`/dashboard/formatting`)
- VI system progress
- Tweets collected
- Patterns learned

**5. System Health** (`/dashboard/health`)
- Job status
- Error rates
- Resource usage

**Data Source:**
- Reads from `content_metadata.actual_*` columns
- Auto-refreshes every 2 minutes

---

## 🔧 **How Systems Work Together**

### **Example: Why Is Engagement Low?**

```
User notices: Posts getting < 1% engagement

What happens automatically:
├─ metricsScraperJob: Collects data every 20 min
├─ dataCollectionEngine: Analyzes every 6 hours
│   └─ Identifies: "data_nerd generator = 0.8% ER (below average)"
├─ Diversity enforcer: Reduces data_nerd usage
├─ Generator matcher: Picks storyteller more often
└─ Next posts: Better performance

Result: System self-corrects over 24 hours
```

### **Example: How VI Improves Formatting**

```
Current: Posts formatted randomly
├─ Sometimes emojis, sometimes not
├─ Sometimes bullets, sometimes paragraphs
└─ No data on what works

VI System:
├─ Scrapes 3,000 viral health tweets
├─ Finds: "Sleep + provocative = 85% use questions + 2 emojis"
├─ Future posts: Apply proven format
└─ Expected: Higher engagement

Status: Collecting data (not yet applied)
```

---

## 🚨 **Common Issues & How System Handles Them**

### **Issue: Scraper Fails**
```
What happens:
├─ Retry 3 times with backoff (2s, 4s, 8s)
├─ Try different extraction strategies
├─ Record failure in scraper_health
├─ Alert if success rate drops below 70%
└─ Auto-recover on next run
```

### **Issue: Posting Fails**
```
What happens:
├─ Retry up to 3 times (progressive delays)
├─ If all fail → mark as failed
├─ Move to next queued item
└─ Logs error for debugging
```

### **Issue: Rate Limit Hit**
```
What happens:
├─ postingQueue checks: posts_this_hour < 2?
├─ If exceeded → skip, try next cycle
├─ Logs: "Rate limit reached, waiting"
└─ Automatically resumes next hour
```

---

## 📈 **Performance Over Time**

### **Week 1:**
- Random content, learning baseline
- ~1% engagement rate
- Collecting data

### **Week 2-4:**
- Learning systems active
- Better topic/generator selection
- ~1.5% engagement rate

### **Month 2+ (Future with VI):**
- Visual formatting applied
- Proven patterns used
- Expected: ~2-3% engagement rate

---

## 🎯 **System Health Indicators**

**Healthy System Shows:**
- ✅ Posts appearing on Twitter every 30-60 min
- ✅ Replies appearing every 15-30 min
- ✅ Dashboard shows real metrics (not all 0s)
- ✅ Scraper success rate > 85%
- ✅ No errors in logs
- ✅ Jobs running on schedule

**Unhealthy System Shows:**
- ❌ Dashboard all 0s (scraper broken)
- ❌ No new posts (posting broken)
- ❌ Logs show errors every cycle
- ❌ Scraper success rate < 70%

---

## 📝 **Key Takeaways**

**1. Content Flow:**
Generate (queued) → Post (posted) → Scrape (metrics) → Learn (optimize)

**2. Timing:**
- Generation: Every 30-60 min
- Posting: Every 3-5 min (rate limited)
- Scraping: Every 20 min
- Learning: Every 6 hours

**3. Database:**
- Everything flows through `content_metadata`
- Dashboard reads from `actual_*` columns
- Scraper updates these columns

**4. Automation:**
- No manual intervention needed
- Self-healing (retries, fallbacks)
- Self-optimizing (learning systems)

**5. Monitoring:**
- Dashboard shows real-time data
- Health tracking in `scraper_health`
- Logs structured as JSON

---

## 🚀 **Current Status (Nov 5, 2025)**

**Working:**
- ✅ Post generation
- ✅ Reply generation  
- ✅ Posting (posts + replies)
- ✅ Scraper (posts working, replies FIXED but not deployed yet)
- ✅ Dashboard (shows correct data)
- ✅ VI system (collecting data in background)

**Just Fixed:**
- ✅ Scraper now uses `posted_at` instead of `created_at`
- ✅ Replies will be scraped starting next run
- ✅ Health tracking added
- ✅ Verification loop added

**Pending Deploy:**
- ⏳ Awaiting your approval to push to Railway

---

**This is your complete system! Ready to deploy the reply fix?**

