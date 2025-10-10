# 🚀 Snap2Health Autonomous X-Bot

> **Mission:** Build a self-running Twitter/X account that feels like a fusion of  
> **Andrew Huberman + Peter Attia + Marc Andreessen + Sam Altman + David Sinclair + Gary Brecka**, with **Duncan Trussell's humor**.  
> It educates on AI-driven health, riffs on deep-tech startups, cracks witty one-liners, and (softly) funnels traffic to **Snap2Health**.

## 🛠️ New Content & Posting Pipeline (v2.0)

This bot now features a **bulletproof posting system** with quality gates, thread completion, and real tweet ID extraction.

### Key Features:
- ✅ **JSON-first content generation** (no more Markdown artifacts)
- ✅ **85/100 quality gate** (completeness, value, evidence, actionability)
- ✅ **Real thread posting** with proper reply chains
- ✅ **Deduplication** prevents posting similar content within 7 days
- ✅ **Rate limiting** respects minimum hours between posts
- ✅ **Bulletproof Playwright** extracts real tweet IDs from CreateTweet responses

## 🛡️ DB SSL/Migrations

### SSL Configuration

The system uses **canonical TLS hardening** for all database connections:

- **CA Certificates:** Docker images include `ca-certificates` in both build and runtime stages to prevent TLS errors
- **Canonical SSL:** All PostgreSQL clients use `src/db/pgClient.ts` with centralized SSL configuration
- **Supabase Pooler:** If `DATABASE_URL` contains `?sslmode=require`, SSL is configured with `{ require: true, rejectUnauthorized: false }`
- **Single Source:** All database code paths use the same SSL options via `makePgPool()`

### Migrations

**CANONICAL MIGRATION RUNNER:** Only `tools/db/migrate.js` applies migrations.

#### Manual Migrations (Recommended for Production)
```bash
# Test database connection
npm run db:ping

# Run migrations manually
npm run db:migrate
```

#### Runtime Migrations (Disabled by Default)
Set `MIGRATIONS_RUNTIME_ENABLED="true"` to run migrations automatically at boot.

**Default behavior:** `MIGRATIONS_RUNTIME_ENABLED="false"` (prevents crash loops)

```bash
# Expected logs with MIGRATIONS_RUNTIME_ENABLED="false":
runtime migrations disabled

# Expected logs with manual migration run:
Found 3 migration files
DB connect -> host=aws-0-us-east-1.pooler.supabase.com port=6543 ssl=no-verify
→ Applying 001_initial.sql ... OK
→ Applying 002_features.sql ... OK
→ Applying 003_learning.sql ... OK
✅ All migrations applied
```

⚠️ **Production Safety:** Keep `MIGRATIONS_RUNTIME_ENABLED="false"` to avoid boot-time failures. Use `npm run db:migrate` in CI/CD or manually.

**One Migration Entry Point:** All other migration runners are neutralized to prevent conflicts.

### Startup Acceptance Smoke

Production boot includes optional acceptance smoke tests:

- **Default:** `STARTUP_ACCEPTANCE_ENABLED="false"` (disabled for fast boot)
- **When enabled:** Scripts are compiled to `dist/scripts` and run with `node` (no ts-node)
- **Non-blocking:** Test failures are logged but don't prevent app startup
- **Scripts tested:** `jobs-learn.js`, `dryrun-plan.js`, `dryrun-reply.js`

```bash
# Enable acceptance smoke at boot (optional)
STARTUP_ACCEPTANCE_ENABLED="true"

# Expected logs when disabled:
🧪 Acceptance smoke: skipped (STARTUP_ACCEPTANCE_ENABLED=false)

# Expected logs when enabled:
🧪 Running acceptance smoke (posting OFF)...
→ Testing learning job...
→ Testing plan dryrun...
→ Testing reply dryrun...
✅ Acceptance smoke completed (failures are non-blocking)
```

## 🚀 Quick Start

### Development
```bash
# Install dependencies
npm install

# Set up environment (copy env.example to .env and fill in values)
cp env.example .env

# Run dry test
npm run e2e:dry "Sleep optimization for night owls"

# Build and start
npm run build
npm start
```

