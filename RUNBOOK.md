# xBOT Live System Validation Runbook

This runbook provides step-by-step validation commands for the xBOT live system with graceful LLM failure handling.

## Prerequisites

Set these environment variables for testing:
```bash
export XBOT_BASE_URL="https://your-app.railway.app"  # Replace with your actual Railway URL
export ADMIN_TOKEN="your-admin-token-here"           # Set in Railway env vars
```

---

## Part 1: Current State ($0 OpenAI Credits)

### 1.1 Verify OpenAI Failures and Fallback Behavior

Check system metrics to confirm LLM failures and fallback patterns:

```bash
curl -s "$XBOT_BASE_URL/api/metrics" | jq '{
  mode: .mode,
  openaiCalls_total: .openaiCalls_total,
  openaiCalls_failed: .openaiCalls_failed,
  openaiFailureReasons: .openaiFailureReasons,
  post_skipped_reason_counts: .post_skipped_reason_counts
}'
```

**Expected Output (with $0 credits):**
```json
{
  "mode": "live",
  "openaiCalls_total": 10,
  "openaiCalls_failed": 10,
  "openaiFailureReasons": {
    "insufficient_quota": 8,
    "rate_limit": 2
  },
  "post_skipped_reason_counts": {
    "llm_unavailable": 5,
    "posting_disabled": 2
  }
}
```

### 1.2 Check No Real Outcomes Written

Verify that only simulated outcomes exist (none marked as real):

```bash
curl -s "$XBOT_BASE_URL/api/learn/status" | jq '{
  mode: .mode,
  real_outcomes_count: .real_outcomes_count,
  simulated_outcomes_count: .simulated_outcomes_count,
  training_samples_available: .training_samples_available
}'
```

**Expected Output:**
```json
{
  "mode": "live",
  "real_outcomes_count": 0,
  "simulated_outcomes_count": 45,
  "training_samples_available": 45
}
```

### 1.3 Verify Learning Skips Training in Live Mode

Check that learning job correctly skips training without real outcomes:

```bash
# Trigger learning job manually
curl -X POST "$XBOT_BASE_URL/admin/jobs/run?name=learn" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.'
```

**Expected Log Pattern (check Railway logs):**
```
[LEARN_JOB] 🧠 Starting learning cycle...
[LEARN_JOB] 📊 Collecting training data from decisions and outcomes...
[LEARN_JOB] ⚠️ Training skipped: insufficient real outcomes (need 5)
```

---

## Part 2: With OpenAI Credits Restored

*Note: Run these tests after adding OpenAI credits to your account*

### 2.1 Verify Real LLM Usage

Test that the system uses real LLM when credits are available:

```bash
# Trigger content planning
curl -X POST "$XBOT_BASE_URL/admin/jobs/run?name=plan" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.'
```

**Expected Log Pattern:**
```
[PLAN_JOB] 🧠 Generating real content using LLM...
[PLAN_JOB] 🤖 Calling OpenAI (gpt-4o-mini) for content generation...
[PLAN_JOB] ✅ Real LLM content generated successfully
```

### 2.2 Check Posted Decisions with Tweet IDs

Verify that real content gets posted with actual tweet IDs:

```bash
# Enable posting temporarily (set POSTING_DISABLED=false in Railway)
# Then trigger posting
curl -X POST "$XBOT_BASE_URL/admin/jobs/run?name=posting" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.'
```

**Expected Output:**
```json
{
  "success": true,
  "job": "posting",
  "result": {
    "message": "Posting queue processed"
  }
}
```

**Expected Log Pattern:**
```
[POSTING_ORCHESTRATOR] 🚀 Posting attempt 1/3: "Health tip: Stay hydrated! Your body needs..."
[POSTING_ORCHESTRATOR] ✅ Posted successfully: tweet_id=tweet_1695834567890_abc123
```

### 2.3 Verify Real Outcomes Collection

Test that the system collects real engagement metrics:

```bash
# Wait 4+ hours or trigger analytics collection manually
curl -X POST "$XBOT_BASE_URL/admin/jobs/run?name=analyticsCollector" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.'
```

**Expected Log Pattern:**
```
[ANALYTICS_COLLECTOR] 📊 Collecting real engagement data for tweet ID: tweet_1695834567890_abc123...
[ANALYTICS_COLLECTOR] ✅ Stored real outcome for decision_abc123: ER 3.45%
```

### 2.4 Check Learning Progress

Verify that learning trains on real data and advances model versions:

```bash
curl -s "$XBOT_BASE_URL/api/metrics" | jq '{
  learnRuns: .learnRuns,
  banditArmsUpdated: .banditArmsUpdated,
  predictorStatus: .predictorStatus
}'
```

**Expected Output (after learning on real data):**
```json
{
  "learnRuns": 15,
  "banditArmsUpdated": 6,
  "predictorStatus": "v3"
}
```

---

## Part 3: Rate Controller Validation

### 3.1 Check Adaptive Rate Targets

Verify that the AI rate controller adjusts targets based on performance:

