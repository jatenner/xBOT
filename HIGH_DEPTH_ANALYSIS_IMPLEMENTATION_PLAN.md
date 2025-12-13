# 🚀 HIGH-DEPTH ANALYSIS IMPLEMENTATION PLAN

## ✅ READY TO IMPLEMENT

**Yes, I understand:**
- ✅ What files need to change
- ✅ How data will flow
- ✅ What Supabase SQL/editors we need

---

## 📁 FILES TO MODIFY

### **1. expertTweetAnalyzer.ts** (ENHANCE)

**Current:** Gets tweet + performance, analyzes strategically
**Enhancement:** Also get visual data points from VI Visual Analysis

**Changes:**
```typescript
// BEFORE:
async analyzeTweet(tweet: any): Promise<void> {
  const prompt = this.buildExpertPrompt(tweet);
  const analysis = await this.getExpertAnalysis(tweet, prompt);
  await this.storeExpertAnalysis(tweet, analysis);
}

// AFTER:
async analyzeTweet(tweet: any): Promise<void> {
  // ✅ NEW: Get visual data points
  const { VIVisualAnalysis } = await import('./viVisualAnalysis');
  const visualAnalyzer = new VIVisualAnalysis();
  const visualAnalysis = await visualAnalyzer.analyzeVisualAppearance(tweet);
  
  // ✅ NEW: Combine visual data + strategic analysis
  const prompt = this.buildExpertPrompt(tweet, visualAnalysis);
  const analysis = await this.getExpertAnalysis(tweet, prompt, visualAnalysis);
  await this.storeExpertAnalysis(tweet, analysis, visualAnalysis);
}
```

**What Changes:**
- Import `VIVisualAnalysis`
- Get visual data points before analysis
- Pass visual data to prompt builder
- Include visual data in analysis
- Store visual data points in database

---

### **2. expertTweetAnalyzer.ts - buildExpertPrompt()** (ENHANCE)

**Current:** Builds prompt with tweet + performance data
**Enhancement:** Include visual data points in prompt

**Changes:**
```typescript
// BEFORE:
private buildExpertPrompt(tweet: any): string {
  return `Analyze this tweet...`;
}

// AFTER:
private buildExpertPrompt(tweet: any, visualAnalysis?: any): string {
  const visualDataSection = visualAnalysis ? `
VISUAL DATA POINTS:
- Emoji positions: ${JSON.stringify(visualAnalysis.visual_elements?.emojis_used || [])}
- Structural emojis: ${visualAnalysis.visual_appearance?.emoji_function?.structural_count || 0}
- Decorative emojis: ${visualAnalysis.visual_appearance?.emoji_function?.decorative_count || 0}
- Structural ratio: ${visualAnalysis.visual_appearance?.emoji_function?.structural_ratio || 0}
- Visual complexity: ${visualAnalysis.visual_appearance?.visual_complexity || 0}
- Line break positions: ${JSON.stringify(visualAnalysis.visual_elements?.line_breaks_visual || [])}
- Scanning pattern: ${visualAnalysis.visual_appearance?.scanning_pattern?.scan_path || []}

YOUR TASK: Connect visual data points to strategic insights.
Explain WHY these visual elements work (not just WHAT they are).
` : '';
  
  return `Analyze this tweet...
${visualDataSection}
...`;
}
```

**What Changes:**
- Accept `visualAnalysis` parameter
- Include visual data points in prompt
- Ask GPT to connect data to strategy

---

### **3. expertTweetAnalyzer.ts - ExpertTweetAnalysis interface** (ENHANCE)

**Current:** Has basic `visual_analysis` (just text)
**Enhancement:** Add detailed visual data points

**Changes:**
```typescript
// BEFORE:
export interface ExpertTweetAnalysis {
  visual_analysis: {
    formatting_strategy: string;
    visual_hierarchy: string;
  };
}

// AFTER:
export interface ExpertTweetAnalysis {
  visual_data_points: {
    emoji_positions: Array<{emoji: string; position: number; role: string}>;
    structural_emojis: number;
    decorative_emojis: number;
    structural_ratio: number;
    visual_complexity: number;
    line_break_positions: Array<{position: number; purpose: string}>;
    scanning_pattern: string[];
  };
  visual_strategic_insights: {
    emoji_strategy: string;
    visual_hierarchy: string;
    data_backed_reasoning: string;
  };
  visual_analysis: {
    formatting_strategy: string;
    visual_hierarchy: string;
  };
}
```

