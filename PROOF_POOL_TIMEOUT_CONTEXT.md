# Proof: Pool Timeout Context Investigation

**Date:** 2026-01-13  
**Goal:** Prove whether ANCESTRY_ACQUIRE_CONTEXT_TIMEOUT is specific to `railway run` vs live service  
**Status:** ✅ IN PROGRESS

---

## PART 1: Railway Run Context

### Script Output: `scripts/seed-and-run-scheduler.ts`

**Output:** (Pending)

---

## PART 2: Live Service Context

### Metrics Endpoint
```bash
curl -sSf https://xbot-production-844b.up.railway.app/metrics/replies | jq '.pool_health'
```

**Output:** (Pending)

### Status Endpoint
```bash
curl -sSf https://xbot-production-844b.up.railway.app/status | jq '{app_version, boot_time}'
```

**Output:** (Pending)

---

## PART 3: Debug Endpoint

### Endpoint: `POST /debug/seed-and-run`
- Guarded by `DEBUG_TOKEN` env var
- Runs in-process (uses same browser pool)
- Seeds candidates and triggers scheduler

**Output:** (Pending)

---

## DIAGNOSIS

### Current Blocker
(Pending)

### Next Single Fix
(Pending)

---

## FINAL OUTPUT

### 1) Current Blocker
(Pending)

### 2) Next Single Fix
(Pending)

### 3) Updated Progress

**Overall Progress:** (Pending)  
**Posting-Specific Progress:** (Pending)