### Production (Railway)

#### 1. Environment Variables
Set these in Railway dashboard:
```bash
# Core
OPENAI_API_KEY=sk-your-key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-key
TWITTER_SESSION_B64=your-session-cookies

# Safety controls (start with these)
ENABLE_THREADS=false
FORCE_POST=false
MIN_HOURS_BETWEEN_POSTS=2

# Quality controls
QUALITY_MIN_SCORE=85
ALLOW_HASHTAGS=false

# AI settings
OPENAI_MODEL=gpt-4o-mini
OPENAI_TEMPERATURE=0.4
```

#### 2. Database Setup
Migrations run automatically on deployment! The system will apply:
- `migrations/20250115_content_posting_pipeline_v2.sql`
- Enhanced `learning_posts` table with quality tracking
- New `posted_tweets` and `posted_threads` tables

#### 3. Deploy & Test
```bash
# Deploy code
git push origin main

# Test content generation (dry run)
npm run e2e:dry "Hydration myths and science"

# Monitor logs
npm run logs
```

#### 4. Enable Threading (after verification)
Once you see logs like `🎯 Extracted tweet ID: 1234567890` and quality scores ≥85:
```bash
# In Railway dashboard:
ENABLE_THREADS=true
```

#### 5. Monitor
Watch for these log patterns:
```
✅ Posted thread successfully: 1234567890
📊 Quality score: 87/100
🧵 Thread posted: root=123 replies=456,789,012
```

## 📋 Ops Checklist

### Initial Setup
- [ ] Set `ENABLE_THREADS=false` initially
- [ ] Set `FORCE_POST=false` 
- [ ] Set `MIN_HOURS_BETWEEN_POSTS=2`
- [ ] Deploy to Railway (migrations run automatically)
- [ ] Test: `npm run e2e:dry "topic"` - should show complete JSON thread

### Verification Phase  
- [ ] Monitor logs for `🎯 Extracted tweet ID: [real-number]` (not `posted_timestamp`)
- [ ] Confirm quality scores ≥ 85/100
- [ ] Check Twitter account manually - tweets should be complete, not cut off
- [ ] Verify no "Failed to extract tweet ID" errors

### Go Live
- [ ] Set `ENABLE_THREADS=true` once tweet ID extraction confirmed
- [ ] Monitor for successful thread completions: `✅ Posted thread successfully`
- [ ] Watch for follower/engagement growth
- [ ] Adjust `MIN_HOURS_BETWEEN_POSTS` based on performance

### Ongoing Monitoring
- [ ] Quality scores staying ≥ 85/100
- [ ] No duplicate content warnings
- [ ] Thread completion rate ~100%
- [ ] Engagement trending upward

## 🧪 Testing

### Dry Run (No Posting)
```bash
# Test content generation and quality gate
npm run e2e:dry "Sleep routine for night owls"
npm run e2e:dry "Nutrition timing for athletes"
npm run e2e:dry "Stress reduction techniques"
```

### Manual Testing
```bash
# Check browser automation (requires logged-in session)
npm run test:session

# Test specific components
npm test
```

## 📊 Content Quality Standards

### Quality Gate Criteria (85/100 minimum):
- **Completeness (40%)**: No ellipses, no teasers, complete thoughts
- **Value (25%)**: Specific numbers, studies, actionable advice  
- **Clarity (15%)**: Easy to understand, no jargon
- **Actionability (10%)**: Clear steps readers can take
- **Evidence (5%)**: Studies, research, credible sources
- **Engagement (5%)**: Questions, personal touches, relatability

