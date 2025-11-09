# Visual Intelligence System - Data Reference
**Last Updated:** November 5, 2025  
**Purpose:** Complete reference for VI data flow, metrics, and database structure

---

## 🎯 System Goal

**Collect thousands of high-quality tweets → Extract visual patterns → Feed insights to content generators**

---

## 📊 Data Flow

```
STEP 1: SCRAPING (Every 8 hours)
├─ Source: 100 health/longevity accounts on Twitter
├─ Method: Playwright browser automation
├─ Extracts: Content + ALL engagement + media/timestamp data
├─ Concurrency: Configurable via `VI_SCRAPER_CONCURRENCY` (default 8 parallel accounts)
└─ Stores: vi_collected_tweets table

STEP 2: CLASSIFICATION (Every 6 hours) 
├─ Source: Unclassified tweets from vi_collected_tweets
├─ Method: OpenAI API (gpt-4o-mini)
├─ Extracts: Topic, Angle, Tone, Structure
└─ Stores: vi_content_classification table

STEP 3: VISUAL ANALYSIS (Every 6 hours)
├─ Source: Unanalyzed tweets from vi_collected_tweets
├─ Method: Pattern extraction (regex, counting)
├─ Extracts: Emojis, line breaks, hooks, caps, bullets, citations
└─ Stores: vi_visual_formatting table

STEP 4: INTELLIGENCE BUILDING (Automatic)
├─ Source: Classified + Analyzed tweets
├─ Method: Statistical aggregation (tier-weighted)
├─ Extracts: Patterns by topic+angle+tone combinations
└─ Stores: vi_format_intelligence table

STEP 5: APPLICATION (Manual trigger)
├─ Source: vi_format_intelligence table
├─ Method: Query patterns matching content parameters
├─ Applies: Visual formatting to generated content
└─ Result: Better-formatted tweets based on proven patterns
```

---

## 🗄️ Database Schema

### **Table 1: vi_scrape_targets**
**Purpose:** Accounts to monitor for data collection

| Column | Type | Description | Example |
|--------|------|-------------|---------|
| `username` | TEXT | Twitter username (unique) | `PeterAttiaMD` |
| `tier` | TEXT | Account tier classification | `micro`, `growth`, `established`, `viral_unknown` |
| `tier_weight` | FLOAT | Weight for intelligence building | `3.0` (viral_unknown), `1.0` (growth) |
| `followers_count` | INT | Follower count at discovery | `150000` |
| `discovery_method` | TEXT | How account was found | `manual_seed`, `reply_network`, `hashtag_search` |
| `is_active` | BOOLEAN | Currently scraping? | `true` |
| `last_scraped_at` | TIMESTAMPTZ | Last successful scrape | `2025-11-05 15:00:00` |

**Auto-Tiering Rules:**
- `< 1,000 followers` → **viral_unknown** (weight: 3.0)
- `1,000 - 10,000` → **micro** (weight: 2.0)
- `10,000 - 100,000` → **growth** (weight: 1.0)
- `> 100,000` → **established** (weight: 0.5)

---

### **Table 2: vi_collected_tweets**
**Purpose:** Raw tweets with REAL engagement metrics

| Column | Type | Description | Source | Example |
|--------|------|-------------|--------|---------|
| `tweet_id` | TEXT | Twitter status ID (unique) | Direct from URL | `1986052289568588160` |
| `author_username` | TEXT | Tweet author | Direct from profile | `PeterAttiaMD` |
| `original_author` | TEXT | Original poster (for retweets/quotes) | Parsed from URL | `PeterAttiaMD` |
| `content` | TEXT | Full tweet text | Direct from tweet | `"Sleep timing matters more than..."` |
| `tier` | TEXT | Author's tier | Inherited from vi_scrape_targets | `growth` |
| `tier_weight` | FLOAT | Weight for analysis | Inherited from vi_scrape_targets | `1.0` |
| `author_followers` | INT | Author's follower count | Scraped from profile | `150000` |
| **ENGAGEMENT METRICS** | | | | |
| `views` | BIGINT | **REAL view count from Twitter** | `a[href*="/analytics"] span` | `2296`, `2200` (from "2.2K") |
| `likes` | INT | Like count | `[data-testid="like"] aria-label` | `188` |
| `retweets` | INT | Retweet count | `[data-testid="retweet"] aria-label` | `13` |
| `replies` | INT | Reply count | `[data-testid="reply"] aria-label` | `6` |
| `bookmarks` | INT | Bookmark count | Not always available | `0` |
| `quotes` | INT | Quote tweet count | Not always available | `0` |
| **CALCULATED METRICS** | | | | |
| `engagement_rate` | FLOAT | Total engagement / views | Calculated | `0.0284` (2.84%) |
| `is_viral` | BOOLEAN | Views > 50% of follower count | Calculated | `true` |
| `viral_multiplier` | FLOAT | Views / follower count | Calculated | `0.52` (52% reach) |
| **METADATA** | | | | |
| `is_thread` | BOOLEAN | Part of a thread? | Detected | `false` |
| `thread_length` | INT | Number of tweets in thread | Detected | `1` |
| `is_reply` | BOOLEAN | Reply content? | `Replying to` banner | `true` |
| `is_quote` | BOOLEAN | Contains quoted tweet? | Inline quote detection | `false` |
| `has_media` | BOOLEAN | Includes media | Image/video/card detection | `true` |
| `media_types` | TEXT[] | Types of media present | `["image","card"]` | `['image']` |
| `reply_to_tweet_id` | TEXT | Parent tweet (if reply) | Currently null (future) | `null` |
| `root_tweet_id` | TEXT | Conversation root | `data-conversation-id` | `1986052289568588160` |
| `posted_at` | TIMESTAMPTZ | When tweet was posted | Timeline timestamp (`time` tag) | `2025-11-05 07:45:00` |
| `scraped_at` | TIMESTAMPTZ | When we scraped it | Exact | `2025-11-05 11:02:03` |
| `classified` | BOOLEAN | AI classification complete? | Status | `false` |
| `analyzed` | BOOLEAN | Visual analysis complete? | Status | `false` |

