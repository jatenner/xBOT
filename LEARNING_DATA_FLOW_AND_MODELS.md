# 🧠 Learning System: Data Flow & Models Explained

## Overview

Your system has **3 learning models** that work together:
1. **Bandit Arms** (Thompson Sampling) - Learns which content types work best
2. **Ridge Regression** - Predicts engagement rate before posting
3. **Logistic Regression** - Predicts follow-through (will user follow?)

---

## 📊 Data Flow: Where Data Comes From

### **Step 1: Content Posted**
**Table:** `content_metadata`
**Data Collected:**
- `decision_id` (UUID)
- `quality_score` (0-1)
- `decision_type` ('single', 'thread', 'reply')
- `bandit_arm` (e.g., "educational_thread_morning")
- `topic`, `hook_type`, `style`
- `created_at`, `posted_at`

### **Step 2: Metrics Collected (24-48 hours later)**
**Table:** `outcomes`
**Data Collected:**
- `decision_id` (links back to content)
- `impressions` (views)
- `likes`, `retweets`, `replies`, `bookmarks`
- `engagement_rate` (calculated: `(likes + retweets + replies) / impressions`)
- `followers_gained` (24h after posting)
- `collected_at` (when metrics scraped)

### **Step 3: Learning Job Runs (every few hours)**
**File:** `src/jobs/learnJob.ts`

**What it does:**
1. Reads `outcomes` from last 7 days
2. Joins with `content_metadata` to get features
3. Feeds data into 3 models:
   - **Bandit Arms** - Updates success/failure counts
   - **Ridge Regression** - Trains on quality_score → engagement_rate
   - **Logistic Regression** - Trains on features → follow-through

---

## 🤖 Model 1: Bandit Arms (Thompson Sampling)

### **Purpose**
Learn which content types perform best (explore vs exploit)

### **Data Fed Into Model**
**Features:**
- Content type (from `bandit_arm`, e.g., "educational_thread")
- Timing slot (from `posted_at` hour)

**Targets:**
- Success = engagement_rate > 3% (threshold)
- Failure = engagement_rate ≤ 3%

**Example Data:**
```javascript
{
  content_type: "educational_thread",
  timing_slot: 14,  // 2 PM
  actual_er: 0.045,  // 4.5% engagement rate
  isSuccess: true    // > 3% = success
}
```

### **How It Works**
1. **Thompson Sampling** for content types:
   - Tracks `successes` and `failures` for each content type
   - Samples from Beta(alpha, beta) distribution
   - Higher success rate = higher chance of being selected
   
2. **UCB1** for timing:
   - Tracks average reward per hour
   - Balances exploration (try new times) vs exploitation (use best times)

### **Output**
**Stored in:** `bandit_arms` table
```sql
arm_name: "educational_thread"
scope: "content"
successes: 25
failures: 5
alpha: 26  (successes + 1)
beta: 6    (failures + 1)
```

### **Used When**
- Generating new content
- Selecting which content type to use
- Deciding when to post

---

## 🤖 Model 2: Ridge Regression (Engagement Rate Prediction)

### **Purpose**
Predict engagement rate BEFORE posting content

### **Data Fed Into Model**
**Features (from `content_metadata` joined with `outcomes`):**
- `quality_score` (0-1, from quality gate)
- `content_type_educational` (1 or 0, binary)
- `content_type_factual` (1 or 0, binary)
- `timing_slot` (0-23, hour of day)
- `length_medium` (1 or 0, binary)
- Time cycling feature: `sin(2π * hour / 24)`

**Target (from `outcomes`):**
- `actual_er` (engagement_rate or calculated)

**Example Data:**
```javascript
{
  quality_score: 0.82,
  content_type_educational: 1,
  timing_slot: 14,
  length_medium: 1,
  actual_er: 0.045  // Target: what we're trying to predict
}
```

### **How It Works**
1. **Ridge Regression** (regularized linear regression):
   - Prevents overfitting with L2 penalty
   - Learns weights for each feature
   - Formula: `predicted_er = intercept + (quality_weight * quality_score) + (timing_weight * timing_slot) + ...`

2. **Training Process:**
   - Uses 80% of data for training, 20% for validation
   - Calculates R² (how well model fits)
   - Stores coefficients in Redis KV store

### **Output**
**Stored in:** Redis KV store (`predictor:v2:latest`)
```javascript
{
  version: "v2_1234567890",
  ridge: {
    intercept: 0.01,
    qualityWeight: 0.025,    // Higher quality = higher ER
    contentTypeWeight: 0.008,
    timingWeight: 0.005,
    rSquared: 0.73,           // 73% of variance explained
    mse: 0.0001
  }
}
```

### **Used When**
- Before posting: Predict if content will perform well
- Quality gate: Reject posts with predicted_er too low
- Scheduling: Prioritize posts with higher predicted performance

---

