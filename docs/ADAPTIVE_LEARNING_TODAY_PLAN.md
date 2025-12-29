# 🚀 ADAPTIVE LEARNING - TODAY'S EXECUTION PLAN

**Date:** December 29, 2025  
**Goal:** Ship self-optimizing system TODAY in safe, tested phases  
**Timeline:** 6-8 hours (4 phases)  
**Strategy:** Deploy → Test → Verify → Next Phase

---

## 🎯 PHILOSOPHY: CRAWL → WALK → RUN

We'll implement in 4 phases TODAY, each independently valuable:

- **Phase 1:** Quick wins (harvesting optimization) - 1-2 hours
- **Phase 2:** Performance tracking foundation - 2-3 hours  
- **Phase 3:** Close learning feedback loops - 2-3 hours
- **Phase 4:** (Optional) Advanced experimentation - Future

Each phase:
- ✅ Deploys independently
- ✅ Tested before next phase
- ✅ Adds value on its own
- ✅ No breaking changes

---

## 🥇 PHASE 1: QUICK WINS (1-2 hours)

**Goal:** Optimize harvesting to target high-engagement tweets NOW

**Impact:** Immediate improvement in reply targeting quality

### **Changes Required:**

**1.1 Reorder Search Queries** (30 min)

**File:** `src/jobs/replyOpportunityHarvester.ts`

**Strategy:** Put high-engagement searches FIRST

```typescript
// BEFORE (current):
const searchQueries = [
  { label: 'Health 500+', minLikes: 500, ... },
  { label: 'Health 1K+', minLikes: 1000, ... },
  { label: 'Wellness 2K+', minLikes: 2000, ... },
  ...
];

// AFTER (optimized):
const searchQueries = [
  // TIER 1: ULTRA-VIRAL (run first)
  { label: 'ULTRA-VIRAL (100K+)', minLikes: 100000, priority: 10, query: 'min_faves:100000 -filter:replies lang:en' },
  { label: 'MEGA-VIRAL (50K+)', minLikes: 50000, priority: 9, query: 'min_faves:50000 -filter:replies lang:en' },
  
  // TIER 2: HIGH-ENGAGEMENT (run second)
  { label: 'VIRAL (25K+)', minLikes: 25000, priority: 8, query: 'min_faves:25000 -filter:replies lang:en' },
  { label: 'TRENDING (10K+)', minLikes: 10000, priority: 7, query: 'min_faves:10000 -filter:replies lang:en' },
  
  // TIER 3: HEALTH-FOCUSED HIGH-ENGAGEMENT
  { label: 'Health VIRAL (10K+)', minLikes: 10000, priority: 6, query: '("health" OR "wellness" OR "longevity") min_faves:10000 -filter:replies lang:en' },
  { label: 'Health TRENDING (5K+)', minLikes: 5000, priority: 5, query: '("health" OR "wellness") min_faves:5000 -filter:replies lang:en' },
  
  // TIER 4: FALLBACK (only if pool low)
  { label: 'Health MODERATE (2K+)', minLikes: 2000, priority: 3, query: '("health" OR "wellness") min_faves:2000 -filter:replies lang:en' },
  { label: 'Health ANY (500+)', minLikes: 500, priority: 1, query: '("health" OR "wellness") min_faves:500 -filter:replies lang:en' },
];
```

**1.2 Increase Search Budget** (5 min)

Set environment variable:
```bash
HARVESTER_MAX_SEARCHES_PER_RUN=9  # Was 6, now 9 to ensure top tiers run
```

**1.3 Add Tier Classification** (30 min)

Add helper function in `replyOpportunityHarvester.ts`:

```typescript
function classifyEngagementTier(likeCount: number): string {
  if (likeCount >= 100000) return 'ULTRA_VIRAL';
  if (likeCount >= 50000) return 'MEGA_VIRAL';
  if (likeCount >= 25000) return 'VIRAL';
  if (likeCount >= 10000) return 'TRENDING';
  if (likeCount >= 5000) return 'POPULAR';
  return 'MODERATE';
}

// When storing opportunity:
await supabase.from('reply_opportunities').insert({
  ...opportunity,
  engagement_tier: classifyEngagementTier(likeCount),
  like_count: likeCount
});
```

**1.4 Migration** (5 min)