**What Changes:**
- Add `visual_data_points` field
- Add `visual_strategic_insights` field
- Keep existing `visual_analysis` for compatibility

---

### **4. expertInsightsAggregator.ts** (ENHANCE)

**Current:** Synthesizes strategic insights
**Enhancement:** Also synthesize visual data patterns + correlations

**Changes:**
```typescript
// BEFORE:
async synthesizeInsights(analyses: any[]): Promise<AggregatedExpertInsights> {
  const prompt = this.buildSynthesisPrompt(analyses);
  return await this.getSynthesizedInsights(prompt, analyses.length);
}

// AFTER:
async synthesizeInsights(analyses: any[]): Promise<AggregatedExpertInsights> {
  // ✅ NEW: Extract visual data patterns
  const visualPatterns = this.extractVisualPatterns(analyses);
  
  // ✅ NEW: Calculate correlations
  const correlations = this.calculateCorrelations(analyses);
  
  const prompt = this.buildSynthesisPrompt(analyses, visualPatterns, correlations);
  return await this.getSynthesizedInsights(prompt, analyses.length, visualPatterns, correlations);
}
```

**What Changes:**
- Extract visual data patterns across tweets
- Calculate performance correlations
- Include in synthesis prompt
- Return visual data patterns + correlations

---

### **5. expertInsightsAggregator.ts - buildSynthesisPrompt()** (ENHANCE)

**Current:** Synthesizes strategic insights
**Enhancement:** Also synthesize visual data patterns

**Changes:**
```typescript
// AFTER:
private buildSynthesisPrompt(analyses: any[], visualPatterns: any, correlations: any): string {
  return `Synthesize insights from ${analyses.length} successful tweets.

VISUAL DATA PATTERNS:
${JSON.stringify(visualPatterns, null, 2)}

PERFORMANCE CORRELATIONS:
${JSON.stringify(correlations, null, 2)}

YOUR TASK:
1. Synthesize strategic insights
2. Identify visual data patterns (emoji positions, ratios, complexity)
3. Calculate performance correlations (what works together)
4. Generate specific guidance (exact positions, counts, ratios)
`;
}
```

**What Changes:**
- Include visual patterns in prompt
- Include correlations in prompt
- Ask for specific guidance

---

### **6. expertInsightsAggregator.ts - extractVisualPatterns()** (NEW)

**New Method:**
```typescript
private extractVisualPatterns(analyses: any[]): any {
  const patterns = {
    emoji_placement: {
      hook_emoji: { positions: [], success_rates: [] },
      structural_emojis: { positions: [], success_rates: [] }
    },
    structural_ratios: [],
    visual_complexity: []
  };
  
  analyses.forEach(analysis => {
    if (analysis.visual_data_points) {
      // Extract emoji positions
      analysis.visual_data_points.emoji_positions?.forEach((emoji: any) => {
        if (emoji.role === 'hook_enhancement') {
          patterns.emoji_placement.hook_emoji.positions.push(emoji.position);
        }
      });
      
      // Extract structural ratios
      patterns.structural_ratios.push(analysis.visual_data_points.structural_ratio);
      
      // Extract visual complexity
      patterns.visual_complexity.push(analysis.visual_data_points.visual_complexity);
    }
  });
  
  return patterns;
}
```

**What This Does:**
- Extracts visual data patterns across tweets
- Groups by type (emoji placement, ratios, complexity)
- Prepares for correlation analysis

---

### **7. expertInsightsAggregator.ts - calculateCorrelations()** (NEW)

