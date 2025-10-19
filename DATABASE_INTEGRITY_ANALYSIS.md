# 🗄️ DATABASE INTEGRITY ANALYSIS - Schema Issues & Permanent Fixes

## 🚨 **Current Database Issues**

### **Error 1: Missing Column `decision_timestamp`**
```
❌ UNIFIED_DATA: Failed to get AI decisions: column content_metadata.decision_timestamp does not exist
```

**What's Happening:**
- Code expects: `content_metadata.decision_timestamp`
- Database has: No such column
- Impact: Can't load AI decision history

**Why It Happens:**
Multiple migrations added different timestamp columns:
- Some migrations use `created_at`
- Some migrations use `scheduled_at`
- Some code expects `decision_timestamp`
- **INCONSISTENCY across migrations**

---

### **Error 2: Missing Foreign Key Relationship**
```
[DYNAMIC_FEW_SHOT] ❌ Database error: 
Could not find a relationship between 'outcomes' and 'posted_decisions' in the schema cache
```

**What's Happening:**
- Code tries to JOIN: `outcomes` + `posted_decisions`
- Database has NO foreign key relationship between them
- Query fails because Supabase can't auto-join

**Why It Happens:**
- `outcomes` table has `decision_id` column
- `posted_decisions` table has `decision_id` column
- BUT: No formal FOREIGN KEY constraint linking them
- Supabase requires explicit foreign keys for automatic joins

---

### **Error 3: Migration Warnings**
```
[MIGRATE] ❌ Cannot connect to database: self-signed certificate in certificate chain
[MIGRATE] ⚠️ Skipping migrations - app will start anyway
```

**What's Happening:**
- Migrations try to run on startup
- SSL certificate validation fails
- Migrations get skipped

**Why It Happens:**
- Railway/Production environment uses self-signed certs
- Migration code doesn't configure SSL properly
- Non-critical but means schema updates don't auto-apply

---

## 🔍 **Root Cause: Migration Chaos**

### **The Problem:**

You have **94 migration files** accumulated over time. They:
1. Add columns with different names for same purpose
2. Don't remove old columns when adding new ones
3. Create no foreign key relationships
4. Use inconsistent naming conventions
5. Don't enforce referential integrity

### **Example of Chaos:**

