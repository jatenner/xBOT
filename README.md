# 🚀 Snap2Health Autonomous X-Bot

> **Mission:** Build a self-running Twitter/X account that feels like a fusion of  
> **Andrew Huberman + Peter Attia + Marc Andreessen + Sam Altman + David Sinclair + Gary Brecka**, with **Duncan Trussell's humor**.  
> It educates on AI-driven health, riffs on deep-tech startups, cracks witty one-liners, and (softly) funnels traffic to **Snap2Health**.

## 0. Outcome
A strategic growth engine that tweets, replies, learns and iterates 24/7 with *zero* daily babysitting.

## 1. KPIs

| Objective | 7-day Target |
|-----------|--------------|
| Originals posted | ≥ 21 |
| High-reach replies | ≥ 35 |
| Avg. engagement score↑ | Week-over-week |
| Snap2Health CTA | 1 in 6 tweets |
| Scheduler uptime | ≥ 99 % |

`eng_score = likes + 2·retweets + 3·replies`

## 2. Architecture

```
StrategistAgent ─► (decides Post / Reply / Sleep)
│
├─► PostTweetAgent (orig. content)
├─► ReplyAgent (opportunistic replies)
└─► LearnAgent (engagement feedback)
```

Shared helpers: **xClient**, **openaiClient**, **supabaseClient**.

## 3. Folder Layout
```
src/
  agents/
    strategistAgent.ts
    postTweet.ts
    replyAgent.ts
    learnAgent.ts
    scheduler.ts
  utils/
    xClient.ts
    openaiClient.ts
    supabaseClient.ts
    formatTweet.ts
  prompts/
    tweetPrompt.txt
    replyPrompt.txt
supabase/schema.sql
.env.example
package.json
README.md
```

## 4. Supabase DDL
(see `supabase/schema.sql`)

## 5. Persona Prompt (to embed)

```
System:
You blend Harvard-level medical authority with Marc Andreessen's tech optimism,
Sam Altman's AGI futurism, David Sinclair's longevity focus, Gary Brecka's biomarker zeal,
and Duncan Trussell's cosmic humor.

Goals:
• Illuminate AI × health.
• Spark conversation (ask bold questions).
• Soft Snap2Health plug roughly every sixth tweet.

Style:
• 1-2 sentences or 4-6-bullet threads.
• Emojis sparingly: 🧠 🤖 🩺 ⏳ 💡 📊.
• Cite stats/anecdotes; never spam.
```

## 6. Environment (.env.example)

```
OPENAI_API_KEY=
TWITTER_APP_KEY=
TWITTER_APP_SECRET=
TWITTER_ACCESS_TOKEN=
TWITTER_ACCESS_SECRET=
TWITTER_BEARER_TOKEN=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
DISABLE_BOT=false
MAX_DAILY_TWEETS=280
LIVE_POSTING_ENABLED=true
```

**What is dry-run?**  
Dry-run executes every pipeline stage (idea generation → image fetch → logs) except the final `POST /2/tweets`. It's controlled by `LIVE_POSTING_ENABLED`. When false you'll see `🧪 DRY RUN – Tweet preview:` log lines; when true the bot actually tweets.

## 7. 🔐 Twitter Session

### Quick Setup (Local)
1. **Seed session**: `npm run seed:x-session`
2. **Log in manually** when browser opens at x.com/login
3. **Close browser** when done - session auto-saved to `data/twitter_session.json`
4. **Test session**: `npm run test:x-session` (opens x.com/home with saved session)

### Production Deployment
1. **Generate base64** from local session:
   ```bash
   # macOS (copy to clipboard)
   npm run b64:x-session
   
   # Manual methods:
   base64 < data/twitter_session.json | pbcopy    # macOS
   base64 -w0 data/twitter_session.json | xclip -selection c  # Linux
   base64 -i data/twitter_session.json           # Output to terminal
   ```