**Data Quality Rules:**
- ✅ `views > 0` → Real data from Twitter
- ⚠️ `views = 0` → Falls back to estimate (likes + RTs + replies) × 50
- ✅ All tweets must have `content.length > 10`
- ✅ All tweets must have valid `tweet_id`

---

### **Table 3: vi_content_classification**
**Purpose:** AI-extracted content attributes

| Column | Type | Description | How Generated | Example |
|--------|------|-------------|---------------|---------|
| `tweet_id` | TEXT | Links to vi_collected_tweets | Foreign key | `1986052289568588160` |
| `topic` | TEXT | Main topic | OpenAI classification | `sleep`, `exercise`, `longevity` |
| `topic_confidence` | FLOAT | AI confidence (0-1) | OpenAI response | `0.89` |
| `angle` | TEXT | Content approach | OpenAI classification | `provocative`, `research`, `practical` |
| `angle_confidence` | FLOAT | AI confidence | OpenAI response | `0.75` |
| `tone` | TEXT | Communication style | OpenAI classification | `authoritative`, `conversational`, `educational` |
| `tone_confidence` | FLOAT | AI confidence | OpenAI response | `0.92` |
| `structure` | TEXT | Format type | OpenAI classification | `question_hook`, `stat_hook`, `story`, `list` |
| `structure_confidence` | FLOAT | AI confidence | OpenAI response | `0.88` |

**Classification Prompt (Example):**
```
Analyze this health/longevity tweet and classify:
- Topic: [sleep, exercise, nutrition, supplements, longevity, mental_health, etc.]
- Angle: [provocative, research, practical, controversial, personal, etc.]
- Tone: [authoritative, conversational, educational, provocative, etc.]
- Structure: [question_hook, stat_hook, story, myth_truth, list, etc.]

Return JSON with confidence scores.
```

---

### **Table 4: vi_visual_formatting**
**Purpose:** Extracted visual patterns

