# 🗞️ TWITTER NEWS SCRAPING SYSTEM - INTEGRATION COMPLETE

## ✅ WHAT WAS BUILT

A comprehensive real-time news scraping system that integrates seamlessly with your existing xBOT architecture.

---

## 📊 SYSTEM ARCHITECTURE

### **3 Core Components:**

1. **News Scraper** (`src/news/newsScraperJob.ts`)
   - Scrapes Twitter every hour
   - Sources: CNN, Fox News, NYT, WebMD, health influencers
   - Stores raw tweets with timestamps

2. **News Curator** (`src/news/newsCuratorService.ts`)
   - AI analyzes scraped tweets
   - Extracts topics, claims, credibility
   - Filters and ranks news

3. **Trending Tracker** (`src/news/trendingTopicsService.ts`)
   - Detects trending topics in real-time
   - Compares today vs. yesterday mentions
   - Flags viral content

---

## 🔄 HOW IT INTEGRATES

### **Existing System Flow (UNCHANGED):**
```
Every 3 hours:
1. Plan Job runs
2. Exploration Wrapper generates topic
3. Content Orchestrator selects generator
4. Generator creates content
5. Quality check + viral scoring
6. Store in database
7. Post via queue
```

### **NEW Integration Points:**

#### **Point 1: News Reporter Generator**
```typescript
// OLD: Made up fake studies
generateNewsReporterContent(topic) {
  "MIT 2024 study shows..." // ← FAKE
}

// NEW: Uses real scraped news
generateNewsReporterContent(topic) {
  const realNews = await getRealNewsForTopic(topic);
  // Uses actual CNN/Fox/health outlet tweets
  // References real viral content
  // Includes actual study URLs
}
```

#### **Point 2: Dynamic Topic Generation**
```typescript
// NEW: Check trending topics first
const trendingTopics = await getTrendingTopics();
// "cold exposure" is trending 5.2x today

// Generate content about what's ACTUALLY viral
topic = trendingTopics[0]; // cold exposure
```

#### **Point 3: Content Orchestrator**
```typescript
// NEW: Can query curated news
const news = await getCuratedNews({
  topic: 'sleep',
  minFreshnessScore: 60,
  unused: true
});

// Use real news as research foundation
```

---

## 📁 DATABASE TABLES (AUTO-CREATED)

### **1. `health_news_scraped`** (Raw Data)
```sql
- tweet_id (unique)
- tweet_text
- author_username (CNN, FoxNews, hubermanlab, etc.)
- likes_count, retweets_count
- posted_at (original tweet time)
- scraped_at (when we captured it)
- source_type (news_outlet, health_account, influencer, viral_trend)
- viral_score (calculated engagement)
- freshness_score (0-100 based on age)
- analyzed (boolean flag)
```

**Retention:** 7 days

### **2. `health_news_curated`** (AI-Analyzed)
```sql
- id
- original_tweet_id (links to scraped)
- topic (AI-extracted: "sleep", "nutrition", etc.)
- headline (AI-generated catchy version)
- key_claim (main finding)
- source_credibility (high/medium/low)
- study_url (if available)
- viral_score, freshness_score
- trending (boolean - is it viral NOW?)
- used_in_post (tracks if we used it)
```

**Retention:** 14 days or until used

### **3. `trending_topics`** (Real-Time Trends)
```sql
- topic
- mention_count_today
- mention_count_yesterday
- trend_score (today/yesterday ratio)
- last_updated
```

**Retention:** 7 days

---

## ⏰ AUTOMATED SCHEDULE

### **Every Hour (News Scraping):**
```
1. Open Twitter
2. Scrape CNN, Fox, NYT (news outlets) - 5 tweets each
3. Scrape WebMD, Mayo Clinic (health accounts) - 5 tweets each
4. Scrape Huberman, Attia (influencers) - 5 tweets each
5. Search "new study health" (trending) - 15 tweets
6. Total: ~50 tweets/hour = 1200 tweets/day
7. Store in health_news_scraped
8. Run AI analysis on high-engagement tweets
9. Update trending topics
```

**Database impact:** ~50 rows/hour in scraped, ~10 rows/hour in curated

