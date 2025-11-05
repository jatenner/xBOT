# 📊 DATABASE REFERENCE - Single Source of Truth

**Last Updated:** November 5, 2025  
**Purpose:** Complete reference for AI assistants and developers working on xBOT

---

## 🎯 CORE ARCHITECTURE

### The 4-Table System (Post-Nov 5 Fix)

```
Generation → Posting → Scraping → Display
    ↓          ↓          ↓          ↓
content_   content_   outcomes   Dashboard
metadata   metadata   +          reads
(queued)   (posted)   learning_  content_
                      posts      metadata
```

---

## 📋 TABLE REFERENCE

### 1. `content_metadata` (PRIMARY TABLE - 2,562 rows)

**Purpose:** Main table for ALL content (generation metadata + performance metrics)

**Key Columns:**
```sql
-- Identity
decision_id UUID PRIMARY KEY          -- Unique identifier for this content
tweet_id TEXT                         -- Twitter's tweet ID (filled after posting)
decision_type TEXT                    -- 'single', 'thread', 'reply'
status TEXT                           -- 'queued', 'posted', 'skipped', 'failed'

-- Generation Metadata (5-Dimensional System)
raw_topic TEXT                        -- "NAD+ supplementation"
angle TEXT                            -- "Optimal dosing windows"
tone TEXT                             -- "Data-driven expert"
generator_name TEXT                   -- "dataNerd", "contrarian", etc.
format_strategy TEXT                  -- "Timeline with progressive effects"

-- Content
content TEXT                          -- The actual tweet text
thread_parts JSONB                    -- For threads: array of tweet parts
features JSONB                        -- Additional metadata

-- Performance Metrics (filled by scraper after posting)
actual_impressions INT                -- Views (Dashboard column: VIEWS)
actual_likes INT                      -- Likes (Dashboard column: LIKES)
actual_retweets INT                   -- Retweets (Dashboard column: VIRAL)
actual_replies INT                    -- Replies
actual_engagement_rate NUMERIC        -- ER % (Dashboard column: ER)

-- Reply-specific
target_tweet_id TEXT                  -- For replies: tweet being replied to
target_username TEXT                  -- For replies: @username

-- Timestamps
created_at TIMESTAMPTZ                -- When generated
posted_at TIMESTAMPTZ                 -- When posted to Twitter
scheduled_at TIMESTAMPTZ              -- When scheduled to post
```

**Data Flow:**
1. **planJob** creates row with `status='queued'`
2. **postingQueue** posts to Twitter, updates `tweet_id` and `status='posted'`
3. **metricsScraperJob** scrapes Twitter, updates `actual_*` columns
4. **Dashboard** reads `actual_*` columns to display metrics

**Code References:** 150 files use this table

---

### 2. `outcomes` (METRICS TABLE - 2,686 rows)

**Purpose:** Engagement metrics for bandit learning and AI optimization

**Key Columns:**
```sql
decision_id UUID REFERENCES content_metadata(decision_id)
tweet_id TEXT
likes INT
retweets INT
replies INT
views INT                             -- Same as impressions
bookmarks INT
impressions INT                       -- Total reach
profile_clicks INT                    -- From analytics page
engagement_rate NUMERIC               -- Calculated ER
collected_at TIMESTAMPTZ              -- When scraped
data_source TEXT                      -- 'orchestrator_v2', 'scraped'
simulated BOOLEAN                     -- false = real data
```

**Used By:**
- Bandit algorithms (Thompson sampling)
- Learning systems
- Performance analysis

**Code References:** 49 files

---

### 3. `learning_posts` (AI LEARNING TABLE - 594 rows)

**Purpose:** Simplified metrics for 30+ learning systems

**Key Columns:**
```sql
tweet_id TEXT PRIMARY KEY
likes_count INT
retweets_count INT
replies_count INT
bookmarks_count INT
impressions_count INT
updated_at TIMESTAMPTZ
```

**Used By:**
- AI learning systems
- Content optimization
- Pattern discovery

**Code References:** 30 files

---

### 4. `tweet_metrics` (TIMING TABLE - 807 rows)

**Purpose:** Metrics for timing and quantity optimizers

**Key Columns:**
```sql
tweet_id TEXT
likes_count INT
retweets_count INT
replies_count INT
impressions_count INT
created_at TIMESTAMPTZ               -- When tweet was created
updated_at TIMESTAMPTZ               -- When metrics last updated
```

**Used By:**
- Timing optimizer
- Posting schedule intelligence
- Quantity optimizer

**Code References:** 10 files

---

### 5. `posted_decisions` (ARCHIVE - 833 rows)

**Purpose:** Historical archive of posted content

**Key Columns:**
```sql
id BIGSERIAL PRIMARY KEY
decision_id UUID REFERENCES content_metadata(decision_id)
decision_type TEXT                   -- 'single', 'thread', 'reply'
tweet_id TEXT                        -- Twitter tweet ID
bandit_arm TEXT                      -- Which bandit arm was used
timing_arm TEXT                      -- Timing experiment
posted_at TIMESTAMPTZ
```

**Code References:** 38 files

---

### 6. `reply_opportunities` (REPLY TARGETING - 89 rows)

**Purpose:** Tweets we could reply to for growth

