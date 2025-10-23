# Database Schema - Single Source of Truth

**Last Updated:** 2025-10-23  
**Purpose:** This document defines the authoritative database schema for xBOT system.

---

## 🎯 **How to Prevent Schema Issues**

### **Before Writing Code:**
1. **Check this document first** - see what columns exist
2. **Use the schema validator** - validates on startup
3. **Generate TypeScript types** - run `npm run generate:types`

### **When Adding New Columns:**
1. Update migration file in `supabase/migrations/`
2. Apply migration: `supabase db push --password "..."`
3. Update `EXPECTED_SCHEMA` in `src/db/schemaValidator.ts`
4. Regenerate types: `npm run generate:types`
5. Test locally before deploying

### **When Code Breaks:**
```bash
# Run schema validation
npm run validate:schema

# See detailed report
npm run schema:report
```

---

## 📋 **Core Tables**

### **1. content_metadata**
Queue of content waiting to be posted.

| Column | Type | Description |
|--------|------|-------------|
| `id` | bigint | Primary key |
| `decision_id` | text | Unique decision identifier (UUID) |
| `content` | text | The actual tweet content |
| `content_hash` | text | SHA-256 hash for duplicate detection |
| `content_type` | text | 'single', 'reply', 'thread' |
| `topic_cluster` | text | Topic category (e.g., 'longevity', 'mental_health') |
| `generator_used` | text | Which generator created it |
| `hook_pattern` | text | Hook type used |
| `posted_at` | timestamptz | When it was posted (null if not yet posted) |
| `scheduled_at` | timestamptz | When it should be posted |
| `status` | text | 'planned', 'queued', 'posted', 'failed', 'skipped' |
| `metadata` | jsonb | Additional data |
| `target_username` | text | For replies - target account |
| `target_tweet_id` | text | For replies - target tweet |
| `target_tweet_content` | text | For replies - what we're replying to |
| `created_at` | timestamptz | When content was generated |
| `updated_at` | timestamptz | Last update time |

**Indexes:**
- `idx_content_metadata_decision_id` on `decision_id`
- `idx_content_metadata_status` on `status`
- `idx_content_metadata_scheduled_at` on `scheduled_at`

---

### **2. posted_decisions**
Archive of successfully posted tweets.

| Column | Type | Description |
|--------|------|-------------|
| `id` | bigint | Primary key |
| `decision_id` | text | Links to content_metadata.decision_id |
| `tweet_id` | text | Twitter's tweet ID (from API response) |
| `content` | text | The posted tweet content |
| `decision_type` | text | 'content', 'reply', 'thread' |
| `topic_cluster` | text | Topic category |
| `target_tweet_id` | text | For replies |
| `target_username` | text | For replies |
| `bandit_arm` | text | A/B testing arm |
| `timing_arm` | text | Timing experiment arm |
| `predicted_er` | numeric | Predicted engagement rate |
| `quality_score` | numeric | Quality score (0-1) |
| `posted_at` | timestamptz | When it was posted |
| `created_at` | timestamptz | When decision was created |
| `generation_source` | text | 'real' (AI) or 'synthetic' (fallback) |

**Indexes:**
- `idx_posted_decisions_tweet_id` on `tweet_id`
- `idx_posted_decisions_decision_id` on `decision_id`
- `idx_posted_decisions_posted_at` on `posted_at DESC`

---

### **3. outcomes**
Performance metrics for posted tweets (scraped from Twitter).