**New Method:**
```typescript
private calculateCorrelations(analyses: any[]): any {
  const correlations = {
    hook_emoji_at_0: { success_count: 0, total_count: 0 },
    structural_ratio_0_7_0_9: { success_count: 0, total_count: 0 },
    visual_complexity_60_70: { success_count: 0, total_count: 0 }
  };
  
  analyses.forEach(analysis => {
    const er = analysis.engagement_rate || 0;
    const is_success = er >= 0.02; // 2%+ ER = success
    
    // Hook emoji at position 0
    const hasHookEmojiAt0 = analysis.visual_data_points?.emoji_positions?.some(
      (e: any) => e.position <= 10 && e.role === 'hook_enhancement'
    );
    if (hasHookEmojiAt0) {
      correlations.hook_emoji_at_0.total_count++;
      if (is_success) correlations.hook_emoji_at_0.success_count++;
    }
    
    // Structural ratio 0.7-0.9
    const ratio = analysis.visual_data_points?.structural_ratio || 0;
    if (ratio >= 0.7 && ratio <= 0.9) {
      correlations.structural_ratio_0_7_0_9.total_count++;
      if (is_success) correlations.structural_ratio_0_7_0_9.success_count++;
    }
    
    // Visual complexity 60-70
    const complexity = analysis.visual_data_points?.visual_complexity || 0;
    if (complexity >= 60 && complexity <= 70) {
      correlations.visual_complexity_60_70.total_count++;
      if (is_success) correlations.visual_complexity_60_70.success_count++;
    }
  });
  
  // Calculate success rates
  Object.keys(correlations).forEach(key => {
    const corr = correlations[key];
    corr.success_rate = corr.total_count > 0 
      ? corr.success_count / corr.total_count 
      : 0;
  });
  
  return correlations;
}
```

**What This Does:**
- Calculates performance correlations
- Tracks success rates for patterns
- Identifies what works together

---

### **8. convertExpertInsightsToAdvice() in planJob.ts** (ENHANCE)

**Current:** Converts expert insights to advice string
**Enhancement:** Include visual data points + specific guidance

**Changes:**
```typescript
// AFTER:
function convertExpertInsightsToAdvice(expertInsights: any, ...): string {
  let advice = `🎯 EXPERT SOCIAL MEDIA MANAGER ADVICE...`;
  
  // ✅ NEW: Add visual data points section
  if (expertInsights.visual_data_patterns) {
    advice += `\n📊 VISUAL DATA PATTERNS (From ${expertInsights.based_on_count} Tweets):\n`;
    
    // Emoji placement
    if (expertInsights.visual_data_patterns.emoji_placement) {
      advice += `\n🎯 EMOJI PLACEMENT:\n`;
      advice += `- Hook emoji at position 0-10: ${expertInsights.visual_data_patterns.emoji_placement.hook_emoji.success_rate * 100}% success rate\n`;
      advice += `- Structural emojis at positions 40-60, 100-130: ${expertInsights.visual_data_patterns.emoji_placement.structural_emojis.success_rate * 100}% success rate\n`;
    }
    
    // Structural ratio
    if (expertInsights.visual_data_patterns.structural_ratio) {
      advice += `\n📊 STRUCTURAL RATIO:\n`;
      advice += `- Optimal range: 0.7-0.9 (80% structural, 20% decorative)\n`;
      advice += `- Success rate: ${expertInsights.visual_data_patterns.structural_ratio.success_rate * 100}%\n`;
    }
    
    // Visual complexity
    if (expertInsights.visual_data_patterns.visual_complexity) {
      advice += `\n🎨 VISUAL COMPLEXITY:\n`;
      advice += `- Optimal range: 60-70\n`;
      advice += `- Success rate: ${expertInsights.visual_data_patterns.visual_complexity.success_rate * 100}%\n`;
    }
  }
  
  // ✅ NEW: Add specific guidance section
  if (expertInsights.specific_guidance) {
    advice += `\n🎯 SPECIFIC GUIDANCE:\n`;
    Object.entries(expertInsights.specific_guidance).forEach(([key, value]) => {
      advice += `${key}: ${value}\n`;
    });
  }
  
  return advice;
}
```

**What Changes:**
- Add visual data patterns section
- Add specific guidance section
- Include success rates
- Include data-backed reasoning

---

## 🔄 DATA FLOW

### **Complete Flow:**