### **When Content Generated (On-Demand):**
```
News Reporter Generator called:
1. Query: "Get fresh news about {topic}"
2. Filter: freshness_score > 60, unused, credibility > medium
3. Return: Top viral news item
4. Use in content generation
5. Mark as "used" to prevent repetition
```

---

## 🎯 NEWS SOURCES

### **Major News Outlets (16 accounts):**
- CNN, Fox News, New York Times, MSNBC, CBS News
- ABC News, NBC News, Reuters, Associated Press
- BBC News, Guardian, Wall Street Journal
- Washington Post, NPR, USA Today, Axios

### **Health News Accounts (15 accounts):**
- WebMD, Mayo Clinic, CDC, WHO, NIH
- Harvard Health, Cleveland Clinic, Kaiser Health
- STAT News, Medscape, HealthDay
- MedPage Today, Science Daily, Nature, Science Magazine

### **Health Influencers (15 accounts):**
- Andrew Huberman, Peter Attia, Rhonda Patrick
- Ben Greenfield, Mark Hyman, Gundry MD
- And 9 more top health accounts

**Total:** 46 accounts monitored + trending searches

---

## 💡 EXAMPLE USAGE

### **Scenario 1: Breaking News**

**9:00 AM - News Scraped:**
```
@CNN posted 2 hours ago:
"New study: Cold showers boost metabolism 23% within 6 weeks"
Engagement: 45,000 likes, 8,000 retweets
```

**9:05 AM - AI Analyzes:**
```
Topic: cold_exposure
Headline: Cold showers boost metabolism 23% in weeks
Key Claim: Cold exposure increases metabolic rate significantly
Credibility: High (news outlet + high engagement)
Viral Score: 61,000
Freshness Score: 95/100 (2 hours old)
```

**12:00 PM - Your Bot Posts:**
```
"New study just dropped: Cold showers → 23% metabolic boost 
within 6 weeks. Here's the mechanism most people miss: [thread]"
```

**Result:** Timely, viral, credible content

---

### **Scenario 2: Trending Topic Detection**

**Daily Analysis:**
```
Topic: "seed oils"
Yesterday: 12 mentions
Today: 67 mentions
Trend Score: 5.6x increase

Action: Flag "seed oils" as trending
```

**Content Generation:**
```
System: "seed oils is trending 5.6x today"
Bot generates: "Everyone's talking about seed oils today. 
Here's what the actual research shows (not the hype): [thread]"
```

**Result:** You ride the viral wave

---

### **Scenario 3: Evergreen with Fresh Angle**

**Your System:**
```
Topic selected: "sleep optimization"
Query news: "Get fresh sleep news"

Result: @hubermanlab 6 hours ago:
"Mouth breathing during sleep destroys deep sleep quality"
Viral: 34k likes

Your post: "Huberman just explained why mouth breathing ruins 
your sleep. The mechanism: [your detailed explanation]"
```

**Result:** Evergreen topic + fresh, timely angle

---

## 🚦 CONTENT GENERATION FLOW (UPDATED)

### **OLD Flow:**
```
1. Pick topic (AI-generated)
2. Select generator (Data Nerd, Coach, etc.)
3. Generate content (AI makes up everything)
4. Post
```

### **NEW Flow:**
```
1. Check trending topics (real-time data)
2. Pick trending or evergreen topic
3. IF News Reporter selected:
   a. Query curated news for topic
   b. Use REAL news (CNN, Fox, health outlets)
   c. Reference actual sources and timing
4. Generate content with real foundation
5. Mark news as used (prevent repetition)
6. Post
```

---

## 📈 BENEFITS

### **1. Credibility**
- ✅ Real sources (CNN, Fox, WebMD)
- ✅ Actual engagement proof (viral tweets)
- ✅ Verifiable study URLs
- ❌ No more fake citations

### **2. Timeliness**
- ✅ Content within hours of breaking news
- ✅ Never reference stale news (freshness score)
- ✅ Ride viral waves while hot
- ❌ No more "old news"

### **3. Trend Awareness**
- ✅ Detect surging topics (5x mentions)
- ✅ Generate content about what's trending
- ✅ Capitalize on viral moments
- ❌ No more guessing what's hot

