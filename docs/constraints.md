Env via Zod; no direct process.env.

Queues use SKIP LOCKED + unique keys (content_hash, tweet_id).

Playwright: fresh context per retry; exponential backoff.

SQL: reversible migrations; indexes on tweet_id/content_hash/created_at/next_run.

Tests: characterization + unit tests for helpers.

CI: tsc + eslint + test; secret scan on PR.

Logs: JSON {op, jobId, tweetId, outcome, ms, attempt}.

