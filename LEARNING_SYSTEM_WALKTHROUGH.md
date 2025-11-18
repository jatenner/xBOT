# 🧠 LEARNING SYSTEM WALKTHROUGH

**Complete flow: Tweet Scraped → Saved → Learning Activated**

---

## 📊 **PHASE 1: TWEET GETS SCRAPED & SAVED**

### **What Happens:**
1. **`metricsScraperJob.ts`** runs every 10 minutes
2. Finds posts with `tweet_id` but missing metrics
3. Uses `ScrapingOrchestrator` → `BulletproofTwitterScraper` to scrape Twitter
4. Collects: views, likes, retweets, replies, bookmarks, profile clicks

### **Where Data Gets Saved:**
```typescript
// 4 TABLES UPDATED SIMULTANEOUSLY:

1. outcomes (decision_id based)
   - Primary metrics store
   - Used by learning systems

2. learning_posts (tweet_id based)  
   - Used by 30+ learning systems
   - Critical for pattern extraction

3. tweet_metrics (tweet_id based)
   - Used by timing & quantity optimizers

4. content_metadata (decision_id based)
   - Dashboard reads actual_impressions, actual_likes here
   - Links generation metadata to performance
```

**Code Location:** `src/jobs/metricsScraperJob.ts:330-427`

---

## 🔥 **PHASE 2: IMMEDIATE LEARNING TRIGGERS**

### **A. Generator Performance Tracking**
**What:** Updates stats for each generator (Provocateur, DataNerd, etc.)

```typescript
// After metrics saved:
const tracker = getGeneratorPerformanceTracker();
await tracker.updateGeneratorStats(generator_name);
```

**Learns:**
- Which generators perform best
- Average engagement per generator
- Topic preferences per generator

**Code Location:** `src/jobs/metricsScraperJob.ts:472-488`

---

### **B. Data-Driven Viral Formulas**
**What:** Extracts patterns from successful posts to create new viral formulas

**Sources:**
1. **Your successful posts** (2%+ engagement rate OR 5K+ views)
2. **Viral replies** (10K-100K views from `reply_metrics`)
3. **Visual Intelligence** (high-performing tweets from `vi_tweets`)
4. **Competitor analysis** (top posts from `peer_posts`)

**How It Works:**
```typescript
// AI analyzes successful content and extracts patterns:
const formulas = await dataDrivenViralFormulas.getViralFormulasForGenerator('dataNerd');

// Returns learned formulas like:
{
  name: "Contrarian Data Hook",
  structure: "[Surprising stat] + [Contrarian take] + [Evidence]",
  example: "95% of people think X, but research shows Y...",
  performance: {
    avgViews: 8500,
    avgEngagementRate: 0.024,
    followerConversion: 12.5, // 12.5 followers per 1000 views
    confidence: 0.87
  }
}
```

**Code Location:** `src/generators/dataDrivenViralFormulas.ts`

---

## 🧠 **PHASE 3: SCHEDULED LEARNING CYCLES**

### **A. Real-Time Learning Loop** (Every Hour)
**Location:** `src/intelligence/realTimeLearningLoop.ts`

**Steps:**
1. **Scrape & Analyze** recent tweet performance
2. **Update ML Models** with new data from `outcomes` table
3. **Analyze Follower Patterns** - what content drives follower growth
4. **Update Viral Formulas** based on performance
5. **Store Learning Summary** for dashboard

**Key Learning:**
```typescript
// Trains ML models with REAL data:
await mlEngine.trainWithNewData(content, {
  likes, retweets, replies,
  followers_gained, // From follower_attribution_simple
  engagement_velocity,
  hook_effectiveness,
  // ... 20+ metrics
});
```

---

### **B. Aggregate & Learn Job** (Scheduled)
**Location:** `src/jobs/aggregateAndLearn.ts`

**What It Does:**
1. **Aggregates** post metrics from last 24 hours
2. **Updates Bandit Arms** (topic selection, timing optimization)
3. **Processes Embeddings** for content similarity
4. **Retrains Predictors** if 10+ new posts available

**Bandit Learning:**
- Topics that perform well get higher selection probability
- Timing patterns (best hours) get reinforced
- Tag combinations that work get boosted

---

### **C. Self-Learning System** (Every Hour)
**Location:** `src/learn/learn.ts`

