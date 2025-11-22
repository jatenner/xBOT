# 🧠 How the Learning System Works

## The Learning Cycle

```
1. POST CONTENT
   ↓
2. COLLECT OUTCOMES (likes, retweets, impressions, etc.)
   ↓
3. CALCULATE ENGAGEMENT RATE (likes + retweets + replies) / impressions
   ↓
4. LEARNING JOB RUNS (every few hours)
   ↓
5. UPDATE BANDIT ARMS (which content types work best)
   ↓
6. NEXT POST USES BETTER STRATEGIES
```

---

## Step-by-Step Breakdown

### **Step 1: Content Posted**
- System posts content with a `bandit_arm` (e.g., "educational_thread_morning")
- Stores in `content_metadata` table

### **Step 2: Metrics Collected**
- Metrics scraper collects: likes, retweets, replies, impressions
- Stores in `outcomes` table with `decision_id` linking back to content

### **Step 3: Engagement Rate Calculated**
- Should calculate: `(likes + retweets + replies) / impressions`
- Should store in `er_calculated` or `engagement_rate` column

### **Step 4: Learning Job Runs**
**File:** `src/jobs/learnJob.ts`

**What it does:**
1. Reads outcomes from last 7 days
2. Extracts `actual_er` (engagement rate) from each outcome
3. Groups by content type and timing
4. Updates bandit arms:
   - **Content arms:** Which content types perform best (Thompson Sampling)
   - **Timing arms:** Which hours perform best (UCB1 algorithm)

### **Step 5: Bandit Arms Updated**
**How it works:**
- **Thompson Sampling:** For content types
  - Tracks successes/failures for each content type
  - Success = engagement rate > 3%
  - Samples from Beta distribution to pick best arm
  
- **UCB1:** For timing
  - Tracks average reward per hour
  - Balances exploration (try new times) vs exploitation (use best times)

### **Step 6: Next Content Uses Learning**
- When generating new content, system selects bandit arm
- Arms with higher success rates get selected more often
- System automatically optimizes toward what works

---

## The Problem

**Current State:**
- Learning job reads `outcome.er_calculated` (line 109)
- **100% of outcomes have NULL `er_calculated`**
- Learning job gets `actual_er = NULL` for all outcomes
- Bandit arms can't update (no reward signal)
- Learning doesn't happen

**What Should Happen:**
- Read `engagement_rate` (39% of outcomes have this)
- Or calculate `er_calculated` from raw metrics
- Use that to update bandit arms
- System learns what works

---

## The Fix

**Change 2 lines in `src/jobs/learnJob.ts`:**

```typescript
// BEFORE (broken):
predicted_er: (outcome.er_calculated as number) * (0.9 + Math.random() * 0.2),
actual_er: outcome.er_calculated,  // Always NULL!

// AFTER (fixed):
predicted_er: (getEngagementRate(outcome) as number) * (0.9 + Math.random() * 0.2),
actual_er: getEngagementRate(outcome),  // Uses engagement_rate or calculates it
```

**Helper function:**
```typescript
function getEngagementRate(outcome: any): number {
  // Try engagement_rate first (39% have this)
  if (outcome.engagement_rate != null) {
    return Number(outcome.engagement_rate);
  }
  
  // Try er_calculated (should be same thing)
  if (outcome.er_calculated != null) {
    return Number(outcome.er_calculated);
  }
  
  // Calculate from raw metrics if available
  const impressions = outcome.impressions || 0;
  if (impressions > 0) {
    const likes = outcome.likes || 0;
    const retweets = outcome.retweets || 0;
    const replies = outcome.replies || 0;
    return (likes + retweets + replies) / impressions;
}

  // No data available
  return 0;
}
```

---

## What This Enables

**After Fix:**
1. ✅ Learning job can read engagement data from 1,563 outcomes (39%)
2. ✅ Bandit arms update based on real performance
3. ✅ System learns which content types work best
4. ✅ System learns which hours perform best
5. ✅ Content selection automatically optimizes
6. ✅ Quality improvements can be validated against engagement

**Result:**
- System becomes smarter over time
- Automatically focuses on what works
- Validates that quality improvements matter
- Optimizes content selection based on data