## 🤖 Model 3: Logistic Regression (Follow-Through Prediction)

### **Purpose**
Predict if a post will convert viewers to followers

### **Data Fed Into Model**
**Features:**
- `novelty_score` (0-1, how unique is content)
- `expertise_level` (0-1, how expert does it seem)
- `viral_indicators` (0-1, from viral_score in outcomes)

**Target:**
- `follow_through` (1 or 0, binary)
  - 1 = followers_gained > 0
  - 0 = followers_gained = 0

**Example Data:**
```javascript
{
  novelty_score: 0.75,
  expertise_level: 0.82,
  viral_indicators: 0.65,  // viral_score / 100
  follow_through: 1        // Target: did they follow?
}
```

### **How It Works**
1. **Logistic Regression:**
   - Outputs probability (0-1) of follow-through
   - Uses sigmoid function: `1 / (1 + e^(-logits))`
   - Binary classification (follow or not)

2. **Training Process:**
   - Calculates precision/recall/accuracy
   - Optimizes weights for novelty, expertise, viral indicators

### **Output**
**Stored in:** Redis KV store (same key as Ridge)
```javascript
{
  logit: {
    intercept: -0.3,
    noveltyWeight: 0.25,      // Novelty helps conversions
    expertiseWeight: 0.2,      // Expertise helps conversions
    viralWeight: 0.15,         // Viral content helps conversions
    accuracy: 0.72,            // 72% accuracy
    precision: 0.68,           // When predicts follow, 68% correct
    recall: 0.75               // Catches 75% of actual follows
  }
}
```

### **Used When**
- Evaluating content quality (high follow-through = good)
- Content selection (prefer posts that convert)

---

## 🔄 Complete Learning Cycle

### **Timeline**

```
Day 1, 2 PM:  Post educational thread
  ↓
Day 2, 2 PM:  Metrics scraper collects:
              - 1,000 impressions
              - 45 likes, 8 retweets, 2 replies
              - engagement_rate = 5.5%
              - followers_gained = 3
  ↓
Day 2, 4 PM:  Learning job runs:
              
              1. Bandit Arms Updated:
                 - "educational_thread": successes++ (5.5% > 3%)
                 - Hour 14 (2 PM): avg_reward = 0.055
              
              2. Ridge Regression Trained:
                 - quality_score: 0.82 → actual_er: 0.055
                 - Learns: Higher quality = higher ER
              
              3. Logistic Regression Trained:
                 - novelty: 0.75, expertise: 0.82 → follow_through: 1
                 - Learns: High novelty + expertise = more followers
  ↓
Day 3, 2 PM:  Next post generated:
              - System selects "educational_thread" (high success rate)
              - Predicts ER: 4.2% (based on quality_score)
              - Predicts follow-through: 85% probability
              - Posts at 2 PM (best performing hour)
```

---

## 📈 What Gets Learned

### **Bandit Arms Learn:**
- **Content types that work:** "educational_thread" vs "factual_single"
- **Timing that works:** 2 PM vs 8 PM
- **Exploration vs Exploitation:** Try new things 30% of time, use best 70%

### **Ridge Regression Learns:**
- **Quality → Engagement:** Higher quality_score = higher engagement rate
- **Timing → Engagement:** Certain hours perform better
- **Content type → Engagement:** Educational threads > factual singles

### **Logistic Regression Learns:**
- **Novelty → Follows:** Novel content converts better
- **Expertise → Follows:** Expert-sounding content converts better
- **Viral → Follows:** Viral indicators correlate with follows

---

## 🔧 Current Issues & Fixes Needed

### **Issue 1: Predictor Trainer Uses Mock Data**
**Problem:** Lines 114-120 use `Math.random()` instead of real data

**Fix:** Join `outcomes` with `content_metadata` to get real:
- `quality_score` (from content_metadata)
- `decision_type` (to determine content_type features)
- `bandit_arm` (to extract content type)
- `timing_slot` (from posted_at hour)

### **Issue 2: Predictor Trainer Reads Wrong Column**
**Problem:** Line 124 reads `outcome.er_calculated` (NULL for all)

**Fix:** Use same `getEngagementRate()` helper as learnJob

### **Issue 3: Bandit Arms Not Persisted**
**Problem:** Line 262 has `// TODO: Store arm updates in database`

**Fix:** Write to `bandit_arms` table after calculating updates

---

## 📋 Summary

**Data Sources:**
- `content_metadata` → Features (quality, type, timing)
- `outcomes` → Targets (engagement, followers)

**Models:**
1. **Bandit Arms** → Learns what works (explore/exploit)
2. **Ridge Regression** → Predicts engagement rate
3. **Logistic Regression** → Predicts follow-through

**Current Status:**
- ✅ Learning job reads engagement data (fixed)
- ❌ Predictor trainer uses mock data (needs fix)
- ❌ Bandit arms not persisted (needs fix)