| Column | Type | Description | How Extracted | Example |
|--------|------|-------------|---------------|---------|
| `tweet_id` | TEXT | Links to vi_collected_tweets | Foreign key | `1986052289568588160` |
| **BASIC STRUCTURE** | | | | |
| `char_count` | INT | Total characters | `content.length` | `165` |
| `word_count` | INT | Total words | Split by spaces | `28` |
| `sentence_count` | INT | Number of sentences | Count periods | `3` |
| `line_count` | INT | Number of lines | Count newlines | `4` |
| `line_breaks` | INT | Explicit line breaks | Count `\n` | `3` |
| **EMOJIS** | | | | |
| `emoji_count` | INT | Total emojis | Regex match | `2` |
| `emoji_list` | TEXT[] | Which emojis used | Array | `['🔥', '💪']` |
| `emoji_positions` | TEXT[] | Where emojis appear | Analysis | `['start', 'end']` |
| **FORMATTING ELEMENTS** | | | | |
| `has_bullets` | BOOLEAN | Uses bullet points? | Contains `•` or `-` | `true` |
| `has_numbers` | BOOLEAN | Uses numbered list? | Contains `1.`, `2.` | `false` |
| `has_caps` | BOOLEAN | Uses ALL CAPS words? | Regex `[A-Z]{3,}` | `true` |
| `caps_words` | TEXT[] | Which words in caps | Array | `['BREAKING', 'NEW']` |
| `has_quotes` | BOOLEAN | Uses quotation marks? | Contains `"` or `'` | `false` |
| `has_hashtags` | BOOLEAN | Uses hashtags? | Contains `#` | `true` |
| `hashtag_count` | INT | Number of hashtags | Count `#` | `2` |
| **HOOK ANALYSIS** | | | | |
| `hook_type` | TEXT | Opening style | First 50 chars analysis | `question`, `stat`, `controversy`, `story` |
| `starts_with` | TEXT | First 50 characters | Substring | `"Did you know your spleen might be..."` |
| **CREDIBILITY MARKERS** | | | | |
| `cites_source` | BOOLEAN | Mentions research? | Contains study/research keywords | `true` |
| `source_type` | TEXT | Type of citation | Keyword matching | `study`, `research`, `expert`, `book`, `data` |
| `has_stats` | BOOLEAN | Includes numbers/stats? | Contains digits in context | `true` |
| **SPECIAL CHARACTERS** | | | | |
| `uses_arrows` | BOOLEAN | Uses arrow symbols? | Contains `→`, `↑`, etc. | `false` |
| `uses_special_chars` | TEXT[] | Special formatting chars | Array | `['→', '•', '≠']` |
| **VISUAL CONTEXT** | | | | |
| `has_media` | BOOLEAN | Media present in tweet | From vi_collected_tweets | `true` |
| `media_types` | TEXT[] | Media mix | `['image', 'card']` |
| `screenshot_detected` | BOOLEAN | Likely screenshot post? | Heuristic (<80 chars + image) | `false` |
| `callout_detected` | BOOLEAN | Headline/callout present? | Detects phrases like `TL;DR` | `true` |

---

### **Table 5: vi_format_intelligence**
**Purpose:** Aggregated recommendations by content type

| Column | Type | Description | How Built | Example |
|--------|------|-------------|-----------|---------|
| `query_key` | TEXT | Topic\|Angle\|Tone\|Structure | Composite | `sleep|provocative|question|hook` |
| `topic` | TEXT | Content topic | From classification | `sleep` |
| `angle` | TEXT | Content angle | From classification | `provocative` |
| `tone` | TEXT | Content tone | From classification | `question` |
| `structure` | TEXT | Content structure | From classification | `hook` |
| `recommended_format` | JSONB | Visual recommendations | Statistical analysis | See below |
| `tier_breakdown` | JSONB | Data sources by tier | Aggregation | See below |
| `example_tweet_ids` | JSONB | Top examples | Top performers | `["id1", "id2"]` |
| `confidence_level` | TEXT | Recommendation quality | Based on sample size | `high`, `medium`, `low` |
| `based_on_count` | INT | Number of tweets analyzed | Count | `87` |
| `weighted_avg_engagement` | FLOAT | Tier-weighted avg ER | Calculation | `0.0342` (3.42%) |

**recommended_format Example:**
```json
{
  "char_count": {"median": 165, "range": [140, 220]},
  "line_breaks": {"median": 3, "mode": 2},
  "emoji_count": {"median": 0, "range": [0, 2]},
  "emoji_positions": ["end", "middle"],
  "hook_pattern": "question",
  "cite_source_pct": 0.73,
  "caps_usage": "single_word",
  "hashtag_pct": 0.12
}
```

**tier_breakdown Example:**
```json
{
  "viral_unknowns": {"count": 23, "avg_engagement": 0.067},
  "micro": {"count": 47, "avg_engagement": 0.042},
  "growth": {"count": 31, "avg_engagement": 0.038}
}
```

---

## 🔍 Metrics Being Collected

### **PRIMARY METRICS (Direct from Twitter)**
1. **Views** - Real impression count (visible on all tweets)
   - Format: `2,296` or `2.2K` or `1.5M`
   - Scraped from: `a[href*="/analytics"] span`
   - Quality: ✅ REAL data (not estimated)

2. **Likes** - Heart/like count
   - Scraped from: `[data-testid="like"] aria-label`
   - Example: `"188 Likes"` → `188`

3. **Retweets** - Share count
   - Scraped from: `[data-testid="retweet"] aria-label`
   - Example: `"13 Retweets"` → `13`

4. **Replies** - Comment count
   - Scraped from: `[data-testid="reply"] aria-label`
   - Example: `"6 Replies"` → `6`

### **CALCULATED METRICS**
5. **Engagement Rate** = `(likes + retweets + replies) / views`
   - Example: `(188 + 13 + 6) / 2296 = 0.0901` (9.01%)
   - Use: Measure content quality

6. **Viral Multiplier** = `views / author_followers`
   - Example: `2296 / 150000 = 0.0153` (1.53% reach)
   - Use: Identify overperformers

