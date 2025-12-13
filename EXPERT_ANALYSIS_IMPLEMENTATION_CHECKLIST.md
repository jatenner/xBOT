# 🚀 EXPERT ANALYSIS IMPLEMENTATION CHECKLIST

## ✅ PRE-BUILD VERIFICATION

### **Database Readiness:**
- [x] Check if `vi_format_intelligence` table exists
- [ ] Check if `expert_tweet_analysis` table exists (will create)
- [ ] Verify Supabase connection works
- [ ] Check existing VI tables structure

### **Integration Points:**
- [x] `planJob.ts` - Where content is generated
- [x] `jobManager.ts` - Where jobs are scheduled
- [x] `viIntelligenceFeed.ts` - Where VI insights are retrieved
- [x] `viProcessor.ts` - Where tweets are classified

---

## 📋 FILES TO CREATE

### **1. Database Migration**
- [ ] `supabase/migrations/YYYYMMDD_create_expert_tweet_analysis.sql`
  - Creates `expert_tweet_analysis` table
  - Adds `expert_insights` column to `vi_format_intelligence`
  - Creates indexes

### **2. Expert Analyzer**
- [ ] `src/intelligence/expertTweetAnalyzer.ts`
  - `ExpertTweetAnalyzer` class
  - `analyzeTweet()` method
  - `buildExpertPrompt()` method
  - `getExpertAnalysis()` method
  - `storeExpertAnalysis()` method
  - `getTweetsNeedingAnalysis()` method

### **3. Expert Analysis Job**
- [ ] `src/jobs/expertAnalysisJob.ts`
  - `expertAnalysisJob()` function
  - Gets tweets needing analysis
  - Processes in batches
  - Error handling

### **4. Expert Insights Aggregator**
- [ ] `src/intelligence/expertInsightsAggregator.ts`
  - `ExpertInsightsAggregator` class
  - `getRecentAnalyses()` method
  - `groupByCombination()` method
  - `synthesizeInsights()` method
  - `storeInsights()` method

### **5. Expert Aggregator Job**
- [ ] `src/jobs/expertInsightsAggregatorJob.ts`
  - `expertInsightsAggregatorJob()` function
  - Aggregates insights
  - Stores in `vi_format_intelligence`

---

## 📝 FILES TO MODIFY

### **1. planJob.ts**
- [ ] Import `getExpertInsightsForCombination`
- [ ] After getting VI insights, get expert insights
- [ ] Convert expert insights to advice string
- [ ] Append to `visualFormattingInsights`

### **2. jobManager.ts**
- [ ] Add `expertAnalysisJob` schedule (every 6 hours)
- [ ] Add `expertInsightsAggregatorJob` schedule (every 12 hours)
- [ ] Stagger timing appropriately

### **3. viIntelligenceFeed.ts**
- [ ] Add method to get expert insights
- [ ] Query `vi_format_intelligence.expert_insights`

---

## 🔧 INTEGRATION STEPS

### **Step 1: Database Setup**
1. Create migration file
2. Run migration (or let Supabase auto-apply)
3. Verify tables created

### **Step 2: Core Analyzer**
1. Create `expertTweetAnalyzer.ts`
2. Implement analysis logic
3. Test with sample tweet

### **Step 3: Jobs**
1. Create `expertAnalysisJob.ts`
2. Create `expertInsightsAggregatorJob.ts`
3. Add to `jobManager.ts`

### **Step 4: Integration**
1. Modify `viIntelligenceFeed.ts` to retrieve expert insights
2. Modify `planJob.ts` to use expert insights
3. Test content generation

### **Step 5: Testing**
1. Test expert analysis on sample tweets
2. Test aggregation
3. Test content generation with expert advice
4. Verify database writes

---

## 🗄️ DATABASE SCHEMA