```sql
-- Add engagement_tier column if not exists
ALTER TABLE reply_opportunities 
ADD COLUMN IF NOT EXISTS engagement_tier TEXT;

CREATE INDEX IF NOT EXISTS idx_reply_opp_tier 
ON reply_opportunities(engagement_tier);
```

### **Phase 1 Deployment:**

1. Create migration
2. Apply to Supabase
3. Modify `replyOpportunityHarvester.ts`
4. Set `HARVESTER_MAX_SEARCHES_PER_RUN=9`
5. Commit + Push
6. Railway auto-deploys

### **Phase 1 Verification:**

```bash
# Wait 30 min for harvester to run
# Check logs:
railway logs --service xBOT | grep "HARVESTER"

# Expected:
# [HARVESTER] 🎯 Search 1/9: ULTRA-VIRAL (100K+)
# [HARVESTER] 🎯 Search 2/9: MEGA-VIRAL (50K+)
# [HARVESTER] ✅ Found 3 opportunities in ULTRA-VIRAL tier

# Query database:
pnpm tsx scripts/check-engagement-distribution.ts
```

**Expected Result:**
- Harvester prioritizes 100K+, 50K+, 25K+ tweets first
- `reply_opportunities` table has `engagement_tier` populated
- Distribution shifts toward higher engagement

**Success Criteria:**
- ✅ No errors in logs
- ✅ Harvester running new query order
- ✅ Opportunities have tier classification
- ✅ At least 20% of new opportunities are VIRAL+ tier

---

## 📊 PHASE 2: PERFORMANCE TRACKING (2-3 hours)

**Goal:** Build analytics to measure what's working

**Impact:** Visibility into ROI by engagement tier, account size, timing

### **Changes Required:**

**2.1 Database Schema** (15 min)

**Migration:** `supabase/migrations/20251229_analytics_foundation.sql`

```sql
-- Performance analytics aggregation
CREATE TABLE IF NOT EXISTS reply_performance_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Dimension
  dimension_type TEXT NOT NULL, -- 'engagement_tier', 'account_size', 'timing_window'
  dimension_value TEXT NOT NULL, -- 'VIRAL', '1M+', '<2h'
  
  -- Aggregated metrics
  reply_count INTEGER DEFAULT 0,
  avg_followers_gained NUMERIC(10,2) DEFAULT 0,
  avg_reply_likes NUMERIC(10,2) DEFAULT 0,
  avg_impressions NUMERIC(10,2) DEFAULT 0,
  
  -- Statistical confidence
  confidence_score NUMERIC(5,4) DEFAULT 0, -- 0 to 1
  
  -- ROI calculation
  roi_score NUMERIC(10,2) DEFAULT 0,
  performance_tier TEXT, -- 'excellent', 'good', 'moderate', 'poor'
  
  -- Time window
  measurement_start TIMESTAMPTZ NOT NULL,
  measurement_end TIMESTAMPTZ NOT NULL,
  
  -- Metadata
  metadata JSONB,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_perf_dimension ON reply_performance_analytics(dimension_type, dimension_value);
CREATE INDEX idx_perf_updated ON reply_performance_analytics(updated_at);

-- Add columns to existing tables
ALTER TABLE reply_opportunities 
ADD COLUMN IF NOT EXISTS account_size_tier TEXT,
ADD COLUMN IF NOT EXISTS timing_window TEXT;

ALTER TABLE discovered_accounts
ADD COLUMN IF NOT EXISTS avg_followers_per_reply NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS performance_tier TEXT,
ADD COLUMN IF NOT EXISTS last_high_value_reply_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_discovered_perf 
ON discovered_accounts(performance_tier, avg_followers_per_reply);
```

**2.2 Performance Analyzer** (1 hour)

**File:** `src/analytics/PerformanceAnalyzer.ts`