2. **Set Railway environment variable**:
   ```bash
   TWITTER_SESSION_B64=eyJjb29raWVzIjpbey...
   ```

3. **Verify deployment**: Check `/session` endpoint shows cookies loaded

### Session Rotation & Debug
- **Auto-save**: After each successful post, session state is automatically saved back
- **Debug flag**: Set `PRINT_SESSION_B64_ON_SAVE=true` to log masked base64 for rotation
- **When to rotate**: After password changes, 2FA updates, or login issues
- **Emergency**: If bot shows `login_required`, update `TWITTER_SESSION_B64` with fresh session

### Session Management Scripts
- `npm run seed:x-session` - Interactive login to save session
- `npm run test:x-session` - Test saved session by opening x.com/home
- `npm run clear:x-session` - Delete saved session file
- `npm run print:x-cookies` - Show cookie names array from session file
- `npm run b64:x-session` - Copy session base64 to clipboard (macOS)

### Health Endpoints
- `/session` - Session status: `{ path, exists, cookieNames, count }`
- `/health` - Railway health checks
- `/status` - Detailed bot status

## 7.1. DB Sanity

### Database Health Check
- `/db/check-latest` - Returns latest 5 tweets with masked content for verification
- Bypasses RLS using service role for reliable health monitoring
- No caching - always fresh data from database

### Admin Testing
- `POST /db/admin-test` - DB insert test (requires `X-Admin-Key: <ADMIN_SECRET>` header)
- Tests write permissions to `diagnostics_log` table if available
- Safe fallback if diagnostics table not configured

## 8. NPM Scripts
`dev` • `cron` • `tweet` • `reply` • `learn` • `lint`

## 9. Deployment
Vercel Cron (*/10 *) → `pnpm cron` **or** Railway always-on worker → `pnpm dev`.

Render automatically runs all new migrations on every deploy via `npm run migrate`. The migration script uses `npx supabase db push` which works in production since Render provides `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` environment variables.

## 10. Advanced Content Pipeline

### 🔬 Trend-Research Fusion
Combines real-time trends with research data for viral potential:
- **TrendResearchFusion**: Merges top 10 Twitter trends with PubMed/NewsAPI articles
- **Credibility Scoring**: Nature (0.98), Stanford (0.92), NIH (0.96), WHO (0.95)
- **Relevance Analysis**: Cosine similarity + trend volume scoring
- **Top 3 Selection**: Highest combined viral potential items

### 🎨 Advanced Tweet Composer
PhD-level content generation with multiple templates:
- **BREAKING_NEWS**: 🚨 format with citations (260 chars max)
- **PHD_THREAD**: 🧵 sophisticated analysis with paradigmatic insights
- **QUICK_STAT**: 📊 data-driven content (200 chars max)
- **VISUAL_SNACK**: 💡 bite-sized insights (180 chars max)

### 🚪 Quality Gate System
Multi-factor validation before posting:
- **Readability Score**: ≥45 Flesch Reading Ease
- **Fact Count**: ≥2 verifiable claims/statistics
- **Source Credibility**: ≥0.8 institutional backing
- **URL/Citation**: Required for research-backed content
- **Character Limits**: Template-specific maximums
- **Rejection Logging**: Failed drafts stored in `rejected_drafts` table

### 📊 Sophistication Metrics
- Uses academic vocabulary (paradigmatic, epistemological, ontological)
- Focuses on systemic implications vs isolated statistics
- PhD-level persona integration from `persona_phd.txt`
- 80/20 insights-to-questions ratio

## 11. Autonomous Growth Loop

### 📈 F/1K Optimization System
The bot optimizes for **Followers-per-1000-Impressions (F/1K)** using machine learning:

#### 🧠 Strategy Learner (ε-greedy Algorithm)
- **Exploration**: 10% random content style selection
- **Exploitation**: 90% best-performing style based on 7-day F/1K average
- **Adaptive ε**: Increases exploration when performance drops, decreases when thriving
- **Content Styles**: educational, breaking_news, viral_take, data_story, thought_leadership, community_building, trending_analysis, research_insight