### **New Table: `expert_tweet_analysis`**
```sql
CREATE TABLE IF NOT EXISTS expert_tweet_analysis (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tweet_id TEXT NOT NULL,
  source_table TEXT NOT NULL,
  
  -- Strategic Analysis (JSONB)
  strategic_analysis JSONB NOT NULL,
  
  -- Content Intelligence (JSONB)
  content_intelligence JSONB NOT NULL,
  
  -- Performance Insights (JSONB)
  performance_insights JSONB NOT NULL,
  
  -- Actionable Recommendations (JSONB)
  actionable_recommendations JSONB NOT NULL,
  
  -- Visual Analysis (JSONB)
  visual_analysis JSONB NOT NULL,
  
  -- Confidence & Metadata
  confidence DECIMAL(3,2) DEFAULT 0.8,
  analyzed_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Performance Data
  engagement_rate NUMERIC(5,4),
  impressions INTEGER,
  likes INTEGER,
  retweets INTEGER,
  replies INTEGER,
  
  -- Constraints
  CONSTRAINT expert_analysis_tweet_id_unique UNIQUE (tweet_id, source_table)
);

CREATE INDEX IF NOT EXISTS idx_expert_analysis_tweet_id 
  ON expert_tweet_analysis (tweet_id);

CREATE INDEX IF NOT EXISTS idx_expert_analysis_analyzed_at 
  ON expert_tweet_analysis (analyzed_at DESC);
```

### **Modify Table: `vi_format_intelligence`**
```sql
ALTER TABLE vi_format_intelligence
ADD COLUMN IF NOT EXISTS expert_insights JSONB,
ADD COLUMN IF NOT EXISTS strategic_recommendations TEXT[],
ADD COLUMN IF NOT EXISTS content_strategy TEXT;
```

---

## 🔄 DATA FLOW

```
1. VI Scraper → vi_viral_unknowns, vi_collected_tweets
2. VI Processor → vi_content_classification
3. Expert Analyzer → expert_tweet_analysis (NEW)
4. Expert Aggregator → vi_format_intelligence.expert_insights (NEW)
5. planJob → Gets expert insights → Uses in generation (NEW)
```

---

## ✅ SUCCESS CRITERIA

- [ ] Expert analysis runs automatically every 6 hours
- [ ] Expert insights aggregated every 12 hours
- [ ] Content generation uses expert advice
- [ ] Database stores all analyses correctly
- [ ] No errors in logs
- [ ] Content quality improves

---

## 🚨 POTENTIAL ISSUES & FIXES

### **Issue 1: Database Connection**
- **Fix:** Verify DATABASE_URL in .env
- **Fix:** Check Supabase connection

### **Issue 2: GPT-4o Rate Limits**
- **Fix:** Batch processing (20 tweets per run)
- **Fix:** Add retry logic with exponential backoff

### **Issue 3: Cost Overruns**
- **Fix:** Only analyze successful tweets (10K+ views OR 2%+ ER)
- **Fix:** Cache analyses (don't re-analyze same tweets)

### **Issue 4: Integration Errors**
- **Fix:** Test each component independently
- **Fix:** Add error handling and logging

---

## 📊 TESTING PLAN

### **Test 1: Expert Analyzer**
```typescript
// Test with sample tweet
const analyzer = new ExpertTweetAnalyzer();
const tweet = { tweet_id: '123', content: '...', views: 15000 };
await analyzer.analyzeTweet(tweet);
// Verify: Check expert_tweet_analysis table
```

### **Test 2: Aggregator**
```typescript
// Test aggregation
const aggregator = new ExpertInsightsAggregator();
await aggregator.aggregateInsights();
// Verify: Check vi_format_intelligence.expert_insights
```

### **Test 3: Content Generation**
```typescript
// Test planJob with expert insights
// Verify: Generated content includes expert advice
```

---

## 🎯 READY TO BUILD?

**YES!** All components mapped out:
- ✅ Database schema defined
- ✅ Files to create identified
- ✅ Files to modify identified
- ✅ Integration points clear
- ✅ Testing plan ready

**Let's build! 🚀**