```typescript
import { supabase } from '../config/supabase.js';

interface TierAnalysis {
  tier: string;
  replyCount: number;
  avgFollowersGained: number;
  avgReplyLikes: number;
  confidenceScore: number;
  roiScore: number;
  performanceTier: 'excellent' | 'good' | 'moderate' | 'poor';
}

export class PerformanceAnalyzer {
  private static instance: PerformanceAnalyzer;

  static getInstance(): PerformanceAnalyzer {
    if (!this.instance) {
      this.instance = new PerformanceAnalyzer();
    }
    return this.instance;
  }

  /**
   * Analyze performance by engagement tier
   */
  async analyzeEngagementTiers(windowDays: number = 30): Promise<TierAnalysis[]> {
    console.log(`[ANALYTICS] Analyzing engagement tiers (last ${windowDays} days)...`);

    const cutoff = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

    // Query posted replies with engagement tier data
    const { data, error } = await supabase
      .from('content_metadata')
      .select(`
        decision_id,
        engagement_tier:metadata->engagement_tier,
        followers_gained:metadata->followers_gained,
        reply_likes:metadata->reply_likes
      `)
      .eq('decision_type', 'reply')
      .eq('status', 'posted')
      .gte('posted_at', cutoff.toISOString());

    if (error) {
      console.error(`[ANALYTICS] Error querying replies:`, error);
      return [];
    }

    // Group by tier
    const tierMap = new Map<string, { followers: number[]; likes: number[] }>();
    
    for (const row of data || []) {
      const tier = row.engagement_tier || 'UNKNOWN';
      if (!tierMap.has(tier)) {
        tierMap.set(tier, { followers: [], likes: [] });
      }
      
      const followersGained = Number(row.followers_gained) || 0;
      const replyLikes = Number(row.reply_likes) || 0;
      
      tierMap.get(tier)!.followers.push(followersGained);
      tierMap.get(tier)!.likes.push(replyLikes);
    }

    // Calculate stats per tier
    const results: TierAnalysis[] = [];
    const baseline = 5; // Baseline followers per reply

    for (const [tier, metrics] of tierMap.entries()) {
      const avgFollowers = metrics.followers.reduce((a, b) => a + b, 0) / metrics.followers.length;
      const avgLikes = metrics.likes.reduce((a, b) => a + b, 0) / metrics.likes.length;
      
      const analysis: TierAnalysis = {
        tier,
        replyCount: metrics.followers.length,
        avgFollowersGained: avgFollowers,
        avgReplyLikes: avgLikes,
        confidenceScore: this.calculateConfidence(metrics.followers.length),
        roiScore: (avgFollowers / baseline) * 100,
        performanceTier: this.getPerformanceTier((avgFollowers / baseline) * 100)
      };
      
      results.push(analysis);
    }

    // Sort by ROI descending
    results.sort((a, b) => b.roiScore - a.roiScore);

    return results;
  }

  /**
   * Calculate confidence score (0-1) based on sample size
   */
  calculateConfidence(sampleSize: number): number {
    // Need 30 samples for 100% confidence
    return Math.min(sampleSize / 30, 1.0);
  }

  /**
   * Determine performance tier based on ROI
   */
  getPerformanceTier(roi: number): 'excellent' | 'good' | 'moderate' | 'poor' {
    if (roi >= 150) return 'excellent'; // 1.5x+ baseline
    if (roi >= 100) return 'good';      // 1x baseline
    if (roi >= 50) return 'moderate';   // 0.5x baseline
    return 'poor';                       // <0.5x baseline
  }

  /**
   * Store analytics in database
   */
  async storeAnalytics(
    analyses: TierAnalysis[],
    dimensionType: string,
    timeWindow: { start: Date; end: Date }
  ): Promise<void> {
    const records = analyses.map(a => ({
      dimension_type: dimensionType,
      dimension_value: a.tier,
      reply_count: a.replyCount,
      avg_followers_gained: a.avgFollowersGained,
      avg_reply_likes: a.avgReplyLikes,
      confidence_score: a.confidenceScore,
      roi_score: a.roiScore,
      performance_tier: a.performanceTier,
      measurement_start: timeWindow.start.toISOString(),
      measurement_end: timeWindow.end.toISOString(),
      metadata: {}
    }));

    const { error } = await supabase
      .from('reply_performance_analytics')
      .upsert(records, {
        onConflict: 'dimension_type,dimension_value,measurement_start'
      });

    if (error) {
      console.error(`[ANALYTICS] Error storing analytics:`, error);
    } else {
      console.log(`[ANALYTICS] ✅ Stored ${records.length} analytics records`);
    }
  }

  /**
   * Get top performing tier
   */
  async getTopTier(dimensionType: string): Promise<TierAnalysis | null> {
    const { data, error } = await supabase
      .from('reply_performance_analytics')
      .select('*')
      .eq('dimension_type', dimensionType)
      .gte('confidence_score', 0.5) // Need at least 15 samples
      .order('roi_score', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) return null;

    return {
      tier: data.dimension_value,
      replyCount: data.reply_count,
      avgFollowersGained: Number(data.avg_followers_gained),
      avgReplyLikes: Number(data.avg_reply_likes),
      confidenceScore: Number(data.confidence_score),
      roiScore: Number(data.roi_score),
      performanceTier: data.performance_tier
    };
  }
}
```

