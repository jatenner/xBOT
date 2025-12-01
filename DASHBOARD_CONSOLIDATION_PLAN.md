# Dashboard Consolidation Plan

## Current State (11 dashboards - TOO MANY!)
1. Business - Overview with activity cards
2. Diagnostics - Chatbot-style health messages
3. System Flow - End-to-end flow visualization
4. Health - System health overview
5. System Health - Job status & target tracking
6. Posts - Posts analytics
7. Replies - Replies analytics
8. Recent - Recent activity feed
9. Data Validation - Data integrity checks
10. Posting Monitor - Hourly target tracking
11. System Audit - Comprehensive audit

## Problems:
- Overlap: Business, Diagnostics, Health, System Health all show similar info
- Confusion: Multiple ways to see same data
- Contradiction: Different dashboards show different statuses
- Too many tabs: Hard to navigate

## Proposed Structure (4 Essential Dashboards)

### 1. **Overview** (Main Landing Page)
- System status banner (working/needs attention/critical)
- Key metrics at a glance (posts today, replies today, queue status)
- Quick health indicators
- Recent activity feed
- **Replaces:** Business dashboard

### 2. **System Health** (Everything System-Related)
- All job statuses with health scores
- Critical issues with root causes
- Target tracking (hourly goals)
- Circuit breaker status
- Component dependencies
- **Replaces:** Diagnostics, Health, System Health, System Flow, System Audit

### 3. **Content** (All Content Views)
- Posts table with filters
- Replies table with filters
- Recent activity timeline
- Content type breakdown
- **Replaces:** Posts, Replies, Recent

### 4. **Analytics** (Performance & Validation)
- Posting performance (success rates, targets)
- Data validation results
- Metrics coverage
- **Replaces:** Posting Monitor, Data Validation

## Implementation:
1. Keep Overview, System Health, Content, Analytics
2. Remove redundant dashboards from navigation
3. Update routes to redirect old URLs to new consolidated dashboards
4. Ensure each dashboard has clear, non-overlapping purpose