**Cycle:**
1. Scrape recent tweet metrics
2. Store/update metrics in database
3. **Analyze performance patterns** (top topics, best timing)
4. **Update content strategy** (what to post more/less)
5. **Update pattern confidence scores** (which patterns are reliable)

**Output:**
```typescript
{
  top_performing_topics: ['NAD+ supplementation', 'Sleep optimization'],
  best_posting_hours: [14, 15, 16], // 2-4 PM
  effective_hooks: ['Contrarian stat', 'Personal story'],
  generator_performance: {
    'dataNerd': 0.028, // 2.8% engagement rate
    'provocateur': 0.019
  }
}
```

---

## 🎯 **PHASE 4: HOW LEARNING GETS USED**

### **A. Content Generation**
When `planJob.ts` generates new content:

1. **Viral Formulas Applied:**
   ```typescript
   // Gets learned formulas for this generator
   const formulas = await getViralFormulasSection('dataNerd');
   // Injects into AI prompt
   ```

2. **Trending Topics:**
   ```typescript
   // 35% chance to use trending topic from harvester data
   if (useTrendingTopic) {
     const topic = await trendingTopicExtractor.getTopTrendingTopic();
   }
   ```

3. **Generator Selection:**
   ```typescript
   // Uses performance data to pick best generator
   const tracker = getGeneratorPerformanceTracker();
   const bestGenerators = tracker.getTopPerformers();
   ```

---

### **B. Topic Selection**
**Bandit Algorithm** learns:
- Which topics get most engagement
- Which topics drive follower growth
- Adjusts selection probability automatically

**Code:** `src/learn/ingest.ts` → `GamingBanditManager`

---

### **C. Timing Optimization**
**Learns:**
- Best hours to post (based on engagement velocity)
- When followers are most active
- Optimal spacing between posts

**Code:** `src/learning/timingOptimizer.ts`

---

## 📈 **COMPLETE DATA FLOW**

```
1. POST CREATED
   ↓
2. POSTED TO TWITTER
   ↓
3. metricsScraperJob (every 10 min)
   → Scrapes Twitter
   → Saves to 4 tables
   ↓
4. IMMEDIATE LEARNING
   → Generator stats updated
   → Viral formulas extracted (if post successful)
   ↓
5. SCHEDULED LEARNING (every hour)
   → RealTimeLearningLoop analyzes patterns
   → ML models trained with new data
   → Viral formulas updated
   → Bandit arms adjusted
   ↓
6. NEXT POST GENERATION
   → Uses learned formulas
   → Picks trending topics
   → Selects best generators
   → Optimizes timing
   ↓
7. REPEAT (continuous improvement)
```

---

## 🔍 **KEY LEARNING SYSTEMS**

| System | Frequency | What It Learns |
|--------|-----------|----------------|
| **metricsScraperJob** | Every 10 min | Collects raw metrics |
| **RealTimeLearningLoop** | Every hour | ML training, viral formulas |
| **aggregateAndLearn** | Scheduled | Bandit arms, predictors |
| **SelfLearningSystem** | Every hour | Performance patterns, strategy |
| **DataDrivenViralFormulas** | On-demand | Extracts patterns from success |
| **GeneratorPerformanceTracker** | Real-time | Generator effectiveness |

---

## ✅ **LEARNING GATES**

**Minimum Thresholds:**
- **Views:** ≥ 100 (below = skip learning)
- **Likes:** ≥ 5 (below = skip learning)
- **Engagement Rate:** 2%+ for "successful" classification
- **Time:** ≥ 2 hours old (too recent = not meaningful)

**Code:** `src/learning/learningSystem.ts:89-95`

---

## 🎯 **WHAT GETS LEARNED**

1. **Content Patterns:**
   - Hook types that work
   - Topic angles that convert
   - Length optimization
   - Format strategies

2. **Generator Performance:**
   - Which generators get most engagement
   - Topic preferences per generator
   - Best use cases for each

3. **Timing:**
   - Best hours to post
   - Engagement velocity patterns
   - Follower activity windows

4. **Viral Formulas:**
   - Structures that drive views
   - Patterns that convert followers
   - Formulas specific to each generator

5. **Follower Growth:**
   - Content that drives follows
   - Profile click patterns
   - Conversion optimization

---

## 🚀 **RESULT**

**The system continuously:**
- Learns from every successful post
- Extracts patterns automatically
- Updates strategies in real-time
- Improves content quality over time
- Optimizes for follower growth

**No manual intervention needed** - fully autonomous learning loop!

