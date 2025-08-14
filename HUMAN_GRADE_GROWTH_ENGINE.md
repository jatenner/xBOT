# 🧠 HUMAN-GRADE GROWTH ENGINE

A comprehensive Twitter/X growth system that generates genuinely useful, science-backed health content with human-like quality for @Signal_Synapse.

## 🎯 Overview

The Human-Grade Growth Engine is a sophisticated AI system that:
- **Predicts follower growth** before posting using opportunity scoring
- **Creates human-like content** that avoids robotic patterns
- **Follows the "Before the Fold" rule** (240 chars must deliver value)
- **Uses Thompson sampling** for format/persona optimization
- **Integrates Twitter trends** with health expertise
- **Posts via Playwright** (browser-only, no API required)

## 🚀 Key Features

### 📊 Smart Decision Making
- **Opportunity Scoring**: EPM metrics + trend analysis + time boost - fatigue penalty
- **Thompson Sampling**: Optimizes format and persona selection using bandit algorithms
- **Trend Integration**: Prioritizes Twitter trends over news, with health topic fitting
- **Fatigue Management**: Prevents format streaks and enforces variety

### 🎨 Content Generation
- **5 Personas**: Scientist, Coach, Mythbuster, Storyteller, Curator
- **6 Hook Types**: how_to, myth_bust, checklist, story, tip, framework
- **5 Health Pillars**: Sleep, Stress, Nutrition, Movement, Behavior
- **Multiple Formats**: Single, Thread, Reply, Quote, Longform Single

### 🔬 Quality Control
- **Front-Loading**: First 240 chars must deliver complete value
- **Human Vibe Scoring**: 8-10 scale, auto-revision if < 8
- **Zero Hashtags**: More natural, human-like content
- **Source Citations**: Added for non-obvious health claims
- **Redundancy Prevention**: Checks against recent posts

## 📁 File Structure

```
src/agents/
├── humanGradeGrowthEngine.ts     # Core growth engine logic
├── growthEngineIntegration.ts    # xBOT integration layer
└── autonomousTwitterPoster.ts    # Playwright posting (existing)

src/utils/
└── longformDetector.ts           # Auto-detects Twitter Blue longform capability

tools/
└── testGrowthEngine.ts           # CLI testing tool
```

## 🛠 Usage

### Command Line Testing
```bash
# Test the growth engine with example data
npm run test:growth-engine
```

### Integration with xBOT
```typescript
import { executeGrowthEngine } from './src/agents/growthEngineIntegration';

// Execute a complete growth cycle
const result = await executeGrowthEngine();

if (result.post_now) {
  console.log('Posted:', result.draft.tweets[0].text);
} else {
  console.log('Deferred:', result.reason);
}
```

### Direct Usage
```typescript
import { HumanGradeGrowthEngine } from './src/agents/humanGradeGrowthEngine';

const engine = HumanGradeGrowthEngine.getInstance();
const output = await engine.processGrowthDecision(inputData);
```

## 📝 Input Format (Strict JSON)

```json
{
  "now_local": "2025-08-13T22:40:00-04:00",
  "caps": { "max_day": 100, "max_hour": 8, "min_gap": 6, "min_gap_same": 20, "thread_cooldown": 15, "min_posts_per_2h": 1 },
  "recent_counts": { "hour": 0, "day": 3, "last_post_min_ago": 137, "last_format": "single", "since_last_2h": 0 },
  "followers": 17,
  "metrics": {
    "epm_current": 0.9,
    "epm_ewma": 0.6,
    "format_bandit": { "single": 0.25, "thread": 0.35, "reply": 0.15, "quote": 0.1, "longform_single": 0.15 },
    "persona_hook_bandit": { "Scientist/myth_bust": 0.22, "Coach/how_to": 0.28, "Storyteller/story": 0.18, "Curator/checklist": 0.18, "Mythbuster/checklist": 0.14 }
  },
  "fatigue": { "format_streak": 1, "thread_cooldown_remaining": 0 },
  "twitter_trends": [
    { "phrase": "sleep debt", "momentum": 0.72, "tph": 180, "category": "Sleep" },
    { "phrase": "morning light exposure", "momentum": 0.58, "tph": 95, "category": "Sleep" }
  ],
  "news_trends": [],
  "trend_policy": { "fit_min": 0.35, "prefer_twitter_over_news": true, "max_offtopic_ratio": 0.15, "blacklist": ["politics", "war", "nsfw", "celebrity_scandal"] },
  "recent_posts_text": ["Hydrate before caffeine", "Stress micro-breaks"],
  "limits": { "first_visible_chars": 240, "tweet_max_hard": 275, "longform_max_chars": 9000 },
  "style": { "style_jitter": 0.25, "hedge_prob": 0.15, "question_prob": 0.25, "emoji_max": 1, "no_hashtags": true },
  "capabilities": { "longform_available": false, "replies_allowed": true, "quotes_allowed": true },
  "reply_context": { "gist": null, "author": null }
}
```