```
1. TWEET SCRAPED (Every 8h)
   ↓
   Stored in: vi_collected_tweets or vi_viral_unknowns
   Fields: tweet_id, content, views, likes, engagement_rate

2. VI VISUAL ANALYSIS (Every 6h)
   ↓
   VIVisualAnalysis.analyzeVisualAppearance(tweet)
   ↓
   Extracts: emoji positions, counts, ratios, visual complexity
   ↓
   GPT-4o analyzes visual appearance
   ↓
   Stored in: vi_visual_formatting
   Fields: tweet_id, visual_appearance (JSONB), visual_elements (JSONB)

3. EXPERT ANALYSIS (Every 6h) ← ENHANCED
   ↓
   ExpertTweetAnalyzer.analyzeTweet(tweet)
   ↓
   Gets visual analysis from vi_visual_formatting
   ↓
   Combines: tweet + performance + visual data
   ↓
   GPT-4o analyzes strategically WITH visual data
   ↓
   Returns: Strategic insights + Visual data points + Connections
   ↓
   Stored in: expert_tweet_analysis
   Fields: 
     - strategic_analysis (JSONB)
     - content_intelligence (JSONB)
     - visual_data_points (JSONB) ← NEW
     - visual_strategic_insights (JSONB) ← NEW
     - performance_insights (JSONB)
     - actionable_recommendations (JSONB)

4. EXPERT AGGREGATION (Every 12h) ← ENHANCED
   ↓
   ExpertInsightsAggregator.aggregateAllInsights()
   ↓
   Gets expert analyses from expert_tweet_analysis
   ↓
   Extracts visual patterns across tweets
   ↓
   Calculates performance correlations
   ↓
   GPT-4o synthesizes WITH visual patterns + correlations
   ↓
   Returns: Strategic insights + Visual patterns + Correlations + Specific guidance
   ↓
   Stored in: vi_format_intelligence.expert_insights
   Fields:
     - expert_insights (JSONB) ← Enhanced with visual patterns
     - strategic_recommendations (TEXT[])
     - content_strategy (TEXT)

5. CONTENT GENERATION (Every 30min)
   ↓
   planJob generates content
   ↓
   Gets VI insights from vi_format_intelligence
   ↓
   Gets expert insights (with visual patterns) ← ENHANCED
   ↓
   Converts to generator advice string
   ↓
   Includes visual data points + specific guidance ← NEW
   ↓
   Passes to generator via intelligenceContext
   ↓
   Generator creates content using specific guidance
```

---

## 🗄️ DATABASE CHANGES

### **1. expert_tweet_analysis Table** (ENHANCE)

**Current Schema:**
```sql
CREATE TABLE expert_tweet_analysis (
  ...
  visual_analysis JSONB NOT NULL,  -- Just text descriptions
  ...
);
```

**Enhancement Needed:**
```sql
-- Add visual data points column
ALTER TABLE expert_tweet_analysis
ADD COLUMN IF NOT EXISTS visual_data_points JSONB,
ADD COLUMN IF NOT EXISTS visual_strategic_insights JSONB;

-- Update existing visual_analysis to be more detailed
-- (Keep for compatibility, enhance structure)
```

**New Columns:**
- `visual_data_points` (JSONB) - Structured visual metrics
- `visual_strategic_insights` (JSONB) - Strategic insights about visual elements

---

### **2. vi_format_intelligence Table** (ENHANCE)

**Current Schema:**
```sql
ALTER TABLE vi_format_intelligence
ADD COLUMN IF NOT EXISTS expert_insights JSONB,
ADD COLUMN IF NOT EXISTS strategic_recommendations TEXT[],
ADD COLUMN IF NOT EXISTS content_strategy TEXT;
```

**Enhancement Needed:**
```sql
-- expert_insights JSONB structure should include:
{
  "strategic_insights": "...",
  "visual_data_patterns": {
    "emoji_placement": {...},
    "structural_ratio": {...},
    "visual_complexity": {...}
  },
  "pattern_correlations": {
    "hook_emoji_at_0": {
      "success_rate": 0.85,
      "sample_size": 47
    }
  },
  "specific_guidance": {
    "emoji_placement": "...",
    "structural_ratio": "...",
    "visual_complexity": "..."
  }
}
```

**No Schema Change Needed** - Just enhance JSONB structure

---

## 📊 DATA FLOW DIAGRAM