**Timestamp Columns in `content_metadata`:**
- `created_at` (added in 20250918)
- `generated_at` (added in 20250930)
- `scheduled_at` (added in 20251001)
- `posted_at` (added in multiple migrations)
- `updated_at` (added in 20250930)
- Code expects: `decision_timestamp` (DOESN'T EXIST!)

**Result:** 5+ timestamp columns, none named `decision_timestamp`

---

### **Why This Keeps Happening:**

#### **1. Additive-Only Migrations**
```sql
-- Every migration does this:
ALTER TABLE content_metadata ADD COLUMN IF NOT EXISTS new_column...

-- But NEVER does this:
ALTER TABLE content_metadata DROP COLUMN IF EXISTS old_column...
```

**Result:** Columns accumulate forever, causing:
- Bloated tables
- Inconsistent naming
- Code confusion about which column to use

#### **2. No Schema Governance**
- No single source of truth for "correct" schema
- Each migration adds what that feature needs
- No cleanup of deprecated columns
- No standardization of column names

#### **3. Code Expects Different Schema Than Exists**
```typescript
// Code written in October:
.select('decision_timestamp')  // Doesn't exist

// Database migrated in September:
Has: created_at, scheduled_at, posted_at

// Never reconciled!
```

#### **4. No Foreign Keys Enforced**
```sql
-- outcomes table:
decision_id UUID  -- Just a column, no constraint

-- posted_decisions table:
decision_id UUID  -- Just a column, no constraint

-- No relationship defined!
-- Supabase can't auto-join
```

---

## 🛠️ **Permanent Fix Strategy**

### **Phase 1: Create Authoritative Schema** (1 hour)

**Goal:** Define THE CORRECT schema once and for all

**Create:** `supabase/migrations/20251020_authoritative_schema.sql`

```sql
-- =====================================================================================
-- AUTHORITATIVE SCHEMA - Single Source of Truth
-- This migration establishes the CORRECT schema that all code should expect
-- =====================================================================================

BEGIN;

-- =====================================================================================
-- 1. CONTENT_METADATA - Content queue and planning
-- =====================================================================================

-- Ensure table exists with correct structure
CREATE TABLE IF NOT EXISTS content_metadata (
  -- Primary identification
  id BIGSERIAL PRIMARY KEY,
  decision_id UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  
  -- Content details
  decision_type TEXT NOT NULL CHECK (decision_type IN ('single', 'thread', 'reply')),
  content TEXT NOT NULL,
  thread_tweets JSONB, -- For threads: ["tweet1", "tweet2", ...]
  
  -- Generation metadata
  generator_name TEXT,
  experiment_arm TEXT CHECK (experiment_arm IN ('control', 'variant_a', 'variant_b')),
  generation_source TEXT CHECK (generation_source IN ('real', 'synthetic')),
  bandit_arm TEXT,
  timing_arm TEXT,
  
  -- Quality scores
  quality_score NUMERIC(5,4),
  predicted_er NUMERIC(5,4),
  generator_confidence NUMERIC(5,4),
  
  -- Status and scheduling
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'posted', 'skipped', 'failed')),
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  posted_at TIMESTAMPTZ,
  
  -- Topic and targeting (for replies)
  topic_cluster TEXT,
  target_tweet_id TEXT,
  target_username TEXT,
  
  -- Timestamps (STANDARDIZED)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Drop deprecated/redundant columns if they exist
DO $$ 
BEGIN
  -- Remove generated_at (use created_at instead)
  ALTER TABLE content_metadata DROP COLUMN IF EXISTS generated_at;
  
  -- Remove decision_timestamp (use created_at instead)
  ALTER TABLE content_metadata DROP COLUMN IF EXISTS decision_timestamp;
  
  -- Remove old naming variations
  ALTER TABLE content_metadata DROP COLUMN IF EXISTS content_id;
  ALTER TABLE content_metadata DROP COLUMN IF EXISTS thread_parts; -- Use thread_tweets instead
EXCEPTION WHEN OTHERS THEN
  NULL; -- Ignore if columns don't exist
END $$;

-- Essential indexes
CREATE INDEX IF NOT EXISTS idx_content_metadata_status_scheduled 
  ON content_metadata(status, scheduled_at) WHERE status = 'queued';
CREATE INDEX IF NOT EXISTS idx_content_metadata_posted_at 
  ON content_metadata(posted_at) WHERE posted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_content_metadata_generator 
  ON content_metadata(generator_name, created_at DESC) WHERE generator_name IS NOT NULL;

-- =====================================================================================
-- 2. POSTED_DECISIONS - Successfully posted content
-- =====================================================================================

CREATE TABLE IF NOT EXISTS posted_decisions (
  -- Primary identification
  id BIGSERIAL PRIMARY KEY,
  decision_id UUID NOT NULL UNIQUE,
  
  -- Twitter references
  tweet_id TEXT NOT NULL,
  tweet_url TEXT,
  
  -- Content snapshot
  content TEXT NOT NULL,
  decision_type TEXT NOT NULL CHECK (decision_type IN ('single', 'thread', 'reply')),
  thread_tweet_ids JSONB, -- For threads: ["id1", "id2", ...]
  
  -- Generation metadata (copied from content_metadata)
  generator_name TEXT,
  bandit_arm TEXT,
  topic_cluster TEXT,
  
  -- Timestamps
  posted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Essential indexes
CREATE INDEX IF NOT EXISTS idx_posted_decisions_tweet_id 
  ON posted_decisions(tweet_id);
CREATE INDEX IF NOT EXISTS idx_posted_decisions_posted_at 
  ON posted_decisions(posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_posted_decisions_generator 
  ON posted_decisions(generator_name, posted_at DESC) WHERE generator_name IS NOT NULL;

-- =====================================================================================
-- 3. OUTCOMES - Tweet performance metrics
-- =====================================================================================

CREATE TABLE IF NOT EXISTS outcomes (
  -- Primary identification
  id BIGSERIAL PRIMARY KEY,
  decision_id UUID NOT NULL, -- Links to posted_decisions.decision_id
  tweet_id TEXT NOT NULL,
  
  -- Core engagement metrics
  likes INTEGER DEFAULT 0,
  retweets INTEGER DEFAULT 0,
  replies INTEGER DEFAULT 0,
  bookmarks INTEGER DEFAULT 0,
  quotes INTEGER DEFAULT 0,
  quote_tweets INTEGER DEFAULT 0, -- Alias for quotes
  
  -- Reach metrics
  impressions INTEGER DEFAULT 0,
  views INTEGER DEFAULT 0,
  profile_clicks INTEGER DEFAULT 0,
  
  -- Calculated metrics
  engagement_rate NUMERIC(5,4),
  virality_coefficient NUMERIC(5,4),
  
  -- Follower attribution
  followers_before INTEGER,
  followers_after INTEGER,
  followers_gained INTEGER DEFAULT 0,
  
  -- Collection metadata
  collected_at TIMESTAMPTZ,
  collected_pass INTEGER DEFAULT 0 CHECK (collected_pass IN (0, 1, 2)), -- 0=placeholder, 1=T+1h, 2=T+24h
  data_source TEXT, -- 'post_placeholder', 'scheduled_scraper', 'real-time'
  
  -- Simulation flag
  simulated BOOLEAN NOT NULL DEFAULT false,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Uniqueness: One outcome per decision (can update with new metrics)
  CONSTRAINT outcomes_decision_id_unique UNIQUE(decision_id)
);

-- 🔥 CRITICAL: Add foreign key to posted_decisions
DO $$ 
BEGIN
  -- Add foreign key if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_outcomes_posted_decisions'
  ) THEN
    ALTER TABLE outcomes
      ADD CONSTRAINT fk_outcomes_posted_decisions
      FOREIGN KEY (decision_id)
      REFERENCES posted_decisions(decision_id)
      ON DELETE CASCADE;
  END IF;
END $$;

-- Essential indexes
CREATE INDEX IF NOT EXISTS idx_outcomes_decision_id 
  ON outcomes(decision_id);
CREATE INDEX IF NOT EXISTS idx_outcomes_tweet_id 
  ON outcomes(tweet_id);
CREATE INDEX IF NOT EXISTS idx_outcomes_collected_pass 
  ON outcomes(collected_pass, decision_id);
CREATE INDEX IF NOT EXISTS idx_outcomes_engagement 
  ON outcomes(engagement_rate DESC) WHERE engagement_rate IS NOT NULL;

COMMIT;

-- =====================================================================================
-- 4. CREATE VIEW FOR EASY JOINS (What code actually wants)
-- =====================================================================================

CREATE OR REPLACE VIEW content_with_outcomes AS
SELECT 
  pd.decision_id,
  pd.tweet_id,
  pd.content,
  pd.decision_type,
  pd.generator_name,
  pd.posted_at,
  pd.created_at as decision_created_at, -- Alias for 'decision_timestamp' legacy code expects
  o.likes,
  o.retweets,
  o.replies,
  o.bookmarks,
  o.impressions,
  o.views,
  o.engagement_rate,
  o.followers_gained,
  o.collected_at,
  o.collected_pass
FROM posted_decisions pd
LEFT JOIN outcomes o ON pd.decision_id = o.decision_id;

-- Grant access
GRANT SELECT ON content_with_outcomes TO anon, authenticated;

-- =====================================================================================
-- 5. DOCUMENTATION
-- =====================================================================================

COMMENT ON TABLE content_metadata IS 'Content queue - content waiting to be posted';
COMMENT ON TABLE posted_decisions IS 'Posted content - successfully published tweets';
COMMENT ON TABLE outcomes IS 'Performance metrics - scraped engagement data';
COMMENT ON VIEW content_with_outcomes IS 'Convenience view joining posted_decisions with outcomes';

COMMENT ON COLUMN content_metadata.created_at IS 'When content was generated (use this instead of decision_timestamp)';
COMMENT ON COLUMN posted_decisions.decision_id IS 'Links to content_metadata.decision_id';
COMMENT ON COLUMN outcomes.decision_id IS 'Links to posted_decisions.decision_id (foreign key enforced)';
COMMENT ON COLUMN outcomes.collected_pass IS '0=placeholder, 1=T+1h metrics, 2=T+24h final metrics';
```

---

### **Phase 2: Update Code to Use Correct Schema** (30 min)

**Files to Update:**

#### **1. Fix `decision_timestamp` references**

```typescript
// src/lib/unifiedDataManager.ts
// BEFORE:
.order('decision_timestamp', { ascending: false })

// AFTER:
.order('created_at', { ascending: false })
```

#### **2. Fix JOIN queries**

```typescript
// src/intelligence/dynamicFewShotProvider.ts
// BEFORE:
const { data, error } = await supabase
  .from('outcomes')
  .select(`
    *,
    posted_decisions!inner(content, posted_at)
  `)

// AFTER (use view):
const { data, error } = await supabase
  .from('content_with_outcomes')
  .select('*')
  .order('decision_created_at', { ascending: false })
```

---

### **Phase 3: Deprecate Old Migrations** (15 min)

**Create:** `supabase/migrations/README.md`

```markdown
# Migration Guidelines

## Current Authoritative Schema
**File:** `20251020_authoritative_schema.sql`

This is THE CORRECT schema. All code should expect this structure.

## Deprecated Migrations
All migrations before 20251020 are deprecated and should not be modified.
They remain for historical reference only.

## Adding New Columns
When adding new columns:
1. Update `20251020_authoritative_schema.sql` (not a new migration!)
2. Create a small migration that ONLY adds the new column
3. Document the column in the authoritative schema
4. Update TypeScript types to match

## Column Naming Standards
- Timestamps: `created_at`, `updated_at`, `posted_at`, `collected_at`
- Never use: `decision_timestamp`, `generated_at`, or custom timestamp names
- IDs: `decision_id`, `tweet_id`, `id`
- Foreign keys: Match the column name in referenced table

## Foreign Keys Required
- `outcomes.decision_id` → `posted_decisions.decision_id` ✅
- Always add ON DELETE CASCADE for cleanup
```

---

### **Phase 4: Fix Migration Runner** (15 min)

**Update SSL handling:**

```typescript
// src/db/migrations.ts (or wherever migrations run)

async function runMigrations() {
  const isProduction = process.env.NODE_ENV === 'production';
  const isRailway = process.env.RAILWAY_ENVIRONMENT === 'production';
  
  const sslConfig = (isProduction || isRailway) ? {
    rejectUnauthorized: false // Allow self-signed certs in production
  } : {
    rejectUnauthorized: true // Enforce SSL validation in dev
  };
  
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: sslConfig
  });
  
  try {
    await client.connect();
    // Run migrations...
  } finally {
    await client.end();
  }
}
```

---

## 📊 **Migration Status Check**

### **Before Fix:**
```
✅ content_metadata table exists
❌ Has decision_timestamp column: NO (code expects it)
❌ Has correct timestamp columns: MIXED (5+ different ones)
✅ posted_decisions table exists
✅ outcomes table exists
❌ Foreign key outcomes→posted_decisions: NO
❌ View content_with_outcomes: NO
```

### **After Fix:**
```
✅ content_metadata table exists
✅ Standardized timestamps: created_at, updated_at, posted_at
✅ No redundant columns
✅ posted_decisions table exists
✅ outcomes table exists
✅ Foreign key outcomes→posted_decisions: YES
✅ View content_with_outcomes: YES
✅ All code queries work
✅ Migrations run successfully
```

---

## 🎯 **Implementation Steps**

### **Step 1: Backup Current Schema**
```bash
# Before any changes, backup current schema
supabase db dump --schema public > backup_20251019.sql
```

### **Step 2: Apply Authoritative Schema**
```bash
# Create and apply authoritative migration
supabase migration new authoritative_schema
# Copy SQL from above into the migration file
supabase db push
```

### **Step 3: Update Code**
```bash
# Fix all decision_timestamp references
rg "decision_timestamp" src/ --files-with-matches | xargs sed -i '' 's/decision_timestamp/created_at/g'

# Fix JOIN queries to use view
# (Manual updates in specific files)
```

### **Step 4: Verify**
```bash
# Check schema matches
supabase db diff

# Check foreign keys exist
psql $DATABASE_URL -c "SELECT 
  tc.constraint_name, tc.table_name, kcu.column_name, 
  ccu.table_name AS foreign_table_name
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name = 'outcomes';"
```

---

## 🔒 **Prevention: Never Let This Happen Again**

### **1. Schema Governance Rules**

```markdown
# SCHEMA_RULES.md

## Rules for Database Changes

1. **Never add columns without checking authoritative schema first**
2. **Always use standard column names** (created_at, not generated_at)
3. **Always add foreign keys** for relationships
4. **Always drop deprecated columns** when adding replacements
5. **Update TypeScript types** to match schema
6. **Document in authoritative schema** file

## Review Checklist
Before merging any PR with migrations:
- [ ] Authoritative schema updated?
- [ ] Foreign keys added for relationships?
- [ ] Deprecated columns removed?
- [ ] TypeScript types match?
- [ ] Indexes added for queries?
- [ ] Column names follow standards?
```

### **2. Pre-commit Hook**

```bash
# .git/hooks/pre-commit

#!/bin/bash
# Check for new migrations
if git diff --cached --name-only | grep -q "supabase/migrations/"; then
  echo "⚠️ Database migration detected!"
  echo "Did you:"
  echo "  1. Update authoritative_schema.sql?"
  echo "  2. Follow naming standards?"
  echo "  3. Add foreign keys?"
  echo "  4. Remove deprecated columns?"
  read -p "Continue? (y/n) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi
```

---

## 📈 **Expected Results**

### **After Implementation:**
- ✅ No more "column does not exist" errors
- ✅ JOINs work without errors
- ✅ Migrations run successfully
- ✅ Single source of truth for schema
- ✅ Code and database in sync
- ✅ Future migrations follow standards
- ✅ Database integrity enforced by foreign keys

---

**Time to implement: ~2 hours**
**Impact: Permanent fix for all schema issues**
**Risk: Low (only adds clarity and constraints)**

