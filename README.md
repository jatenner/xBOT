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
```

## 7. NPM Scripts
`dev` • `cron` • `tweet` • `reply` • `learn` • `lint`

## 8. Deployment
Vercel Cron (*/10 *) → `pnpm cron` **or** Railway always-on worker → `pnpm dev`.

## 9. Advanced Content Pipeline

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

## 10. Autonomous Growth Loop

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
export SUPABASE_SERVICE_ROLE_KEY='your-service-role-key'
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

## 11. Safety Nets
Rate-limit guard, OpenAI moderation, Supabase kill-switch, full audit trail.

## 12. Implementation Tasks
1. Scaffold file tree & TS config.  
2. Implement wrappers (`xClient`, `openaiClient`, `supabaseClient`).  
3. Stub agents with `run()` methods & TODOs.  
4. Scheduler with node-cron (Strategist 15 min, Learn 02:00 UTC).  
5. Populate prompts with persona + 3 example tweets, 2 example replies.  
6. Ensure `pnpm run dev` prints "💚 All agents completed".

© 2025 Snap2Health # Force Render redeploy with correct TypeScript build
# Force redeploy Thu Jun 19 13:26:05 EDT 2025
