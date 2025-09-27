# xBOT LIVE Mode Runbook

## Overview
This runbook contains validation commands to demonstrate LIVE mode functionality with graceful LLM failure handling.

## Prerequisites
- xBOT deployed on Railway with `MODE=live`
- OpenAI credits may be $0 (system should handle gracefully)
- Supabase database with proper tables
- Redis for caching

## Environment Variables
```bash
# Required for LIVE mode
MODE=live
NODE_ENV=production
POSTING_DISABLED=true  # Start with posting disabled for safety

# OpenAI (may have $0 credits)
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini

# Database
DATABASE_URL=postgresql://...
SUPABASE_URL=https://...
SUPABASE_SERVICE_ROLE_KEY=...

# Redis
REDIS_URL=redis://...

# Rate limits (conservative)
MAX_POSTS_PER_HOUR=1
REPLY_MAX_PER_DAY=5
```

## Validation Commands

### 1. Check System Health
```bash
# Check if service is running
curl -s https://your-app.railway.app/health | jq

# Check configuration
curl -s https://your-app.railway.app/api/config | jq '.mode, .posting_disabled'
```

### 2. Monitor LLM Fallback Behavior (with $0 credits)
```bash
# Check metrics for LLM failures
curl -s https://your-app.railway.app/api/metrics | jq '{
  openaiCalls_total: .openaiCalls_total,
  openaiCalls_failed: .openaiCalls_failed, 
  openaiFailureReasons: .openaiFailureReasons,
  post_skipped_reason_counts: .post_skipped_reason_counts
}'

# Expected output with $0 credits:
# {
#   "openaiCalls_total": 5,
#   "openaiCalls_failed": 5,
#   "openaiFailureReasons": {
#     "insufficient_quota": 5
#   },
#   "post_skipped_reason_counts": {
#     "llm_unavailable": 3
#   }
# }
```

### 3. Check Learning Job Behavior
```bash
# Monitor learning status - should skip training in LIVE mode without real outcomes
curl -s https://your-app.railway.app/api/metrics | jq '{
  learnRuns: .learnRuns,
  outcomesWritten: .outcomesWritten,
  mode: .mode
}'

# Look for this in logs:
# [LEARN_JOB] ⚠️ Training skipped: insufficient samples (need real outcomes in LIVE mode)
```

### 4. Verify Posting is Disabled
```bash
# Check posting metrics
curl -s https://your-app.railway.app/api/metrics | jq '{
  postsPosted: .postsPosted,
  postsQueued: .postsQueued,
  postingErrors: .postingErrors
}'

# Expected: postsPosted should be 0 when POSTING_DISABLED=true
```

## Log Patterns to Verify

### Successful LLM Fallback (with $0 credits)
```
[PLAN_JOB] 🤖 Calling OpenAI (gpt-4o-mini) for content generation...
[PLAN_JOB] ❌ OpenAI generation failed: insufficient_quota
[PLAN_JOB] 🔄 OpenAI insufficient_quota → fallback to shadow generation
[PLAN_JOB] 🎭 Generating synthetic content for shadow mode...
```

### Learning Job Skipping Training
```
[LEARN_JOB] 🧠 Starting learning cycle...
[LEARN_JOB] ℹ️ No real outcomes data found in LIVE mode, skipping training
[LEARN_JOB] ⚠️ Training skipped: insufficient samples (need real outcomes in LIVE mode)
```

### Posting Orchestrator Skipping Non-Real Content
```
[POSTING_ORCHESTRATOR] 🚀 Processing posting queue...
[POSTING_ORCHESTRATOR] 📝 Processing decision abc123: "Health tip: Stay hydrated..."
[POSTING_ORCHESTRATOR] ⏭️ Skipped posting abc123: llm_unavailable
```

## Testing with Credits Added

After adding OpenAI credits, verify real LLM usage:

### 1. Check Real LLM Generation
```bash
# Should see real LLM calls succeeding
curl -s https://your-app.railway.app/api/metrics | jq '{
  openaiCalls_total: .openaiCalls_total,
  openaiCalls_failed: .openaiCalls_failed,
  failure_rate: (.openaiCalls_failed / .openaiCalls_total * 100)
}'
```

### 2. Enable Posting (when ready)
   ```bash
# Set POSTING_DISABLED=false in Railway environment
# Then verify posts are created:
curl -s https://your-app.railway.app/api/metrics | jq '{
  postsPosted: .postsPosted,
  postingErrors: .postingErrors
}'
```

### 3. Check Real Outcomes Collection
   ```bash
# After posts are live, outcomes should be collected
curl -s https://your-app.railway.app/api/metrics | jq '{
  outcomesWritten: .outcomesWritten,
  learnRuns: .learnRuns
}'

# Learning should start training on real data
```

## Expected Log Patterns (with credits)

### Real LLM Success
```
[PLAN_JOB] 🤖 Calling OpenAI (gpt-4o-mini) for content generation...
[PLAN_JOB] ✅ Real LLM content generated successfully
[PLAN_JOB] 📊 LLM Metrics - Total: 10, Failed: 0, Failure Rate: 0.0%
```

### Real Posting
```
[POSTING_ORCHESTRATOR] 🐦 Posting to X: "Health tip: Stay hydrated..."
[POSTING_ORCHESTRATOR] ✅ Posted successfully: tweet_id=1234567890
[POSTING_ORCHESTRATOR] 💾 Stored posted decision: abc123 → 1234567890
```

### Real Learning
```
[LEARN_JOB] 🧠 Starting learning cycle...
[LEARN_JOB] 📊 Collecting training data from decisions and outcomes...
[LEARN_JOB] 📋 Collected 5 training samples
[LEARN_JOB] 🎰 Updating bandit arms with new rewards...
[LEARN_JOB] ✅ LEARN_RUN sample=5, arms_trained=6, explore_ratio=0.224, coeffs_updated=v1
```

## Monitoring Dashboard

Key metrics to track:
- `openaiCalls_failed` / `openaiCalls_total` (failure rate)
- `post_skipped_reason_counts.llm_unavailable` (content skipped due to LLM issues)
- `outcomesWritten` (real outcomes collected)
- `learnRuns` vs training skips in logs

## Emergency Procedures

### If LLM Budget Exhausted
1. System automatically falls back to shadow generation
2. Posting is skipped with reason `llm_unavailable`
3. Learning continues with existing data
4. No manual intervention required

### If Posting Fails
1. Posts are marked as skipped with specific reasons
2. Check `post_skipped_reason_counts` for failure patterns
3. Review posting logs for detailed error messages

## Database Queries

### Check Real vs Synthetic Content
```sql
SELECT generation_source, COUNT(*) 
FROM posted_decisions 
GROUP BY generation_source;
```

### Check Outcome Types
```sql
SELECT simulated, COUNT(*) 
FROM outcomes 
GROUP BY simulated;
```

### Recent Posting Activity
```sql
SELECT posted_at, content, tweet_id 
FROM posted_decisions 
ORDER BY posted_at DESC 
LIMIT 10;
```