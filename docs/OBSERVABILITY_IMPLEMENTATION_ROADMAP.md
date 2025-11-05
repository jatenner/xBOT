# 🗺️ Observability Implementation Roadmap
**Created:** November 5, 2025  
**Purpose:** Step-by-step plan to build production-grade monitoring

---

## 🎯 **The Goal**

**Transform from:**
- Manual log checking
- 1-hour detection time
- Silent failures

**To:**
- Automatic error alerts
- 30-second detection
- Proactive monitoring

---

## 📋 **Complete Roadmap (Two Phases)**

### **PHASE 1: Foundation (This Week - 1.5 hours)**
Quick wins, immediate impact, all free

### **PHASE 2: Advanced (Next Week - 3 hours)**  
Full observability, production-grade, still free

---

## 🚀 **PHASE 1: Foundation (This Week)**

### **Step 1: Sign Up for Free Accounts (10 minutes)**

**What you need to do:**

**1.1 Sentry (Error Tracking)**
- Go to: https://sentry.io/signup
- Sign up (free)
- Create new project: "xbot"
- Platform: "Node.js"
- Copy your DSN (looks like: `https://abc123@o123.ingest.sentry.io/456`)
- Save for later

**1.2 Axiom (Logs - OPTIONAL for Phase 1)**
- Go to: https://axiom.co/signup
- Sign up (free)
- Create dataset: "xbot-logs"
- Copy API token
- Save for later

**1.3 Grafana Cloud (Metrics - OPTIONAL for Phase 1)**
- Go to: https://grafana.com/auth/sign-up
- Sign up (free)
- Note: We'll set this up in Phase 2

**What you'll have:**
- Sentry DSN key
- Axiom API token (optional)
- Ready to integrate

---

### **Step 2: Install Sentry (10 minutes)**

**What I'll do:**

```bash
# Install Sentry SDK
npm install @sentry/node @sentry/profiling-node
```

**Add to .env:**
```bash
SENTRY_DSN=https://your-key-here@o123.ingest.sentry.io/456
SENTRY_ENVIRONMENT=production
SENTRY_TRACES_SAMPLE_RATE=0.1  # Sample 10% of transactions
```

**Create initialization file:**
```typescript
// src/observability/sentry.ts
import * as Sentry from '@sentry/node';
import { ProfilingIntegration } from '@sentry/profiling-node';
import { ENV } from '../config/env';

export function initializeSentry() {
  if (!ENV.SENTRY_DSN) {
    console.warn('⚠️ SENTRY: DSN not configured, skipping initialization');
    return;
  }

  Sentry.init({
    dsn: ENV.SENTRY_DSN,
    environment: ENV.NODE_ENV,
    
    // Performance monitoring (10% of requests)
    tracesSampleRate: parseFloat(ENV.SENTRY_TRACES_SAMPLE_RATE || '0.1'),
    
    // Profiling (10% of requests)
    profilesSampleRate: 0.1,
    
    integrations: [
      new ProfilingIntegration(),
    ],
    
    // Filter out sensitive data
    beforeSend(event) {
      // Remove sensitive fields
      if (event.request?.headers) {
        delete event.request.headers['authorization'];
        delete event.request.headers['cookie'];
      }
      return event;
    }
  });

  console.log('✅ SENTRY: Initialized');
}
```

**Update env.ts:**
```typescript
// Add to envSchema
SENTRY_DSN: z.string().optional(),
SENTRY_ENVIRONMENT: z.string().default('production'),
SENTRY_TRACES_SAMPLE_RATE: z.string().optional(),
```

**What this does:**
- Captures all unhandled errors
- Sends to Sentry dashboard
- No code changes needed yet

---

### **Step 3: Initialize Sentry in Main Entry Point (5 minutes)**

**Update main-bulletproof.ts:**
```typescript
// At the very top, before any other imports
import './observability/sentry';  // ← Add this line
import { initializeSentry } from './observability/sentry';

// Initialize before starting jobs
initializeSentry();

// Rest of code...
```

**Test it works:**
```typescript
// Add test error (we'll remove this after testing)
setTimeout(() => {
  throw new Error('TEST: Sentry integration working!');
}, 5000);
```

**What this does:**
- Sentry catches ALL errors automatically
- No manual error logging needed

---

