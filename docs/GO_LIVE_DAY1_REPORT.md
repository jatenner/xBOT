# 📊 24-Hour Stability Bake Report

**Generated:** 2026-01-21T22:08:36.164Z
**Period:** 2026-01-20T22:08:36.164Z to 2026-01-21T22:08:36.164Z
**Duration:** 24 hours

---

## 📈 Executive Summary

- **Plans Generated:** 3/24 (❌ 21 gaps)
- **POST_SUCCESS (24h):** 1
- **Target Overruns:** 0 ✅
- **Resistance Signals:** CONSENT_WALL=6, CHALLENGE=0, POST_FAILED=6
- **POST_FAILED Breakdown:** Safety Gates=3, Platform=2
- **Current MAX_REPLIES_PER_HOUR:** 4

---

## 1. Shadow Plan Generation Continuity

**SQL Query:**
```sql
SELECT plan_id, window_start, target_posts, target_replies, resistance_backoff_applied, backoff_reason
FROM growth_plans
WHERE window_start >= '2026-01-20T22:08:36.164Z'
  AND window_start < '2026-01-21T22:08:36.164Z'
ORDER BY window_start ASC;
```

**Results:**
❌ **Missing 21 plan(s) - gaps detected**

**Plans by Hour:**
| Hour | Plan Generated | Plan ID | Targets | Backoff |
|------|----------------|---------|---------|---------|
| 22:00 | ❌ | N/A | N/A | ✅ NO |
| 23:00 | ❌ | N/A | N/A | ✅ NO |
| 00:00 | ❌ | N/A | N/A | ✅ NO |
| 01:00 | ❌ | N/A | N/A | ✅ NO |
| 02:00 | ❌ | N/A | N/A | ✅ NO |
| 03:00 | ❌ | N/A | N/A | ✅ NO |
| 04:00 | ❌ | N/A | N/A | ✅ NO |
| 05:00 | ❌ | N/A | N/A | ✅ NO |
| 06:00 | ❌ | N/A | N/A | ✅ NO |
| 07:00 | ❌ | N/A | N/A | ✅ NO |
| 08:00 | ❌ | N/A | N/A | ✅ NO |
| 09:00 | ❌ | N/A | N/A | ✅ NO |
| 10:00 | ❌ | N/A | N/A | ✅ NO |
| 11:00 | ❌ | N/A | N/A | ✅ NO |
| 12:00 | ❌ | N/A | N/A | ✅ NO |
| 13:00 | ❌ | N/A | N/A | ✅ NO |
| 14:00 | ❌ | N/A | N/A | ✅ NO |
| 15:00 | ❌ | N/A | N/A | ✅ NO |
| 16:00 | ❌ | N/A | N/A | ✅ NO |
| 17:00 | ✅ | 76c40a81... | 1p/2r | ⚠️ YES |
| 18:00 | ❌ | N/A | N/A | ✅ NO |
| 19:00 | ✅ | 845753d3... | 2p/4r | ✅ NO |
| 20:00 | ❌ | N/A | N/A | ✅ NO |
| 21:00 | ✅ | 604e1783... | 2p/4r | ✅ NO |

---

## 2. Enforcement Verification (Execution Counters)

**SQL Query:**
```sql
SELECT
  gp.plan_id,
  gp.window_start,
  gp.target_posts,
  gp.target_replies,
  COALESCE(ge.posts_done, 0) as posts_done,
  COALESCE(ge.replies_done, 0) as replies_done
FROM growth_plans gp
LEFT JOIN growth_execution ge ON ge.plan_id = gp.plan_id
WHERE gp.window_start >= '2026-01-20T22:08:36.164Z'
  AND gp.window_start < '2026-01-21T22:08:36.164Z'
ORDER BY gp.window_start ASC;
```

**Overrun Check:**
```sql
SELECT COUNT(*) as count
FROM growth_plans gp
JOIN growth_execution ge ON ge.plan_id = gp.plan_id
WHERE (ge.posts_done > gp.target_posts OR ge.replies_done > gp.target_replies)
  AND gp.window_start >= '2026-01-20T22:08:36.164Z'
  AND gp.window_start < '2026-01-21T22:08:36.164Z';
```

**Result:**
✅ **No target overruns (0 rows returned)**

**Execution vs Targets by Hour:**
| Hour | Plan | Target | Actual | Status |
|------|------|--------|--------|--------|
| 17:00 | 1p/2r | 0p/2r | Posts: ✅ 0/1, Replies: ✅ 2/2 |
| 19:00 | 2p/4r | 0p/0r | Posts: ✅ 0/2, Replies: ✅ 0/4 |
| 21:00 | 2p/4r | 0p/0r | Posts: ✅ 0/2, Replies: ✅ 0/4 |

