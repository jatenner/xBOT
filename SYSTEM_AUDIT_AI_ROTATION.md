# 🔍 SYSTEM AUDIT: AI-Driven Generator Rotation

## **STATUS: ⚠️ PARTIALLY IMPLEMENTED**

You're RIGHT - we **did** build data-driven generator selection! But it's **not fully active**. Here's what exists vs what's running:

---

## ✅ **WHAT YOU HAVE BUILT:**

### **1. Generator Weights System** (`generator_weights` table)
**Location:** `supabase/migrations/20251018_generator_learning_system.sql`

**What it does:**
- Tracks performance of all 12 generators
- Stores `weight` (selection probability), `avg_f_per_1k` (followers per 1K impressions), `total_posts`, `total_followers_gained`
- Updates dynamically based on actual performance

**Tables:**
```sql
generator_weights (
  generator_name TEXT PRIMARY KEY,
  weight DECIMAL(5, 4),           -- Selection probability (0-1)
  avg_f_per_1k DECIMAL(6, 2),     -- Followers gained per 1K impressions
  total_posts INTEGER,
  total_followers_gained INTEGER,
  status TEXT                      -- 'active', 'testing', 'paused'
)
```

**Initial weights** (from migration):
```
humanVoice: 0.15
provocateur: 0.15
contrarian: 0.15
storyteller: 0.13
interesting: 0.10
dataNerd: 0.10
mythBuster: 0.10
thoughtLeader: 0.05
newsReporter: 0.04
coach: 0.03
explorer: 0.02
philosopher: 0.02
```

---

### **2. Content Type Performance System**
**Location:** `supabase/migrations/20251015_comprehensive_data_storage.sql`

**What it does:**
- Tracks 7 distinct content TYPES (not just generators)
- Types: Fact Bomb, Case Study, Educational Thread, News Reaction, Study Breakdown, Quick Tip, Controversy
- Uses **Thompson Sampling** to balance exploitation (best performer) vs exploration (try new things)

**Code Location:** `src/intelligence/contentTypeSelector.ts`

**How it works:**
```typescript
// Scores content types based on:
- avg_follower_conversion (70%)
- avg_engagement_rate (20%)
- success_rate (10%)

// Recency penalty to ensure variety
const recencyPenalty = Math.pow(0.3, usageCount); // Very aggressive

// 70% exploit (use best), 30% explore (try alternatives)
```

---

### **3. Dynamic Weight Loading in UnifiedContentEngine**
**Location:** `src/unified/UnifiedContentEngine.ts` line 616

**What it does:**
```typescript
private async loadDynamicWeights(experimentArm: string): Promise<Record<string, number>> {
  // Queries generator_weights table
  const { data } = await supabase
    .from('generator_weights')
    .select('generator_name, weight')
    .eq('status', 'active');
  
  // If no data → falls back to hardcoded defaults
  if (!data || data.length === 0) {
    return this.getDefaultWeights(experimentArm);
  }
  
  return weights;
}
```

**Then selects generator using weighted random:**
```typescript
const generatorWeights = await this.loadDynamicWeights(params.experimentArm);

// Weighted random selection
for (const [gen, weight] of Object.entries(generatorWeights)) {
  cumulativeWeight += weight;
  if (random <= cumulativeWeight) {
    selectedGenerator = gen;
    break;
  }
}
```

---

## ❌ **WHAT'S NOT WORKING / MISSING:**

### **Problem 1: Weights Never Update from Initial Values**

**Issue:**
- The `generator_weights` table exists
- Initial weights are set
- **BUT**: Nothing updates these weights based on actual performance!

**What's missing:**
A job that:
1. Fetches recent post performance (likes, RTs, followers gained)
2. Calculates which generators performed best
3. **Updates** the `generator_weights` table with new weights