**2.3 Analytics Job** (45 min)

**File:** `src/jobs/analyticsJob.ts`

```typescript
import { PerformanceAnalyzer } from '../analytics/PerformanceAnalyzer.js';

export async function analyticsJob(): Promise<void> {
  console.log('[ANALYTICS] 📊 Starting performance analysis...');

  const analyzer = PerformanceAnalyzer.getInstance();

  try {
    // Analyze last 30 days
    const windowDays = 30;
    const endDate = new Date();
    const startDate = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

    // Analyze engagement tiers
    const tierAnalysis = await analyzer.analyzeEngagementTiers(windowDays);

    console.log('[ANALYTICS] 📈 Engagement Tier Results:');
    for (const tier of tierAnalysis) {
      console.log(
        `[ANALYTICS]   ${tier.tier}: ` +
        `${tier.replyCount} replies, ` +
        `+${tier.avgFollowersGained.toFixed(1)} avg followers, ` +
        `ROI: ${tier.roiScore.toFixed(0)}%, ` +
        `Confidence: ${(tier.confidenceScore * 100).toFixed(0)}%, ` +
        `${tier.performanceTier.toUpperCase()}`
      );
    }

    // Store in database
    await analyzer.storeAnalytics(tierAnalysis, 'engagement_tier', {
      start: startDate,
      end: endDate
    });

    // Identify top performer
    const topTier = await analyzer.getTopTier('engagement_tier');
    if (topTier) {
      console.log(
        `[ANALYTICS] 🏆 TOP PERFORMER: ${topTier.tier} ` +
        `(+${topTier.avgFollowersGained.toFixed(1)} avg followers, ` +
        `${topTier.replyCount} samples)`
      );
    }

    console.log('[ANALYTICS] ✅ Analysis complete');
  } catch (error) {
    console.error('[ANALYTICS] ❌ Error during analysis:', error);
    throw error;
  }
}
```

**2.4 Register Job** (5 min)

**File:** `src/jobs/jobManager.ts`

```typescript
import { analyticsJob } from './analyticsJob.js';

// In scheduleJobs():
schedule.scheduleJob('0 */6 * * *', async () => {
  // Every 6 hours
  try {
    console.log('[JOB_MANAGER] Starting analytics job...');
    await analyticsJob();
  } catch (error) {
    console.error('[JOB_MANAGER] Analytics job failed:', error);
  }
});
```

**2.5 CLI Script** (15 min)

**File:** `scripts/analytics-report.ts`

```typescript
import { PerformanceAnalyzer } from '../src/analytics/PerformanceAnalyzer.js';

async function main() {
  console.log('🔍 PERFORMANCE ANALYTICS REPORT\n');

  const analyzer = PerformanceAnalyzer.getInstance();

  // Last 7 days
  console.log('📊 LAST 7 DAYS:');
  const week = await analyzer.analyzeEngagementTiers(7);
  printTable(week);

  console.log('\n📊 LAST 30 DAYS:');
  const month = await analyzer.analyzeEngagementTiers(30);
  printTable(month);

  process.exit(0);
}

function printTable(data: any[]) {
  console.table(data.map(d => ({
    Tier: d.tier,
    Replies: d.replyCount,
    'Avg Followers': `+${d.avgFollowersGained.toFixed(1)}`,
    'ROI %': `${d.roiScore.toFixed(0)}%`,
    Confidence: `${(d.confidenceScore * 100).toFixed(0)}%`,
    Rating: d.performanceTier
  })));
}

main();
```

Add to `package.json`:
```json
{
  "scripts": {
    "analytics:report": "tsx scripts/analytics-report.ts"
  }
}
```

