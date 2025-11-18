# 🔍 VISUAL INTELLIGENCE (VI) SCRAPER - COMPLETE WALKTHROUGH

**How the VI system scrapes tweets and learns from them**

---

## 📊 **PHASE 1: VI ACCOUNT SCRAPER** (Every 8 hours)

### **What It Does:**
Scrapes tweets from monitored accounts stored in `vi_scrape_targets` table

**Location:** `src/intelligence/viAccountScraper.ts`

### **Step-by-Step:**

1. **Get Active Targets:**
   ```typescript
   // Gets all accounts from vi_scrape_targets where is_active = true
   // Prioritizes by tier_weight (micro accounts = 2.0, highest priority)
   ```

2. **Scrape Each Account:**
   - Navigates to `https://twitter.com/{username}`
   - Scrolls 15 times (collects ~50-100 tweets per account)
   - Extracts from DOM:
     - Tweet ID, text, views, likes, retweets, replies
     - Media types (image, video, gif, card, poll)
     - Timestamp, is_reply, is_quote
     - Author info

3. **Store in Database:**
   ```typescript
   // Saves to vi_collected_tweets table:
   {
     tweet_id,
     author_username,
     tier: 'micro' | 'growth' | 'established',
     tier_weight: 2.0 | 1.0 | 0.5,
     content: tweet text,
     views, likes, retweets, replies,
     engagement_rate: calculated,
     is_viral: (views / followers) > 0.5,
     viral_multiplier: views / followers,
     has_media, media_types,
     posted_at, scraped_at,
     classified: false,  // ← Not yet processed
     analyzed: false    // ← Not yet analyzed
   }
   ```

**Result:** Raw tweets stored in `vi_collected_tweets` table

---

## 🧠 **PHASE 2: VI PROCESSOR** (Every 6 hours)

**Location:** `src/intelligence/viProcessor.ts`

### **STAGE 1: CLASSIFICATION** (AI extracts metadata)

**What Happens:**
- Finds tweets where `classified = false`
- Uses GPT-4o-mini to analyze each tweet
- Extracts:
  - **Topic:** sleep, exercise, supplements, nutrition, etc.
  - **Angle:** provocative, research_based, personal_story, etc.
  - **Tone:** authoritative, conversational, provocative, etc.
  - **Structure:** question_hook, stat_hook, story, myth_truth, etc.
  - **Generator Match:** Which of 22 generators would create this?
  - **Hook Effectiveness:** 0-100 score
  - **Controversy Level:** 0-100 score

**Stored In:**
```typescript
// vi_content_classification table:
{
  tweet_id,
  topic, angle, tone, structure,
  generator_match: 'dataNerd' | 'provocateur' | etc.,
  hook_effectiveness: 0-100,
  controversy_level: 0-100,
  confidence scores for each
}
```

**Result:** Tweets marked `classified = true`

---

### **STAGE 2: VISUAL ANALYSIS** (Pattern extraction)

**What Happens:**
- Finds tweets where `classified = true` AND `analyzed = false`
- Extracts visual patterns:
  - Character count, word count, line breaks
  - Emoji count, positions, types
  - Formatting: bullets, numbers, caps, quotes, hashtags
  - Hook type detection
  - Source citations
  - Media presence
  - **Readability scores** (Flesch Reading Ease)
  - **Engagement velocity** (fast/medium/slow)
  - **CTA detection** (follow, try, learn, share)
  - **Time analysis** (hour, day of week, weekend)

**Stored In:**
```typescript
// vi_visual_formatting table:
{
  tweet_id,
  char_count, word_count, line_breaks,
  emoji_count, emoji_list, emoji_positions,
  hook_type, starts_with,
  has_bullets, has_numbers, has_caps,
  cites_source, has_stats,
  has_media, media_types,
  readability_score,
  engagement_velocity,
  has_cta, cta_type, cta_placement,
  hour_posted, day_of_week, is_weekend
}
```

**Result:** Tweets marked `analyzed = true`

---

### **STAGE 3: INTELLIGENCE BUILDING** (Pattern aggregation)

**What Happens:**
1. **Groups tweets** by angle/tone/structure combinations
2. **Filters by success:**
   - Only includes tweets with:
     - 2%+ engagement rate OR
     - Viral status (50%+ reach) OR
     - 30%+ viral multiplier
3. **Analyzes patterns** per tier:
   - Viral unknowns (tier_weight 3.0)
   - Micro accounts (tier_weight 2.0) ← **YOUR STAGE**
   - Growth accounts (tier_weight 1.0)
   - Established accounts (tier_weight 0.5)
4. **Correlates patterns with engagement:**
   - Finds optimal values (highest ER)
   - Example: "3 line breaks = 2.8% ER vs 0 line breaks = 1.2% ER"
5. **Builds recommendations:**
   - Optimal character count (highest ER)
   - Optimal line breaks (highest ER)
   - Optimal emoji count (highest ER)
   - Best hook types (highest ER)
   - Media strategies
   - CTA placement