#### 📊 Engagement Feedback Agent
- **Hourly Data Collection**: Fetches tweet metrics via Twitter API v2
- **Follower Attribution**: Estimates new followers per tweet using engagement scoring
- **Nightly Aggregation**: Computes daily F/1K metrics and stores in `growth_metrics` table
- **Performance Tracking**: Updates `style_rewards` for continuous learning

#### 👥 Follow Growth Agent
- **Strategic Following**: 25 follows/day from competitor follower lists
- **Smart Unfollowing**: 25 unfollows/day after 4-day delay for non-reciprocals
- **Quality Filtering**: Bot detection, ratio analysis, engagement level validation
- **Ratio Guard**: Pauses following when followers/following < 1.1

#### 🕘 Scheduling
- **Engagement Feedback**: Every hour (`0 * * * *`)
- **Strategy Learning**: Daily at 2:30 AM UTC (`30 2 * * *`)
- **Follow Growth**: Every 4 hours (`15 */4 * * *`)

#### 🗃️ Database Schema
```sql
-- F/1K tracking with auto-calculated metric
CREATE TABLE growth_metrics (
    day DATE PRIMARY KEY,
    impressions BIGINT DEFAULT 0,
    new_followers INT DEFAULT 0,
    f_per_1k NUMERIC GENERATED ALWAYS AS 
        (CASE WHEN impressions = 0 THEN 0 ELSE new_followers * 1000.0 / impressions END) STORED
);

-- ε-greedy learning rewards
CREATE TABLE style_rewards (
    style_name VARCHAR(100) UNIQUE,
    f_per_1k_reward NUMERIC DEFAULT 0,
    sample_count INT DEFAULT 0
);

-- Rate-limited follow/unfollow tracking
CREATE TABLE follow_actions (
    target_username VARCHAR(255),
    action_type VARCHAR(20) CHECK (action_type IN ('follow', 'unfollow')),
    action_date DATE DEFAULT CURRENT_DATE,
    success BOOLEAN DEFAULT FALSE
);
```

#### 🎯 Growth Metrics
- **Target F/1K**: 3-5 new followers per 1000 impressions
- **Daily Limits**: 25 follows, 25 unfollows (Twitter API compliance)
- **Learning Rate**: Style performance updates every 24 hours
- **Safety Guards**: Ratio monitoring, quota limits, bot detection

## 🚀 Deploy Flow

### Prerequisites
```bash
# Apply growth metrics schema
export SUPABASE_URL='https://your-project.supabase.co'
export SUPABASE_SERVICE_ROLE_KEY='your-service-role-
key'
chmod +x scripts/db_push.sh
./scripts/db_push.sh
```

### Local Testing
```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run unit tests
npm test

# Run load testing
npm install -g k6
k6 run scripts/soak_test.js
```

### Production Deployment
```bash
# Push to main branch (triggers CI/CD)
git add .
git commit -m "Deploy autonomous growth loop"
git push origin main
```

#### Deployment Pipeline
1. **Lint** → ESLint code quality check
2. **Build** → TypeScript compilation
3. **Jest** → Unit tests (strategyLearner, followGrowthAgent)
4. **k6 Load Test** → 200 RPS for 1 minute with <1% failure rate
5. **Deploy Gate** → Automatic deployment if all tests pass

#### Render Configuration
- **Production**: `xbot-prod` (starter-plus, 1-3 instances, auto-scale)
- **Staging**: `xbot-stage` (starter, 1 instance, DRY_RUN=true)
- **Health Check**: `/health` endpoint
- **Metrics**: `/metrics` (Prometheus format)
- **Dashboard**: `/dashboard` (basic UI)

