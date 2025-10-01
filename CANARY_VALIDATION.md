# 🧪 Canary Validation Guide

## Overview
This document provides SQL queries and log patterns for validating the xBOT autonomous system.

---

## 📊 SQL Validation Queries

### 1. Last 10 Content Metadata Rows
```sql
SELECT 
  decision_id::text AS id,
  decision_type,
  generation_source,
  status,
  quality_score,
  predicted_er,
  created_at
FROM content_metadata 
ORDER BY created_at DESC 
LIMIT 10;
```

**Expected Output**:
- `generation_source` should be `'real'` (from LLM) or `'synthetic'` (fallback)
- `status` should be `'pending'`, `'queued'`, `'posted'`, or `'skipped'`
- `quality_score` should be between 0 and 1
- Recent rows should have timestamps within last 24 hours

---

### 2. Last 10 Outcomes
```sql
SELECT 
  decision_id::text AS id,
  tweet_id,
  impressions,
  likes,
  retweets,
  replies,
  er_calculated,
  simulated,
  collected_at
FROM outcomes 
ORDER BY collected_at DESC 
LIMIT 10;
```

**Expected Output**:
- `simulated=false` for real Twitter data
- `simulated=true` for shadow mode data
- `er_calculated` should be > 0 if there are impressions
- `tweet_id` should be populated for real posts

---

### 3. Posted Decisions Summary
```sql
SELECT 
  decision_type,
  generation_source,
  COUNT(*) as count,
  AVG(CASE WHEN quality_score IS NOT NULL THEN quality_score ELSE 0 END) as avg_quality
FROM content_metadata 
WHERE status = 'posted'
GROUP BY decision_type, generation_source
ORDER BY decision_type, generation_source;
```

---

### 4. Learning System Status
```sql
-- Check bandit arms
SELECT 
  arm_name,
  scope,
  successes,
  failures,
  ROUND(successes::numeric / NULLIF(successes + failures, 0), 3) as success_rate,
  last_updated
FROM bandit_arms
ORDER BY last_updated DESC;

-- Check recent outcomes for learning
SELECT 
  COUNT(*) as total_outcomes,
  COUNT(*) FILTER (WHERE simulated = false) as real_outcomes,
  COUNT(*) FILTER (WHERE simulated = true) as simulated_outcomes,
  AVG(er_calculated) as avg_er,
  MAX(collected_at) as last_collected
FROM outcomes;
```

---

## 📋 Success Log Patterns

### Plan Job Success
```
[PLAN_JOB] ✅ Real LLM content queued decision_id=abc-123-def-456 scheduled_at=2025-10-01T12:00:00Z
```

### Posting Success
```
[POSTING_ORCHESTRATOR] ✅ Posted successfully tweet_id=1234567890123456789 decision_id=abc-123-def-456
```

or for threads:
```
[POSTING_ORCHESTRATOR] ✅ Posted thread successfully thread_id=1234567890123456789 decision_id=abc-123-def-456
```

### Reply Job Success
```
[REPLY_JOB] ✅ Real LLM reply queued decision_id=xyz-789-abc-123 scheduled_at=2025-10-01T13:00:00Z
```

### Learning Job Success
```
[LEARN_JOB] ✅ coeffs_updated=v1 arms_trained=5 explore_ratio=0.20
```

### Outcome Collection Success
```
[OUTCOME_INGEST] ✅ Collected outcome decision_id=abc-123 impressions=1234 likes=56 ER=4.54%
```

---

## 🔍 Troubleshooting Log Patterns

### Warning Patterns (Expected in Some Cases)
```
⚠️  429 rate limit hit                   # OpenAI quota exhausted (expected)
⚠️  Could not fetch metrics               # Tweet deleted/private (ok to skip)
⚠️  Training skipped: insufficient outcomes  # Normal until ≥5 real outcomes
⚠️  No decisions ready for posting        # Queue empty (ok)
```

### Error Patterns (Requires Investigation)
```
❌ Failed to post decision              # Posting error (check Playwright)
❌ column unified_ai_intelligence.status does not exist  # Schema bug
❌ Budget exceeded                     # Check DAILY_OPENAI_LIMIT_USD
❌ Failed to store decision            # Database error
```

---

## 🚀 Running Canary Tests

### Local Execution
```bash
# Individual jobs
npm run job:plan
npm run job:posting
npm run job:reply
npm run job:learn
npm run job:outcomes

# Full end-to-end canary
npm run canary:e2e
```

