# 🚀 VIRAL TWEET LEARNING SYSTEM

## The Problem We're Solving

Your AI formatter was creating shit because it had:
- ❌ Vague guidance ("make it look good")
- ❌ Limited data (only YOUR 50-100 tweets)
- ❌ Hardcoded rules (guesses, not data)
- ❌ No feedback on what ACTUALLY works

## The Solution: Learn From Viral Tweets

Instead of guessing what works, we **scrape actual viral tweets from Twitter** and learn patterns that get engagement.

### How It Works

```
1. SCRAPE viral tweets (50K+ views) ───┐
   - Health accounts (Huberman, Attia)  │
   - Format masters (Colin Rugg)        │
   - General viral content              │
                                         │
2. ANALYZE patterns ────────────────────┤
   - Hook types (question, data, etc.)  │
   - Formatting (bullets, breaks, etc.) │
   - Engagement correlation             │
                                         │
3. STORE in viral_tweet_library ────────┤
   - Performance metrics                │
   - Pattern tags                       │
   - Engagement rates                   │
                                         │
4. FEED to AI Formatter ────────────────┘
   - Real examples in prompt
   - Data-driven insights
   - Pattern recommendations
```

---

## Components

### 1. Database (`viral_tweet_library` table)

Stores high-performing tweets with analyzed patterns:

```sql
-- Example record
{
  tweet_id: "1234567890",
  text: "Blue light isn't the enemy...",
  likes: 4200,
  views: 180000,
  engagement_rate: 0.045, -- 4.5%
  
  -- Pattern analysis
  hook_type: "controversy",
  formatting_patterns: ["line_breaks", "data_lead", "emoji_free"],
  character_count: 247,
  emoji_count: 0,
  
  topic_category: "health"
}
```

**Views** (via migration):
- `top_viral_patterns` - Aggregated pattern performance
- `recent_viral_examples` - Latest high performers (for AI prompts)

### 2. Scraper (`viralTweetScraper.ts`)

Core class that:
- Scrapes tweets using Playwright
- Analyzes formatting patterns
- Calculates engagement metrics
- Stores in database

**Key functions:**
```typescript
const scraper = getViralScraper();

// Scrape tweets
await scraper.scrapeViralTweets({
  minViews: 50000,
  minEngagementRate: 0.02, // 2%
  categories: ['health', 'science'],
  maxTweets: 100
});

// Get top patterns
const patterns = await scraper.getTopPatterns({
  minSampleSize: 10,
  category: 'health'
});

// Get examples for AI prompt
const examples = await scraper.getExamplesForPrompt(5);
```

### 3. Scraper Script (`scripts/scrape-viral-tweets.ts`)

Executable script for collecting tweets:

```bash
# Scrape health tweets
pnpm tsx scripts/scrape-viral-tweets.ts --category health --max 100

# Scrape with custom thresholds
pnpm tsx scripts/scrape-viral-tweets.ts --min-views 100000 --max 50
```

**What it does:**
1. Opens browser with Playwright
2. Visits high-performing accounts
3. Extracts tweets with metrics
4. Analyzes patterns
5. Stores in database
6. Shows pattern analysis

### 4. AI Formatter (`aiVisualFormatter.ts`)

**BEFORE** (vague):
```typescript
const prompt = `Make this tweet look good for a premium account...`;
// Result: Generic advice, inconsistent formatting
```

**AFTER** (data-driven):
```typescript
const prompt = buildSmartFormattingPrompt(generator, tone, topic, intelligence, content);

// Includes:
// - Generator-specific guidance (Provocateur vs Storyteller)
// - Performance data (what's working for this generator)
// - Decision framework (when to format vs leave plain)
// - Real viral tweet examples (future enhancement)
```

---

## Setup & Usage

### Initial Setup

1. **Run migration:**
```bash
# Apply database schema
psql $DATABASE_URL < supabase/migrations/20251103_viral_tweet_learning.sql
```

2. **First scrape:**
```bash
# Collect initial viral tweet library
pnpm tsx scripts/scrape-viral-tweets.ts --category health --max 200
```

3. **Schedule regular scrapes:**
```bash
# Add to cron (run daily)
0 2 * * * cd /path/to/xBOT && pnpm tsx scripts/scrape-viral-tweets.ts --max 50
```

### How AI Formatter Uses It

**Current implementation** (aiVisualFormatter.ts):
- ✅ Generator-specific guidance (Provocateur, Storyteller, etc.)
- ✅ Performance insights from YOUR tweets
- ✅ Recent format variety check
- ⚠️ Viral tweet examples (TODO - enhance)

**Next enhancement** (add to prompt):
```typescript
// In buildSmartFormattingPrompt()
const viralExamples = await scraper.getExamplesForPrompt(3);

// Add to prompt:
`REAL VIRAL EXAMPLES (50K+ views, 3%+ engagement):
${viralExamples}

These are PROVEN patterns. Learn from them.`
```

---

## Pattern Detection

The system automatically detects these patterns:

### Hook Types
- `question` - Starts with What/Why/How or "?"
- `data` - Starts with numbers/stats
- `controversy` - "Everyone thinks X, but..."
- `news` - BREAKING/NEW/JUST IN
- `story` - Experience/happened/friend
- `statement` - Direct claim

### Formatting Patterns
- `bullets` - Uses • or ● for lists
- `numbered_list` - 1) 2) 3) format
- `line_breaks` - Multiple \\n for spacing
- `caps_emphasis` - KEY TERMS in caps
- `emoji_free` - No emojis (credibility)
- `single_emoji` - Strategic 1 emoji
- `myth_truth_markers` - 🚫/✅ debunking