### **Step 4: Add Context to Critical Operations (20 minutes)**

**Instrument key operations:**

```typescript
// src/jobs/metricsScraperJob.ts
import * as Sentry from '@sentry/node';

export async function metricsScraperJob(): Promise<void> {
  // Create transaction for this job
  const transaction = Sentry.startTransaction({
    op: 'job',
    name: 'metrics_scraper_job'
  });

  try {
    // ... existing code ...
    
    // Add breadcrumbs for debugging
    Sentry.addBreadcrumb({
      message: `Found ${posts.length} posts to scrape`,
      level: 'info',
      data: { recentCount, historicalCount }
    });
    
    // ... scraping logic ...
    
    transaction.setStatus('ok');
    
  } catch (error) {
    transaction.setStatus('error');
    Sentry.captureException(error, {
      tags: { job: 'metrics_scraper' },
      extra: { posts_count: posts.length }
    });
    throw error;
  } finally {
    transaction.finish();
  }
}
```

**Do this for:**
- metricsScraperJob ✓
- postingQueue ✓
- planJob ✓
- replyJob ✓

**What this does:**
- Adds context to errors
- Shows performance traces
- Makes debugging 10x easier

---

### **Step 5: Add Health Endpoint (15 minutes)**

**Create:** `src/api/healthEndpoint.ts`

```typescript
import { getSupabaseClient } from '../db';
import { BulletproofTwitterScraper } from '../scrapers/bulletproofTwitterScraper';

export async function getSystemHealth() {
  const supabase = getSupabaseClient();
  const now = new Date();
  
  // Check 1: Database connectivity
  const dbHealth = await checkDatabase(supabase);
  
  // Check 2: Recent posting activity
  const postingHealth = await checkPosting(supabase);
  
  // Check 3: Scraper performance
  const scraperHealth = await checkScraper();
  
  // Check 4: Queue status
  const queueHealth = await checkQueue(supabase);
  
  const allHealthy = 
    dbHealth.healthy && 
    postingHealth.healthy && 
    scraperHealth.healthy && 
    queueHealth.healthy;
  
  return {
    status: allHealthy ? 'healthy' : 'degraded',
    timestamp: now.toISOString(),
    checks: {
      database: dbHealth,
      posting: postingHealth,
      scraper: scraperHealth,
      queue: queueHealth
    }
  };
}

async function checkDatabase(supabase: any) {
  try {
    const start = Date.now();
    const { error } = await supabase.from('content_metadata').select('id').limit(1);
    const duration = Date.now() - start;
    
    return {
      healthy: !error && duration < 1000,
      duration_ms: duration,
      message: error ? error.message : 'OK'
    };
  } catch (error: any) {
    return { healthy: false, duration_ms: 0, message: error.message };
  }
}

async function checkPosting(supabase: any) {
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  
  const { count: postCount } = await supabase
    .from('content_metadata')
    .select('*', { count: 'exact', head: true })
    .eq('decision_type', 'single')
    .eq('status', 'posted')
    .gte('posted_at', twoHoursAgo);
  
  const { count: replyCount } = await supabase
    .from('content_metadata')
    .select('*', { count: 'exact', head: true })
    .eq('decision_type', 'reply')
    .eq('status', 'posted')
    .gte('posted_at', twoHoursAgo);
  
  const expectedPosts = 4;  // 2 posts/hour × 2 hours
  const expectedReplies = 8; // 4 replies/hour × 2 hours
  
  const healthy = (postCount || 0) >= expectedPosts * 0.5 && 
                  (replyCount || 0) >= expectedReplies * 0.5;
  
  return {
    healthy,
    posts: postCount || 0,
    replies: replyCount || 0,
    expected_posts: expectedPosts,
    expected_replies: expectedReplies,
    message: healthy ? 'OK' : `Low posting rate (${postCount} posts, ${replyCount} replies in 2h)`
  };
}

async function checkScraper() {
  try {
    const scraper = BulletproofTwitterScraper.getInstance();
    const health = await scraper.getSuccessRate(24);
    
    const healthy = health.rate >= 0.85;
    
    return {
      healthy,
      success_rate: health.rate,
      total_attempts: health.total,
      successful: health.successful,
      failed: health.failed,
      message: healthy ? 'OK' : `Low success rate: ${(health.rate * 100).toFixed(1)}%`
    };
  } catch (error: any) {
    return {
      healthy: false,
      message: `Health check failed: ${error.message}`
    };
  }
}

async function checkQueue(supabase: any) {
  const { count: queuedCount } = await supabase
    .from('content_metadata')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'queued');
  
  const healthy = (queuedCount || 0) < 50;
  
  return {
    healthy,
    queued_items: queuedCount || 0,
    message: healthy ? 'OK' : `Queue backed up (${queuedCount} items)`
  };
}
```

