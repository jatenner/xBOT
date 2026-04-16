-- =============================================================================
-- brain_tweets.reply_tree_scraped_at — Marker for dedicated reply-tree scraper
-- =============================================================================
--
-- The reply-tree scraper visits /status/{tweet_id} for high-engagement tweets
-- from growing accounts, extracts the visible reply tree, and populates
-- external_reply_patterns. This column tracks which tweets have been scraped
-- so we don't re-scrape the same tweet's conversation repeatedly.
--
-- NULL = never scraped. Worker filters by this + engagement thresholds.

ALTER TABLE brain_tweets
  ADD COLUMN IF NOT EXISTS reply_tree_scraped_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_brain_tweets_reply_tree_pending
  ON brain_tweets (author_username, posted_at DESC)
  WHERE reply_tree_scraped_at IS NULL;