### Content Patterns
- `statistics` - Includes numbers/percentages
- `myth_busting` - Debunks common beliefs
- `storytelling` - Narrative format

---

## Querying Viral Data

### Get Top Patterns
```sql
-- What patterns perform best?
SELECT 
  hook_type,
  formatting_patterns,
  AVG(engagement_rate) as avg_engagement,
  COUNT(*) as samples
FROM viral_tweet_library
WHERE views >= 50000
GROUP BY hook_type, formatting_patterns
HAVING COUNT(*) >= 10
ORDER BY avg_engagement DESC
LIMIT 10;
```

### Get Examples for Specific Pattern
```sql
-- Find viral tweets with "question hook + emoji_free"
SELECT text, likes, views, engagement_rate
FROM viral_tweet_library
WHERE 
  hook_type = 'question'
  AND 'emoji_free' = ANY(formatting_patterns)
  AND views >= 50000
ORDER BY engagement_rate DESC
LIMIT 5;
```

### Performance by Category
```sql
-- Health vs general performance
SELECT 
  topic_category,
  AVG(engagement_rate) as avg_engagement,
  AVG(views) as avg_views,
  COUNT(*) as samples
FROM viral_tweet_library
WHERE is_active = true
GROUP BY topic_category;
```

---

## Benefits

### 1. Data-Driven Decisions
- AI learns from **real success** not guesses
- Patterns proven with 50K+ view tweets
- Continuous learning as Twitter evolves

### 2. Cross-Domain Learning
- Not limited to health content
- Learns universal engagement patterns
- Adapts Twitter-wide trends

### 3. Generator-Aware Formatting
- Provocateur: Bold, direct (no fluff)
- Storyteller: Narrative flow (no bullets)
- Data Nerd: Clean stats (analytical)
- Each gets appropriate guidance

### 4. Performance Feedback Loop
```
Scrape viral → Analyze patterns → Guide AI formatter → Post tweet
                                                            ↓
Track performance → Update insights ──────────────────────┘
```

---

## Roadmap

### Phase 1: Foundation ✅
- [x] Database schema
- [x] Scraper class
- [x] Pattern detection
- [x] Basic scraper script
- [x] AI formatter integration

### Phase 2: Enhancement 🚧
- [ ] Add viral examples to AI prompt
- [ ] Implement Twitter API scraping (more data)
- [ ] Thread detection and analysis
- [ ] Sentiment analysis on replies

### Phase 3: Intelligence 🔮
- [ ] Pattern performance tracking
- [ ] A/B test format strategies
- [ ] Predictive formatting (ML model)
- [ ] Real-time trend adaptation

---

## Usage Examples

### Example 1: Scrape Health Content
```bash
pnpm tsx scripts/scrape-viral-tweets.ts \
  --category health \
  --max 100 \
  --min-views 75000
```

### Example 2: Query Best Patterns
```typescript
import { getViralScraper } from './src/scraper/viralTweetScraper';

const scraper = getViralScraper();
const patterns = await scraper.getTopPatterns({
  category: 'health',
  minSampleSize: 15
});

console.log('Top 3 patterns:');
patterns.slice(0, 3).forEach(p => {
  console.log(`${p.hookType} + ${p.formattingPatterns.join(', ')}`);
  console.log(`  Engagement: ${(p.avgEngagement * 100).toFixed(2)}%`);
  console.log(`  Samples: ${p.sampleSize}`);
});
```

### Example 3: Test AI Formatter
```typescript
import { formatContentForTwitter } from './src/posting/aiVisualFormatter';

const result = await formatContentForTwitter({
  content: "Raw tweet content here...",
  generator: "provocateur",
  topic: "sleep optimization",
  angle: "controversial take",
  tone: "bold",
  formatStrategy: "question hook"
});

console.log('Formatted:', result.formatted);
console.log('Approach:', result.visualApproach);
console.log('Confidence:', result.confidence);
```

---

## Maintenance

### Clean Old Data
```sql
-- Deactivate tweets older than 90 days (trends change)
SELECT deactivate_old_viral_tweets();
```

### Check Library Health
```sql
-- How much data do we have?
SELECT 
  topic_category,
  COUNT(*) as active_tweets,
  AVG(engagement_rate) as avg_engagement
FROM viral_tweet_library
WHERE is_active = true
GROUP BY topic_category;
```

### Refresh Data
```bash
# Weekly refresh recommended
pnpm tsx scripts/scrape-viral-tweets.ts --category health --max 50
pnpm tsx scripts/scrape-viral-tweets.ts --category general --max 50
```

---

## Key Insight

**This system lets the AI learn from ACTUAL Twitter success, not guesses.**

Instead of telling it "use bullets sometimes", we show it:
- Real tweets that got 200K views
- What formatting they used
- Why it worked for that content type

The AI makes smarter decisions because it's trained on **ground truth data** from successful tweets.

---

## Files Created

```
src/scraper/viralTweetScraper.ts       # Core scraper class
scripts/scrape-viral-tweets.ts          # Executable scraper
supabase/migrations/20251103_viral_tweet_learning.sql  # Database
src/posting/aiVisualFormatter.ts        # Updated with smart prompts
VIRAL_TWEET_LEARNING_SYSTEM.md          # This file
```

**Next Steps:**
1. Run migration
2. Do first scrape
3. Watch AI formatter improve
4. Schedule regular scrapes
5. Monitor pattern performance

🚀 Now your formatter learns from what ACTUALLY works on Twitter!