### **Phase 2 Deployment:**

1. Apply migration
2. Add `PerformanceAnalyzer.ts`
3. Add `analyticsJob.ts`
4. Register in `jobManager.ts`
5. Add CLI script
6. Commit + Push
7. Railway auto-deploys

### **Phase 2 Verification:**

```bash
# Run analytics manually:
railway run --service xBOT pnpm analytics:report

# Expected output:
# 📊 LAST 30 DAYS:
# ┌─────────────┬─────────┬──────────────┬────────┬────────────┬──────────┐
# │ Tier        │ Replies │ Avg Followers│ ROI %  │ Confidence │ Rating   │
# ├─────────────┼─────────┼──────────────┼────────┼────────────┼──────────┤
# │ VIRAL       │ 8       │ +12.3        │ 246%   │ 27%        │ excellent│
# │ TRENDING    │ 15      │ +6.8         │ 136%   │ 50%        │ good     │
# │ POPULAR     │ 22      │ +4.2         │ 84%    │ 73%        │ moderate │
# └─────────────┴─────────┴──────────────┴────────┴────────────┴──────────┘

# Check database:
# Should see rows in reply_performance_analytics table
```

**Success Criteria:**
- ✅ Analytics job registered and running
- ✅ `reply_performance_analytics` table populated
- ✅ CLI report shows tier breakdown
- ✅ Top performer identified

---

## 🧠 PHASE 3: CLOSE FEEDBACK LOOPS (2-3 hours)

**Goal:** Use learning data to inform harvesting and generation decisions

**Impact:** System prioritizes proven accounts and uses best generators

### **Changes Required:**

**3.1 Priority Account Discovery** (45 min)

**Modify:** `src/jobs/replyOpportunityHarvester.ts`

Add at the top of the harvesting cycle:

```typescript
async function harvestWithIntelligence(): Promise<void> {
  console.log('[HARVESTER] 🧠 Querying learning system for proven accounts...');

  // Step 1: Find high-performing accounts
  const { data: topAccounts, error } = await supabase
    .from('discovered_accounts')
    .select('username, avg_followers_per_reply, handle')
    .gte('avg_followers_per_reply', 8) // Accounts that drive 8+ followers per reply
    .order('avg_followers_per_reply', { ascending: false })
    .limit(15);

  if (error) {
    console.error('[HARVESTER] Error querying top accounts:', error);
  }

  // Step 2: Build priority search for proven accounts
  if (topAccounts && topAccounts.length > 0) {
    console.log(`[HARVESTER] 🎯 Found ${topAccounts.length} proven performers`);
    
    // Build "from:user1 OR from:user2" query
    const accountQuery = topAccounts.map(a => `from:${a.username}`).join(' OR ');
    
    // PRIORITY SEARCH: New tweets from proven accounts
    const provenQuery = {
      label: 'PROVEN PERFORMERS (Priority)',
      minLikes: 3000, // Lower threshold for proven accounts
      maxAgeHours: 6, // Fresh tweets only
      query: `(${accountQuery}) min_faves:3000 -filter:replies lang:en`,
      priority: 100 // HIGHEST PRIORITY
    };

    console.log(`[HARVESTER] 🚀 Priority search: ${topAccounts.map(a => '@' + a.username).join(', ')}`);
    
    // Execute priority search FIRST
    await executeSearch(provenQuery);
  } else {
    console.log('[HARVESTER] ℹ️ No proven performers yet (need more reply data)');
  }

  // Step 3: Execute standard searches (high-engagement first)
  // ... existing search logic ...
}
```

**3.2 Update Account Performance** (30 min)

**Modify:** `src/jobs/replyMetricsScraperJob.ts`

Add after followers gained calculation:

```typescript
// Update discovered_accounts with performance data
if (followersGained >= 10) {
  console.log(`[METRICS] 🌟 HIGH-VALUE ACCOUNT: @${targetAccount} (+${followersGained} followers)`);
  
  // Update account record
  await supabase
    .from('discovered_accounts')
    .upsert({
      username: targetAccount,
      avg_followers_per_reply: followersGained, // Will be averaged over time
      performance_tier: 'excellent',
      last_high_value_reply_at: new Date().toISOString(),
      metadata: { last_reply_decision_id: decisionId }
    }, {
      onConflict: 'username'
    });
}
```