## 📤 Output Format (Strict JSON)

```json
{
  "post_now": true,
  "reason": "High opportunity score",
  "delay_min": 0,
  "decision": {
    "format": "thread",
    "n_tweets": 5,
    "topic": "sleep debt",
    "pillar": "Sleep",
    "persona": "Coach",
    "hook_type": "how_to",
    "explore": true,
    "pacing": { "opportunity": 0.85, "z_epm": 0.5, "fatigue_penalty": 0.1 }
  },
  "draft": {
    "tweets": [
      { "n": 1, "text": "Sleep debt is real and it's sabotaging your health. Here's how to pay it back in 7 days (science-backed method)..." },
      { "n": 2, "text": "Step 1: Calculate your deficit. Most people underestimate by 2-3 hours..." }
    ],
    "sources": ["American Journal of Medicine 2023"],
    "cta_note": "Thread completion and light engagement"
  },
  "qc": { "length_ok": true, "emoji_ok": true, "no_hashtags": true, "non_redundant": true, "human_vibe_score": 9, "front_loaded": true }
}
```

## 🧪 Longform Detection

The system automatically detects Twitter Blue/Premium longform capability:

```typescript
import { detectLongformAvailable } from './src/utils/longformDetector';

const page = await getPageWithStorage();
const canPostLongform = await detectLongformAvailable(page);
// Returns true if account can post >280 characters
```

### Detection Methods
1. **Composer Test**: Fill composer with 1200+ chars, check if tweet button stays enabled
2. **Settings Check**: Look for Twitter Blue indicators in account settings  
3. **Features Check**: Count premium features (edit button, verification, etc.)

## 🎯 Content Strategy

### The "Before the Fold" Rule
**CRITICAL**: First 240 characters must deliver complete value before "Show more" appears.

✅ **Good Examples:**
```
Quick sleep tip: Keep bedroom below 65°F. Takes 2 minutes to adjust, improves deep sleep by 23%. Your body needs to cool down to trigger sleep hormones...

Study of 50,000+ people reveals: Morning light exposure beats melatonin for sleep quality. 15 minutes outside within 2 hours of waking resets your circadian rhythm...
```

❌ **Bad Examples:**
```
I want to talk about something really important today that affects millions of people worldwide and might be the key to solving your health problems...

There are many factors that contribute to poor sleep quality, and in this thread I'm going to break down each one for you step by step...
```

### Personas & Hook Types

| Persona | Hook Types | Style |
|---------|------------|-------|
| **Scientist** | myth_bust, tip | Precise, evidence-based, debunks myths |
| **Coach** | how_to, checklist | Actionable, friendly, step-by-step |
| **Mythbuster** | myth_bust | "Sounds true but isn't" + alternatives |
| **Storyteller** | story | Short narrative → lesson → micro-steps |
| **Curator** | checklist, framework | Compact routines with "why" explanations |

### Health Pillars

- **Sleep**: Sleep debt, circadian rhythms, sleep hygiene
- **Stress**: Cortisol, breathing techniques, stress management  
- **Nutrition**: Meal timing, supplements, metabolic health
- **Movement**: Exercise timing, recovery, movement patterns
- **Behavior**: Habit formation, environmental design, psychology

## 📈 Opportunity Scoring Formula

```
OpportunityScore = 
  Z(EPM_current vs EPM_ewma) +
  TwitterTrendBoost +
  (NewsTrendBoost × 0.6) +
  LocalTimeBoost -
  FatiguePenalty
```

### Components:
- **Z-Score EPM**: How current engagement compares to historical average
- **Twitter Trend Boost**: Momentum × TPH × Health Fit (max 1.0)
- **News Trend Boost**: Momentum × Health Fit × 0.6 (lower priority)
- **Local Time Boost**: +0.3 for peak hours, -0.2 for low hours
- **Fatigue Penalty**: Format streaks, thread cooldown, posting frequency

