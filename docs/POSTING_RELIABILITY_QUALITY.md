# Posting Reliability & Quality

This document outlines the enhanced posting system with improved reliability, concurrency control, and content quality features.

## 🔒 Database Write Permissions

### Supabase Client Architecture

- **Admin Client** (`admin`): Uses `SUPABASE_SERVICE_ROLE_KEY` for all database writes
- **Anon Client** (`anon`): Uses `SUPABASE_ANON_KEY` for public reads only
- **RLS Enforcement**: Row Level Security blocks anon client writes, admin bypasses

```typescript
import { admin, anon } from '../src/lib/supabaseClients';

// ✅ Admin writes (always works)
await admin.from('tweet_metrics').upsert(data);

// ❌ Anon writes (blocked by RLS)
await anon.from('tweet_metrics').insert(data); // Permission denied
```

### Tables & Columns

- **`tweet_metrics`**: `tweet_id`, `collected_at`, `likes_count`, `retweets_count`, `replies_count`, `bookmarks_count`, `impressions_count`, `content`
- **`learning_posts`**: `tweet_id`, `created_at`, `format`, `likes_count`, `retweets_count`, `replies_count`, `bookmarks_count`, `impressions_count`, `viral_potential_score`, `content`

## 🚫 Race Condition Prevention

### Redis-Based PostLock

```typescript
import { getPostLock } from '../src/infra/postLockInstance';

const lock = getPostLock();
await lock.run('posting_operation', async (corrId) => {
  // Only one posting workflow can run at a time
  // Lock auto-extends with heartbeat every 30s
  // TTL: 8 minutes with stale detection
});
```

### Features

- **Unique Owner ID**: `hostname-pid` prevents conflicts
- **Heartbeat Extension**: Keeps lock alive during long operations  
- **Stale Lock Recovery**: Auto-clears abandoned locks
- **Fast Exit**: Subsequent attempts exit immediately when locked

## 🎭 Playwright Resilience  

### BrowserManager Singleton

```typescript
import { BrowserManager } from '../src/core/BrowserManager';

await BrowserManager.withContext(async (context) => {
  const page = await context.newPage();
  // Auto-recovers from "Target closed" errors
  // Exponential backoff: 1s → 2s → 4s → 8s → 16s
});
```

### Error Recovery

- **Auto-Retry**: One retry on `Target.*closed` errors
- **Context Recreation**: Fresh browser context on failure
- **Session Persistence**: Reloads Twitter session automatically
- **Timeout Handling**: 30s default timeout with graceful degradation

## ⭐ Content Quality System

### Scoring Rubric (0-100 Scale)

| Component | Points | Description |
|-----------|--------|-------------|
| **Hook Clarity** | 25 | Specific, engaging opening with numbers/insights |
| **Big Idea** | 15 | Single clear concept, not scattered |  
| **Actionability** | 20 | Concrete micro-steps, timeframes |
| **Novelty** | 20 | Surprising insights, myth-busting |
| **Readability** | 10 | Short sentences, good formatting |
| **Human Tone** | 10 | Conversational, not lecture-y |

### Quality Gates

- **≥80**: Passes quality gate (will post)
- **70-79**: Auto-revision attempted (shorter sentences, add actions)
- **<70**: Fails quality gate (won't post)

### Safety Checks

- **Medical Claims**: Blocks `cure`, `treat`, `diagnose`, `prescribe`
- **Absolute Statements**: Prevents `always`, `never`, `guaranteed`
- **Harmful Advice**: Filters dangerous health recommendations

## 🧵 Thread Templates

### Available Templates

1. **Mini (3-4 tweets)**: Quick insights with counterintuitive hooks
2. **Deep (6-8 tweets)**: Myth-busting with evidence and framework  
3. **Checklist (5-6 tweets)**: 80/20 prioritized action items

### Hook Patterns

- **Counterintuitive**: "The #1 sleep advice is backwards"
- **Before/After**: "From exhausted to energized in 30 days"
- **Myth vs Fact**: "Sleep myth that's literally backwards"
- **Framework**: "Simple 3-step system for better energy"

## 💬 Context-Aware Replies

### Reply Engine Features

- **Context Analysis**: Extracts specific details to reference
- **Health Relevance**: Only replies to health-related tweets (≥40% relevance)
- **Style Selection**: `short_nudge`, `helpful_pointer`, `mini_framework`, `ask_then_answer`
- **Safety Guardrails**: No medical advice, curious tone

### Contextuality Requirements

- Must reference specific details from original tweet
- ≤220 characters including handles
- 0-1 emojis maximum, no hashtags
- Passes same quality rubric as posts

## 🧪 Testing & Verification

### Test Suites

```bash
npm test                    # Run all tests
npm run test:clients        # Database permission tests
npm run test:lock          # Concurrency control tests  
npm run test:quality       # Content scoring tests
npm run test:reply         # Reply contextuality tests
npm run test:browser       # Playwright resilience tests
```

### Verification Scripts

```bash
npm run verify:schema      # Check database schema & permissions
npm run verify             # Full verification (build + schema + tests)
npm run dryrun:post        # Generate content without posting
```

### Example Dry Run

```bash
npm run dryrun:post --type thread --topic "sleep optimization" --template deep
```

Output:
```
📊 Overall Score: 87/100
✅ Passes Quality Gate: YES (threshold: 80)
🎨 Template Used: deep - Myth-busting deep dive with evidence
```

## 🔧 Environment Variables

### Required for Full Functionality

```bash
# Database
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key

# Redis (for posting locks)
REDIS_URL=redis://localhost:6379
REDIS_PREFIX=prod:

# App Configuration  
APP_ENV=production
LIVE_POSTS=true
MIN_POST_INTERVAL_MINUTES=120
```

### Optional Configuration

```bash
# Playwright
PLAYWRIGHT_HEADLESS=true
PLAYWRIGHT_SLOW_MO=0
SESSION_CANONICAL_PATH=/app/data/twitter_session.json

# Database Fallbacks
DIRECT_DB_URL=postgresql://...
SUPABASE_IPV4_ONLY=true
```

## 📊 Monitoring & Diagnostics

### Health Endpoints

- `GET /status` - Overall system status + posting lock status
- `GET /env` - Environment variable validation
- `GET /playwright` - Browser health check
- `GET /session` - Twitter session validation

### Log Patterns

```bash
# Success Patterns
✅ METRICS_UPSERT_OK {"tweet_id":"123"}
✅ POST_ORCHESTRATOR: Thread posted successfully
🔒 POST_LOCK: Lock acquired for "thread_post"

# Warning Patterns  
⚠️ QUALITY_GATE: Score 76/100, below threshold
⚠️ POST_LOCK: Another post already in progress
⚠️ BROWSER: Context closed, recreating

# Error Patterns
❌ METRICS_UPSERT_FAILED: permission denied
❌ POST_ORCHESTRATOR: Quality gate failed
❌ BROWSER: Failed to create context after 5 attempts
```

## 🚀 Quick Start

1. **Verify Setup**
   ```bash
   npm run verify:schema
   ```

2. **Test Content Generation**
   ```bash
   npm run dryrun:post --type single --topic "morning routine"
   ```

3. **Run Tests**
   ```bash
   npm test
   ```

4. **Deploy with Confidence**
   ```bash
   npm start
   ```

The system will automatically:
- ✅ Apply database migrations
- ✅ Verify schema and permissions  
- ✅ Initialize posting locks
- ✅ Load Twitter session
- ✅ Start posting with quality gates

All operations are idempotent and safe to run multiple times.
