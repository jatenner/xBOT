# Truth Audit: Last 24 Hours

**Date:** 2025-12-18T21:14:51.953Z

---

## Totals

- **Posted Singles:** 13
- **Posted Threads:** 1
- **Posted Replies:** 30
- **Total Posted:** 44
- **Failed/Retrying:** 9

## Log Summary

- **Log Singles:** 0
- **Log Threads:** 0
- **Log Replies:** 0
- **Total Log Entries:** 0

## Mismatches (intended_type vs detected_type)

✅ No mismatches found.

## Missing Logs (DB posted but no SUCCESS log)

Found 44 posted decisions without SUCCESS logs:

| decision_id | status | posted_at | reason |
|-------------|--------|-----------|--------|
| b59dc489... | posted | 2025-12-18T21:08:30.569+00:00 | service_restart_or_crash |
| 1a489eb0... | posted | 2025-12-18T20:56:36.114+00:00 | service_restart_or_crash |
| 62e2fe70... | posted | 2025-12-18T07:30:14.631+00:00 | likely_log_rotation |
| e7d07a4e... | posted | 2025-12-18T07:47:06.332+00:00 | likely_log_rotation |
| 6841a8ec... | posted | 2025-12-18T19:46:56.421+00:00 | service_restart_or_crash |
| 1d3ebf33... | posted | 2025-12-18T11:59:40.161+00:00 | service_restart_or_crash |
| 4b2d6db4... | posted | 2025-12-18T15:44:56.57+00:00 | service_restart_or_crash |
| 5bbc5c87... | posted | 2025-12-18T19:58:08.007+00:00 | service_restart_or_crash |
| e3e8922c... | posted | 2025-12-18T20:54:26.954+00:00 | service_restart_or_crash |
| f559a000... | posted | 2025-12-18T15:46:26.877+00:00 | service_restart_or_crash |
| 868d6486... | posted | 2025-12-18T16:06:17.932+00:00 | service_restart_or_crash |
| cb21be00... | posted | 2025-12-17T20:07:54.343+00:00 | log_rotation (posted >20h ago) |
| fd47567f... | posted | 2025-12-17T21:17:54.742+00:00 | log_rotation (posted >20h ago) |
| ed3091e0... | posted | 2025-12-17T23:54:35.03+00:00 | log_rotation (posted >20h ago) |
| d1af4051... | posted | 2025-12-18T17:31:24.35+00:00 | service_restart_or_crash |
| 09427a77... | posted | 2025-12-18T17:50:37.316+00:00 | service_restart_or_crash |
| e9d1ad80... | posted | 2025-12-18T20:52:09.356+00:00 | service_restart_or_crash |
| 2e82eca7... | posted | 2025-12-18T19:01:13.904+00:00 | service_restart_or_crash |
| 9b2b597b... | posted | 2025-12-18T19:07:45.422+00:00 | service_restart_or_crash |
| 75e4997b... | posted | 2025-12-18T19:44:17.808+00:00 | service_restart_or_crash |

## Missing DB (SUCCESS log but no DB entry)

✅ All SUCCESS logs have DB entries.

## Top 10 Most Recent Threads

| decision_id | tweet_ids_count | method | posted_at | url |
|-------------|-----------------|--------|-----------|-----|
| 179d3815... | 1 | native-composer | 2025-12-18T10:50:18.841+00:00 | https://x.com/SignalAndSynapse/status/2001605259228061907 |

## Thread Proof (DB-only)

Last 20 decisions where decision_type='thread' OR thread_tweet_ids IS NOT NULL:

| decision_id | decision_type | status | tweet_id | thread_tweet_ids_length | posted_at |
|-------------|----------------|--------|----------|------------------------|-----------|
| c623aa57... | thread | queued | N/A | 0 | N/A |
| b23bf642... | thread | posting | N/A | 0 | N/A |
| bd027e89... | thread | queued | N/A | 0 | N/A |
| 92aa84ef... | thread | failed | N/A | 0 | N/A |
| d8cd69b1... | thread | queued | N/A | 0 | N/A |
| a14852ff... | thread | queued | N/A | 0 | N/A |
| aec74372... | thread | queued | N/A | 0 | N/A |
| ab5a7238... | thread | failed_permanent | N/A | 0 | N/A |
| 51c7aa65... | thread | queued | N/A | 0 | N/A |
| 54d5367b... | thread | queued | N/A | 0 | N/A |
| 3320a25a... | thread | queued | N/A | 0 | N/A |
| 0d304149... | thread | queued | N/A | 0 | N/A |
| ad98133e... | thread | queued | N/A | 0 | N/A |
| a30e848b... | thread | archived | N/A | 0 | N/A |
| 046a9a68... | thread | failed_permanent | N/A | 0 | N/A |
| 43e05053... | thread | failed_permanent | N/A | 0 | N/A |
| 52d3785e... | thread | failed_permanent | N/A | 0 | N/A |
| 080f0a44... | thread | failed_permanent | N/A | 0 | N/A |
| 7d96448f... | thread | failed_permanent | N/A | 0 | N/A |
| 07eec120... | thread | failed_permanent | N/A | 0 | N/A |

## Warnings (decision_type='thread' but thread_tweet_ids length < 2)

Found 3 warnings:

| decision_id | decision_type | thread_tweet_ids_length | reason |
|-------------|---------------|-------------------------|--------|
| 92aa84ef... | thread | 0 | decision_type='thread' but thread_tweet_ids length=0 < 2 (missing thread IDs) |
| 179d3815... | thread | 1 | decision_type='thread' but thread_tweet_ids length=1 < 2 (missing thread IDs) |
| 3fa67116... | thread | 0 | decision_type='thread' but thread_tweet_ids length=0 < 2 (missing thread IDs) |

---

**Report Generated:** 2025-12-18T21:14:51.953Z
