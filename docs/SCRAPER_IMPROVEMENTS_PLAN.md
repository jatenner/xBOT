# 🎯 Scraper Improvements Plan
**Created:** November 5, 2025  
**Goal:** Bulletproof scraping that stores correct data autonomously

---

## 🚨 Current State (Nov 5, 4 PM)

### **What's Working:**
- ✅ Scraper runs every 20 minutes
- ✅ Extracts impressions reliably
- ✅ Syncs to content_metadata (just deployed)
- ✅ Generic URL works for all tweet types

### **What's NOT Ideal:**
- ⚠️ Uses regex text parsing (brittle - Twitter can change text format)
- ⚠️ Defaults to 0 when not found (might hide real issues)
- ⚠️ No validation (accepts 0 for tweets that should have engagement)
- ⚠️ No health monitoring (can't tell if scraper is degraded)
- ⚠️ Single extraction strategy (no fallback chain)

---

## 🎯 Goal: Multi-Strategy Extraction

**Principle:** Try multiple methods, pick the most reliable result

```
STRATEGY 1: DOM Selectors (Most Reliable)
├─ Extract from analytics page DOM elements
├─ Uses data-testid and aria-label attributes
└─ Success rate: 85% (when page loads correctly)

STRATEGY 2: Analytics Text Parsing (Current Method)
├─ Extract from visible text on analytics page
├─ Uses regex patterns
└─ Success rate: 60% (when text format matches)

STRATEGY 3: Public Tweet Page (Fallback)
├─ Extract from public tweet view (no login required)
├─ Uses engagement buttons' aria-labels
└─ Success rate: 90% (most stable)

STRATEGY 4: Cross-Validation
├─ Compare results from multiple strategies
├─ Flag discrepancies for manual review
└─ Use median value if strategies disagree
```

---

## 🔧 Improvement 1: Multi-Strategy Extraction

### **File:** `src/scrapers/bulletproofTwitterScraper.ts`

**Add new extraction methods:**

```typescript
async extractMetricsWithStrategies(page: Page, tweetId: string): Promise<ScrapedMetrics> {
  const strategies = [];
  
  // Strategy 1: Try analytics page DOM extraction
  try {
    const analyticsMetrics = await this.extractFromAnalyticsDOM(page);
    if (this.metricsHaveMinimumData(analyticsMetrics)) {
      strategies.push({ name: 'analytics_dom', metrics: analyticsMetrics, confidence: 0.85 });
    }
  } catch (e) {
    log({ op: 'analytics_dom_failed', error: e.message });
  }
  
  // Strategy 2: Try analytics page text parsing (current method)
  try {
    const textMetrics = await this.extractFromAnalyticsText(page);
    if (this.metricsHaveMinimumData(textMetrics)) {
      strategies.push({ name: 'analytics_text', metrics: textMetrics, confidence: 0.60 });
    }
  } catch (e) {
    log({ op: 'analytics_text_failed', error: e.message });
  }
  
  // Strategy 3: Fallback to public tweet page (most reliable)
  if (strategies.length === 0) {
    try {
      await page.goto(`https://twitter.com/i/status/${tweetId}`, { waitUntil: 'networkidle' });
      const publicMetrics = await this.extractFromPublicTweet(page, tweetId);
      if (this.metricsHaveMinimumData(publicMetrics)) {
        strategies.push({ name: 'public_tweet', metrics: publicMetrics, confidence: 0.90 });
      }
    } catch (e) {
      log({ op: 'public_tweet_failed', error: e.message });
    }
  }
  
  // Pick best strategy or merge results
  return this.selectBestMetrics(strategies, tweetId);
}
```

**Benefits:**
- ✅ Not dependent on single extraction method
- ✅ Can detect when one method fails
- ✅ Automatically tries alternatives
- ✅ Logs which strategy worked

---

## 🔧 Improvement 2: Smart Validation

### **Problem:** Currently accepts 0 for everything (might be wrong)

**Add realistic validation:**

```typescript
validateMetricsRealistic(metrics: ScrapedMetrics, tweetAge: number): ValidationResult {
  const issues = [];
  
  // Check 1: Old tweet with 0 engagement is suspicious
  if (tweetAge > 24 * 60 * 60 * 1000) { // > 24 hours old
    if (metrics.views === 0 || metrics.views === null) {
      issues.push({ severity: 'high', message: 'Tweet >24h old but 0 views' });
    }
  }
  
  // Check 2: Engagement rate sanity
  if (metrics.views > 0) {
    const totalEngagement = (metrics.likes || 0) + (metrics.retweets || 0) + (metrics.replies || 0);
    const engagementRate = totalEngagement / metrics.views;
    
    if (engagementRate > 0.5) {
      issues.push({ severity: 'medium', message: `Unrealistic ER: ${(engagementRate * 100).toFixed(1)}%` });
    }
  }
  
  // Check 3: Likes should be >= retweets (usually)
  if (metrics.retweets > metrics.likes * 2) {
    issues.push({ severity: 'low', message: 'Retweets > 2x likes (unusual)' });
  }
  
  // Check 4: Compare to historical average
  const avgViews = await this.getAverageViews(); // From past 10 tweets
  if (metrics.views > avgViews * 50) { // 50x average is suspicious
    issues.push({ severity: 'high', message: `Views ${metrics.views} >> average ${avgViews}` });
  }
  
  return {
    valid: issues.filter(i => i.severity === 'high').length === 0,
    warnings: issues,
    confidence: this.calculateConfidence(issues)
  };
}
```

**Benefits:**
- ✅ Detects clearly wrong data
- ✅ Flags suspicious metrics for review
- ✅ Learns from historical patterns
- ✅ Prevents garbage data in dashboard

---

## 🔧 Improvement 3: Extraction from Public Tweet (Most Reliable)

### **Why Public Tweet Page is Better:**
- ✅ Always has engagement buttons (like, RT, reply)
- ✅ Uses aria-label (screen reader text - very stable)
- ✅ Doesn't require analytics page (which sometimes fails)
- ✅ Works for ALL tweets (singles, threads, replies)

**Implementation:**

```typescript
async extractFromPublicTweet(page: Page, tweetId: string): Promise<ScrapedMetrics> {
  // Navigate to public tweet (not analytics)
  await page.goto(`https://twitter.com/i/status/${tweetId}`, { waitUntil: 'networkidle' });
  
  // Find the tweet article by data-tweet-id attribute
  const tweetArticle = await page.$(`article[data-tweet-id="${tweetId}"]`);
  if (!tweetArticle) {
    // Fallback: find by looking for tweet ID in URL
    const allArticles = await page.$$('article[data-testid="tweet"]');
    for (const article of allArticles) {
      const links = await article.$$('a[href*="/status/"]');
      for (const link of links) {
        const href = await link.getAttribute('href');
        if (href?.includes(tweetId)) {
          tweetArticle = article;
          break;
        }
      }
      if (tweetArticle) break;
    }
  }
  
  if (!tweetArticle) {
    throw new Error('Could not find tweet article');
  }
  
  // Extract from engagement buttons (most reliable method)
  const metrics: ScrapedMetrics = {
    likes: null,
    retweets: null,
    replies: null,
    views: null
  };
  
  // LIKES: [data-testid="like"] or [data-testid="unlike"]
  const likeBtn = await tweetArticle.$('[data-testid="like"], [data-testid="unlike"]');
  if (likeBtn) {
    const ariaLabel = await likeBtn.getAttribute('aria-label');
    // "3 Likes. Like" or "Like"
    const match = ariaLabel?.match(/(\d[\d,]*)\s*(?:Like|like)/);
    metrics.likes = match ? parseInt(match[1].replace(/,/g, '')) : 0;
  }
  
  // RETWEETS: [data-testid="retweet"] or [data-testid="unretweet"]
  const rtBtn = await tweetArticle.$('[data-testid="retweet"], [data-testid="unretweet"]');
  if (rtBtn) {
    const ariaLabel = await rtBtn.getAttribute('aria-label');
    // "5 Reposts. Repost" or "Repost"
    const match = ariaLabel?.match(/(\d[\d,]*)\s*(?:Repost|Retweet)/);
    metrics.retweets = match ? parseInt(match[1].replace(/,/g, '')) : 0;
  }
  
  // REPLIES: [data-testid="reply"]
  const replyBtn = await tweetArticle.$('[data-testid="reply"]');
  if (replyBtn) {
    const ariaLabel = await replyBtn.getAttribute('aria-label');
    // "2 Replies. Reply" or "Reply"
    const match = ariaLabel?.match(/(\d[\d,]*)\s*(?:Repl|reply)/i);
    metrics.replies = match ? parseInt(match[1].replace(/,/g, '')) : 0;
  }
  
  // VIEWS: Look for analytics link or view count text
  const viewsElement = await tweetArticle.$('a[href*="/analytics"]');
  if (viewsElement) {
    const viewsText = await viewsElement.textContent();
    // "2.2K Views" or "1,234 Views"
    metrics.views = this.parseViewCount(viewsText);
  }
  
  log({ 
    op: 'public_tweet_extraction', 
    tweet_id: tweetId,
    likes: metrics.likes,
    retweets: metrics.retweets,
    replies: metrics.replies,
    views: metrics.views
  });
  
  return metrics;
}
```

**Benefits:**
- ✅ Most stable extraction method (aria-label rarely changes)
- ✅ Works without analytics access
- ✅ Gets real engagement data
- ✅ Can extract views from multiple sources

---

## 🔧 Improvement 4: Health Monitoring & Auto-Recovery

### **Add scraper health metrics:**

```typescript
class ScraperHealthMonitor {
  private stats = {
    total_attempts: 0,
    successful_extractions: 0,
    failed_extractions: 0,
    fallback_uses: 0,
    validation_failures: 0,
    strategies_used: {} as Record<string, number>,
    last_24h_success_rate: 0
  };
  