---

## 3. Posting Activity (POST_SUCCESS per Hour)

**SQL Query:**
```sql
SELECT
  DATE_TRUNC('hour', created_at) as hour,
  COUNT(*) as count
FROM system_events
WHERE event_type = 'POST_SUCCESS'
  AND created_at >= '2026-01-20T22:08:36.164Z'
  AND created_at < '2026-01-21T22:08:36.164Z'
GROUP BY DATE_TRUNC('hour', created_at)
ORDER BY hour ASC;
```

**Total POST_SUCCESS (24h):** 1

**POST_SUCCESS by Hour:**
| Hour | Count |
|------|-------|
| 22:00 | 0 |
| 23:00 | 0 |
| 00:00 | 0 |
| 01:00 | 0 |
| 02:00 | 0 |
| 03:00 | 0 |
| 04:00 | 0 |
| 05:00 | 0 |
| 06:00 | 0 |
| 07:00 | 0 |
| 08:00 | 0 |
| 09:00 | 0 |
| 10:00 | 0 |
| 11:00 | 0 |
| 12:00 | 0 |
| 13:00 | 0 |
| 14:00 | 0 |
| 15:00 | 0 |
| 16:00 | 1 |
| 17:00 | 0 |
| 18:00 | 0 |
| 19:00 | 0 |
| 20:00 | 0 |
| 21:00 | 0 |

---

## 4. Resistance Signals per Hour

**SQL Query:**
```sql
SELECT
  DATE_TRUNC('hour', created_at) as hour,
  COUNT(*) FILTER (WHERE event_type = 'CONSENT_WALL') as consent_wall,
  COUNT(*) FILTER (WHERE event_type = 'CHALLENGE') as challenge,
  COUNT(*) FILTER (WHERE event_type = 'POST_FAILED') as post_failed
FROM system_events
WHERE event_type IN ('CONSENT_WALL', 'CHALLENGE', 'POST_FAILED')
  AND created_at >= '2026-01-20T22:08:36.164Z'
  AND created_at < '2026-01-21T22:08:36.164Z'
GROUP BY DATE_TRUNC('hour', created_at)
ORDER BY hour ASC;
```

**Total Resistance Signals (24h):**
- CONSENT_WALL: 6
- CHALLENGE: 0
- POST_FAILED: 6

**Resistance Signals by Hour:**
| Hour | CONSENT_WALL | CHALLENGE | POST_FAILED |
|------|--------------|-----------|-------------|
| 22:00 | 0 | 0 | 0 |
| 23:00 | 0 | 0 | 0 |
| 00:00 | 0 | 0 | 0 |
| 01:00 | 0 | 0 | 0 |
| 02:00 | 0 | 0 | 2 |
| 03:00 | 0 | 0 | 0 |
| 04:00 | 0 | 0 | 0 |
| 05:00 | 0 | 0 | 0 |
| 06:00 | 0 | 0 | 0 |
| 07:00 | 0 | 0 | 0 |
| 08:00 | 0 | 0 | 0 |
| 09:00 | 0 | 0 | 0 |
| 10:00 | 0 | 0 | 0 |
| 11:00 | 0 | 0 | 0 |
| 12:00 | 0 | 0 | 0 |
| 13:00 | 0 | 0 | 0 |
| 14:00 | 0 | 0 | 0 |
| 15:00 | 0 | 0 | 4 |
| 16:00 | 4 | 0 | 0 |
| 17:00 | 2 | 0 | 0 |
| 18:00 | 0 | 0 | 0 |
| 19:00 | 0 | 0 | 0 |
| 20:00 | 0 | 0 | 0 |
| 21:00 | 0 | 0 | 0 |

---

## 5. POST_FAILED Breakdown (Gates vs Platform)

**SQL Query:**
```sql
SELECT
  DATE_TRUNC('hour', created_at) as hour,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE event_data->>'pipeline_error_reason' LIKE 'SAFETY_GATE%' OR event_data->>'pipeline_error_reason' LIKE 'INVALID_STATUS%' OR event_data->>'pipeline_error_reason' LIKE 'ANCESTRY%' OR event_data->>'pipeline_error_reason' LIKE '%OFF_LIMITS%') as safety_gates,
  COUNT(*) FILTER (WHERE event_data->>'pipeline_error_reason' LIKE 'POSTING_FAILED%' OR event_data->>'pipeline_error_reason' LIKE '%timeout%' OR event_data->>'pipeline_error_reason' LIKE '%rate_limit%' OR event_data->>'pipeline_error_reason' LIKE '%consent%') as platform_failures
FROM system_events
WHERE event_type = 'POST_FAILED'
  AND created_at >= '2026-01-20T22:08:36.164Z'
  AND created_at < '2026-01-21T22:08:36.164Z'
GROUP BY DATE_TRUNC('hour', created_at)
ORDER BY hour ASC;
```

