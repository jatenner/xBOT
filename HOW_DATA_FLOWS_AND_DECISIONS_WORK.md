# 📊 How Data Flows & Decisions Are Made - Simple Explanation

## The Complete Story: How Your Bot Learns and Decides

Think of it like a feedback loop: **Post → Learn → Improve → Post Better**

---

## 🎬 Part 1: Generating & Posting Content

### **Step 1: Plan Job Runs (Every 2 Hours)**

**What happens:**
```
System: "Time to generate new content!"
```

**Decision 1: Which content type to use?**
- **Looks at:** `bandit_arms` table (what worked in the past)
- **Data used:**
  - "educational_thread" has 25 successes, 5 failures
  - "factual_single" has 10 successes, 8 failures
- **Decision:** Pick "educational_thread" (higher success rate)

**Decision 2: When to post?**
- **Looks at:** `bandit_arms` table (timing performance)
- **Data used:**
  - 2 PM hour: avg 4.5% engagement rate
  - 8 PM hour: avg 3.2% engagement rate
- **Decision:** Schedule for 2 PM (better performance)

### **Step 2: Content Generated**

**AI generates content** with these properties:
```javascript
{
  content: "Sleep debt accumulates: losing 1 hour per night...",
  decision_type: "thread",           // Multi-tweet thread
  quality_score: 0.82,                // Quality gate gave this score
  bandit_arm: "educational_thread",  // Strategy chosen
  topic: "sleep",
  hook_type: "statistic",
  scheduled_at: "2025-11-22 14:00:00"  // 2 PM
}
```

**Stored in:** `content_metadata` table

---

## 📤 Part 2: Posting to Twitter

### **Step 3: Posting Queue Runs (Every 5 Minutes)**

**Checks:**
- Is this post ready? (scheduled_at time reached?)
- Have we posted too many times recently? (rate limits)
- Quality gate passed? (quality_score >= 70%)

**Decision: Post or Skip?**
- ✅ Ready: Yes (scheduled time reached)
- ✅ Rate limit: OK (only 1 post this hour)
- ✅ Quality: Passed (0.82 >= 0.70)

**Result:** **POST IT!**

**What happens:**
- System posts to Twitter via Playwright
- Gets back `tweet_id` from Twitter
- Updates `content_metadata`:
  - `status = 'posted'`
  - `tweet_id = '1234567890'`
  - `posted_at = '2025-11-22 14:00:00'`

---

## 📈 Part 3: Collecting Results (24-48 Hours Later)

### **Step 4: Metrics Scraper Runs**

**What it does:**
- Goes to Twitter
- Finds your tweet (using `tweet_id`)
- Collects metrics:
  - Impressions: 1,000 (how many people saw it)
  - Likes: 45
  - Retweets: 8
  - Replies: 2
  - Bookmarks: 3

**Calculates:**
```javascript
engagement_rate = (likes + retweets + replies) / impressions
                = (45 + 8 + 2) / 1000
                = 0.055 (5.5%)
```

**Stores in:** `outcomes` table
```javascript
{
  decision_id: "uuid-from-content_metadata",
  impressions: 1000,
  likes: 45,
  retweets: 8,
  replies: 2,
  engagement_rate: 0.055,      // 5.5%
  followers_gained: 3,          // 3 new followers
  collected_at: "2025-11-23 14:00:00"  // 24h later
}
```

---

## 🧠 Part 4: Learning (Every Few Hours)

### **Step 5: Learning Job Runs**

**What it does:**
1. **Collects data** from last 7 days
2. **Joins tables** to combine features + results
3. **Trains 3 models** on the data
4. **Updates decisions** for next posts

---

### **Data Collection:**

**Reads from `outcomes` table:**
```sql
SELECT * FROM outcomes 
WHERE collected_at > NOW() - INTERVAL '7 days'
```

**Gets:** 100 recent outcomes with engagement data

**Joins with `content_metadata`:**
```sql
JOIN content_metadata ON outcomes.decision_id = content_metadata.decision_id
```

**Combines:**
- **Features** (from `content_metadata`): quality_score, content type, timing
- **Results** (from `outcomes`): engagement_rate, followers_gained

**Example Combined Data:**
```javascript
{
  // Features (from content_metadata):
  quality_score: 0.82,
  bandit_arm: "educational_thread",
  timing_slot: 14,  // 2 PM
  
  // Results (from outcomes):
  engagement_rate: 0.055,    // 5.5%
  followers_gained: 3,
  impressions: 1000
}
```

---

### **Model 1: Bandit Arms (Learning What Works)**