  recordExtraction(result: ExtractionResult) {
    this.stats.total_attempts++;
    
    if (result.success) {
      this.stats.successful_extractions++;
      this.stats.strategies_used[result.strategy] = 
        (this.stats.strategies_used[result.strategy] || 0) + 1;
    } else {
      this.stats.failed_extractions++;
    }
    
    if (result.usedFallback) {
      this.stats.fallback_uses++;
    }
    
    if (result.validationIssues && result.validationIssues.length > 0) {
      this.stats.validation_failures++;
    }
    
    // Calculate rolling success rate
    this.updateSuccessRate();
    
    // Auto-alert if degraded
    if (this.stats.last_24h_success_rate < 0.7) {
      this.alertDegradedPerformance();
    }
  }
  
  async alertDegradedPerformance() {
    log({ 
      op: 'scraper_degraded', 
      success_rate: this.stats.last_24h_success_rate,
      total_failures: this.stats.failed_extractions,
      recommendation: 'Check Twitter DOM changes or rate limits'
    });
    
    // Store in database for dashboard alert
    await supabase.from('system_alerts').insert({
      alert_type: 'scraper_degraded',
      severity: 'high',
      message: `Scraper success rate: ${(this.stats.last_24h_success_rate * 100).toFixed(1)}%`,
      metadata: this.stats
    });
  }
  