**Where it should be:**
- `src/jobs/learningCycleJob.ts` (exists but doesn't update generator weights)
- Or a dedicated `generatorWeightUpdater.ts` (doesn't exist)

---

### **Problem 2: Default Weights Used Instead of DB Weights**

**Issue:**
Looking at the code, if DB query fails or returns no data, it **falls back to hardcoded defaults**.

**Why this happens:**
- Initial migration inserts 12 rows into `generator_weights`
- But if table is empty, it uses defaults
- No logs showing which path was taken

**Fix needed:**
- Verify `generator_weights` table has data on Railway
- Add logging: "Using DB weights" vs "Using fallback defaults"

---

### **Problem 3: No Rotation/Avoidance Logic in planJobUnified**

**What you just added:**
```typescript
const recentGenerators = recentContent?.map(c => c.generator_name);
console.log(`🎲 Avoiding recent generators: ${recentGenerators.slice(0, 3).join(', ')}`);

// TODO: Pass recentGenerators to avoid repetition once ContentRequest interface supports it
```

**Issue:**
- You log recent generators
- **BUT**: You don't actually avoid them!
- `UnifiedContentEngine` doesn't know which generators to avoid

**Fix needed:**
- Add `avoidGenerators` parameter to `ContentRequest` interface
- Modify `loadDynamicWeights` to reduce weights for recently used generators
- Example: If `dataNerd` was just used, temporarily set its weight to 0.01

---

### **Problem 4: ContentTypeSelector Not Integrated**

**What exists:**
`src/intelligence/contentTypeSelector.ts` - Full Thompson Sampling system for 7 content types

**Issue:**
- This system exists but isn't called anywhere!
- `planJobUnified.ts` doesn't use it
- `UnifiedContentEngine` doesn't use it

**Fix needed:**
```typescript
// In planJobUnified.ts
const contentTypeSelector = getContentTypeSelector();
const selection = await contentTypeSelector.selectContentType({
  format: 'single',
  goal: 'followers'
});

// Pass to engine
const generated = await engine.generateContent({
  format: selection.selectedType.format,
  contentTypeHint: selection.selectedType.type_id
});
```

---

## 🎯 **WHAT'S CURRENTLY HAPPENING:**

### **Current Flow (planJobUnified → UnifiedContentEngine):**

1. **planJobUnified.ts** generates content every 30min
2. Calls `engine.generateContent({ format: 'single' or 'thread' })`
3. **UnifiedContentEngine** loads generator weights:
   - Tries to load from `generator_weights` table
   - If fails → uses hardcoded defaults
   - **These weights NEVER change** (no update job)
4. Weighted random selection picks a generator
5. Generator runs

**Result:**
- ✅ Uses weighted selection (not pure random)
- ❌ Weights never update based on performance
- ❌ No avoidance of recently used generators
- ❌ ContentTypeSelector not used

---

## 🚀 **HOW TO FIX THIS (3 Levels):**

### **LEVEL 1: Quick Fix (5 min) - Rotation Logic**
**Add generator avoidance to prevent repetition**

```typescript
// In UnifiedContentEngine.ts loadDynamicWeights()
private async loadDynamicWeights(
  experimentArm: string,
  avoidGenerators?: string[]
): Promise<Record<string, number>> {
  
  let weights = /* ... load from DB or defaults ... */;
  
  // ROTATION LOGIC: Reduce weight for recently used generators
  if (avoidGenerators && avoidGenerators.length > 0) {
    for (const gen of avoidGenerators) {
      if (weights[gen]) {
        weights[gen] *= 0.1; // Reduce to 10% of normal weight
        console.log(`🔄 ROTATION: Reduced weight for ${gen} (recently used)`);
      }
    }
    
    // Renormalize weights to sum to 1.0
    const total = Object.values(weights).reduce((sum, w) => sum + w, 0);
    for (const gen in weights) {
      weights[gen] /= total;
    }
  }
  
  return weights;
}
```

---

### **LEVEL 2: Medium Fix (20 min) - Weight Update Job**
**Create job that updates generator weights based on performance**

```typescript
// NEW FILE: src/jobs/generatorWeightUpdater.ts
export async function updateGeneratorWeights(): Promise<void> {
  console.log('[GENERATOR_WEIGHTS] 📊 Updating weights based on performance...');
  
  // 1. Get recent performance (last 30 days) for each generator
  const { data: recentPosts } = await supabase
    .from('content_metadata')
    .select(`
      generator_name,
      decision_id,
      outcomes!inner (
        likes,
        retweets,
        replies,
        impressions,
        followers_gained
      )
    `)
    .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
  
  // 2. Calculate performance metrics per generator
  const generatorStats = {};
  for (const post of recentPosts) {
    const gen = post.generator_name;
    if (!generatorStats[gen]) {
      generatorStats[gen] = { totalFollowers: 0, totalPosts: 0, totalImpressions: 0 };
    }
    generatorStats[gen].totalFollowers += post.outcomes.followers_gained || 0;
    generatorStats[gen].totalImpressions += post.outcomes.impressions || 0;
    generatorStats[gen].totalPosts += 1;
  }
  
  // 3. Calculate f_per_1k (followers per 1K impressions)
  const generatorMetrics = {};
  for (const [gen, stats] of Object.entries(generatorStats)) {
    const fPer1k = (stats.totalFollowers / stats.totalImpressions) * 1000;
    generatorMetrics[gen] = {
      f_per_1k: fPer1k,
      total_posts: stats.totalPosts,
      total_followers: stats.totalFollowers
    };
  }
  
  // 4. Update weights (proportional to f_per_1k)
  const totalScore = Object.values(generatorMetrics).reduce((sum, m) => sum + m.f_per_1k, 0);
  
  for (const [gen, metrics] of Object.entries(generatorMetrics)) {
    const newWeight = metrics.f_per_1k / totalScore; // Normalized 0-1
    
    await supabase
      .from('generator_weights')
      .update({
        weight: newWeight,
        avg_f_per_1k: metrics.f_per_1k,
        total_posts: metrics.total_posts,
        total_followers_gained: metrics.total_followers,
        last_updated: new Date().toISOString()
      })
      .eq('generator_name', gen);
    
    console.log(`  ✅ ${gen}: weight=${newWeight.toFixed(4)}, f_per_1k=${metrics.f_per_1k.toFixed(2)}`);
  }
}
```

**Then add to JobManager:**
```typescript
// In src/jobs/jobManager.ts
this.scheduleStaggeredJob('generator_weights', updateGeneratorWeights, 24 * 60); // Daily at offset
```

---

### **LEVEL 3: Full Fix (45 min) - Integrate ContentTypeSelector**
**Use the Thompson Sampling system you built**

```typescript
// In planJobUnified.ts
const contentTypeSelector = getContentTypeSelector();
const typeSelection = await contentTypeSelector.selectContentType({
  format: 'both',
  goal: 'followers'
});

console.log(`[UNIFIED_PLAN] 🎭 Selected content type: ${typeSelection.selectedType.name}`);
console.log(`[UNIFIED_PLAN] 📊 Reason: ${typeSelection.selectionReason}`);

const generated = await engine.generateContent({
  format: typeSelection.selectedType.format === 'both' 
    ? (Math.random() < 0.5 ? 'single' : 'thread')
    : typeSelection.selectedType.format,
  contentTypeHint: typeSelection.selectedType.type_id
});

// After post performs, update content type
await contentTypeSelector.updateContentTypePerformance(
  typeSelection.selectedType.type_id,
  followersGained,
  engagementRate,
  wasSuccessful
);
```

---

## 📊 **VERIFICATION COMMANDS:**

### **Check if generator_weights table has data:**
```sql
SELECT generator_name, weight, total_posts, avg_f_per_1k
FROM generator_weights
ORDER BY weight DESC;
```

### **Check recent generator usage:**
```sql
SELECT generator_name, COUNT(*) as usage_count
FROM content_metadata
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY generator_name
ORDER BY usage_count DESC;
```

### **Check if ContentTypeSelector tables exist:**
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_name = 'content_type_performance';
```

---

## 🎯 **RECOMMENDATION:**

**DO ALL 3 LEVELS** to get fully AI-driven rotation:

1. **Level 1 (5 min):** Add rotation logic to avoid recently used generators
2. **Level 2 (20 min):** Create weight update job to learn from performance
3. **Level 3 (45 min):** Integrate ContentTypeSelector for Thompson Sampling

**Total Time:** ~1 hour  
**Result:** Fully autonomous, data-driven generator selection that learns and improves

Want me to implement all 3 levels?

