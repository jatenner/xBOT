# 💾 Resource Impact Analysis - Visual Intelligence System

## Current System Resource Usage

### Memory (4GB Total Available):
```
Node.js runtime: ~150 MB
Database connections: ~50 MB
Redis (if enabled): ~30 MB
Browser pool (2-3 active contexts): ~600-900 MB
Job overhead: ~100 MB
Learning systems: ~200 MB
Buffer: ~200 MB

Current total: ~1.3-1.6 GB
Remaining: ~2.4-2.7 GB
```

### CPU (4 Cores):
```
Idle: 10-20%
During scraping: 40-60%
During content generation: 30-50%
Peak (multiple jobs): 70-80%

Average: 35% utilization
Headroom: 65%
```

### Browser Contexts (8 Max):
```
Posting: 1 context
Metrics scraping: 1-2 contexts
Reply harvesting: 1 context
Analytics: 1 context

Concurrent max: 3-4 contexts
Available: 4-5 contexts
```

---

## Visual Intelligence Resource Impact

### New Memory Requirements:

#### Option A: Merge with Existing (MINIMAL IMPACT)
```
VI account scraping (merged with peer_scraper): +100 MB (1 context)
VI classification (merged with data_collection): +50 MB (OpenAI calls)
VI analysis (merged with data_collection): +30 MB (pattern extraction)

Total addition: +180 MB
New total: 1.8 GB
Remaining: 2.2 GB ✅
```

#### Option B: Separate Jobs (MODERATE IMPACT)
```
VI scraper job (2 contexts for 100 accounts): +300 MB
VI classifier job: +80 MB
VI analyzer job: +50 MB

Total addition: +430 MB
New total: 2.0 GB
Remaining: 2.0 GB ⚠️ Getting tight
```

#### Option C: All-in-One Daily Job (MINIMAL IMPACT)
```
VI pipeline (1 context, runs at 3am): +150 MB
Only active 1-2 hours per day
Low traffic time (3am)

Peak addition: +150 MB
Normal: +50 MB (minimal background)
Remaining: 2.3 GB ✅
```

---

## CPU Impact:

### Per Job Type:

#### Scraping (Light CPU, Waiting Dominant):
```
100 accounts × 5 seconds each = 500 seconds = 8.3 minutes
CPU during scraping: +15% (page load/parse)
Memory during scraping: +150 MB per context
```

#### Classification (Medium CPU, API Call Dominant):
```
100 tweets × 2 seconds per call = 200 seconds = 3.3 minutes
CPU during classification: +20% (JSON parsing, OpenAI API)
Memory during classification: +50 MB
```

#### Analysis (Light CPU, Pattern Extraction):
```
100 tweets × 0.5 seconds = 50 seconds = <1 minute
CPU during analysis: +10% (regex, counting)
Memory: +30 MB
```

**Total VI processing time: ~15 minutes per cycle**
**CPU impact: +15-20% during processing, 0% between cycles**

---

## Recommendation: Option A (Merge with Existing Jobs)

### Why Option A is Safest:

1. **No New Jobs**
   - Existing: 17 jobs
   - Added: 0 jobs
   - Total: 17 jobs ✅

2. **Memory Fits Comfortably**
   - Current: 1.6 GB
   - VI addition: +180 MB
   - Total: 1.78 GB
   - Remaining: 2.22 GB (55% free) ✅

3. **CPU Has Headroom**
   - Current avg: 35%
   - VI addition: +5% avg (only during processing)
   - Peak: 60% (still safe) ✅

4. **Browser Contexts Available**
   - Current: 3-4 in use
   - VI needs: +1 context
   - Total: 4-5 contexts
   - Max: 8 contexts ✅

5. **Leverages Existing Infrastructure**
   - peer_scraper already scrapes Twitter accounts
   - data_collection already processes data
   - account_discovery already finds accounts
   - Just extend them, don't duplicate

---

## Implementation Plan (Option A):

### Extend Existing Job #1: peer_scraper
```typescript
// Current: Scrapes 15-20 hardcoded health accounts
// Add: Scrape 100 VI accounts from vi_scrape_targets table

async function peerScraperJob() {
  // EXISTING: Scrape hardcoded peers
  await scrapePeerAccounts();
  
  // NEW: Scrape VI accounts (feature flagged)
  if (isVisualIntelligenceEnabled) {
    await scrapeVIAccounts();
  }
}

// Impact: +5-8 minutes to job runtime (acceptable)
```

### Extend Existing Job #2: data_collection
```typescript
// Current: Collects comprehensive data every 6 hours
// Add: Classify and analyze VI tweets

async function dataCollectionJob() {
  // EXISTING: Collect data
  await collectComprehensiveData();
  
  // NEW: Process VI tweets (feature flagged)
  if (isVisualIntelligenceEnabled) {
    await classifyVITweets();
    await analyzeVIPatterns();
    await buildVIIntelligence();
  }
}

// Impact: +8-12 minutes to job runtime (acceptable)
```

### Extend Existing Job #3: account_discovery
```typescript
// Current: Discovers reply opportunities
// Add: Discover micro-influencer accounts

async function accountDiscoveryJob() {
  // EXISTING: Discover reply targets
  await discoverReplyOpportunities();
  
  // NEW: Discover micro-influencers (feature flagged, weekly only)
  const isWeekly = new Date().getDay() === 0; // Sunday
  if (isVisualIntelligenceEnabled && isWeekly) {
    await discoverMicroInfluencers();
  }
}

// Impact: +10-15 minutes once per week (minimal)
```

---

## Safety Checklist:

✅ Memory: Fits comfortably (1.8GB / 4GB = 45%)
✅ CPU: Has headroom (40% avg vs 100% max)
✅ Browser contexts: Within limits (5 / 8 = 62%)
✅ Jobs: No new jobs (17 total, same as now)
✅ OpenAI budget: Minimal increase ($0.26/month)
✅ Feature flagged: Can disable if issues arise
✅ Extends existing jobs: Leverages proven infrastructure

---

## Decision: Option A is Safest and Best

**Advantages:**
- No new job scheduling complexity
- Minimal resource increase
- Proven infrastructure reuse
- Easy to disable (feature flag)
- Gradual rollout (runs in background for 30 days)

**Disadvantages:**
- Existing jobs run slightly longer (acceptable)
- Data collection every 6-8 hours instead of 3 hours (slower but safer)

**Verdict:** Proceed with Option A

