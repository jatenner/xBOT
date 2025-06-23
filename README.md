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

## 10. Safety Nets
Rate-limit guard, OpenAI moderation, Supabase kill-switch, full audit trail.

## 11. Implementation Tasks
1. Scaffold file tree & TS config.  
2. Implement wrappers (`xClient`, `openaiClient`, `supabaseClient`).  
3. Stub agents with `run()` methods & TODOs.  
4. Scheduler with node-cron (Strategist 15 min, Learn 02:00 UTC).  
5. Populate prompts with persona + 3 example tweets, 2 example replies.  
6. Ensure `pnpm run dev` prints "💚 All agents completed".

© 2025 Snap2Health # Force Render redeploy with correct TypeScript build
# Force redeploy Thu Jun 19 13:26:05 EDT 2025