| Column | Type | Description |
|--------|------|-------------|
| `id` | bigint | Primary key |
| `decision_id` | text | Links to posted_decisions.decision_id (FK) |
| `tweet_id` | text | Twitter tweet ID |
| `likes` | integer | Number of likes |
| `retweets` | integer | Number of retweets |
| `replies` | integer | Number of replies |
| `bookmarks` | integer | Number of bookmarks |
| `quotes` | integer | Number of quote tweets |
| `impressions` | integer | Total impressions |
| `views` | integer | Video views (if applicable) |
| `profile_clicks` | integer | Profile clicks from tweet |
| `engagement_rate` | numeric | Calculated engagement rate |
| `followers_gained` | integer | Followers gained from this tweet |
| `followers_before` | integer | Follower count before posting |
| `followers_after` | integer | Follower count after posting |
| `collected_at` | timestamptz | When metrics were scraped |
| `collected_pass` | integer | 0=placeholder, 1=T+1h, 2=T+24h |
| `data_source` | text | 'scraped', 'api', 'estimated' |
| `simulated` | boolean | Whether this is simulated data |
| `created_at` | timestamptz | Row creation time |

**Indexes:**
- `idx_outcomes_decision_id` on `decision_id`
- `idx_outcomes_tweet_id` on `tweet_id`
- `idx_outcomes_collected_pass` on `collected_pass, decision_id`

**Foreign Key:**
- `outcomes.decision_id` → `posted_decisions.decision_id` (CASCADE)

---

### **4. reply_opportunities**
Scraped tweets that the system can reply to.

| Column | Type | Description |
|--------|------|-------------|
| `id` | bigint | Primary key |
| `target_username` | text | Account that posted the tweet |
| `target_tweet_id` | text | Tweet ID to reply to (UNIQUE) |
| `target_tweet_content` | text | What the tweet says |
| `tweet_posted_at` | timestamptz | When the original tweet was posted |
| `opportunity_score` | numeric | How good of an opportunity (0-1) |
| `engagement_potential` | numeric | Estimated engagement |
| `follower_count` | integer | Target account's follower count |
| `relevance_score` | numeric | How relevant to our niche |
| `status` | text | 'discovered', 'replied', 'skipped' |
| `created_at` | timestamptz | When we discovered it |
| `updated_at` | timestamptz | Last update |

**Indexes:**
- `idx_reply_opportunities_target_tweet_id` on `target_tweet_id`
- `idx_reply_opportunities_status` on `status`
- `idx_reply_opportunities_created_at` on `created_at DESC`

---

### **5. discovered_accounts**
Pool of health/wellness accounts to interact with.

| Column | Type | Description |
|--------|------|-------------|
| `id` | bigint | Primary key |
| `username` | text | Twitter @username (UNIQUE) |
| `follower_count` | integer | Number of followers |
| `following_count` | integer | Number following |
| `tweet_count` | integer | Total tweets |
| `bio` | text | Account bio |
| `verified` | boolean | Is verified |
| `profile_url` | text | Profile URL |
| `discovery_source` | text | How we found them |
| `relevance_score` | numeric | How relevant to our niche |
| `engagement_rate` | numeric | Their avg engagement rate |
| `last_tweet_at` | timestamptz | When they last tweeted |
| `status` | text | 'active', 'inactive', 'blocked' |
| `created_at` | timestamptz | When we discovered them |
| `updated_at` | timestamptz | Last update |

**Indexes:**
- `idx_discovered_accounts_username` on `username`
- `idx_discovered_accounts_relevance_score` on `relevance_score DESC`
- `idx_discovered_accounts_status` on `status`

---

### **6. content_violations**
Tracks content that failed quality gates (for learning).

| Column | Type | Description |
|--------|------|-------------|
| `id` | bigint | Primary key |
| `generator_name` | text | Which generator failed |
| `topic` | text | Topic it was trying to write about |
| `format` | text | 'single', 'thread', 'reply' |
| `violation_type` | text | What rule it violated |
| `severity` | text | 'low', 'medium', 'high' |
| `detected_phrase` | text | Specific phrase that triggered |
| `context_snippet` | text | Surrounding context |
| `content_preview` | text | First 100 chars |
| `full_content` | text | Complete content |
| `specificity_score` | integer | How specific it was |
| `specificity_matches` | text | What specifics it had |
| `action_taken` | text | What happened next |
| `retry_succeeded` | boolean | Did retry work? |
| `metadata` | jsonb | Additional data |
| `created_at` | timestamptz | When violation occurred |

