# Autonomy Readiness Audit

**Generated:** 2026-02-03T02:32:40.655Z
**Audit ID:** 1770085967645

## Control-plane Health

### Railway Services

**xBOT Service:**
- **Healthy:** ✅ YES
- **SHA:** fdf00f1e32b67fa399f668d836c0a737e73bc62a
- **Execution Mode:** control


**serene-cat Service:**
- **Healthy:** ✅ YES
- **SHA:** fdf00f1e32b67fa399f668d836c0a737e73bc62a
- **Execution Mode:** control


### Scheduler Ticks (Last 60 Minutes)

- **POSTING_QUEUE_TICK:** ✅ Present
- **REPLY_QUEUE_TICK:** ✅ Present
- **LEARNING_TICK:** ❌ Missing

**Missing Ticks:** LEARNING_TICK

---

## Supply Health

### Reply Opportunities

- **Total:** 0
- **Passed Hard Filters:** 0
- **Accessibility Status Distribution:**

- **Freshness Distribution:**
  - Last 24h: 0
  - Last 7d: 0
  - Last 30d: 0
  - Older: 0

### Content Candidates


- **Total:** 1000
- **By Status:**
  - posted: 446
  - archived: 393
  - cancelled: 160
  - failed_permanent: 1
- **By Type:**
  - reply: 509
  - single: 452
  - thread: 39


### Self-Supply Capability

- **Can Self-Supply:** ❌ NO
  - Requires: >= 10 passed filters AND > 0 opportunities in last 24h

---

## Planner Output

### Decisions Created (Last 24h)

- **Total:** 19

**By Pipeline Source:**
- unknown: 19

**By Status:**
- failed_permanent: 7
- failed: 1
- blocked: 3
- queued: 8

**By Type:**
- thread: 8
- single: 3
- reply: 8

### Starvation Reasons

- POSTING_QUEUE_BLOCKED

---

## Executor Readiness

### Status Summary

```
executor_status_failed
```

### Authentication

- **AUTH_OK Age:** Marker missing
- **Last Auth Persistence Result:** no_report
- **Last 20 Auth Events Classification:**
  - EXECUTOR_AUTH_REQUIRED: 1
  - EXECUTOR_AUTH_INVALID: 14
  - EXECUTOR_AUTH_VERIFIED: 5

---

## Execution Proofs

### Summary (Last 20 Runs)

- **Total Runs:** 0
- **Success Rate:** 0.0%
- **Median Time-to-Success:** N/A

### Failure Classifications

- None

### By Proof Type

- No proof data

---

## Measurement + Learning

### Outcomes

- **Outcomes Collected (Last 24h):** 2

### Rewards

- **Last Updated:** N/A

**Top 10 Strategies by Mean Reward:**
- No strategy rewards data

### Strategy Attribution Coverage

- **Coverage:** 0.0% of decisions have strategy_id

---

## Autonomy Readiness Score

**Readiness:** ❌ NO
**Top Blocker:** AUTH_PERSISTENCE_FAILED

### Requirements Met

- ✅ Control-plane ticks present: YES
- ✅ Auth persistence >= 60 min OR last 3 runs PASS: NO
- ✅ Execution success rate >= 70%: NO (0.0%)
- ✅ Outcomes collected in last 24h: YES (2 outcomes)

---

**AUTONOMY_READY=NO reason=AUTH_PERSISTENCE_FAILED
