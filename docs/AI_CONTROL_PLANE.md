# 🎛️ AI CONTROL PLANE DOCUMENTATION

**Date:** January 8, 2026  
**Version:** 1.0

---

## OVERVIEW

The AI Control Plane is an intelligent system that automatically adjusts reply system behavior based on performance data, costs, and outcomes. It replaces rigid thresholds with adaptive, AI-driven decisions.

---

## ARCHITECTURE

### 1) Cost Logging

**Table:** `llm_usage_log`
- Logs every LLM call with: model, purpose, tokens, cost, latency, trace_ids
- Automatic logging via wrappers around OpenAI calls
- Hourly/daily rollups in `llm_cost_summary_hourly` and `llm_cost_summary_daily`

**Usage:**
```typescript
import { logLLMUsage } from '../services/llmCostLogger';

await logLLMUsage({
  model: 'gpt-4o-mini',
  purpose: 'target_judge',
  input_tokens: 500,
  output_tokens: 200,
  latency_ms: 1200,
  trace_ids: { candidate_id: '123', decision_id: '456' }
});
```

**Inspection:**
```sql
-- View 24h costs by purpose
SELECT * FROM llm_cost_summary_24h;

-- View hourly costs
SELECT * FROM llm_cost_summary_hourly 
WHERE hour_start >= NOW() - INTERVAL '24 hours'
ORDER BY hour_start DESC;
```

---

### 2) Target Suitability Judge

**Purpose:** Replace rigid topic threshold with intelligent LLM judgment

**Output:** JSON with:
- `relevance`: 0-1 (topic relevance)
- `replyability`: 0-1 (suitability for reply)
- `momentum`: 0-1 (engagement velocity)
- `audience_fit`: 0-1 (audience alignment)
- `spam_risk`: 0-1 (spam risk, lower is better)
- `expected_views_bucket`: 'low' | 'medium' | 'high' | 'viral'
- `decision`: 'accept' | 'reject' | 'explore'
- `reasons`: Human-readable explanation

**Storage:** Full JSON in `candidate_evaluations.ai_judge_decision` + flattened columns

**Integration:** Called in `candidateScorer.ts` after hard filters pass

---

### 3) Control Plane Agent

**Hourly Adjustment:**
- Reads: `reply_system_summary_hourly`, `llm_cost_summary_hourly`, recent errors
- Outputs: Updated `control_plane_state` with:
  - `feed_weights`: Distribution across feeds (sums to 1.0)
  - `acceptance_threshold`: Adaptive threshold (0.3-0.9)
  - `exploration_rate`: Probability of exploring borderline candidates (0.05-0.25)
  - `shortlist_size`: Max candidates in queue (10-50)
  - `budget_caps`: Hourly/daily/per-reply limits
  - `model_preferences`: Default/fallback models

**Daily Adjustment:**
- Reads: `reply_system_summary_daily`, strategy performance
- Updates: Strategy weights, account pruning/adding (future)

**State Management:**
- Only one active state at a time (`expires_at IS NULL`)
- New state expires old state
- Decisions logged to `control_plane_decisions`

---

### 4) Safety Rails

**Absolute Filters (Never Relaxed):**
- Root tweet check (`is_root_tweet`)
- Parody detection (`is_parody`)
- Spam floor (`spam_score > 0.7`)

**Budget Caps:**
- Enforced in `openaiBudgetedClient.ts`
- Degrades to cheaper models when near cap
- Hard stop if exceeded

**State Validation:**
- `acceptance_threshold`: Clamped to 0.3-0.9
- `exploration_rate`: Clamped to 0.05-0.25
- `shortlist_size`: Clamped to 10-50
- Feed weights: Normalized to sum to 1.0
- Budget caps: Never increased (only reduced)

---

## HOW TO INSPECT COSTS

### View Current Costs (24h)
```sql
SELECT * FROM llm_cost_summary_24h;
```

### View Hourly Breakdown
```sql
SELECT 
  hour_start,
  purpose,
  model,
  total_cost_usd,
  total_requests
FROM llm_cost_summary_hourly
WHERE hour_start >= NOW() - INTERVAL '24 hours'
ORDER BY hour_start DESC, total_cost_usd DESC;
```

### View Per-Purpose Costs
```sql
SELECT 
  purpose,
  SUM(total_cost_usd) as total_cost,
  SUM(total_requests) as total_requests,
  AVG(avg_latency_ms) as avg_latency
FROM llm_cost_summary_hourly
WHERE hour_start >= NOW() - INTERVAL '24 hours'
GROUP BY purpose
ORDER BY total_cost DESC;
```

---

## HOW CONTROL PLANE ADJUSTS BEHAVIOR

### Hourly Adjustments

**Inputs:**
- Queue size (if empty → lower threshold)
- Candidate throughput (if low → increase exploration)
- Cost trends (if high → use cheaper models)
- Error rates (if high → conservative settings)

**Outputs:**
- `acceptance_threshold`: Adjusted based on queue health
- `exploration_rate`: Increased if queue empty
- `shortlist_size`: Adjusted based on throughput
- `model_preferences`: Switched to cheaper models if costs high

**Example:**
```
Queue empty → Lower threshold from 0.60 to 0.45, increase exploration to 0.15
Costs high → Switch to gpt-4o-mini, reduce shortlist_size to 15
```

### Daily Adjustments

**Inputs:**
- Daily performance summary
- Strategy performance (future)
- Account performance (future)

**Outputs:**
- Feed weights: Favor high-performing feeds
- Strategy weights: Adjust based on outcomes
- Account pruning: Remove low-performing accounts

---

## VERIFICATION

### 1) Control Plane Writes State
```sql
-- Check latest state
SELECT * FROM control_plane_current_state;

-- Check decisions log
SELECT 
  decision_type,
  decision_time,
  output_state->>'acceptance_threshold' as threshold,
  output_state->>'exploration_rate' as exploration
FROM control_plane_decisions
ORDER BY decision_time DESC
LIMIT 10;
```

### 2) Jobs Read State
```sql
-- Check if candidates are using judge decisions
SELECT 
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE judge_decision IS NOT NULL) as with_judge,
  COUNT(*) FILTER (WHERE judge_decision = 'accept') as judge_accepted
FROM candidate_evaluations
WHERE created_at >= NOW() - INTERVAL '1 hour';
```

### 3) LLM Costs Logged
```sql
-- Check recent LLM usage
SELECT 
  purpose,
  model,
  SUM(est_cost_usd) as total_cost,
  COUNT(*) as requests
FROM llm_usage_log
WHERE timestamp >= NOW() - INTERVAL '1 hour'
GROUP BY purpose, model
ORDER BY total_cost DESC;
```

---

## FILES

- **Migration:** `supabase/migrations/20260108_ai_control_plane.sql`
- **Cost Logger:** `src/services/llmCostLogger.ts`
- **Target Judge:** `src/jobs/replySystemV2/targetSuitabilityJudge.ts`
- **Control Plane Agent:** `src/jobs/replySystemV2/controlPlaneAgent.ts`
- **Integration:** `src/jobs/replySystemV2/candidateScorer.ts` (uses judge)
- **Scheduling:** `src/jobs/jobManager.ts` (hourly/daily jobs)

---

## NEXT STEPS

1. ✅ Migration applied
2. ✅ Cost logging integrated
3. ✅ Target judge implemented
4. ✅ Control plane agent created
5. ⏳ Deploy and verify
6. ⏳ Monitor first hourly adjustment
7. ⏳ Verify costs are logged

---

**Status:** ✅ **IMPLEMENTATION COMPLETE - READY FOR DEPLOYMENT**