## 🔄 Thompson Sampling

The system uses Thompson sampling (multi-armed bandit) to optimize:

### Format Selection
- **Single**: Quick tips, standalone insights
- **Thread**: Deep dives, step-by-step guides  
- **Reply**: Adding value to conversations
- **Quote**: Commentary on health discussions
- **Longform**: Comprehensive guides (Twitter Blue only)

### Persona Selection
Each persona has win/loss probabilities that update based on engagement performance.

## 🛡 Quality Control

### Automatic Checks
- ✅ Length compliance (275 chars standard, 9000 longform)
- ✅ Emoji count (≤1 emoji max)
- ✅ Zero hashtags (more human)
- ✅ Non-redundant vs recent posts
- ✅ Front-loaded value (first 240 chars)
- ✅ Human vibe score (8-10 scale)

### Auto-Revision
If human vibe score < 8, content is automatically revised to be more conversational.

## 🔧 Configuration

### Posting Caps
```typescript
{
  max_day: 100,        // Maximum posts per day
  max_hour: 8,         // Maximum posts per hour  
  min_gap: 6,          // Minimum minutes between posts
  min_gap_same: 20,    // Minimum minutes between same format
  thread_cooldown: 15, // Minutes to wait after posting thread
  min_posts_per_2h: 1  // Minimum posts every 2 hours (forces activity)
}
```

### Style Settings
```typescript
{
  style_jitter: 0.25,   // Probability of style variation
  hedge_prob: 0.15,     // Probability of gentle hedging language
  question_prob: 0.25,  // Probability of question format
  emoji_max: 1,         // Maximum emojis per tweet
  no_hashtags: true     // Never use hashtags
}
```

## 🗄 Database Integration

The system logs all decisions and performance for continuous learning:

### Tables Created
- `growth_decisions`: Every decision (post/defer) with reasoning
- `bandit_arms`: Format and persona performance tracking
- `posting_fatigue`: Format streaks and cooldown tracking
- `twitter_trends`: Health-related trending topics
- `news_trends`: Health news trend tracking

## 🚀 Deployment

### With xBOT Integration
The growth engine automatically integrates with the existing xBOT autonomous posting system. No manual intervention required.

### Standalone Usage
```typescript
import { GrowthEngineIntegration } from './src/agents/growthEngineIntegration';

const integration = GrowthEngineIntegration.getInstance();
const result = await integration.executeGrowthCycle();
```

## 🧪 Testing & Development

### Run Tests
```bash
# Test with example data
npm run test:growth-engine

# Build and test
npm run build
npm run test:growth-engine
```

### Example Output
```
🧪 TESTING HUMAN-GRADE GROWTH ENGINE
=====================================

📊 Collecting growth engine input data...
🚀 Starting Human-Grade Growth Engine cycle...
✅ Growth cycle complete: POSTED

📊 GROWTH ENGINE OUTPUT:
========================
Post now: true
Reason: High opportunity score  
Format: thread
Topic: sleep debt
Content preview: Sleep debt is real and it's sabotaging your health. Here's how to pay it back in 7 days...
Human vibe score: 9

✅ Test completed successfully!
```

## 🎯 Performance Metrics

The system tracks and optimizes for:
- **Engagement Per Minute (EPM)**: Primary success metric
- **Follower Growth Rate**: Secondary metric
- **Format Performance**: Which formats drive best engagement
- **Persona Performance**: Which personas resonate with audience
- **Trend Fit Accuracy**: How well trend selection predicts performance

## 🔮 Future Enhancements

1. **Dynamic Persona Creation**: Learn new personas from top-performing content
2. **Real-time Trend Analysis**: Live Twitter trend monitoring with health filtering
3. **A/B Testing Framework**: Systematic testing of content variations
4. **Engagement Prediction**: ML models to predict engagement before posting
5. **Competitor Analysis**: Learn from top health accounts' successful content

---

## 💡 Tips for Success

1. **Trust the "Before the Fold" Rule**: Always front-load value in first 240 chars
2. **Vary Your Personas**: Don't get stuck in one voice
3. **Monitor Opportunity Scores**: Higher scores = better posting timing
4. **Watch Format Performance**: Let Thompson sampling guide format selection
5. **Stay Health-Focused**: High trend fit scores matter more than viral potential

**The Human-Grade Growth Engine is designed to grow your health account sustainably by consistently delivering genuine value to your audience while maintaining authentic, human-like communication.**