**Indexes:**
- `idx_content_violations_generator_name` on `generator_name`
- `idx_content_violations_violation_type` on `violation_type`
- `idx_content_violations_created_at` on `created_at DESC`

---

### **7. post_attribution**
Tracks which strategies lead to follower growth.

| Column | Type | Description |
|--------|------|-------------|
| `id` | bigint | Primary key |
| `post_id` | text | Tweet ID |
| `posted_at` | timestamptz | When posted |
| `topic` | text | Topic |
| `hook_pattern` | text | Hook type |
| `generator` | text | Generator used |
| `content_type` | text | 'single', 'thread', 'reply' |
| `engagement_rate` | numeric | Final engagement rate |
| `impressions` | integer | Total impressions |
| `followers_gained` | integer | Followers gained |
| `metadata` | jsonb | Additional data |

**Indexes:**
- `idx_post_attribution_post_id` on `post_id`
- `idx_post_attribution_followers_gained` on `followers_gained DESC`

---

## 👁️ **Views**

### **content_with_outcomes**
Convenience view joining posted_decisions with outcomes.

**Columns:** All columns from `posted_decisions` + all columns from `outcomes`

**Key Aliases:**
- `decision_created_at` = `posted_decisions.created_at`

**Usage:**
```typescript
const { data } = await supabase
  .from('content_with_outcomes')
  .select('*')
  .order('posted_at', { ascending: false });
```

---

## 🔧 **Schema Validation**

### **Automatic Validation on Startup**

The system now validates schema on every startup:

```typescript
// src/main.ts
import { validateDatabaseSchema } from './db/schemaValidator';

const result = await validateDatabaseSchema();
if (!result.valid) {
  // System exits with detailed error
  process.exit(1);
}
```

### **Manual Validation**

```bash
# Validate schema
npm run validate:schema

# Generate detailed report
npm run schema:report

# Generate TypeScript types
npm run generate:types
```

---

## 🚨 **Common Issues**

### **"Column X does not exist"**

**Cause:** Code expects column that doesn't exist in database.

**Fix:**
1. Check this document for correct column name
2. If column truly missing, create migration
3. Update `EXPECTED_SCHEMA` in `src/db/schemaValidator.ts`

### **"Table Y does not exist"**

**Cause:** Migration not applied.

**Fix:**
```bash
supabase db push --password "..."
```

### **"Cannot read property Z of undefined"**

**Cause:** Column nullable but code doesn't handle null.

**Fix:**
```typescript
const value = row.column_name || 'default';
// or
const value = row.column_name ?? null;
```

---

## 📝 **Migration Workflow**

### **Adding New Column:**

1. **Create migration:**
```sql
-- supabase/migrations/20250125000005_add_new_column.sql
ALTER TABLE table_name 
ADD COLUMN new_column_name TEXT;
```

2. **Apply migration:**
```bash
supabase db push --password "Christophernolanfan123!!"
```

3. **Update validator:**
```typescript
// src/db/schemaValidator.ts
export const EXPECTED_SCHEMA = {
  table_name: [
    // ... existing columns
    'new_column_name'
  ]
};
```

4. **Regenerate types:**
```bash
npm run generate:types
```

5. **Test locally, then deploy:**
```bash
git add .
git commit -m "Add new_column_name to table_name"
git push origin main
```

---

## ✅ **Best Practices**

1. **Always validate locally before deploying**
2. **Never hardcode column names** - use typed interfaces
3. **Check nullable columns** - handle null/undefined
4. **Use views for complex joins** - don't repeat JOIN logic
5. **Update this document** when schema changes
6. **Run type generation** after schema changes
7. **Test with actual database** not just TypeScript types

---

## 🔗 **Related Files**

- **Schema Validator:** `src/db/schemaValidator.ts`
- **Type Generator:** `scripts/generateDatabaseTypes.ts`
- **Generated Types:** `src/types/database.ts`
- **Migrations:** `supabase/migrations/`
- **Supabase Client:** `src/lib/supabaseClient.ts`