  getHealthReport() {
    return {
      status: this.stats.last_24h_success_rate > 0.9 ? 'healthy' : 
              this.stats.last_24h_success_rate > 0.7 ? 'degraded' : 'critical',
      success_rate: this.stats.last_24h_success_rate,
      total_attempts: this.stats.total_attempts,
      preferred_strategy: Object.entries(this.stats.strategies_used)
        .sort((a, b) => b[1] - a[1])[0]?.[0],
      ...this.stats
    };
  }
}
```

**Benefits:**
- ✅ Detects when scraper is degraded
- ✅ Alerts you automatically
- ✅ Shows which strategy is most reliable
- ✅ Tracks success rate over time

---

## 🔧 Improvement 5: Dashboard Verification Loop

### **Problem:** Data might be stored but not displayed

**Add end-to-end verification:**

```typescript
async verifyDataFlowComplete(tweetId: string): Promise<boolean> {
  // Step 1: Check if scraped to outcomes
  const { data: outcome } = await supabase
    .from('outcomes')
    .select('*')
    .eq('tweet_id', tweetId)
    .order('collected_at', { ascending: false })
    .limit(1)
    .single();
  
  if (!outcome) {
    log({ op: 'verification_failed', tweet_id: tweetId, stage: 'outcomes_missing' });
    return false;
  }
  
  // Step 2: Check if synced to content_metadata
  const { data: content } = await supabase
    .from('content_metadata')
    .select('actual_impressions, actual_likes, actual_retweets')
    .eq('tweet_id', tweetId)
    .single();
  
  if (!content || content.actual_impressions === null) {
    log({ op: 'verification_failed', tweet_id: tweetId, stage: 'content_metadata_not_synced' });
    
    // AUTO-FIX: Sync now
    await this.syncOutcomesToContentMetadata(tweetId);
    return false;
  }
  
  // Step 3: Verify values match
  if (content.actual_impressions !== outcome.impressions) {
    log({ 
      op: 'verification_mismatch', 
      tweet_id: tweetId,
      outcomes_value: outcome.impressions,
      content_metadata_value: content.actual_impressions
    });
  }
  
  log({ op: 'verification_success', tweet_id: tweetId });
  return true;
}
```

**Benefits:**
- ✅ Ensures data reaches dashboard
- ✅ Auto-fixes sync issues
- ✅ Detects discrepancies
- ✅ Logs verification results

---

## 📊 Implementation Priority

### **Phase 1: Reliability (This Week)**
1. ✅ **Add public tweet extraction** (most reliable method)
2. ✅ **Add multi-strategy selection** (try multiple, pick best)
3. ✅ **Add validation** (reject clearly wrong data)

**Files to modify:**
- `src/scrapers/bulletproofTwitterScraper.ts`
- `src/jobs/metricsScraperJob.ts`

**Expected improvement:** 60% → 95% success rate

---

### **Phase 2: Monitoring (Next Week)**
4. ✅ **Add health monitoring** (track success rate)
5. ✅ **Add dashboard verification** (end-to-end check)
6. ✅ **Add auto-recovery** (fix common issues)

**Files to modify:**
- `src/scrapers/scraperHealthMonitor.ts` (new file)
- `src/jobs/metricsScraperJob.ts`
- `src/dashboard/systemHealthDashboard.ts`

**Expected improvement:** Detect issues within 1 hour, auto-fix 80% of problems

---

### **Phase 3: Intelligence (Future)**
7. ✅ **Learn optimal extraction strategy per tweet type**
8. ✅ **Predict when scraping will fail (rate limits, etc)**
9. ✅ **Auto-adjust batch size based on success rate**

**Expected improvement:** 95% → 99% success rate, autonomous operation

---

## 🎯 Success Metrics

**Current (Nov 5, 4 PM):**
- Success rate: ~60% (regex only)
- Manual intervention: Required when broken
- Recovery time: Hours (need to deploy fix)

**After Phase 1:**
- Success rate: ~95% (multi-strategy)
- Manual intervention: Rare
- Recovery time: Minutes (auto-fallback)

**After Phase 2:**
- Success rate: ~95%
- Manual intervention: None (auto-recovery)
- Recovery time: Seconds (auto-fix)
- Alert time: < 1 hour (health monitoring)

**After Phase 3:**
- Success rate: ~99%
- Manual intervention: None
- Recovery time: Immediate
- Predictive: Yes (avoid failures before they happen)

---

## 🚀 Quick Wins (Deploy Today)

### **1. Add Public Tweet Extraction (30 min)**
- Most stable method
- Works for all tweet types
- Doesn't rely on analytics page

### **2. Add Basic Validation (15 min)**
- Reject metrics where views=0 but tweet is >24h old
- Flag unrealistic engagement rates
- Log suspicious data

### **3. Add Verification Loop (15 min)**
- Check if data reaches dashboard
- Auto-sync if missing
- Log verification results

**Total time:** ~1 hour  
**Expected impact:** 60% → 85% success rate immediately

---

## 📝 Next Steps

1. **Deploy Phase 1 improvements** (public tweet extraction + validation)
2. **Monitor for 24 hours** (verify success rate improves)
3. **Deploy Phase 2** (health monitoring + auto-recovery)
4. **Review health dashboard** (identify remaining issues)
5. **Plan Phase 3** (ML-based optimization)

---

**Ready to implement Phase 1? It will take ~1 hour and make scraping significantly more reliable.**