**Purpose:** Learn which content types perform best

**How it learns:**
```javascript
// Looks at all educational_thread posts:
educational_thread: {
  successes: 25,    // Posts with > 3% engagement
  failures: 5,      // Posts with <= 3% engagement
  success_rate: 83% // 25/30 = 83% success rate
}

// Looks at all factual_single posts:
factual_single: {
  successes: 10,
  failures: 8,
  success_rate: 56%  // 10/18 = 56% success rate
}

// Decision: educational_thread performs better!
```

**Storage:** `bandit_arms` table
```sql
arm_name: "content_educational_thread"
scope: "content"
successes: 25
failures: 5
alpha: 26  (for Thompson Sampling)
beta: 6
```

**How it makes decisions:**
- **Thompson Sampling:** Samples from Beta(26, 6) distribution
- Higher success rate = higher probability of being selected
- Still explores new content types 30% of time (exploration)

---

### **Model 2: Ridge Regression (Predicting Engagement)**

**Purpose:** Predict engagement rate BEFORE posting

**Input Features:**
```javascript
{
  quality_score: 0.82,              // From quality gate
  content_type_educational: 1,      // 1 = yes, 0 = no
  content_type_factual: 0,
  timing_slot: 14,                  // 2 PM = hour 14
  length_medium: 1,                 // Thread = 1, Single = 0
  time_cycle: 0.707                 // sin(2π * 14/24) = time pattern
}
```