```bash
curl -s "$XBOT_BASE_URL/api/learn/status" | jq '{
  current_explore_ratio: .current_explore_ratio,
  er_trend_7d: .er_trend_7d,
  engagement_momentum: .engagement_momentum,
  best_timing_slot: .best_timing_slot
}'
```

**Expected Output:**
```json
{
  "current_explore_ratio": 0.224,
  "er_trend_7d": 5.2,
  "engagement_momentum": "increasing",
  "best_timing_slot": 18
}
```

**Expected Log Pattern (check Railway logs):**
```
[RATE_CTRL] 🧠 Computing adaptive rate targets...
[RATE_CTRL] 📈 +0.25 posts/hour: good 24h ER & fresh outcomes
[RATE_CTRL] targets: postsPerHour=0.75, repliesPerDay=15 (ceilings 4/40)
```

---

## Part 4: Gate Chain Validation

### 4.1 Test Quality Gate

Submit low-quality content to verify gate blocking:

```bash
# This would require a custom endpoint or direct database insertion
# For now, check logs for gate activity:
curl -s "$XBOT_BASE_URL/api/metrics" | jq '{
  qualityBlocksCount: .qualityBlocksCount,
  uniqueBlocksCount: .uniqueBlocksCount,
  rotationBlocksCount: .rotationBlocksCount
}'
```

**Expected Gate Block Log Pattern:**
```
[POSTING_ORCHESTRATOR] ⛔ Blocked by gate: quality_gate (score 0.45 < threshold 0.7)
[POSTING_ORCHESTRATOR] ⛔ Blocked by gate: uniqueness_gate (similarity 0.89 > threshold 0.85)
```

---

## Part 5: Embeddings and Uniqueness

### 5.1 Backfill Embeddings

Test the embedding backfill system:

```bash
curl -X POST "$XBOT_BASE_URL/admin/jobs/run?name=backfillEmbeddings" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"count": 10}' | jq '.'
```

**Expected Output:**
```json
{
  "success": true,
  "job": "backfillEmbeddings",
  "result": {
    "message": "Backfilled embeddings for 8 items",
    "processed": 10,
    "updated": 8,
    "errors": 2
  }
}
```

---

## Part 6: Health and Status Endpoints

### 6.1 Basic Health Check

```bash
curl -s "$XBOT_BASE_URL/health" | jq '.'
```

**Expected Output:**
```json
{
  "status": "ok",
  "timestamp": "2025-09-27T14:30:00.000Z"
}
```

### 6.2 Configuration Check

```bash
curl -s "$XBOT_BASE_URL/api/config" | jq '{
  mode: .mode,
  posting_disabled: .posting_disabled,
  max_posts_per_hour: .max_posts_per_hour
}'
```

### 6.3 Learning System Status

```bash
curl -s "$XBOT_BASE_URL/api/learn/status" | jq '{
  mode: .mode,
  last_run: .last_run,
  content_arms: .content_arms[0:2],
  timing_arms: .timing_arms[0:2],
  predictor: .predictor
}'
```

### 6.4 Available Admin Jobs

```bash
curl -s "$XBOT_BASE_URL/admin/jobs" | jq '.available_jobs'
```

---

## Part 7: Error Recovery Testing

### 7.1 Test Database Connection Recovery

Temporarily disrupt database connection and verify graceful degradation:

```bash
# Check that metrics still return (with degraded data)
curl -s "$XBOT_BASE_URL/api/metrics" | jq '.errors'
```

### 7.2 Test Redis Failure Handling

Verify that predictor system falls back gracefully without Redis:

```bash
curl -X POST "$XBOT_BASE_URL/admin/jobs/run?name=learn" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

---

## Summary Checklist

**$0 Credits (Current State):**
- [ ] OpenAI calls fail with `insufficient_quota`
- [ ] Posting skipped with `llm_unavailable` reason
- [ ] No real outcomes written (`real_outcomes_count: 0`)
- [ ] Learning skips training in live mode

**With Credits:**
- [ ] Real LLM content generation succeeds
- [ ] At least one successful posting with `tweet_id`
- [ ] Real outcomes collected (`simulated: false`)
- [ ] Predictor version advances (`v2` → `v3`)

**Rate Controller:**
- [ ] Adaptive targets computed based on performance
- [ ] Targets respect hard ceilings (4 posts/hour, 40 replies/day)
- [ ] Explore ratio adjusts dynamically

**Safety & Quality:**
- [ ] Gates block low-quality content in live mode
- [ ] Embeddings prevent near-duplicates
- [ ] Admin endpoints require authentication
- [ ] All components fail gracefully

## Emergency Commands

**Stop all posting immediately:**
```bash
# Set POSTING_DISABLED=true in Railway environment
```

**Check current job status:**
```bash
curl -s "$XBOT_BASE_URL/api/metrics" | jq '{
  plan_runs: .planRuns,
  reply_runs: .replyRuns,
  errors: .errors,
  last_error: .lastError
}'
```

**Force learning cycle:**
```bash
curl -X POST "$XBOT_BASE_URL/admin/jobs/run?name=learn" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```