**3.3 Smart Generator Selection** (1 hour)

**Modify:** `src/jobs/replyJob.ts`

Before generating reply content:

```typescript
console.log(`[REPLY_JOB] 🧠 Selecting best generator for @${opportunity.target_username}...`);

// Query learning system
const { data: accountHistory, error } = await supabase
  .from('content_metadata')
  .select(`
    decision_id,
    generator:metadata->generator,
    followers_gained:metadata->followers_gained
  `)
  .eq('decision_type', 'reply')
  .eq('status', 'posted')
  .eq('metadata->>target_username', opportunity.target_username)
  .order('posted_at', { ascending: false })
  .limit(5);

let selectedGenerator = 'ResearchSynthesizer'; // Default

if (accountHistory && accountHistory.length >= 2) {
  // We have history for this account
  const generators = new Map<string, number[]>();
  
  for (const row of accountHistory) {
    const gen = row.generator || 'ResearchSynthesizer';
    const followers = Number(row.followers_gained) || 0;
    
    if (!generators.has(gen)) generators.set(gen, []);
    generators.get(gen)!.push(followers);
  }
  
  // Find best generator
  let bestGen = selectedGenerator;
  let bestAvg = 0;
  
  for (const [gen, results] of generators.entries()) {
    const avg = results.reduce((a, b) => a + b, 0) / results.length;
    if (avg > bestAvg) {
      bestAvg = avg;
      bestGen = gen;
    }
  }
  
  selectedGenerator = bestGen;
  console.log(`[REPLY_JOB] ✅ Selected ${selectedGenerator} (${accountHistory.length} samples, +${bestAvg.toFixed(1)} avg followers)`);
} else {
  console.log(`[REPLY_JOB] 🎲 No history for @${opportunity.target_username}, using default: ${selectedGenerator}`);
}

// Generate with selected generator
const reply = await generateReplyWithGenerator(opportunity, selectedGenerator);
```

**3.4 Opportunity Scoring V2** (45 min)

**New File:** `src/intelligence/OpportunityScorer.ts`

```typescript
import { supabase } from '../config/supabase.js';

export class OpportunityScorer {
  /**
   * Calculate multi-dimensional opportunity score
   */
  static async calculateScore(opportunity: any): Promise<number> {
    let score = 0;

    // Base: Engagement (0-40 points)
    score += Math.min(opportunity.like_count / 2500, 40);

    // Boost: Proven account (0-30 points)
    const accountData = await this.getAccountPerformance(opportunity.target_username);
    if (accountData) {
      if (accountData.avg_followers_per_reply >= 15) score += 30;
      else if (accountData.avg_followers_per_reply >= 10) score += 20;
      else if (accountData.avg_followers_per_reply >= 5) score += 10;
    }

    // Boost: Freshness (0-20 points)
    const ageMinutes = opportunity.posted_minutes_ago || 999;
    if (ageMinutes < 120) score += 20; // <2h
    else if (ageMinutes < 360) score += 10; // <6h
    else if (ageMinutes < 1440) score += 5; // <24h

    // Penalty: Competition (0 to -10 points)
    const replies = opportunity.reply_count || 0;
    if (replies > 500) score -= 10;
    else if (replies > 200) score -= 5;

    return Math.max(0, score);
  }

  private static async getAccountPerformance(username: string): Promise<any> {
    const { data } = await supabase
      .from('discovered_accounts')
      .select('avg_followers_per_reply, performance_tier')
      .eq('username', username)
      .single();

    return data;
  }
}
```

**Integrate into replyJob:**

```typescript
// When selecting which opportunity to reply to:
import { OpportunityScorer } from '../intelligence/OpportunityScorer.js';

// Score all candidates
for (const opp of opportunities) {
  opp.score_v2 = await OpportunityScorer.calculateScore(opp);
}

// Sort by score
opportunities.sort((a, b) => b.score_v2 - a.score_v2);

// Take top opportunity
const best = opportunities[0];
console.log(`[REPLY_JOB] 🎯 Selected opportunity with score ${best.score_v2.toFixed(1)}`);
```

### **Phase 3 Deployment:**