#### Monitoring Stack
- **k6 Soak Testing**: `scripts/soak_test.js` (200 RPS load validation)
- **Prometheus Metrics**: `src/metrics/exporter.ts` (/metrics endpoint)
- **Grafana Dashboard**: `grafana_dashboard_growth.json` (F/1K visualization)

All deployments include autonomous growth loop with F/1K optimization

## 12. Safety Nets
Rate-limit guard, OpenAI moderation, Supabase kill-switch, full audit trail.

## 13. Implementation Tasks
1. Scaffold file tree & TS config.  
2. Implement wrappers (`xClient`, `openaiClient`, `supabaseClient`).  
3. Stub agents with `run()` methods & TODOs.  
4. Scheduler with node-cron (Strategist 15 min, Learn 02:00 UTC).  
5. Populate prompts with persona + 3 example tweets, 2 example replies.  
6. Ensure `pnpm run dev` prints "💚 All agents completed".

© 2025 Snap2Health # Force Render redeploy with correct TypeScript build
# Force redeploy Thu Jun 19 13:26:05 EDT 2025

## Environment Configuration

### Required Environment Variables (Secrets Only)

Only these environment variables are required for deployment on Render. All other settings (tweet limits, quality gates, posting strategy) are stored in the `bot_config` table in Supabase and can be changed without redeployment.

```bash
# OpenAI API
OPENAI_API_KEY=your_openai_api_key

# Twitter API Credentials  
TWITTER_BEARER_TOKEN=your_bearer_token

# Supabase Database
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### Optional Environment Variables

```bash
# Development/Testing
LIVE_POSTING_ENABLED=true     # false for dry-run mode
DISABLE_BOT=false             # emergency stop switch
NODE_ENV=production           # development/production
```

### Configuration Table

All non-secret settings are stored in the `bot_config` table and can be updated via SQL:

```sql
-- Example: Change daily tweet limit
UPDATE bot_config 
SET value = jsonb_set(value, '{max_daily_tweets}', '8') 
WHERE key = 'runtime_config';

-- Example: Adjust quality requirements
UPDATE bot_config 
SET value = jsonb_set(
  jsonb_set(value, '{quality_readability_min}', '60'),
  '{quality_credibility_min}', '0.9'
)
WHERE key = 'runtime_config';

-- Example: Change posting strategy
UPDATE bot_config 
SET value = jsonb_set(value, '{posting_strategy}', '"aggressive"') 
WHERE key = 'runtime_config';
```

Default configuration values:
- **max_daily_tweets**: 6 (conservative API limit)
- **quality_readability_min**: 55 (Flesch Reading Ease)
- **quality_credibility_min**: 0.85 (source credibility)
- **fallback_stagger_minutes**: 90 (post spacing fallback)
- **posting_strategy**: "balanced" (posting behavior mode)

## Verification

After Railway deployment with Dockerfile, verify the system is working correctly:

```bash
# Test Playwright endpoint (should return PLAYWRIGHT_OK)
curl http://127.0.0.1:8080/playwright

# Check logs for factory initialization and posting safety
railway logs --service xBOT | rg "PLAYWRIGHT_FACTORY_READY|POST_SKIPPED_LIVE_OFF"
```

**Success Criteria:**
- Playwright endpoint returns `PLAYWRIGHT_OK`
- Logs show `PLAYWRIGHT_FACTORY_READY` (browser factory initialized)
- Logs show `POST_SKIPPED_LIVE_OFF` (posting safety guard active)
- No `headless_shell`, `ENOENT`, or `EBUSY` errors in logs

**Additional Verification:**
```bash
# Inside Railway container
railway run --service xBOT -- curl -sSf http://127.0.0.1:8080/playwright && echo
railway run --service xBOT -- curl -sSf http://127.0.0.1:8080/status && echo

# Ensure no browser installation errors
railway logs --service xBOT --lines 400 | grep -i headless_shell || echo "✅ none"
```

## Installation
