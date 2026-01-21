# 🎭 Growth Shadow Controller

**Purpose:** Generate hourly recommendations for posting/reply cadence and strategy (SHADOW MODE - does not enforce).

---

## Overview

The Shadow Controller analyzes recent reward trends and produces recommendations for:
- **Posts per hour** (current: 2, recommended range: 1-4)
- **Replies per hour** (current: 4, recommended range: 2-8)
- **Exploration rate** (0-30%)
- **Strategy weights** (top topics, formats, generators)

**SHADOW MODE:** Recommendations are logged but NOT enforced. The system continues using current configured rates.

---

## How It Works

### 1. Reward Analysis

Analyzes last 24-72h reward trends:
- Average reward score (24h vs 72h)
- Trend direction (increasing/decreasing/flat)
- Reward variance

### 2. Recommendation Generation

**Posts/Hour:**
- If trend is **increasing** and reward > 0 → recommend +1 (up to max)
- If trend is **decreasing** and reward < 0 → recommend -1 (down to min)
- Otherwise → keep current

**Replies/Hour:**
- Same heuristic as posts

**Exploration Rate:**
- High variance (>100) → 30% exploration
- Medium variance (50-100) → 20% exploration
- Low variance (<50) → 10% exploration

**Strategy Weights:**
- Computed from `daily_aggregates` (last 7 days)
- Top 5 topics by avg_reward_score
- Top 3 formats by avg_reward_score
- Top 5 generators by avg_reward_score
- Weights normalized to sum to 1.0

### 3. Output

**System Events:**
- `SHADOW_PLAN` event written to `system_events` table
- Contains full plan with recommendations and explanation

**Report File:**
- `docs/GROWTH_SHADOW_CONTROLLER_REPORT.md`
- Appended with each hourly run
- Contains timestamp, recommendations, explanation, strategy weights

---

## Running the Shadow Controller

### One-Time Run (Testing)
```bash
pnpm run runner:shadow-controller-once
```

### Hourly Schedule (Future)

Add to `jobManager.ts`:
```typescript
this.scheduleStaggeredJob(
  'shadow_controller',
  async () => {
    await this.safeExecute('shadow_controller', async () => {
      const { runShadowControllerJob } = await import('./shadowControllerJob');
      await runShadowControllerJob();
    });
  },
  60 * 60 * 1000, // 1 hour
  5 * 60 * 1000   // Start after 5 minutes
);
```

---

## Report Format

The report file (`docs/GROWTH_SHADOW_CONTROLLER_REPORT.md`) contains:

```markdown
## 2026-01-14 15:00:00

**Posts/Hour:** 3
**Replies/Hour:** 5
**Exploration Rate:** 20%

**Explanation:** Recent reward trend: increasing. 24h avg reward: 12.5. 72h avg reward: 8.3. Recommend increasing posts (reward trend positive). Recommend increasing replies (reward trend positive).

**Top Topics:**
- NAD+ supplementation: 25.3%
- Sleep optimization: 18.7%
- Intermittent fasting: 15.2%

**Top Formats:**
- Timeline with progressive effects: 45.2%
- Single tweet: 32.1%

**Top Generators:**
- dataNerd: 28.5%
- contrarian: 22.3%
```

---

## Querying Recommendations

### Get latest shadow plan
```sql
SELECT 
  event_data->>'posts_per_hour_recommendation' AS posts_per_hour,
  event_data->>'replies_per_hour_recommendation' AS replies_per_hour,
  event_data->>'explanation' AS explanation,
  created_at
FROM system_events
WHERE event_type = 'SHADOW_PLAN'
ORDER BY created_at DESC
LIMIT 1;
```

### Get all plans from last 24h
```sql
SELECT 
  created_at,
  event_data->>'posts_per_hour_recommendation' AS posts_per_hour,
  event_data->>'replies_per_hour_recommendation' AS replies_per_hour,
  event_data->>'exploration_rate' AS exploration_rate
FROM system_events
WHERE event_type = 'SHADOW_PLAN'
  AND created_at >= NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;
```

---

## Moving from Shadow to Control Mode

**Current State:** Shadow mode (recommendations only, no enforcement)

**To Enable Control Mode:**

1. **Review Recommendations:**
   - Check `docs/GROWTH_SHADOW_CONTROLLER_REPORT.md` for trends
   - Verify recommendations make sense
   - Monitor for at least 1 week

2. **Update Job Manager:**
   - Modify `postingQueue.ts` to read from latest `SHADOW_PLAN`
   - Update `MAX_POSTS_PER_HOUR` and `REPLIES_PER_HOUR` from recommendations
   - Add validation (ensure within safe envelope)

3. **Add Control Flag:**
   ```typescript
   const SHADOW_CONTROL_ENABLED = process.env.SHADOW_CONTROL_ENABLED === 'true';
   
   if (SHADOW_CONTROL_ENABLED) {
     const { getLatestShadowPlan } = await import('./shadowControllerJob');
     const plan = await getLatestShadowPlan();
     if (plan) {
       config.MAX_POSTS_PER_HOUR = plan.posts_per_hour_recommendation;
       config.REPLIES_PER_HOUR = plan.replies_per_hour_recommendation;
     }
   }
   ```

4. **Gradual Rollout:**
   - Start with 10% of decisions using shadow recommendations
   - Monitor performance
   - Gradually increase to 100%

5. **Safety Limits:**
   - Always enforce min/max bounds
   - Never exceed safe envelope (env vars)
   - Log all control actions to `system_events`

---

## Safety Envelope

Recommendations are constrained by:
- `SHADOW_MIN_POSTS_PER_HOUR` (default: 1)
- `SHADOW_MAX_POSTS_PER_HOUR` (default: 4)
- `SHADOW_MIN_REPLIES_PER_HOUR` (default: 2)
- `SHADOW_MAX_REPLIES_PER_HOUR` (default: 8)

These limits prevent extreme recommendations that could violate Twitter rate limits or cause account issues.

---

## Monitoring

### Check if recommendations are being generated
```sql
SELECT COUNT(*) as plan_count
FROM system_events
WHERE event_type = 'SHADOW_PLAN'
  AND created_at >= NOW() - INTERVAL '24 hours';
```

### Compare recommendations vs actual rates
```sql
-- Get latest recommendation
WITH latest_plan AS (
  SELECT 
    (event_data->>'posts_per_hour_recommendation')::INTEGER AS recommended_posts,
    (event_data->>'replies_per_hour_recommendation')::INTEGER AS recommended_replies,
    created_at
  FROM system_events
  WHERE event_type = 'SHADOW_PLAN'
  ORDER BY created_at DESC
  LIMIT 1
)
-- Get actual rates (last hour)
, actual_rates AS (
  SELECT 
    COUNT(*) FILTER (WHERE decision_type IN ('single', 'thread')) AS actual_posts,
    COUNT(*) FILTER (WHERE decision_type = 'reply') AS actual_replies
  FROM content_metadata
  WHERE posted_at >= NOW() - INTERVAL '1 hour'
)
SELECT 
  lp.recommended_posts,
  ar.actual_posts,
  lp.recommended_replies,
  ar.actual_replies
FROM latest_plan lp, actual_rates ar;
```

---

## Next Steps

1. **Run shadow controller hourly** (add to job manager)
2. **Monitor recommendations** for 1 week
3. **Review report file** for trends
4. **Enable control mode** when confident (gradual rollout)