**Add route in server.ts:**
```typescript
import { getSystemHealth } from './api/healthEndpoint';

app.get('/api/health', async (req, res) => {
  try {
    const health = await getSystemHealth();
    res.status(health.status === 'healthy' ? 200 : 503).json(health);
  } catch (error: any) {
    res.status(500).json({ 
      status: 'error', 
      message: error.message 
    });
  }
});
```

**What this gives you:**
- Single URL to check system health
- External monitoring can ping it
- Returns 200 if healthy, 503 if degraded

---

### **Step 6: Add Console Alerts to Critical Jobs (20 minutes)**

**Add to metricsScraperJob.ts (after scraping):**
```typescript
// After job completes
console.log(`[METRICS_JOB] ✅ Metrics collection complete: ${updated} updated, ${skipped} skipped, ${failed} failed`);

// ALERT: Check success rate
const successRate = updated / (updated + failed);
if ((updated + failed) >= 5 && successRate < 0.7) {
  console.error('🚨🚨🚨 CRITICAL ALERT 🚨🚨🚨');
  console.error(`🚨 SCRAPER DEGRADED: ${(successRate * 100).toFixed(1)}% success rate (expected >85%)`);
  console.error(`🚨 Updated: ${updated}, Failed: ${failed}`);
  console.error(`🚨 ACTION: Check scraper_health table for details`);
  console.error('🚨🚨🚨 END ALERT 🚨🚨🚨');
  
  // Also send to Sentry
  Sentry.captureMessage('Scraper degraded', {
    level: 'error',
    tags: { alert_type: 'scraper_degraded' },
    extra: { success_rate: successRate, updated, failed }
  });
}
```

**Add to postingQueue.ts (after cycle):**
```typescript
// Check posting activity
const { count: recentPosts } = await supabase
  .from('content_metadata')
  .select('*', { count: 'exact', head: true })
  .eq('status', 'posted')
  .gte('posted_at', new Date(Date.now() - 2 * 60 * 60 * 1000));

if ((recentPosts || 0) === 0) {
  console.error('🚨🚨🚨 CRITICAL ALERT 🚨🚨🚨');
  console.error('🚨 NO POSTS IN LAST 2 HOURS');
  console.error('🚨 Expected: 4 posts + 8 replies = 12 total');
  console.error('🚨 ACTION: Check posting queue, browser pool, rate limits');
  console.error('🚨🚨🚨 END ALERT 🚨🚨🚨');
  
  Sentry.captureMessage('Posting stopped', {
    level: 'critical',
    tags: { alert_type: 'posting_stopped' }
  });
}
```

**What this gives you:**
- Visible alerts in Railway logs
- Hard to miss (triple emoji lines)
- Also sent to Sentry for tracking

---

### **Step 7: Test Everything (10 minutes)**

**After deployment:**

**Test 1: Sentry Error Capture**
```typescript
// Add temporary test error in server.ts
app.get('/test-sentry', (req, res) => {
  throw new Error('TEST: Sentry integration working!');
});

// Visit: http://your-app/test-sentry
// Check: Sentry dashboard should show the error
```

**Test 2: Health Endpoint**
```bash
# Check health endpoint
curl https://xbot-production-844b.up.railway.app/api/health

# Should return:
{
  "status": "healthy",
  "timestamp": "2025-11-05T...",
  "checks": {
    "database": { "healthy": true, "duration_ms": 45 },
    "posting": { "healthy": true, "posts": 4, "replies": 9 },
    "scraper": { "healthy": true, "success_rate": 0.94 },
    "queue": { "healthy": true, "queued_items": 5 }
  }
}
```

**Test 3: Console Alerts**
```bash
# Watch Railway logs, wait for next scraper run
railway logs --tail 100

# Should see alerts if any issues:
# 🚨🚨🚨 CRITICAL ALERT 🚨🚨🚨
```