### **EXTRACTED METRICS**
7. **Visual Patterns** - See vi_visual_formatting table
8. **Content Classification** - See vi_content_classification table

---

## 🛡️ Data Integrity Checks

### **At Scraping Time:**
```sql
-- All tweets must have content
WHERE content IS NOT NULL AND LENGTH(content) > 10

-- All tweets must have valid ID
WHERE tweet_id IS NOT NULL AND tweet_id != ''

-- Engagement metrics must be non-negative
WHERE likes >= 0 AND retweets >= 0 AND replies >= 0 AND views >= 0
```

### **At Analysis Time:**
```sql
-- Only analyze classified tweets
WHERE classified = true AND topic_confidence >= 0.6

-- Only build intelligence from high-confidence data
WHERE topic_confidence >= 0.6 
  AND angle_confidence >= 0.6 
  AND tone_confidence >= 0.6
```

### **At Application Time:**
```sql
-- Only use patterns based on sufficient data
WHERE based_on_count >= 50 AND confidence_level IN ('high', 'medium')
```

---

## 📈 Data Collection Progress

### **Expected Timeline**
| Timeframe | Tweets Collected | Status |
|-----------|------------------|--------|
| Day 1 | ~700 | In progress |
| Week 1 | ~4,900 | Scheduled |
| Week 2 | ~9,800 | Scheduled |
| Month 1 | ~21,000 | Goal |

### **Quality Targets**
- ✅ 100% of tweets have REAL view counts
- ✅ 90%+ have valid engagement metrics
- ✅ 80%+ classified with high confidence
- ✅ 75%+ analyzed for visual patterns
- ✅ 50+ patterns per major topic

---

## 🔧 How to Query & Analyze

### **Check Collection Progress**
```sql
SELECT 
  (SELECT COUNT(*) FROM vi_scrape_targets) as accounts,
  (SELECT COUNT(*) FROM vi_collected_tweets) as tweets,
  (SELECT COUNT(*) FROM vi_collected_tweets WHERE classified = true) as classified,
  (SELECT COUNT(*) FROM vi_collected_tweets WHERE analyzed = true) as analyzed,
  (SELECT COUNT(*) FROM vi_format_intelligence) as patterns;
```

### **Find Top Performing Tweets**
```sql
SELECT 
  author_username,
  content,
  views,
  likes,
  engagement_rate,
  viral_multiplier
FROM vi_collected_tweets
WHERE views > 0
ORDER BY engagement_rate DESC
LIMIT 20;
```

### **Analyze by Tier**
```sql
SELECT 
  tier,
  COUNT(*) as tweets,
  AVG(views) as avg_views,
  AVG(engagement_rate) as avg_er,
  MAX(engagement_rate) as max_er
FROM vi_collected_tweets
WHERE views > 0
GROUP BY tier
ORDER BY tier_weight DESC;
```

### **Get Recommendations for Content**
```sql
SELECT 
  recommended_format,
  confidence_level,
  based_on_count,
  weighted_avg_engagement
FROM vi_format_intelligence
WHERE topic = 'sleep'
  AND angle = 'provocative'
  AND tone = 'question'
  AND confidence_level IN ('high', 'medium')
LIMIT 1;
```

---

## 🎓 For Future PRs

**When modifying scraper:**
- ✅ Check `viAccountScraper.ts` for selector changes
- ✅ Test view count parsing (K/M format)
- ✅ Verify engagement metrics are non-negative
- ✅ Update this doc if adding new metrics

**When modifying classification:**
- ✅ Check `viProcessor.ts` for OpenAI prompt changes
- ✅ Ensure confidence thresholds are respected
- ✅ Update this doc if adding new attributes

**When modifying intelligence:**
- ✅ Check aggregation logic in pattern builder
- ✅ Ensure tier weighting is applied correctly
- ✅ Update this doc if changing recommendation structure

**Data Consistency:**
- ✅ Never mix estimated and real view counts
- ✅ Delete old data if scraping logic changes fundamentally
- ✅ Always validate data integrity after schema changes

---

## 📚 Related Docs
- `/docs/VISUAL_INTELLIGENCE_SYSTEM_COMPLETE.md` - System overview
- `/docs/VI_INTEGRATION_GUIDE.md` - Integration guide
- `/supabase/migrations/20251105_visual_intelligence_system.sql` - Database schema
- `/src/intelligence/viAccountScraper.ts` - Scraper implementation
- `/src/intelligence/viProcessor.ts` - Classification/analysis
- `/src/intelligence/viIntelligenceFeed.ts` - Pattern retrieval

---

**Last Data Reset:** November 5, 2025 (cleared 102 tweets with estimated views)  
**Current Collection Mode:** REAL view counts only  
**Status:** ✅ Ready for production data collection

