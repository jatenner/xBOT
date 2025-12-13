# 🔄 HOW EXPERT ANALYSIS WORKS - COMPLETE WORKFLOW

## 📊 THE COMPLETE FLOW

### **Step 1: Scraping (Already Happening)**

```
VI Account Scraper runs every 8 hours
  ↓
Scrapes tweets from 100+ monitored accounts
  ↓
Stores in vi_viral_unknowns (viral tweets)
  ↓
Stores in vi_collected_tweets (monitored accounts)
```

**Current State:** ✅ Working

---

### **Step 2: Classification (Already Happening)**

```
VI Processor runs every 6 hours
  ↓
Gets unclassified tweets from vi_viral_unknowns + vi_collected_tweets
  ↓
Sends to GPT-4o-mini for classification
  ↓
Extracts: topic, angle, tone, structure, hook_effectiveness, controversy_level
  ↓
Stores in vi_content_classification table
```

**Current State:** ✅ Working

**What Gets Stored:**
```json
{
  "tweet_id": "123456",
  "topic": "sleep",
  "angle": "provocative",
  "tone": "conversational",
  "structure": "question_hook",
  "hook_effectiveness": 78,
  "controversy_level": 45
}
```

---

### **Step 3: Expert Analysis (NEW - What We'll Add)**

```
Expert Analyzer runs every 6 hours (after classification)
  ↓
Gets successful tweets (10K+ views OR high engagement rate)
  ↓
For each successful tweet:
  1. Get tweet content + performance data
  2. Send to GPT-4o with expert prompt
  3. GPT analyzes as expert social media manager
  4. Returns strategic analysis in plain English
  5. Store in expert_tweet_analysis table
```

**What Gets Stored:**
```json
{
  "tweet_id": "123456",
  "strategic_analysis": {
    "why_it_works": "Creates curiosity gap in first 10 words, then delivers surprising insight...",
    "core_value_proposition": "Provides counterintuitive health insight backed by research",
    "target_audience": "Health-conscious individuals who value evidence-based information",
    "engagement_strategy": "Question hook → Surprising data → Mechanism explanation → Actionable insight"
  },
  "content_intelligence": {
    "hook_analysis": {
      "type": "question",
      "effectiveness": 85,
      "why_effective": "Creates immediate curiosity gap - makes people stop scrolling",
      "improvement_suggestions": ["Could be more specific", "Could add urgency"]
    },
    "structure_analysis": {
      "pattern": "question_hook",
      "why_it_works": "Question creates curiosity, data builds credibility...",
      "when_to_use": "Best for educational content that challenges assumptions"
    }
  },
  "actionable_recommendations": {
    "content_strategy": ["Start with curiosity gap hook", "Follow with surprising data"],
    "hook_improvements": ["Create curiosity gap in first 10 words", "Make it specific"],
    "messaging_tips": ["Lead with surprising insight", "Back with data/research"]
  }
}
```

---

### **Step 4: Aggregation (NEW - What We'll Add)**

```
Expert Insights Aggregator runs every 12 hours
  ↓
Groups expert analyses by angle/tone/structure combinations
  ↓
For each combination:
  1. Get all expert analyses for that combination
  2. Extract common patterns
  3. Synthesize strategic recommendations
  4. Store in vi_format_intelligence.expert_insights
```

**What Gets Stored:**
```json
{
  "query_key": "provocative|conversational|question_hook",
  "expert_insights": {
    "strategic_insights": "Successful tweets use curiosity gap hooks that challenge assumptions...",
    "content_strategy": ["Start with curiosity gap", "Follow with data", "Explain mechanism"],
    "hook_advice": "Question hooks work best when specific enough to be interesting but broad enough to appeal to many",
    "messaging_tips": ["Lead with surprising insight", "Back with research", "Provide actionable value"]
  },
  "based_on_count": 47
}
```

---

### **Step 5: Content Generation (How It Gets Used)**

```
planJob runs every 30 minutes
  ↓
Generates content:
  1. Selects topic, angle, tone, structure
  2. Gets VI insights (formatting patterns)
  3. 🔥 NEW: Gets expert insights (strategic advice)
  4. Combines both into intelligence package
  5. Passes to generator
```

**What Generator Receives:**