**What you verify:**
- Sentry captures errors ✓
- Health endpoint works ✓
- Alerts show in logs ✓

---

## 📊 **Phase 1 Summary**

**Time Investment:** 1.5 hours  
**Cost:** $0/month  
**What You Get:**

✅ **Automatic error tracking** (Sentry)
- Every error captured
- Stack traces + context
- Email alerts

✅ **Health endpoint** (/api/health)
- Single URL to check system
- External monitors can use it
- Simple, reliable

✅ **Console alerts**
- Visible in Railway logs
- Loud, hard to miss
- No external dependencies

**Detection time:** 30 seconds (errors), 20 minutes (degradation)

---

## 🚀 **PHASE 2: Advanced Observability (Next Week)**

### **Step 8: Add Axiom (Logs - 1 hour)**

**What I'll do:**

**Install SDK:**
```bash
npm install @axiom-so/js
```

**Update logger.ts:**
```typescript
import { Axiom } from '@axiom-so/js';

const axiom = ENV.AXIOM_TOKEN 
  ? new Axiom({ token: ENV.AXIOM_TOKEN })
  : null;

export function log(event: Record<string, unknown>) {
  const enriched = {
    ...event,
    timestamp: new Date().toISOString(),
    app: 'xbot',
    environment: ENV.NODE_ENV
  };
  
  // Redact sensitive data
  const scrubbed = JSON.parse(JSON.stringify(enriched, (k, v) => {
    if (typeof v === 'string' && /key|token|secret/i.test(k)) return '[redacted]';
    return v;
  }));
  
  // Send to console (Railway)
  console.log(JSON.stringify(scrubbed));
  
  // Also send to Axiom (async, non-blocking)
  if (axiom) {
    axiom.ingest('xbot-logs', [scrubbed]).catch(err => {
      console.warn('⚠️ AXIOM: Failed to send log:', err.message);
    });
  }
}
```

**What this gives you:**
- All logs in Axiom dashboard
- Real-time search (faster than `railway logs | grep`)
- Automatic retention (90 days)
- Query language (better than grep)

**Example queries in Axiom:**
```
# Find all scraper failures in last 24h
['op'] == 'scraper_complete' and ['outcome'] == 'failed' 

# Show success rate over time
['op'] == 'scraper_complete' | summarize success_rate=avg(outcome=='success') by bin(1h)

# Find slow operations
['ms'] > 5000 | sort by ['ms'] desc
```

---

### **Step 9: Add OpenTelemetry Metrics (2 hours)**

**What I'll do:**

**Install OpenTelemetry:**
```bash
npm install @opentelemetry/sdk-node
npm install @opentelemetry/api
npm install @opentelemetry/exporter-metrics-otlp-http
npm install @opentelemetry/instrumentation-http
```

**Create telemetry setup:**
```typescript
// src/observability/telemetry.ts
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { metrics } from '@opentelemetry/api';

const sdk = new NodeSDK({
  serviceName: 'xbot',
  metricReader: new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter({
      url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/metrics'
    }),
    exportIntervalMillis: 60000  // Export every minute
  })
});

sdk.start();

// Export meter for use in app
export const meter = metrics.getMeter('xbot');
```

**Define metrics:**
```typescript
// src/observability/metrics.ts
import { meter } from './telemetry';

export const Metrics = {
  // Counters (always increasing)
  postsGenerated: meter.createCounter('posts.generated.total'),
  postsPosted: meter.createCounter('posts.posted.total'),
  repliesPosted: meter.createCounter('replies.posted.total'),
  tweetsScraped: meter.createCounter('tweets.scraped.total'),
  scrapingErrors: meter.createCounter('scraping.errors.total'),
  openaiCalls: meter.createCounter('openai.calls.total'),
  
  // Gauges (current value)
  scraperSuccessRate: meter.createGauge('scraper.success_rate'),
  queueSize: meter.createGauge('queue.size'),
  openaiCostToday: meter.createGauge('openai.cost.today_usd'),
  
  // Histograms (distribution)
  scraperDuration: meter.createHistogram('scraper.duration_ms'),
  postingDuration: meter.createHistogram('posting.duration_ms'),
  generationDuration: meter.createHistogram('generation.duration_ms'),
  openaiLatency: meter.createHistogram('openai.latency_ms')
};
```

