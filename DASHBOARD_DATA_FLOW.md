# 📊 DASHBOARD DATA FLOW DOCUMENTATION

## Overview

All dashboards follow a consistent data flow pattern for reliability and maintainability.

## Standard Data Flow

```
┌─────────────────┐
│  User Request   │
│  /dashboard/xxx │
└────────┬────────┘
         │
         ▼
┌─────────────────────────┐
│  Server Route Handler   │
│  - Auth Check           │
│  - Route Validation     │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│  Dashboard Generator    │
│  Function               │
│  - Fetch Data           │
│  - Process Data         │
│  - Generate HTML        │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│  Shared Utilities       │
│  - Navigation           │
│  - Styles               │
│  - Data Helpers         │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│  Database Queries       │
│  - Supabase Client      │
│  - Job Manager          │
│  - Heartbeat Checks     │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│  HTML Response          │
│  - Styled Dashboard     │
│  - Auto-refresh Script  │
└─────────────────────────┘
```

## Data Sources

### 1. Database Tables
- `content_metadata` - Posts, replies, content status
- `job_heartbeats` - Job execution status
- `tweet_metrics` - Scraped engagement metrics
- `outcomes` - Performance data
- `learning_posts` - Learning system data
- `posting_attempts` - Posting history

### 2. Job Manager
- `JobManager.getInstance()` - Job execution stats
- `getHeartbeat(jobName)` - Last run status

### 3. Diagnostic Engine
- `DiagnosticEngine.getInstance()` - System health analysis

## Dashboard-Specific Data Flows

### Business Dashboard (`/dashboard/business`)
**Purpose:** Executive overview of system activity

**Data Sources:**
1. `getHeartbeat('metrics_scraper')` - Scraper status
2. `getTodayStats()` - Today's posts/replies
3. `getQueueStatus()` - Queued content count
4. `getScraperCoverage()` - Metrics coverage
5. `DiagnosticEngine.runDiagnostics()` - Overall health

**Key Metrics:**
- Is scraper running NOW?
- Last scrape time
- Posts/replies today
- Queue depth
- Scraper coverage %

### Diagnostics Dashboard (`/dashboard/diagnostics`)
**Purpose:** Chatbot-style system health explanations

**Data Sources:**
1. `DiagnosticEngine.runDiagnostics()` - Complete system analysis
2. `content_metadata` - Recent activity
3. `getTodayStats()` - Today's stats

**Key Metrics:**
- Plain English system status
- Stage-by-stage health scores
- Issue detection and explanations

### System Flow Dashboard (`/dashboard/system-flow`)
**Purpose:** End-to-end system flow visualization

**Data Sources:**
1. `DiagnosticEngine.runDiagnostics()` - Stage status
2. `getHeartbeat()` for each stage - Last/next run times
3. `content_metadata` - Queue validation

**Key Metrics:**
- Stage status (Content → Posting → Metrics → Learning)
- Health scores per stage
- Last run / next run times
- Data validation checks

### Data Validation Dashboard (`/dashboard/data-validation`)
**Purpose:** Verify data correctness and authenticity

**Data Sources:**
1. `content_metadata` - Recent posts with metrics
2. `DataAuthenticityGuard` - Validation checks
3. Duplicate detection queries

**Key Metrics:**
- Tweet ID format validation
- Engagement metrics validation
- Duplicate detection
- Overall data health score

### Posting Monitor Dashboard (`/dashboard/posting-monitor`)
**Purpose:** Track hourly posting schedule

**Data Sources:**
1. `content_metadata` - Posts from last 24h
2. `getPostingMonitor()` - Posting timeline
3. Weekly stats queries

**Key Metrics:**
- Daily posting goal progress
- 24-hour timeline
- Schedule health
- Weekly posting stats

### Posts Overview (`/dashboard/posts`)
**Purpose:** List all posts with metrics

**Data Sources:**
1. `content_metadata` - All posts
2. `tweet_metrics` - Scraped metrics
3. Scraper status checks

**Key Metrics:**
- Post count (24h)
- Views/likes totals
- Queue status
- Data coverage

### Replies Overview (`/dashboard/replies`)
**Purpose:** List all replies

**Data Sources:**
1. `content_metadata` - Replies only
2. `reply_opportunities` - Target info
3. Metrics for replies

**Key Metrics:**
- Reply count
- Views/likes
- Opportunity pool size

## Shared Data Fetching Patterns

### Today's Stats
```typescript
const { postedToday, repliedToday, queuedToday, totalViews, totalLikes } = await getTodayStats();
```

### Queue Status
```typescript
const queuedCount = await getQueueStatus();
```

### Scraper Coverage
```typescript
const { coverage, postsWithMetrics, totalPosted } = await getScraperCoverage();
```

### Job Heartbeats
```typescript
const heartbeat = await getHeartbeat('jobName');
const isRunning = heartbeat?.last_run_status === 'running';
const lastSuccess = heartbeat?.last_success ? new Date(heartbeat.last_success) : null;
```

## Error Handling

All dashboards use:
- `generateErrorHTML(error, backUrl)` - Standard error page
- `generateAuthErrorHTML()` - Auth failure page
- Try/catch blocks in handlers
- Graceful degradation (show partial data if some queries fail)

## Performance Considerations

1. **Parallel Queries:** Use `Promise.all()` for independent queries
2. **Limit Results:** Always limit queries (e.g., `.limit(50)`)
3. **Cache Heartbeats:** Job heartbeats checked once per page load
4. **Auto-refresh:** 30-60 second intervals to avoid server load

## Navigation Standard

All dashboards include:
- Same navigation tabs (Business, Diagnostics, System Flow, Health, Posts, Replies, Data Validation, Posting Monitor)
- Active tab highlighting
- Consistent styling
- Same token parameter handling