**Key Columns:**
```sql
id BIGSERIAL PRIMARY KEY
target_username TEXT
target_tweet_id TEXT UNIQUE
target_tweet_content TEXT
opportunity_score NUMERIC            -- How good of an opportunity
status TEXT                          -- 'pending', 'replied', 'skipped'
created_at TIMESTAMPTZ
```

**Code References:** 22 files

---

### 7. `discovered_accounts` (ACCOUNT POOL - 1,000 rows)

**Purpose:** Health/wellness accounts to engage with

**Key Columns:**
```sql
id BIGSERIAL PRIMARY KEY
username TEXT UNIQUE
follower_count INT
relevance_score NUMERIC
status TEXT                          -- 'active', 'inactive'
created_at TIMESTAMPTZ
```

**Code References:** 26 files

---

## 🔄 DATA FLOW (Complete)

### Posting Flow:
```
1. planJob.ts
   ↓ INSERT INTO content_metadata
   ↓ (status='queued', raw_topic, angle, tone, generator_name, format_strategy)

2. postingQueue.ts
   ↓ SELECT FROM content_metadata WHERE status='queued'
   ↓ Post to Twitter via Playwright
   ↓ UPDATE content_metadata SET tweet_id='...', status='posted'

3. metricsScraperJob.ts (every 10 min)
   ↓ SELECT FROM content_metadata WHERE status='posted'
   ↓ Scrape Twitter for likes, views, retweets
   ↓ UPDATE content_metadata SET actual_likes=..., actual_impressions=...
   ↓ INSERT INTO outcomes (decision_id, likes, views...)
   ↓ INSERT INTO learning_posts (tweet_id, likes_count...)
   ↓ INSERT INTO tweet_metrics (tweet_id, likes_count...)

4. Dashboard
   ↓ SELECT actual_impressions, actual_likes, actual_engagement_rate
   ↓ FROM content_metadata
   ↓ Display as VIEWS, LIKES, ER columns
```

### Reply Flow:
```
1. accountDiscoveryJob.ts
   ↓ Scrape health accounts
   ↓ INSERT INTO discovered_accounts

2. replyOpportunityHarvester.ts
   ↓ Find tweets from discovered accounts
   ↓ INSERT INTO reply_opportunities

3. replyJob.ts
   ↓ SELECT FROM reply_opportunities WHERE status='pending'
   ↓ Generate reply content
   ↓ INSERT INTO content_metadata (decision_type='reply', target_tweet_id)

4. postingQueue.ts
   ↓ Post reply to Twitter
   ↓ UPDATE reply_opportunities SET status='replied'
```

---

## 🚨 CRITICAL FIXES (November 5, 2025)

### Problem Found:
- Dashboard was showing all zeros for metrics
- Scraper was writing to `outcomes`, `learning_posts`, `tweet_metrics`
- BUT NOT updating `content_metadata` table
- Dashboard reads from `content_metadata` → saw zeros

### Solution:
- Updated `metricsScraperJob.ts` to ALSO write to `content_metadata`
- Now scraper updates ALL 4 tables:
  1. `content_metadata` (for dashboard)
  2. `outcomes` (for bandit learning)
  3. `learning_posts` (for AI learning)
  4. `tweet_metrics` (for timing optimizer)

### File Changed:
- `src/jobs/metricsScraperJob.ts` lines 239-262

---

## 🗑️ LEGACY TABLES (To Clean Up)

**Total Tables:** 259
**Empty Tables:** 158 (61%!)
**Core Tables:** ~40

### Major Duplicates to Delete:
- `content_generation_metadata_comprehensive` - duplicate of `content_metadata`
- `tweet_engagement_metrics_comprehensive` - duplicate of `outcomes`
- `posted_tweets_comprehensive` - duplicate of `posted_decisions`
- `tweets` - old schema, replaced by `content_metadata`

### See: `DATABASE_CLEANUP_PLAN.md` for full cleanup strategy

---

## 💡 QUICK REFERENCE FOR AI ASSISTANTS

### "Where are tweet metrics stored?"
→ `content_metadata` table, columns: `actual_impressions`, `actual_likes`, `actual_retweets`, `actual_engagement_rate`

### "Where does the dashboard get data?"
→ Reads from `content_metadata` table

### "How often are metrics updated?"
→ Every 10 minutes via `metricsScraperJob`

### "Where is generation metadata?"
→ `content_metadata` table, columns: `raw_topic`, `angle`, `tone`, `generator_name`, `format_strategy`

### "How do I link a tweet to its metrics?"
→ Use `decision_id` (UUID) or `tweet_id` (Twitter's ID)

### "What tables should I read for learning?"
→ `learning_posts` (simple metrics), `outcomes` (detailed metrics), `content_metadata` (generation + performance)

---

## 🔗 Related Files

**Core Code:**
- Content Generation: `src/jobs/planJob.ts`
- Posting: `src/jobs/postingQueue.ts`
- Metrics Scraping: `src/jobs/metricsScraperJob.ts`
- Dashboard: `src/dashboard/comprehensiveDashboard.ts`

**Database:**
- Main Migration: `supabase/migrations/20251001_comprehensive_autonomous_system.sql`
- Schema Docs: `docs/DATABASE_REFERENCE.md` (this file)

**Learning:**
- Bandit System: `src/learn/bandit.ts`
- AI Learning: `src/intelligence/realTimeLearningLoop.ts`

---

**For Future AI Assistants:** This file contains the authoritative database schema. Always check here first before writing database code. If you find outdated info, update this file and note the date.