**Use in code:**
```typescript
// src/jobs/metricsScraperJob.ts
import { Metrics } from '../observability/metrics';

export async function metricsScraperJob() {
  const startTime = Date.now();
  
  try {
    // ... scraping logic ...
    
    // Record metrics
    Metrics.tweetsScraped.add(updated);
    Metrics.scrapingErrors.add(failed);
    Metrics.scraperSuccessRate.record(updated / (updated + failed));
    Metrics.scraperDuration.record(Date.now() - startTime);
    
  } catch (error) {
    Metrics.scrapingErrors.add(1);
    throw error;
  }
}
```

**What this gives you:**
- Real-time metrics dashboard (Grafana)
- Historical trends (7-day, 30-day graphs)
- Automatic alerting (Grafana alerts)
- Industry-standard format

---

### **Step 10: Set Up Grafana Dashboards (30 minutes)**

**What you'll do:**

1. Go to Grafana Cloud (free account from Step 1)
2. Add data source: OTLP endpoint
3. Import pre-built dashboards or create custom:

**Example Dashboard Panels:**

```
Panel 1: Scraper Success Rate (24h)
├─ Query: scraper.success_rate
├─ Visualization: Line graph
└─ Alert: If < 85% for 30 min

Panel 2: Posts Per Hour
├─ Query: rate(posts.posted.total[1h])
├─ Visualization: Bar chart
└─ Alert: If < 1.5 posts/hour

Panel 3: Scraper Duration
├─ Query: histogram_quantile(0.95, scraper.duration_ms)
├─ Visualization: Heatmap
└─ Alert: If p95 > 10 seconds

Panel 4: OpenAI Cost
├─ Query: openai.cost.today_usd
├─ Visualization: Gauge
└─ Alert: If > $50/day
```

**What this gives you:**
- Beautiful, auto-updating graphs
- Mobile-friendly
- Share links with team
- No custom HTML needed

---

## 🏗️ **Complete Architecture**

```
┌─────────────────────────────────────────────────────────────┐
│                    YOUR APPLICATION                          │
│                   (No major changes!)                        │
└─────────────────────────────────────────────────────────────┘
                            ↓
        ┌───────────────────┼───────────────────┐
        ↓                   ↓                   ↓
┌─────────────┐   ┌─────────────────┐   ┌─────────────┐
│   Sentry    │   │ OpenTelemetry   │   │   Axiom     │
│  (Errors)   │   │   (Metrics)     │   │   (Logs)    │
└─────────────┘   └─────────────────┘   └─────────────┘
      ↓                     ↓                   ↓
      ↓             ┌───────┴───────┐           ↓
      ↓             ↓               ↓           ↓
┌─────────────┐   ┌─────────────┐ ┌─────────────┐
│   Sentry    │   │  Grafana    │ │   Axiom     │
│  Dashboard  │   │  Dashboard  │ │  Dashboard  │
└─────────────┘   └─────────────┘ └─────────────┘
      ↓                   ↓               ↓
      └───────────────────┴───────────────┘
                      ↓
        ┌─────────────────────────────┐
        │   ALERTS (Slack/Email)      │
        │   • Errors in 30 seconds    │
        │   • Degradation in 1 minute │
        │   • Trends detected         │
        └─────────────────────────────┘
```

---

## 📊 **Comparison: Custom vs Industry Standard**

### **Metric: Detection Time**
| Issue Type | Custom Alerts | Industry Standard |
|------------|---------------|-------------------|
| Errors | 1 hour | **30 seconds** |
| Degradation | 1 hour | **1 minute** |
| Trends | Never | **Real-time** |

### **Metric: Scalability**
| Data Volume | Custom Alerts | Industry Standard |
|-------------|---------------|-------------------|
| 1k tweets | ✅ Fast | ✅ Fast |
| 100k tweets | ⚠️ Slow | ✅ Fast |
| 1M tweets | ❌ Broken | ✅ Fast |
| 10M tweets | ❌ Unusable | ✅ Fast |

### **Metric: Maintenance**
| Task | Custom Alerts | Industry Standard |
|------|---------------|-------------------|
| Add new alert | 30 min coding | 2 min config |
| Update threshold | Code change + deploy | Dashboard edit |
| Add new metric | Create table + code | 1 line of code |
| Troubleshooting | Manual log grep | Click on spike |