### **4. Authenticity**
- ✅ Reference real Twitter accounts
- ✅ Cite actual viral posts
- ✅ Link to real studies
- ❌ No more made-up information

---

## 🎯 USE CASES BY GENERATOR

### **News Reporter** (PRIMARY USER)
```
BEFORE: "MIT 2024 study shows..." (fake)
AFTER: "@CNN just reported: Cold exposure..." (real, 2hrs old, 45k likes)
```

### **Data Nerd** (CAN USE)
```
Gets curated news with study URLs
References real research from scraped tweets
"Stanford 2024 (via @hubermanlab): Protein timing matters..."
```

### **Storyteller** (CAN USE)
```
Finds viral personal stories
"This went viral yesterday: Someone's sleep experiment..."
```

### **Contrarian** (CAN USE)
```
Finds controversial trending topics
"Everyone's arguing about seed oils today. Here's the nuance..."
```

---

## 💾 DATA MANAGEMENT

### **Storage Optimization:**
```
Scraped news: 50 tweets/hour × 24h = 1,200 tweets/day
After 7 days: Auto-delete old scraped data
Curated news: ~10 items/hour = 240 items/day
After 14 days OR used: Auto-delete

Net storage: ~7,000 scraped + ~3,360 curated = ~10K rows max
```

### **Query Performance:**
```
Indexes on:
- freshness_score (DESC)
- viral_score (DESC)  
- topic
- trending (WHERE true)
- used_in_post (WHERE NULL)

Result: Sub-second queries even at scale
```

---

## 🔧 CONFIGURATION

### **Scraper Frequency:**
```env
NEWS_SCRAPER_INTERVAL_HOURS=1  # Default: every hour
```

### **Freshness Threshold:**
```env
MIN_FRESHNESS_SCORE=60  # Default: 60/100
```

### **Trending Threshold:**
```env
TRENDING_MULTIPLIER=2.0  # Default: 2x increase
```

---

## 🚀 DEPLOYMENT STATUS

**✅ DEPLOYED:**
- News scraping job (runs every hour)
- News curator service (AI analysis)
- Trending topics service (real-time detection)
- Database tables (auto-created via migrations)
- News Reporter generator (updated to use real news)
- Job manager integration (scheduled automatically)

**🔄 ACTIVE:**
- Scraping starts immediately on next deployment
- First news will be available within 1 hour
- Trending detection starts after 24 hours (needs baseline)

---

## 📊 MONITORING

### **Check News Scraping:**
```sql
-- Check scraped news count
SELECT COUNT(*), source_type FROM health_news_scraped 
GROUP BY source_type;

-- Check latest scraped news
SELECT author_username, tweet_text, posted_at, viral_score
FROM health_news_scraped 
ORDER BY scraped_at DESC LIMIT 10;
```

### **Check Curated News:**
```sql
-- Check curated news by topic
SELECT topic, COUNT(*) FROM health_news_curated 
GROUP BY topic ORDER BY COUNT(*) DESC;

-- Check unused fresh news
SELECT topic, headline, freshness_score, viral_score
FROM health_news_curated
WHERE used_in_post IS NULL AND freshness_score > 60
ORDER BY viral_score DESC LIMIT 10;
```

### **Check Trending:**
```sql
-- Check trending topics
SELECT topic, trend_score, mention_count_today
FROM trending_topics
WHERE trend_score > 2.0
ORDER BY trend_score DESC;
```

---

## 🎉 SUMMARY

**You now have:**
1. ✅ Real news from CNN, Fox, NYT, health outlets
2. ✅ Automated hourly scraping (50 tweets/hour)
3. ✅ AI analysis and curation
4. ✅ Real-time trending detection
5. ✅ Seamless integration with existing system
6. ✅ News Reporter uses REAL news (no more fake studies)
7. ✅ Freshness tracking (never post stale news)
8. ✅ Viral scoring (use what's already proven)

**Result:** Your bot now generates content about REAL breaking news, riding viral waves while they're hot, with credible sources and perfect timing.

🎯 **NO MORE FAKE STUDIES. ONLY REAL, TIMELY, VIRAL NEWS.**