```typescript
intelligence = {
  visualFormattingInsights: `
    CHARACTER COUNT: Optimal 180 chars
    LINE BREAKS: 2 breaks
    ...
  `,
  
  expertAdvice: `
    🎯 EXPERT SOCIAL MEDIA MANAGER ADVICE:
    
    STRATEGIC INSIGHTS:
    Successful tweets use curiosity gap hooks that challenge assumptions.
    Follow with surprising data to build credibility.
    Explain the mechanism (HOW/WHY) to provide depth.
    End with actionable insight to deliver value.
    
    CONTENT STRATEGY:
    - Start with curiosity gap hook
    - Follow with surprising data
    - Explain mechanism
    - Provide actionable insight
    
    HOOK ADVICE:
    Question hooks work best when specific enough to be interesting
    but broad enough to appeal to many. Create curiosity gap in first 10 words.
    
    MESSAGING TIPS:
    - Lead with surprising insight
    - Back with research/data
    - Explain HOW/WHY it works
    - Provide actionable value
  `
}
```

**Generator Uses This:**
- ✅ Understands WHY patterns work (not just WHAT works)
- ✅ Gets strategic advice (not just formatting data)
- ✅ Receives actionable recommendations
- ✅ Creates content using expert guidance

---

## 🔄 DETAILED WORKFLOW

### **A. Scraping Phase (Every 8 Hours)**

**File:** `src/intelligence/viAccountScraper.ts`

```
1. Get active scrape targets from vi_scrape_targets table
2. For each account:
   - Navigate to Twitter profile
   - Scrape recent tweets
   - Extract: content, views, likes, retweets, replies
   - Store in vi_collected_tweets
3. Also scrape viral tweets → Store in vi_viral_unknowns
```

**Output:** Raw tweet data in database

---

### **B. Classification Phase (Every 6 Hours)**

**File:** `src/intelligence/viProcessor.ts`

```
1. Get unclassified tweets (classified = false)
2. For each tweet:
   - Send to GPT-4o-mini for classification
   - Extract: topic, angle, tone, structure, hook_effectiveness, controversy_level
   - Store in vi_content_classification
   - Mark as classified = true
```

**Output:** Classified tweets with basic metadata

---

### **C. Expert Analysis Phase (NEW - Every 6 Hours)**

**File:** `src/intelligence/expertTweetAnalyzer.ts` (NEW)

```
1. Get successful tweets:
   - From vi_viral_unknowns (viral tweets)
   - From vi_collected_tweets (high engagement: 2%+ ER OR 10K+ views)
   - Filter: not yet analyzed (expert_analyzed = false)
   
2. For each successful tweet:
   a. Get tweet content + performance data
   b. Build expert analysis prompt:
      "You are an expert social media manager..."
   c. Send to GPT-4o (higher capability model)
   d. Get strategic analysis in JSON
   e. Store in expert_tweet_analysis table
   f. Mark tweet as expert_analyzed = true
   
3. Process in batches (10-20 tweets per run to manage costs)
```

**Output:** Expert analyses with strategic insights

---

### **D. Aggregation Phase (NEW - Every 12 Hours)**

**File:** `src/intelligence/expertInsightsAggregator.ts` (NEW)

```
1. Get all expert analyses from last 30 days
2. Group by angle/tone/structure combinations
3. For each combination:
   a. Extract common patterns:
      - Common hook strategies
      - Common structure patterns
      - Common messaging approaches
      - Common formatting strategies
   b. Synthesize strategic recommendations:
      - What works best?
      - Why does it work?
      - How to apply it?
   c. Store in vi_format_intelligence.expert_insights
```

**Output:** Aggregated expert insights by combination

---

### **E. Content Generation Phase (Every 30 Minutes)**

**File:** `src/jobs/planJob.ts`

```
1. Generate content:
   - Select topic, angle, tone, structure
   
2. Get VI insights:
   - Query vi_format_intelligence for angle/tone/structure
   - Get formatting patterns (char count, line breaks, etc.)
   
3. 🔥 NEW: Get expert insights:
   - Query vi_format_intelligence.expert_insights
   - Get strategic advice for angle/tone/structure
   
4. Combine both:
   - Formatting patterns (from VI)
   - Strategic advice (from expert analysis)
   
5. Convert to generator advice:
   - Formatting: "Use 180 chars, 2 line breaks..."
   - Expert: "Start with curiosity gap hook that challenges assumptions..."
   
6. Pass to generator:
   - Generator receives both formatting + expert advice
   - AI interprets intelligently (temperature 0.7)
   - Creates content using expert guidance
```

**Output:** Content generated with expert guidance

---

## 🎯 EXAMPLE: COMPLETE FLOW

### **Tweet Gets Scraped:**

```
Tweet: "What if everything we know about sleep is wrong? Studies show..."
Views: 12,345
Likes: 234
Engagement Rate: 2.1%
```

### **Step 1: Classification**

