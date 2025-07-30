# 🚀 ENVIRONMENT SETUP GUIDE

## Required Environment Variables

### 🔑 Essential (Bot Won't Start Without These)
```bash
# Supabase Database
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Twitter API (for data collection)
TWITTER_BEARER_TOKEN=your_twitter_bearer_token

# OpenAI (for AI content generation)
OPENAI_API_KEY=your_openai_api_key

# Twitter Session (for browser posting)
TWITTER_USERNAME=your_twitter_username
TWITTER_PASSWORD=your_twitter_password
```

### 🎛️ Phase Control (Gradual AI Rollout)
```bash
# Bot development phase (controls AI features)
BOT_PHASE=data_collection  # Options: data_collection, ai_trial, learning_loop, growth_mode

# Manual feature overrides (optional)
ENABLE_ELITE_STRATEGIST=false     # Enable AI content generation
ENABLE_BANDIT_LEARNING=false      # Enable learning optimization
ENABLE_ENGAGEMENT_OPT=false       # Enable engagement analytics
ENABLE_AUTO_ENGAGEMENT=false      # Enable auto-replies/likes

# Content controls
STRATEGIST_USAGE_RATE=0.4          # 0.0-1.0, percentage of posts using AI
FACT_CHECK_THRESHOLD=0.7           # 0.5-1.0, strictness of content safety
MAX_DAILY_POSTS=6                  # Maximum posts per day
```

### 💰 Budget Protection
```bash
# OpenAI spending limits
ABSOLUTE_DAILY_LIMIT=7.50          # Maximum $ per day for OpenAI
EMERGENCY_BUDGET_LOCKDOWN=7.25     # Emergency brake threshold

# Monthly budget tracking
OPENAI_MONTHLY_BUDGET=100.00       # Monthly budget limit
MONTHLY_BUDGET_RESET_DAY=1         # Day of month to reset (1-28)
```

### 🎭 Browser Automation
```bash
# Playwright installation control
SKIP_PLAYWRIGHT=false              # Set to 'true' to skip Playwright install

# Session management
SESSION_STORAGE_PATH=/app/twitter_session.json  # Where to store Twitter session
```

### 📊 Optional Integrations
```bash
# News API (for trending content - optional)
NEWS_API_KEY=your_news_api_key

# Pexels (for images - optional) 
PEXELS_API_KEY=your_pexels_api_key

# Analytics (optional)
VERBOSE_LOGGING=false              # Detailed debug logs
DRY_RUN=false                      # Test mode (no actual posting)
```

## 🎯 Phase-Based Rollout Strategy

### Phase 1: Data Collection (BOT_PHASE=data_collection)
- **Duration**: 3-5 days
- **Features**: Template-only posting, baseline metrics
- **Goal**: Collect 30+ posts with engagement data
- **AI Usage**: 0%

### Phase 2: AI Trial (BOT_PHASE=ai_trial)  
- **Duration**: 4-7 days
- **Features**: 40% AI content, 60% templates
- **Goal**: Compare AI vs template performance
- **Requirements**: 30+ posts from Phase 1

### Phase 3: Learning Loop (BOT_PHASE=learning_loop)
- **Duration**: 1-2 weeks  
- **Features**: 60% AI + bandit optimization
- **Goal**: Optimize format/topic selection
- **Requirements**: 60+ posts, positive AI performance

### Phase 4: Growth Mode (BOT_PHASE=growth_mode)
- **Duration**: Ongoing
- **Features**: 80% AI + full engagement automation
- **Goal**: Maximum follower growth
- **Requirements**: 100+ posts, proven engagement improvement

## 🚄 Railway Deployment Setup

### 1. Create Railway Project
```bash
# Connect your GitHub repo to Railway
railway login
railway init
railway link
```

### 2. Set Environment Variables
In Railway dashboard → Your Project → Variables:
- Add all required variables from above
- Set `BOT_PHASE=data_collection` to start
- Set `SKIP_PLAYWRIGHT=false` for browser automation

### 3. Configure Deployment
Ensure these files are present:
- `nixpacks.toml` (build configuration)
- `package.json` (dependencies and scripts)

### 4. Deploy
```bash
git add .
git commit -m "Initial deployment"
git push origin main
```

Railway will auto-deploy from your main branch.

### 5. Monitor Health
- **Health Check**: `https://your-app.railway.app/health`
- **Dashboard**: `https://your-app.railway.app:3001`
- **Logs**: Use `npm run logs` for continuous monitoring

## 🛠️ Manual Configuration Steps

### 1. Supabase Database Setup
The bot will automatically create required tables on first run via migrations. No manual setup needed.

### 2. Twitter Authentication
The bot uses browser automation for posting. On first run:
1. It will attempt to login with your credentials
2. If 2FA is required, you may need to manually complete it once
3. Session will be saved for future use

### 3. Phase Advancement
Monitor your bot's performance and advance phases manually:

```bash
# In Railway dashboard, update BOT_PHASE variable:
# data_collection → ai_trial → learning_loop → growth_mode
```

## 🔍 Monitoring & Troubleshooting

### Key Metrics to Watch
- **Posts per day**: Should match your MAX_DAILY_POSTS setting
- **Engagement rate**: Track likes/retweets per post
- **AI usage**: Verify AI content percentage matches phase
- **Budget spending**: Monitor daily OpenAI costs

### Common Issues

**Bot not posting:**
- Check Twitter session validity
- Verify TWITTER_USERNAME/PASSWORD
- Ensure sufficient budget remaining

**High OpenAI costs:**
- Reduce STRATEGIST_USAGE_RATE
- Lower MAX_DAILY_POSTS
- Set stricter ABSOLUTE_DAILY_LIMIT

**Template content only:**
- Verify BOT_PHASE setting
- Check ENABLE_ELITE_STRATEGIST flag
- Confirm OPENAI_API_KEY is valid

### Success Indicators
- ✅ Health endpoint returns 200 OK
- ✅ Daily posts match target frequency  
- ✅ Budget stays under daily limit
- ✅ Engagement rates improve over time
- ✅ No error spam in logs

## 🎯 Expected Performance by Phase

### Phase 1 (Templates): 
- Engagement: 1-3%
- Followers: +2-5/day
- Posting: 100% reliable

### Phase 2 (AI Trial):
- Engagement: 3-6% 
- Followers: +5-10/day
- Cost: $0.50-1.00/day

### Phase 3 (Learning):
- Engagement: 5-8%
- Followers: +8-15/day  
- Cost: $1.00-2.00/day

### Phase 4 (Growth):
- Engagement: 8-15%
- Followers: +15-30/day
- Cost: $2.00-4.00/day

Remember: Results depend on your niche, existing audience, and content quality. These are baseline expectations for health/wellness content.