**Target (What it's trying to predict):**
```javascript
{
  actual_er: 0.055  // Actual engagement rate (5.5%)
}
```

**How it learns:**
```javascript
// Looks at all posts with quality_score 0.82:
// - Post 1: quality_score 0.82 → engagement_rate 0.055 (5.5%)
// - Post 2: quality_score 0.82 → engagement_rate 0.050 (5.0%)
// - Post 3: quality_score 0.75 → engagement_rate 0.040 (4.0%)
// - Post 4: quality_score 0.90 → engagement_rate 0.065 (6.5%)

// Learns pattern:
// Higher quality_score = Higher engagement_rate
// Formula: predicted_er = 0.01 + (0.025 * quality_score) + ...
```

**Model Weights (Learned):**
```javascript
{
  intercept: 0.01,                  // Base engagement rate
  qualityWeight: 0.025,             // Each 0.1 quality = +0.25% ER
  contentTypeWeight: 0.008,         // Educational helps
  timingWeight: 0.005,              // Timing matters
  rSquared: 0.73                    // 73% accurate
}
```

**How it makes decisions:**
```javascript
// Before posting new content:
new_post = {
  quality_score: 0.85,
  content_type_educational: 1,
  timing_slot: 14
}

// Predicts:
predicted_er = 0.01 + (0.025 * 0.85) + (0.008 * 1) + (0.005 * 14/24)
            = 0.01 + 0.021 + 0.008 + 0.003
            = 0.042 (4.2% predicted engagement)

// Decision: If predicted_er > 3.5%, post it!
```

**Storage:** Redis KV store (`predictor:v2:latest`)

---

### **Model 3: Logistic Regression (Predicting Followers)**

**Purpose:** Predict if viewer will follow

**Input Features:**
```javascript
{
  novelty_score: 0.75,     // How unique/interesting (0-1)
  expertise_level: 0.82,   // How expert it sounds (0-1)
  viral_indicators: 0.65   // Viral potential (0-1)
}
```

**Target (What it's trying to predict):**
```javascript
{
  follow_through: 1  // 1 = gained followers, 0 = didn't
}
```

**How it learns:**
```javascript
// Looks at posts:
// - Post 1: novelty 0.75, expertise 0.82 → gained 3 followers (follow_through = 1)
// - Post 2: novelty 0.50, expertise 0.60 → gained 0 followers (follow_through = 0)
// - Post 3: novelty 0.90, expertise 0.85 → gained 5 followers (follow_through = 1)

// Learns pattern:
// Higher novelty + expertise = More likely to gain followers
// Formula: probability = 1 / (1 + e^(-(intercept + novelty*weight + ...)))
```

**Model Weights (Learned):**
```javascript
{
  intercept: -0.3,
  noveltyWeight: 0.25,      // Novelty helps conversions
  expertiseWeight: 0.2,      // Expertise helps conversions
  viralWeight: 0.15,         // Viral content helps
  accuracy: 0.72             // 72% accurate predictions
}
```

**How it makes decisions:**
```javascript
// Before posting:
new_post = {
  novelty_score: 0.80,
  expertise_level: 0.75,
  viral_indicators: 0.60
}

// Predicts:
logits = -0.3 + (0.25 * 0.80) + (0.2 * 0.75) + (0.15 * 0.60)
       = -0.3 + 0.20 + 0.15 + 0.09
       = 0.14

probability = 1 / (1 + e^(-0.14))
           = 0.535 (53.5% chance of gaining followers)

// Decision: If probability > 50%, good content to post!
```

**Storage:** Redis KV store (same key as Ridge)

---

## 🔄 The Complete Flow: End to End

### **Timeline Example:**

```
Day 1, 2 PM:
  ↓
  Plan Job Runs:
    - Reads bandit_arms: "educational_thread" has 83% success
    - Selects "educational_thread" strategy
    - Generates thread with quality_score 0.82
    - Schedules for 2 PM (best hour)
  ↓
  Content Stored:
    - content_metadata table
    - quality_score: 0.82
    - bandit_arm: "educational_thread"
    - scheduled_at: 2 PM
  ↓
  Posting Queue Runs:
    - Checks: ready? rate limit? quality? → ✅ All good
    - Posts to Twitter
    - Gets tweet_id: "1234567890"
    - Updates status: "posted"
  ↓
Day 2, 2 PM (24 hours later):
  ↓
  Metrics Scraper Runs:
    - Finds tweet on Twitter
    - Collects: 1,000 impressions, 45 likes, 8 retweets
    - Calculates: engagement_rate = 5.5%
    - Tracks: followers_gained = 3
  ↓
  Outcomes Stored:
    - outcomes table
    - decision_id: links back to content
    - engagement_rate: 0.055
    - followers_gained: 3
  ↓
Day 2, 4 PM (few hours later):
  ↓
  Learning Job Runs:
    1. Collects Outcomes:
       - Reads last 7 days of outcomes
       - Joins with content_metadata
       - Gets 100 training samples
    2. Trains Bandit Arms:
       - educational_thread: successes++ (5.5% > 3%)
       - Hour 14 (2 PM): avg_reward updated to 0.055
       - Stores in bandit_arms table
    3. Trains Ridge Regression:
       - Learns: quality_score 0.82 → engagement_rate 0.055
       - Updates weights: qualityWeight = 0.025
       - Stores in Redis
    4. Trains Logistic Regression:
       - Learns: novelty + expertise → follow_through
       - Updates weights: noveltyWeight = 0.25
       - Stores in Redis
  ↓
Day 3, 2 PM (Next Post):
  ↓
  Plan Job Runs:
    - Reads updated bandit_arms: "educational_thread" now 84% success
    - Uses Ridge Regression: predicts 4.5% engagement for quality 0.85
    - Uses Logistic Regression: predicts 55% follow probability
    - Decision: Post it! (all predictions look good)
  ↓
  Better Content Posted:
    - System learned from past performance
    - Automatically optimized
    - Uses best strategies discovered
```

---

## 📊 Data Types & Sources

### **Content Data (`content_metadata` table):**
- **Decision metadata:**
  - `decision_id` (UUID)
  - `decision_type` ('single', 'thread', 'reply')
  - `content` (the actual tweet text)
  - `quality_score` (0-1, from quality gate)
  
- **Strategy data:**
  - `bandit_arm` (content strategy: "educational_thread")
  - `topic` (what it's about: "sleep")
  - `hook_type` (opening style: "statistic")
  - `style` (tone: "expert", "conversational")
  
- **Timing data:**
  - `scheduled_at` (when to post)
  - `posted_at` (when it was posted)

### **Outcome Data (`outcomes` table):**
- **Engagement metrics:**
  - `impressions` (views)
  - `likes`, `retweets`, `replies`, `bookmarks`
  - `engagement_rate` (calculated: (likes+retweets+replies)/impressions)
  
- **Follower metrics:**
  - `followers_gained` (new followers after posting)
  - `followers_before`, `followers_after`
  
- **Viral metrics:**
  - `viral_score` (0-100, how viral it went)
  - `virality_coefficient` (viral spread rate)

### **Learning Data (Stored after training):**
- **Bandit Arms (`bandit_arms` table):**
  - `arm_name` ("content_educational_thread")
  - `scope` ("content" or "timing")
  - `successes`, `failures` (counts)
  - `alpha`, `beta` (for Thompson Sampling)
  
- **Predictor Models (Redis KV store):**
  - Ridge Regression coefficients (quality → engagement)
  - Logistic Regression coefficients (features → follow)

---

## 🎯 How Decisions Are Made

### **Decision 1: What Content Type to Generate?**

**Uses:** Bandit Arms (Thompson Sampling)

**Process:**
1. Reads `bandit_arms` table
2. For each content type, samples from Beta(alpha, beta) distribution
3. Picks the one with highest sample value
4. Still explores new types 30% of time

**Example:**
```
educational_thread: Beta(26, 6) → samples 0.82
factual_single: Beta(10, 8) → samples 0.58

Decision: Pick "educational_thread" (higher sample)
```

---

### **Decision 2: When to Post?**

**Uses:** Bandit Arms (UCB1 for timing)

**Process:**
1. Reads `bandit_arms` table for timing arms
2. Calculates UCB1 score: `avg_reward + confidence_interval`
3. Picks hour with highest UCB1 score

**Example:**
```
2 PM: avg_reward 0.055, samples 10 → UCB1 = 0.055 + 0.02 = 0.075
8 PM: avg_reward 0.032, samples 5 → UCB1 = 0.032 + 0.03 = 0.062

Decision: Pick 2 PM (higher UCB1)
```

---

### **Decision 3: Should We Post This Content?**

**Uses:** Ridge Regression (prediction)

**Process:**
1. Calculates features: quality_score, content_type, timing
2. Uses Ridge Regression to predict engagement_rate
3. Posts if predicted_er > threshold (3.5%)

**Example:**
```
Content: quality_score 0.85, educational, 2 PM

Predicted ER = 0.01 + (0.025 * 0.85) + (0.008 * 1) + (0.005 * 14/24)
            = 0.042 (4.2%)

Decision: Post it! (4.2% > 3.5% threshold)
```

---

### **Decision 4: Is This High Quality?**

**Uses:** Logistic Regression (follow prediction)

**Process:**
1. Calculates features: novelty, expertise, viral
2. Uses Logistic Regression to predict follow probability
3. Higher probability = better quality

**Example:**
```
Content: novelty 0.80, expertise 0.75

Follow Probability = 1 / (1 + e^(-(0.14)))
                   = 53.5%

Decision: Good quality (53.5% > 50% threshold)
```

---

## 🔁 The Feedback Loop

### **How Learning Improves Decisions:**

```
Post 1:
  - Strategy: "factual_single" (random choice)
  - Result: 3.2% engagement, 0 followers
  ↓
  Learning Job:
    - Updates bandit_arms: factual_single failures++
    - Learns: factual_single doesn't work well
  ↓
Post 2:
  - Strategy: "educational_thread" (bandit picked this)
  - Result: 5.5% engagement, 3 followers
  ↓
  Learning Job:
    - Updates bandit_arms: educational_thread successes++
    - Learns: educational_thread works well
  ↓
Post 3:
  - Strategy: "educational_thread" (bandit prefers this now)
  - Result: 5.8% engagement, 4 followers
  ↓
  System Getting Smarter:
    - Automatically focusing on what works
    - Improving over time
```

---

## 📈 Data Flow Summary

### **Input Data (What Goes In):**
1. **Content features:**
   - Quality score (from quality gate)
   - Content type (from bandit arm)
   - Timing (from scheduling)
   
2. **Performance results:**
   - Engagement rate (from Twitter metrics)
   - Followers gained (from follower tracking)

### **Processing (What Happens):**
1. **Joins data:**
   - Links content features with performance results
   - Creates training examples: feature → result
   
2. **Trains models:**
   - Bandit Arms: Learns what works
   - Ridge Regression: Learns quality → engagement
   - Logistic Regression: Learns features → followers

### **Output Data (What Comes Out):**
1. **Bandit Arms:**
   - Success/failure counts for each strategy
   - Used to pick best content type
   
2. **Predictor Models:**
   - Coefficients/weights learned
   - Used to predict performance before posting

### **Decision Making:**
1. **Content Generation:**
   - Uses Bandit Arms to pick strategy
   - Uses Predictors to evaluate quality
   
2. **Posting:**
   - Uses Predictors to decide if it's good enough
   - Posts if predictions are above thresholds

---

## 🎯 Key Insights

**The system learns by:**
1. ✅ **Collecting data:** Features + Results
2. ✅ **Finding patterns:** What works, what doesn't
3. ✅ **Updating models:** Better predictions
4. ✅ **Making better decisions:** Uses learned patterns

**The feedback loop:**
```
Post → Collect Results → Learn → Better Strategy → Better Post → ...
```

**Automatic optimization:**
- No manual tuning needed
- System learns what works for your audience
- Gets smarter over time