```
GPT-4o-mini analyzes:
→ Topic: sleep
→ Angle: provocative
→ Tone: conversational
→ Structure: question_hook
→ Hook effectiveness: 78/100
→ Controversy level: 45/100

Stored in vi_content_classification
```

### **Step 2: Expert Analysis**

```
GPT-4o analyzes as expert social media manager:

STRATEGIC ANALYSIS:
"Why It Works: Creates curiosity gap in first 10 words with 'What if everything we know is wrong?' This stops scrolling because it challenges fundamental assumptions. The follow-up with 'Studies show' builds credibility. The structure works because it creates curiosity → builds credibility → delivers insight."

CONTENT INTELLIGENCE:
"Hook Analysis: Question hook, 78/100 effectiveness. Why effective: Creates immediate curiosity gap, specific enough to be interesting, broad enough to appeal to many. Improvements: Could be more specific ('What if your sleep debt isn't what you think?'), could add urgency."

ACTIONABLE RECOMMENDATIONS:
"Content Strategy: Start with curiosity gap hook that challenges assumptions. Follow with surprising data to build credibility. Explain mechanism (HOW/WHY) to provide depth. End with actionable insight."

Stored in expert_tweet_analysis
```

### **Step 3: Aggregation**

```
Aggregator groups by: provocative|conversational|question_hook

Finds 47 similar successful tweets
Synthesizes common patterns:
- Curiosity gap hooks work best
- Follow with data/research
- Explain mechanism
- Provide actionable insight

Stored in vi_format_intelligence.expert_insights
```

### **Step 4: Content Generation**

```
planJob generates content:
Topic: "sleep optimization"
Angle: "provocative"
Tone: "conversational"
Structure: "question_hook"

Gets expert insights:
"Start with curiosity gap hook that challenges assumptions.
Follow with surprising data to build credibility.
Explain mechanism (HOW/WHY) to provide depth.
End with actionable insight."

Generator creates:
"What if your sleep debt isn't what you think?

Studies show sleep debt works differently than most people realize.
It's not just hours missed - it's recovery disrupted.
Your body needs REM cycles, not just time in bed."
```

---

## 🔧 TECHNICAL IMPLEMENTATION

### **1. Expert Analyzer Job**

**File:** `src/jobs/expertAnalysisJob.ts` (NEW)

```typescript
export async function expertAnalysisJob(): Promise<void> {
  console.log('[EXPERT_ANALYSIS] 🎯 Starting expert analysis job...');
  
  const analyzer = new ExpertTweetAnalyzer();
  
  // Get successful tweets that need analysis
  const tweetsToAnalyze = await analyzer.getTweetsNeedingAnalysis({
    minViews: 10000,
    minEngagementRate: 0.02,
    limit: 20 // Process 20 per run
  });
  
  console.log(`[EXPERT_ANALYSIS] 📊 Found ${tweetsToAnalyze.length} tweets to analyze`);
  
  for (const tweet of tweetsToAnalyze) {
    try {
      await analyzer.analyzeTweet(tweet);
      console.log(`[EXPERT_ANALYSIS] ✅ Analyzed tweet ${tweet.tweet_id}`);
    } catch (error: any) {
      console.error(`[EXPERT_ANALYSIS] ❌ Failed to analyze ${tweet.tweet_id}:`, error.message);
    }
  }
  
  console.log('[EXPERT_ANALYSIS] ✅ Expert analysis job complete');
}
```

### **2. Expert Analyzer Class**

**File:** `src/intelligence/expertTweetAnalyzer.ts` (NEW)

```typescript
export class ExpertTweetAnalyzer {
  private supabase = getSupabaseClient();
  
  async analyzeTweet(tweet: any): Promise<void> {
    // Build expert prompt
    const prompt = this.buildExpertPrompt(tweet);
    
    // Get expert analysis from GPT-4o
    const analysis = await this.getExpertAnalysis(tweet, prompt);
    
    // Store in database
    await this.storeExpertAnalysis(tweet.tweet_id, analysis);
  }
  
  private buildExpertPrompt(tweet: any): string {
    return `You are an expert social media manager with 10+ years of experience...
    
    [Expert analysis prompt as described above]
    `;
  }
  
  private async getExpertAnalysis(tweet: any, prompt: string): Promise<any> {
    const response = await createBudgetedChatCompletion({
      model: 'gpt-4o', // Higher capability model
      messages: [
        {
          role: 'system',
          content: 'You are an expert social media manager specializing in Twitter growth...'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 4000,
      response_format: { type: 'json_object' }
    }, {
      purpose: 'expert_tweet_analysis'
    });
    
    return JSON.parse(response.choices[0].message.content || '{}');
  }
}
```