### Railway Execution
```bash
# Individual jobs
railway run -- npm run job:plan
railway run -- npm run job:posting
railway run -- npm run job:reply

# Check logs after
railway logs | grep -E "(PLAN_JOB|POSTING_ORCHESTRATOR|REPLY_JOB|LEARN_JOB)"
```

### Database Validation After Canary
```bash
# Check content_metadata
railway run -- psql $DATABASE_URL -c "SELECT decision_id::text, decision_type, generation_source, status FROM content_metadata ORDER BY created_at DESC LIMIT 10;"

# Check outcomes
railway run -- psql $DATABASE_URL -c "SELECT decision_id::text, tweet_id, impressions, likes, simulated FROM outcomes ORDER BY collected_at DESC LIMIT 10;"
```

---

## 🎯 Success Criteria

### After Plan Job
- [ ] At least 1 new row in `content_metadata` with `generation_source='real'`
- [ ] Log shows `[PLAN_JOB] ✅ Real LLM content queued`
- [ ] `status` is `'pending'` or `'queued'`

### After Posting Job
- [ ] At least 1 row in `content_metadata` with `status='posted'`
- [ ] At least 1 row in `posted_decisions`
- [ ] Log shows `[POSTING_ORCHESTRATOR] ✅ Posted successfully`
- [ ] Tweet visible on X/Twitter timeline

### After Reply Job
- [ ] At least 1 new row in `content_metadata` with `decision_type='reply'`
- [ ] Log shows `[REPLY_JOB] ✅ Real LLM reply queued`

### After Learning Job
- [ ] Log shows `[LEARN_JOB] ✅ coeffs_updated=vN` (if ≥5 outcomes exist)
- [ ] OR log shows `[LEARN_JOB] ⚠️ Training skipped: insufficient real outcomes` (if <5)
- [ ] Bandit arms table updated (if training occurred)

### After Outcome Ingestion
- [ ] At least 1 row in `outcomes` with `simulated=false`
- [ ] Log shows `[OUTCOME_INGEST] ✅ Collected outcome`
- [ ] Metrics populated (impressions, likes, etc.)

---

## 📈 Expected Metrics Over Time

### Day 1
- **Content Generated**: 5-10 decisions
- **Posts**: 3-5 tweets/threads
- **Replies**: 2-3 replies
- **Outcomes**: 0 (not enough time for engagement)
- **Learning**: Skipped (insufficient data)

### Day 3
- **Content Generated**: 20-30 decisions
- **Posts**: 10-15 tweets/threads
- **Replies**: 5-10 replies
- **Outcomes**: 10-15 with real metrics
- **Learning**: First training run (≥5 outcomes)

### Day 7
- **Content Generated**: 50-70 decisions
- **Posts**: 30-40 tweets/threads
- **Replies**: 15-25 replies
- **Outcomes**: 30-40 with real metrics
- **Learning**: Regular updates, explore_rate decaying

---

## 🔐 Admin Token Configuration

### Setting Up ADMIN_TOKEN
```bash
# In Railway dashboard
railway variables --set ADMIN_TOKEN=your-secure-token-here

# Or via CLI
export ADMIN_TOKEN=your-secure-token-here

# Restart service to pick up new token
railway restart
```

### Testing Auth
```bash
# Should succeed
curl -X POST "https://xbot-production.railway.app/admin/jobs/run?name=plan" \
  -H "x-admin-token: your-secure-token-here"

# Should fail with 401
curl -X POST "https://xbot-production.railway.app/admin/jobs/run?name=plan" \
  -H "x-admin-token: wrong-token"

# Should fail with 503 if ADMIN_TOKEN not set
curl -X POST "https://xbot-production.railway.app/admin/jobs/run?name=plan"
```

---

## 📝 Quick Reference Commands

```bash
# Check system health
curl https://xbot-production.railway.app/status | jq

# View learning status
curl https://xbot-production.railway.app/api/learning/status | jq

# View growth metrics
curl https://xbot-production.railway.app/api/growth | jq

# Trigger plan job
railway run -- npm run job:plan

# Check recent logs
railway logs | tail -100

# Database query
railway run -- psql $DATABASE_URL -c "SELECT COUNT(*) FROM content_metadata WHERE status='posted';"
```

---

**Last Updated**: 2025-09-30  
**Maintained By**: Platform Engineering