1. Modify `replyOpportunityHarvester.ts` (priority search)
2. Modify `replyMetricsScraperJob.ts` (account updates)
3. Modify `replyJob.ts` (smart generator selection)
4. Add `OpportunityScorer.ts`
5. Commit + Push
6. Railway auto-deploys

### **Phase 3 Verification:**

```bash
# Check logs for intelligent behavior:
railway logs --service xBOT | grep "PROVEN PERFORMERS"

# Expected:
# [HARVESTER] 🎯 Found 8 proven performers
# [HARVESTER] 🚀 Priority search: @bryan_johnson, @hubermanlab, ...

# Check smart generator selection:
railway logs --service xBOT | grep "Selected.*generator"

# Expected:
# [REPLY_JOB] ✅ Selected ResearchSynthesizer (3 samples, +14.2 avg followers)

# Run analytics:
pnpm analytics:report
```

**Success Criteria:**
- ✅ Harvester searches proven accounts first
- ✅ Account performance updates after high-value replies
- ✅ Generator selection based on history
- ✅ Opportunity scoring considers multiple factors

---

## 🧪 PHASE 4: EXPERIMENTATION (Future - Optional)

**Goal:** Advanced multi-armed bandit and A/B testing

**Status:** This can wait until we have more data (Phase 1-3 running for 1-2 weeks)

**Why Later:**
- Need baseline data first
- Need sample sizes for statistical significance
- Phases 1-3 provide 80% of value
- Phase 4 is the final 20% optimization

**When to Implement:**
- After 2+ weeks of Phase 1-3 running
- After 100+ replies collected
- When analytics show clear patterns

---

## ⏱️ TODAY'S TIMELINE

| Phase | Time | Tasks | Deploy | Verify |
|-------|------|-------|--------|--------|
| 1 | 1-2h | Reorder searches, tier classification | ✅ | 30 min |
| 2 | 2-3h | Analytics foundation, job, CLI | ✅ | 30 min |
| 3 | 2-3h | Feedback loops, smart selection | ✅ | 30 min |
| **Total** | **6-8h** | **All core features** | **3 deploys** | **1.5h** |

---

## ✅ DEPLOYMENT STRATEGY

### **Safe Phased Rollout:**

**After Phase 1:**
- Let harvester run for 1 cycle (30-60 min)
- Verify high-engagement tweets being found
- Check `engagement_tier` populated
- **If good:** Proceed to Phase 2
- **If issues:** Debug before next phase

**After Phase 2:**
- Wait for analytics job to run (or trigger manually)
- Verify `reply_performance_analytics` table populated
- Run CLI report
- **If good:** Proceed to Phase 3
- **If issues:** Fix analytics before feedback loops

**After Phase 3:**
- Monitor logs for intelligent behavior
- Verify proven account searches
- Verify smart generator selection
- **Monitor for 24 hours**
- Check if performance improves

### **Rollback Plan:**

Each phase is independent:
- Phase 1 breaks → Revert harvester changes
- Phase 2 breaks → Disable analytics job
- Phase 3 breaks → Revert to simple harvesting

No phase depends on another for basic functionality.

---

## 🎯 SUCCESS METRICS

### **Phase 1 Success:**
- ✅ Harvester prioritizes 100K+, 50K+, 25K+ first
- ✅ `engagement_tier` populated on opportunities
- ✅ Distribution shifts to higher engagement

### **Phase 2 Success:**
- ✅ Analytics job runs every 6 hours
- ✅ Performance data by tier available
- ✅ CLI report works
- ✅ Top tier identified

### **Phase 3 Success:**
- ✅ Proven accounts searched first
- ✅ Generator selection based on history
- ✅ Account performance updated real-time
- ✅ Opportunity scoring considers multiple factors

### **Overall Success (1 week):**
- ✅ Average followers per reply increasing
- ✅ Higher % of replies to VIRAL+ tweets
- ✅ System learning and adapting
- ✅ No errors or breaking changes

---

## 🚀 READY TO START?

This is the **optimal plan for TODAY**:
- ✅ Aggressive but safe
- ✅ Phased for stability
- ✅ Each phase adds value
- ✅ Rollback plans ready
- ✅ 6-8 hours total

**Phase 1 takes 1-2 hours and provides immediate value.**

Say the word and I'll start building Phase 1.