### **3. Aggregator Job**

**File:** `src/jobs/expertInsightsAggregatorJob.ts` (NEW)

```typescript
export async function expertInsightsAggregatorJob(): Promise<void> {
  console.log('[EXPERT_AGGREGATOR] 🔄 Starting expert insights aggregation...');
  
  const aggregator = new ExpertInsightsAggregator();
  
  // Get all expert analyses from last 30 days
  const analyses = await aggregator.getRecentAnalyses(30);
  
  // Group by angle/tone/structure
  const grouped = aggregator.groupByCombination(analyses);
  
  // Synthesize insights for each combination
  for (const [combination, groupAnalyses] of grouped.entries()) {
    const synthesized = await aggregator.synthesizeInsights(groupAnalyses);
    
    // Store in vi_format_intelligence
    await aggregator.storeInsights(combination, synthesized);
  }
  
  console.log('[EXPERT_AGGREGATOR] ✅ Aggregation complete');
}
```

### **4. Integration in planJob**

**File:** `src/jobs/planJob.ts` (MODIFY)

```typescript
// After getting VI insights:
const viInsights = await viFeed.getIntelligence({ topic, angle, tone, structure });

// 🔥 NEW: Get expert insights
const expertInsights = await getExpertInsightsForCombination(angle, tone, structure);

// Convert both to generator advice
const viFormatString = convertVIInsightsToString(viInsights);
const expertAdviceString = convertExpertInsightsToAdvice(expertInsights);

// Combine
growthIntelligence.visualFormattingInsights = `${viFormatString}\n\n${expertAdviceString}`;
```

---

## ⏰ TIMING & SCHEDULING

### **Current Schedule:**

```
Every 8 hours: VI Account Scraper (scrapes tweets)
Every 6 hours: VI Processor (classifies tweets)
Every 6 hours: VI Intelligence Builder (aggregates patterns)
```

### **New Schedule:**

```
Every 8 hours: VI Account Scraper (scrapes tweets)
Every 6 hours: VI Processor (classifies tweets)
Every 6 hours: Expert Analyzer (analyzes successful tweets) ← NEW
Every 12 hours: Expert Insights Aggregator (synthesizes insights) ← NEW
Every 6 hours: VI Intelligence Builder (aggregates patterns)
```

### **Job Manager Integration:**

**File:** `src/jobs/jobManager.ts`

```typescript
// Add new jobs:
scheduleJob('expert_analysis', expertAnalysisJob, {
  intervalMinutes: 360, // Every 6 hours
  initialDelayMinutes: 10
});

scheduleJob('expert_aggregator', expertInsightsAggregatorJob, {
  intervalMinutes: 720, // Every 12 hours
  initialDelayMinutes: 30
});
```

---

## 💰 COST CONSIDERATIONS

### **GPT-4o Costs:**

**Per Tweet Analysis:**
- Input: ~500 tokens (tweet + prompt)
- Output: ~2000 tokens (expert analysis)
- Cost: ~$0.03 per tweet

**Daily Cost:**
- 20 tweets analyzed per run
- 4 runs per day (every 6 hours)
- 80 tweets/day × $0.03 = **$2.40/day**

**Monthly Cost:** ~$72/month

### **Optimization:**
- Only analyze successful tweets (10K+ views OR 2%+ ER)
- Batch process (20 per run)
- Cache analyses (don't re-analyze same tweets)
- Use GPT-4o-mini for classification, GPT-4o for expert analysis

---

## ✅ SUMMARY: HOW IT WORKS

**Complete Flow:**

```
1. Scrape tweets (every 8h) → vi_viral_unknowns, vi_collected_tweets
   ↓
2. Classify tweets (every 6h) → vi_content_classification
   ↓
3. Expert analyze successful tweets (every 6h) → expert_tweet_analysis ← NEW
   ↓
4. Aggregate expert insights (every 12h) → vi_format_intelligence.expert_insights ← NEW
   ↓
5. Use in content generation (every 30min) → Generator receives expert advice ← NEW
   ↓
6. Content uses expert guidance → Better content → Better performance
   ↓
7. Loop continues → System gets smarter
```

**Key Points:**
- ✅ Expert analysis happens automatically (background job)
- ✅ Insights aggregated by angle/tone/structure
- ✅ Used in every content generation
- ✅ Continuous learning (analyzes new successful tweets)
- ✅ Cost-effective (only analyzes successful tweets)

**Result:**
- ✅ Content uses expert strategic advice
- ✅ Not just formatting data
- ✅ Understands WHY things work
- ✅ Gets actionable recommendations
- ✅ Continuously improves

