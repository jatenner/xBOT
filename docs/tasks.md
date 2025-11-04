1) Comprehensive scraper + job queue.

2) Idempotent scheduler helper (postOnce) + queue_posts table.

3) Winner loop (medians, ER>=1%, remix 48–72h).

4) Auto-pause on low ER; keep replies.

5) Similarity guard (no near-dupe < 90 min).

6) Public-page-first scraping + HTML snapshot.

7) Rolling 90-day impressions endpoint.

8) Structured logger + redaction.

9) GitHub Action: tsc/lint/test + secret scan.