### Example High-Quality Thread:
```
Hook: "90% of people think they need 8 hours of sleep. New research shows it's not about duration—it's about timing."

Tweet 1: "Study of 50,000 people found that sleep quality beats quantity. Going to bed at 10 PM with 6.5 hours beats midnight with 8 hours."

Tweet 2: "Your circadian rhythm peaks at specific times. Missing your 'sleep window' by 2 hours reduces recovery by 40%, even with more total sleep."

Tweet 3: "Try this: Track your natural tiredness for 3 days. When do you first feel sleepy? That's your optimal bedtime, regardless of duration."

Tweet 4: "I've been following this for 6 months. Same 6.5 hours, but timing it right increased my HRV by 23% and morning energy by 40%."

Tweet 5: "Quality sleep isn't about the clock—it's about your biology. Work with your rhythm, not against it."
```

## 🔧 Architecture

### New Pipeline Flow:
```
PostingCoordinator
├── generateThread() → JSON thread (5-9 tweets)
├── scoreThread() → Quality gate (≥85/100) 
├── isDuplicateThread() → Deduplication check
├── postThread() → Playwright with real ID extraction
└── storeThreadRecord() → Database tracking
```

### Key Components:
- **ThreadGenerator** (`src/ai/threadGenerator.ts`): JSON-based content generation
- **QualityGate** (`src/quality/qualityGate.ts`): Multi-dimensional scoring
- **PlaywrightPoster** (`src/posting/playwrightPoster.ts`): Bulletproof thread posting
- **PostingCoordinator** (`src/coordinator/postingCoordinator.ts`): Orchestrates entire pipeline

### Database Schema:
- `posted_tweets`: Deduplication tracking with text signatures (auto-created)
- `posted_threads`: Thread metadata and performance tracking (auto-created)
- `learning_posts`: Enhanced with impressions, metadata columns (auto-migrated)

## 🐛 Troubleshooting

### Common Issues:

**"Quality gate failed"**
- Check `QUALITY_MIN_SCORE` (default 85)
- Review failure reasons in logs
- Content may be too generic or incomplete

**"Failed to extract tweet ID"** 
- Session cookies may be expired
- X.com interface may have changed
- Check `TWITTER_SESSION_B64` validity

**"Threading disabled"**
- Set `ENABLE_THREADS=true` after verification
- Check browser posting logs first

**"Content too similar to recent posts"**
- Deduplication is working correctly
- Try different topics or wait 7 days
- Check `posted_tweets` table for signatures

### Debug Commands:
```bash
# Check configuration
npm run logs | grep "🔧 Bot Configuration"

# Monitor quality scores  
npm run logs | grep "Quality Gate"

# Watch thread posting
npm run logs | grep "Posted thread successfully"

# Check for errors
npm run logs | grep "❌"
```

## 📝 Content Strategy

### Viral Topic Categories:
1. **Sleep optimization** - timing, quality, recovery
2. **Nutrition science** - timing, myths, latest research  
3. **Stress reduction** - practical techniques, studies
4. **Exercise timing** - when, why, how much
5. **Cognitive enhancement** - focus, memory, clarity
6. **Longevity research** - cutting-edge findings
7. **Technology & health** - wearables, tracking, AI
8. **Habit formation** - psychology, systems, tracking

### Engagement Patterns:
- **Curiosity gaps**: "90% of people don't know..."
- **Social proof**: "Study of 50,000 people found..."  
- **Personal experience**: "I've been tracking this for..."
- **Contrarian takes**: "Everyone thinks X, but actually Y..."
- **Specific numbers**: "Increased performance by 23%..."

## 🔐 Security & Privacy

- Session cookies stored as base64 environment variables
- No sensitive data logged
- Rate limiting prevents spam/bans
- Deduplication prevents repetitive content
- Quality gates prevent low-value posts

## 📈 Performance Metrics

Track these in Supabase dashboard:
- **Quality scores** (aim for 85-95/100)
- **Thread completion rate** (should be ~100%) 
- **Engagement per post** (likes + retweets + replies)
- **Follower growth rate** (track weekly)
- **Content uniqueness** (no duplicates within 7 days)

---

Built with ❤️ for autonomous, high-quality health content that actually helps people.# Force rebuild Sat Sep  6 16:52:55 EDT 2025
# Force restart Sat Sep  6 17:24:34 EDT 2025
# Session Recovery Fri Oct 10 11:21:31 EDT 2025