**Stored In:**
```typescript
// vi_format_intelligence table:
{
  query_key: 'angle|tone|structure',
  angle, tone, structure,
  generator_match: 'dataNerd', // ← NEW: Generator-specific
  recommended_format: {
    char_count: { optimal: 180, median: 200 },
    line_breaks: { optimal: 3, median: 2 },
    emoji_count: { optimal: 1, median: 0 },
    hook_pattern: 'stat',
    optimal_hook: 'stat', // ← Hook with highest ER
    cite_source_pct: 0.65,
    media_presence_pct: 0.20
  },
  tier_breakdown: {
    micro: { count: 45, avg_engagement: 0.028, patterns: {...} },
    growth: { count: 12, avg_engagement: 0.019, patterns: {...} }
  },
  primary_tier: 'micro',
  confidence_level: 'high' | 'medium' | 'low',
  based_on_count: 57, // ← Only successful tweets
  weighted_avg_engagement: 0.025
}
```

**Result:** Intelligence patterns ready for content generation

---

## 🔥 **PHASE 3: HOW LEARNING GETS USED**

### **A. Data-Driven Viral Formulas**
**Location:** `src/generators/dataDrivenViralFormulas.ts`

**Uses VI Data:**
```typescript
// Learns from vi_tweets table (high-performing tweets analyzed by VI)
const { data: viTweets } = await supabase
  .from('vi_tweets')
  .select('*')
  .gte('engagement_rate', 0.02) // 2%+ ER
  .limit(50);

// AI extracts viral formulas from these tweets
const formulas = await extractFormulasFromVITweets(viTweets);
```

**Result:** Viral formulas learned from VI-analyzed tweets

---

### **B. Content Generation** (When creating new posts)

**Uses VI Intelligence:**
```typescript
// When planJob generates content:
// 1. Gets format recommendations from vi_format_intelligence
const { data: formatIntel } = await supabase
  .from('vi_format_intelligence')
  .select('*')
  .eq('generator_match', 'dataNerd') // ← Generator-specific!
  .eq('primary_tier', 'micro')
  .single();

// 2. Applies optimal formatting:
const recommended = formatIntel.recommended_format;
// Uses: optimal char_count, optimal line_breaks, optimal_hook, etc.

// 3. Injects into AI prompt:
const prompt = `
Generate a tweet with:
- ${recommended.char_count.optimal} characters (optimal for engagement)
- ${recommended.line_breaks.optimal} line breaks
- Hook type: ${recommended.optimal_hook}
- ${recommended.emoji_count.optimal} emojis
...
`;
```

**Result:** Generated content uses proven patterns from VI analysis

---

## 📈 **COMPLETE DATA FLOW**

```
1. VI ACCOUNT SCRAPER (every 8 hours)
   ↓
   Scrapes 327 accounts
   ↓
   Stores in vi_collected_tweets
   (1,185 tweets collected)
   ↓

2. VI PROCESSOR - CLASSIFICATION (every 6 hours)
   ↓
   AI classifies tweets
   ↓
   Stores in vi_content_classification
   (1,067 classified = 90% complete)
   ↓

3. VI PROCESSOR - VISUAL ANALYSIS (every 6 hours)
   ↓
   Extracts visual patterns
   ↓
   Stores in vi_visual_formatting
   (1,067 analyzed = 90% complete)
   ↓

4. VI PROCESSOR - INTELLIGENCE BUILDING (every 6 hours)
   ↓
   Groups successful tweets (2%+ ER or viral)
   ↓
   Correlates patterns with engagement
   ↓
   Finds optimal values (highest ER)
   ↓
   Stores in vi_format_intelligence
   ↓

5. CONTENT GENERATION (planJob)
   ↓
   Queries vi_format_intelligence
   ↓
   Gets optimal formatting for generator
   ↓
   Applies to AI prompt
   ↓
   Generates optimized content
```

---

## 🎯 **KEY METRICS FROM DASHBOARD**

**Current Status:**
- **1,185 tweets** collected from 327 accounts
- **61 successful tweets** (5% with 2%+ ER)
- **362 viral tweets** (50%+ reach)
- **1,067 AI classified** (90% complete)
- **1,067 pattern analyzed** (90% complete)

**What This Means:**
- System has analyzed 1,185 tweets
- Identified 61 successful patterns (2%+ engagement)
- Found 362 viral tweets to learn from
- 90% of tweets have been processed through the pipeline

---

## ✅ **WHAT GETS LEARNED**

1. **Format Patterns:**
   - Optimal character count (by generator)
   - Optimal line breaks (by generator)
   - Optimal emoji usage (by generator)
   - Best hook types (by generator)

2. **Generator-Specific Intelligence:**
   - What works for `dataNerd` vs `provocateur`
   - Format preferences per generator
   - Engagement patterns per generator

3. **Tier-Specific Patterns:**
   - What works for micro accounts (your stage)
   - What works for growth accounts
   - Weighted recommendations (micro = 2.0x weight)

4. **Success Correlations:**
   - "3 line breaks = 2.8% ER" (optimal)
   - "Stat hooks = 3.2% ER" (optimal)
   - "1 emoji = 2.5% ER" (optimal)

---

## 🚀 **RESULT**

**The VI system:**
- Scrapes tweets from 327 monitored accounts
- Classifies them with AI (topic, angle, tone, structure, generator match)
- Analyzes visual patterns (formatting, hooks, media)
- Correlates patterns with engagement rates
- Finds optimal values (highest ER)
- Builds generator-specific intelligence
- Feeds into content generation system

**Fully autonomous learning loop** - no manual intervention needed!