```
┌─────────────────────────────────────────────────────────────┐
│ 1. TWEET SCRAPED (Every 8h)                                 │
│    vi_collected_tweets / vi_viral_unknowns                  │
│    Fields: tweet_id, content, views, engagement_rate        │
└───────────────────────┬─────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. VI VISUAL ANALYSIS (Every 6h)                            │
│    VIVisualAnalysis.analyzeVisualAppearance()               │
│    Extracts: emoji positions, counts, ratios                 │
│    Stores: vi_visual_formatting                             │
│    Fields: visual_appearance (JSONB), visual_elements (JSONB)│
└───────────────────────┬─────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. EXPERT ANALYSIS (Every 6h) ← ENHANCED                   │
│    ExpertTweetAnalyzer.analyzeTweet()                       │
│    Gets: visual analysis from vi_visual_formatting          │
│    Combines: tweet + performance + visual data              │
│    GPT-4o analyzes WITH visual data                        │
│    Stores: expert_tweet_analysis                            │
│    Fields:                                                  │
│      - strategic_analysis (JSONB)                          │
│      - visual_data_points (JSONB) ← NEW                     │
│      - visual_strategic_insights (JSONB) ← NEW             │
│      - performance_insights (JSONB)                         │
└───────────────────────┬─────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. EXPERT AGGREGATION (Every 12h) ← ENHANCED                │
│    ExpertInsightsAggregator.aggregateAllInsights()          │
│    Extracts: visual patterns across tweets                  │
│    Calculates: performance correlations                     │
│    GPT-4o synthesizes WITH patterns + correlations         │
│    Stores: vi_format_intelligence.expert_insights          │
│    Fields:                                                  │
│      - expert_insights (JSONB) ← Enhanced                   │
│        * visual_data_patterns                               │
│        * pattern_correlations                               │
│        * specific_guidance                                  │
└───────────────────────┬─────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. CONTENT GENERATION (Every 30min)                          │
│    planJob generates content                                │
│    Gets: expert insights (with visual patterns)              │
│    Converts: to generator advice string                     │
│    Includes: visual data points + specific guidance         │
│    Passes: to generator via intelligenceContext             │
│    Generator: creates content using specific guidance       │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔧 SUPABASE SQL CHANGES

### **Migration File:** `supabase/migrations/20251203_enhance_expert_analysis.sql`

```sql
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- ENHANCE EXPERT ANALYSIS WITH VISUAL DATA POINTS
-- Date: December 3, 2025
-- Purpose: Add visual data points and strategic insights to expert analysis
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

BEGIN;

-- ════════════════════════════════════════════════════════════════════════════
-- ENHANCE: expert_tweet_analysis table
-- Add visual data points and strategic insights columns
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE expert_tweet_analysis
ADD COLUMN IF NOT EXISTS visual_data_points JSONB,
ADD COLUMN IF NOT EXISTS visual_strategic_insights JSONB;

COMMENT ON COLUMN expert_tweet_analysis.visual_data_points IS 
  'Structured visual metrics: emoji positions, counts, ratios, visual complexity';

COMMENT ON COLUMN expert_tweet_analysis.visual_strategic_insights IS 
  'Strategic insights connecting visual data points to performance: why visual elements work';

-- ════════════════════════════════════════════════════════════════════════════
-- ENHANCE: vi_format_intelligence.expert_insights structure
-- No schema change needed - JSONB structure enhanced in code
-- ════════════════════════════════════════════════════════════════════════════

-- Note: expert_insights JSONB structure will be enhanced to include:
-- - visual_data_patterns (emoji placement, structural ratio, visual complexity)
-- - pattern_correlations (success rates, sample sizes)
-- - specific_guidance (exact positions, counts, ratios)