**Total Breakdown (24h):**
- Total POST_FAILED: 6
- Safety Gates: 3 (50.0%)
- Platform Failures: 2 (33.3%)

**POST_FAILED by Hour:**
| Hour | Total | Safety Gates | Platform |
|------|-------|--------------|----------|
| 22:00 | 0 | 0 | 0 |
| 23:00 | 0 | 0 | 0 |
| 00:00 | 0 | 0 | 0 |
| 01:00 | 0 | 0 | 0 |
| 02:00 | 2 | 2 | 0 |
| 03:00 | 0 | 0 | 0 |
| 04:00 | 0 | 0 | 0 |
| 05:00 | 0 | 0 | 0 |
| 06:00 | 0 | 0 | 0 |
| 07:00 | 0 | 0 | 0 |
| 08:00 | 0 | 0 | 0 |
| 09:00 | 0 | 0 | 0 |
| 10:00 | 0 | 0 | 0 |
| 11:00 | 0 | 0 | 0 |
| 12:00 | 0 | 0 | 0 |
| 13:00 | 0 | 0 | 0 |
| 14:00 | 0 | 0 | 0 |
| 15:00 | 4 | 1 | 2 |
| 16:00 | 0 | 0 | 0 |
| 17:00 | 0 | 0 | 0 |
| 18:00 | 0 | 0 | 0 |
| 19:00 | 0 | 0 | 0 |
| 20:00 | 0 | 0 | 0 |
| 21:00 | 0 | 0 | 0 |

**Top POST_FAILED Reasons:**
| Reason | Count |
|--------|-------|
| OFF_LIMITS_TOPIC | 1 |
| POSTING_FAILED_BLOCKED__Posting_only_allowed_from_worker_service_ | 1 |
| POSTING_FAILED_FINAL_PLAYWRIGHT_GATE_BLOCKED__ANCESTRY_UNCERTAIN_ | 1 |
| SAFETY_GATE_missing_gate_data_safety_block | 1 |
| SAFETY_GATE_root_resolution_failed_null | 1 |
| UNKNOWN | 1 |

---

## 6. Incidents & Auto-Remediations

**Total Incidents:** 1

### COOLDOWN_MODE_ACTIVE (warning)
- **Time:** Wed Jan 21 2026 16:09:45 GMT-0500 (Eastern Standard Time)
- **Message:** Cooldown envelope activated
- **Details:** {
  "caps": {
    "max_step_posts": 1,
    "max_step_replies": 2,
    "max_posts_per_hour": 2,
    "max_replies_per_hour": 3
  },
  "reason": "Resistance signals detected: CONSENT_WALL=6, POST_FAILED=6. Applying 12h cooldown to reduce platform friction.",
  "end_time": "2026-01-22T09:09:45.492Z",
  "start_time": "2026-01-21T21:09:45.492Z",
  "previous_caps": {
    "max_posts_per_hour": 2,
    "max_replies_per_hour": 4
  },
  "duration_hours": 12
}


---

## 7. GO/NO-GO Recommendation

**Exit Criteria:**
- CONSENT_WALL < 5 in last 12h: ❌ FAIL (6)
- CHALLENGE = 0 in last 12h: ✅ PASS (0)
- Actual posting failures <= 1 in last 12h: ❌ FAIL (2)
- Target overruns = 0: ✅ PASS (0)
- Plan continuity: ❌ FAIL (21 gaps)

## ⚠️ **NO-GO: EXTEND COOLDOWN / KEEP CONSERVATIVE CAPS**

**Rationale:**
- CONSENT_WALL still high: 6 (threshold: <5)
- Platform failures too high: 2 (threshold: <=1)
- Plan generation gaps: 21

**Action:**
- Keep `MAX_REPLIES_PER_HOUR=3` (or reduce to 2 if CONSENT_WALL persists)
- Continue monitoring for next 12 hours
- Re-check exit criteria


---

## 8. Next Change Recommendation

### Consider Adding REPLY_TOO_GENERIC Gate

**Rationale:**
- Safety gates are working well, but no quality-based filtering detected
- Adding REPLY_TOO_GENERIC gate could improve reply quality
- Would complement existing safety gates (ANCESTRY, OFF_LIMITS, etc.)

**Implementation:**
- Add quality check in reply decision flow
- Block generic/repetitive replies before posting
- Log as POST_FAILED with reason: SAFETY_GATE_REPLY_TOO_GENERIC

---

**Report Generated:** 2026-01-21T22:08:36.164Z