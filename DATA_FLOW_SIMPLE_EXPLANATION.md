# 📊 Data Flow & Decisions - Simple Visual Explanation

## The Complete Picture in One Page

---

## 🔄 The Full Cycle (Step by Step)

```
┌─────────────────────────────────────────────────────────────────┐
│ STEP 1: GENERATE CONTENT (Every 2 Hours)                       │
└─────────────────────────────────────────────────────────────────┘

System decides:
  ├─ What content type? → Reads bandit_arms table
  │    └─ "educational_thread" has 83% success → Pick this!
  │
  ├─ When to post? → Reads bandit_arms table
  │    └─ 2 PM has 4.5% avg engagement → Schedule for 2 PM!
  │
  └─ AI generates content:
        content: "Sleep debt accumulates..."
        quality_score: 0.82 (quality gate scored it)
        bandit_arm: "educational_thread"
        scheduled_at: 2 PM

Stored in: content_metadata table
  ├─ decision_id: "abc-123"
  ├─ quality_score: 0.82
  ├─ bandit_arm: "educational_thread"
  └─ scheduled_at: 2 PM


┌─────────────────────────────────────────────────────────────────┐
│ STEP 2: POST TO TWITTER (Every 5 Minutes)                      │
└─────────────────────────────────────────────────────────────────┘

Posting Queue checks:
  ├─ Ready? → Yes (2 PM reached)
  ├─ Rate limit? → OK (only 1 post this hour)
  └─ Quality? → Passed (0.82 >= 0.70)

Posts to Twitter → Gets tweet_id: "1234567890"

Updates: content_metadata
  ├─ status: 'posted'
  ├─ tweet_id: '1234567890'
  └─ posted_at: 2 PM


┌─────────────────────────────────────────────────────────────────┐
│ STEP 3: COLLECT RESULTS (24-48 Hours Later)                    │
└─────────────────────────────────────────────────────────────────┘

Metrics Scraper runs:
  ├─ Finds tweet on Twitter (using tweet_id)
  ├─ Collects metrics:
  │    ├─ impressions: 1,000
  │    ├─ likes: 45
  │    ├─ retweets: 8
  │    ├─ replies: 2
  │    └─ followers_gained: 3
  │
  └─ Calculates:
        engagement_rate = (45 + 8 + 2) / 1000 = 5.5%

Stored in: outcomes table
  ├─ decision_id: "abc-123" (links back to content)
  ├─ engagement_rate: 0.055 (5.5%)
  ├─ impressions: 1000
  ├─ likes: 45
  └─ followers_gained: 3


┌─────────────────────────────────────────────────────────────────┐
│ STEP 4: LEARN FROM RESULTS (Every Few Hours)                   │
└─────────────────────────────────────────────────────────────────┘

Learning Job runs:
  1. Collects data:
     ├─ Reads outcomes (last 7 days)
     └─ Joins with content_metadata (to get features)

  2. Creates training examples:
     {
       // Features (from content_metadata):
       quality_score: 0.82,
       content_type: "educational_thread",
       timing_slot: 14 (2 PM),
       
       // Results (from outcomes):
       engagement_rate: 0.055 (5.5%),
       followers_gained: 3
     }

  3. Trains 3 models:

     MODEL 1: BANDIT ARMS
     ├─ Learns: "educational_thread" works well (5.5% > 3%)
     ├─ Updates: successes++ for educational_thread
     └─ Stores in: bandit_arms table

     MODEL 2: RIDGE REGRESSION
     ├─ Learns: quality_score 0.82 → engagement_rate 0.055
     ├─ Updates: Higher quality = higher engagement
     └─ Stores in: Redis (predictor:v2:latest)

     MODEL 3: LOGISTIC REGRESSION
     ├─ Learns: novelty + expertise → follow_through
     ├─ Updates: What makes people follow
     └─ Stores in: Redis (same key as Ridge)

  4. Next posts use learned patterns:
     └─ System automatically gets smarter!


┌─────────────────────────────────────────────────────────────────┐
│ STEP 5: NEXT POST (Better Decisions)                           │
└─────────────────────────────────────────────────────────────────┘

Plan Job runs again:
  ├─ Reads bandit_arms: "educational_thread" now 84% success
  ├─ Uses Ridge Regression: Predicts 4.5% engagement for quality 0.85
  └─ Decision: Post it! (predictions look good)

Better content posted automatically!
  └─ System learned from past performance
```

---

## 📊 Data Types & Where They Come From

### **Content Features (From `content_metadata` table):**
```
quality_score: 0.82          ← Quality gate scored it
bandit_arm: "educational_thread"  ← Strategy chosen
decision_type: "thread"      ← Multi-tweet thread
timing_slot: 14              ← Hour (2 PM = hour 14)
topic: "sleep"               ← What it's about
hook_type: "statistic"       ← Opening style
```

### **Performance Results (From `outcomes` table):**
```
impressions: 1000            ← How many people saw it
likes: 45                    ← Engagement
retweets: 8                  ← Engagement
replies: 2                   ← Engagement
engagement_rate: 0.055       ← (45+8+2)/1000 = 5.5%
followers_gained: 3          ← New followers
collected_at: 24h later      ← When metrics scraped
```