COMMIT;
```

---

## ✅ IMPLEMENTATION CHECKLIST

### **Phase 1: Database Setup**
- [ ] Create migration file
- [ ] Add `visual_data_points` column to `expert_tweet_analysis`
- [ ] Add `visual_strategic_insights` column to `expert_tweet_analysis`
- [ ] Run migration (or let Supabase auto-apply)

### **Phase 2: Expert Analyzer Enhancement**
- [ ] Modify `expertTweetAnalyzer.ts` to get visual analysis
- [ ] Enhance `buildExpertPrompt()` to include visual data
- [ ] Enhance `ExpertTweetAnalysis` interface
- [ ] Update `storeExpertAnalysis()` to store visual data points

### **Phase 3: Aggregator Enhancement**
- [ ] Add `extractVisualPatterns()` method
- [ ] Add `calculateCorrelations()` method
- [ ] Enhance `buildSynthesisPrompt()` to include patterns
- [ ] Enhance `synthesizeInsights()` to return patterns + correlations

### **Phase 4: Prompt Improvement**
- [ ] Enhance `convertExpertInsightsToAdvice()` in planJob.ts
- [ ] Add visual data patterns section
- [ ] Add specific guidance section
- [ ] Include success rates and data-backed reasoning

### **Phase 5: Testing**
- [ ] Test expert analysis with visual data
- [ ] Test aggregation with patterns
- [ ] Test content generation with enhanced prompts
- [ ] Verify database writes

---

## 📊 MEASUREMENT QUERIES

### **Analysis Quality:**
```sql
SELECT 
  COUNT(*) as tweets_analyzed,
  AVG(CASE WHEN visual_data_points IS NOT NULL THEN 1 ELSE 0 END) as has_visual_data,
  AVG(jsonb_array_length(visual_data_points->'emoji_positions')) as avg_emoji_data_points
FROM expert_tweet_analysis
WHERE analyzed_at > NOW() - INTERVAL '7 days';
```

### **Prompt Improvement:**
```sql
SELECT 
  query_key,
  jsonb_array_length(expert_insights->'visual_data_patterns') as visual_patterns_count,
  jsonb_array_length(expert_insights->'pattern_correlations') as correlations_count,
  jsonb_array_length(expert_insights->'specific_guidance') as guidance_items_count
FROM vi_format_intelligence
WHERE expert_insights IS NOT NULL;
```

### **Content Quality:**
```sql
SELECT 
  generator_name,
  COUNT(*) as posts,
  AVG(CASE WHEN content LIKE '🔥%' OR content LIKE '⚡%' THEN 1 ELSE 0 END) as hook_emoji_compliance,
  AVG(actual_engagement_rate) as avg_er
FROM content_metadata
WHERE posted_at > NOW() - INTERVAL '7 days'
GROUP BY generator_name;
```

### **Performance Improvement:**
```sql
WITH before_period AS (
  SELECT AVG(actual_engagement_rate) as avg_er_before
  FROM content_metadata
  WHERE posted_at BETWEEN NOW() - INTERVAL '14 days' AND NOW() - INTERVAL '7 days'
),
after_period AS (
  SELECT AVG(actual_engagement_rate) as avg_er_after
  FROM content_metadata
  WHERE posted_at > NOW() - INTERVAL '7 days'
)
SELECT 
  before_period.avg_er_before,
  after_period.avg_er_after,
  ((after_period.avg_er_after - before_period.avg_er_before) / before_period.avg_er_before * 100) as improvement_pct
FROM before_period, after_period;
```

---

## ✅ SUMMARY

**Files to Modify:**
1. ✅ `expertTweetAnalyzer.ts` - Get visual data, enhance prompt, store visual data points
2. ✅ `expertInsightsAggregator.ts` - Extract patterns, calculate correlations, synthesize
3. ✅ `planJob.ts` - Enhance `convertExpertInsightsToAdvice()` to include visual data

**Database Changes:**
1. ✅ Add `visual_data_points` column to `expert_tweet_analysis`
2. ✅ Add `visual_strategic_insights` column to `expert_tweet_analysis`
3. ✅ Enhance `expert_insights` JSONB structure (no schema change)

**Data Flow:**
1. ✅ Tweet scraped → VI Visual Analysis → Expert Analysis (with visual data) → Aggregation (with patterns) → Content Generation (with specific guidance)

**Measurement:**
1. ✅ Analysis Quality (tweets analyzed, visual data points)
2. ✅ Prompt Improvement (specificity, data points)
3. ✅ Content Quality (compliance with guidance)
4. ✅ Performance Improvement (ER, views, followers)

**Ready to implement!** 🚀