### **Metric: Features**
| Feature | Custom | Industry |
|---------|--------|----------|
| Error tracking | ❌ | ✅ Sentry |
| Stack traces | ❌ | ✅ Sentry |
| Performance tracing | ❌ | ✅ OpenTelemetry |
| Anomaly detection | ❌ | ✅ Grafana/Axiom |
| Mobile alerts | ❌ | ✅ All platforms |
| Team collaboration | ❌ | ✅ All platforms |
| Historical analysis | ⚠️ Limited | ✅ Full |

---

## ✅ **FINAL RECOMMENDATION**

### **Build This (Production-Grade):**

**Week 1 (Today - 1.5 hours):**
1. ✅ Add Sentry (30 min) - Error tracking
2. ✅ Add Health endpoint (30 min) - Status checks
3. ✅ Add Console alerts (30 min) - Visible warnings

**Week 2 (3 hours):**
4. ✅ Add Axiom (1 hour) - Real-time logs
5. ✅ Add OpenTelemetry (2 hours) - Metrics + tracing

**Total:** 4.5 hours, $0/month, production-ready

---

### **DON'T Build This (My Original Proposal):**

❌ Custom alert table
❌ SQL-based health checks  
❌ Manual alert rules
❌ Custom dashboard for alerts

**Why not:**
- Same effort (2 hours vs 1.5 hours)
- Much worse results
- Doesn't scale
- High maintenance

---

## 🎯 **Step-by-Step Plan (Detailed)**

### **TODAY (Session 1 - 1.5 hours):**

**Pre-work (You do this - 10 min):**
1. Sign up for Sentry.io (free)
2. Create project "xbot"
3. Copy DSN key
4. Give me the key (or add to Railway env vars)

**Work (I do this - 80 min):**
1. Install Sentry package (5 min)
2. Add Sentry to env.ts schema (5 min)
3. Create observability/sentry.ts (10 min)
4. Initialize in main-bulletproof.ts (5 min)
5. Add context to 4 critical jobs (20 min)
6. Create health endpoint (15 min)
7. Add console alerts (20 min)
8. Test integration (10 min)
9. Deploy to Railway (5 min)

**After this session:**
- Sentry capturing all errors ✅
- Health endpoint live ✅
- Alerts in console logs ✅

---

### **NEXT WEEK (Session 2 - 3 hours):**

**Pre-work (You do - 10 min):**
1. Sign up for Axiom (free)
2. Create dataset "xbot-logs"
3. Copy API token
4. Add to Railway

**Work (I do - 3 hours):**
1. Install Axiom SDK (5 min)
2. Update log() function (15 min)
3. Test Axiom ingestion (10 min)
4. Install OpenTelemetry (10 min)
5. Define metrics (30 min)
6. Instrument all jobs (60 min)
7. Set up Grafana dashboards (30 min)
8. Configure alerts (15 min)
9. Deploy and verify (15 min)

**After this session:**
- Real-time log analysis ✅
- Metrics dashboards ✅
- Automatic anomaly detection ✅
- Mobile alerts ✅

---

## 🎯 **What You Need to Decide**

**Question 1: Do we add external services?**
- Option A: Yes (Sentry + Axiom) - Better, industry standard
- Option B: No (console alerts only) - Simpler, limited

**My recommendation:** Option A - free tiers are generous, massive value

**Question 2: When to start?**
- Option A: Today (1.5 hours)
- Option B: Tomorrow (after verifying scraper fix)
- Option C: Next week

**My recommendation:** Today - while system is fresh in mind

**Question 3: How much to build?**
- Option A: Phase 1 only (1.5 hours, basic coverage)
- Option B: Phase 1 + 2 (4.5 hours, full observability)

**My recommendation:** Phase 1 today, Phase 2 next week

---

## ✅ **What I Need From You**

**To start:**
1. Confirm: Add external services (Sentry/Axiom) or console only?
2. If yes to external: Sign up for Sentry, give me DSN
3. Confirm: Start today or wait?

**Then I'll:**
- Build everything step-by-step
- Show you each change
- Deploy when ready
- Test to verify it works

---

**Ready to start? Just need your Sentry DSN and we can begin!** 🚀