### **Learning Results (Stored after training):**
```
Bandit Arms (in bandit_arms table):
  ├─ arm_name: "content_educational_thread"
  ├─ successes: 25           ← Posts with > 3% engagement
  ├─ failures: 5             ← Posts with <= 3% engagement
  └─ success_rate: 83%       ← 25/30 = 83%

Predictor Models (in Redis):
  ├─ Ridge Regression:       ← quality_score → engagement_rate
  │    └─ qualityWeight: 0.025 (higher quality = +0.25% ER per 0.1 quality)
  │
  └─ Logistic Regression:    ← features → follow_through
       └─ noveltyWeight: 0.25 (novelty helps conversions)
```

---

## 🎯 How Decisions Are Made

### **Decision 1: What Content Type?**

**Uses:** Bandit Arms (Thompson Sampling)

**How:**
```
Reads bandit_arms table:
  educational_thread: 25 successes, 5 failures (83% success)
  factual_single: 10 successes, 8 failures (56% success)

Samples from distributions:
  educational_thread: Beta(26, 6) → samples 0.82
  factual_single: Beta(10, 8) → samples 0.58

Decision: Pick "educational_thread" (higher sample: 0.82 > 0.58)
```

---

### **Decision 2: When to Post?**

**Uses:** Bandit Arms (UCB1 for timing)

**How:**
```
Reads bandit_arms table:
  2 PM: avg_reward 0.055 (5.5%), samples 10
  8 PM: avg_reward 0.032 (3.2%), samples 5

Calculates UCB1 scores:
  2 PM: 0.055 + confidence_interval = 0.075
  8 PM: 0.032 + confidence_interval = 0.062

Decision: Pick 2 PM (higher UCB1: 0.075 > 0.062)
```

---

### **Decision 3: Should We Post This Content?**

**Uses:** Ridge Regression (predicts engagement)

**How:**
```
Before posting, calculates:
  quality_score: 0.85
  content_type_educational: 1
  timing_slot: 14 (2 PM)

Uses Ridge Regression:
  predicted_er = 0.01 + (0.025 * 0.85) + (0.008 * 1) + (0.005 * 14/24)
               = 0.01 + 0.021 + 0.008 + 0.003
               = 0.042 (4.2%)

Decision: Post it! (4.2% > 3.5% threshold)
```

---

### **Decision 4: Is This High Quality?**

**Uses:** Logistic Regression (predicts followers)

**How:**
```
Before posting, calculates:
  novelty_score: 0.80
  expertise_level: 0.75
  viral_indicators: 0.60

Uses Logistic Regression:
  probability = 1 / (1 + e^(-0.14))
             = 53.5%

Decision: Good quality (53.5% > 50% threshold)
```

---

## 🔄 The Complete Data Flow

```
content_metadata table          outcomes table
──────────────────────          ───────────────
decision_id: "abc-123"    →     decision_id: "abc-123"
quality_score: 0.82             engagement_rate: 0.055
bandit_arm: "educational"       followers_gained: 3
timing_slot: 14                 impressions: 1000
posted_at: 2 PM                 collected_at: 24h later
```

**Joined Together:**
```
Training Example:
  ├─ Features (from content_metadata):
  │    ├─ quality_score: 0.82
  │    ├─ content_type: "educational_thread"
  │    └─ timing_slot: 14
  │
  └─ Targets (from outcomes):
       ├─ actual_er: 0.055
       └─ follow_through: 1
```

**Fed Into Models:**
```
Bandit Arms:
  Input: content_type, timing_slot
  Output: success/failure (engagement_rate > 3%)
  Stored: bandit_arms table

Ridge Regression:
  Input: quality_score, content_type, timing_slot
  Output: predicted engagement_rate
  Stored: Redis (predictor:v2:latest)

Logistic Regression:
  Input: novelty_score, expertise_level, viral_indicators
  Output: probability of follow_through
  Stored: Redis (predictor:v2:latest)
```

---

## 📈 How It Gets Smarter Over Time

### **Week 1:**
```
Posts random content types
  ├─ educational_thread: 5 posts, 4 successes
  └─ factual_single: 5 posts, 2 successes

Bandit Arms Learn:
  └─ educational_thread performs better (80% vs 40%)
```

### **Week 2:**
```
Bandit Arms Guide Selection:
  ├─ 70% picks educational_thread (exploiting)
  └─ 30% picks other types (exploring)

More posts use educational_thread
  └─ Even better results (83% success)
```

### **Week 3:**
```
System Optimized:
  ├─ Automatically focuses on educational_thread
  ├─ Predicts engagement before posting
  ├─ Rejects low-quality content
  └─ Gets smarter over time
```

---

## 🎯 Key Insights

**The System Learns:**
1. ✅ **What works:** Which content types perform best
2. ✅ **When works:** Which hours get best engagement
3. ✅ **Why works:** Quality → Engagement correlation
4. ✅ **Who converts:** What makes people follow

**The Feedback Loop:**
```
Post → Collect Results → Learn → Better Strategy → Better Post → ...
```

**Automatic Optimization:**
- No manual tuning needed
- System learns what works for your audience
- Gets smarter with every post

