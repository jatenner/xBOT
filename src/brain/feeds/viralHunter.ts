/**
 * Brain Feed: Viral Hunter
 *
 * Specifically hunts for MASSIVE tweets — the biggest wins on Twitter.
 * Uses search queries designed to find tweets with extreme engagement.
 *
 * Also captures failures: tweets from high-follower accounts that got
 * almost no engagement. Understanding WHY something failed from a big
 * account is just as valuable as understanding why something went viral.
 *
 * Strategies:
 * 1. "min_faves" search operator to find tweets with 1K+ / 10K+ / 100K+ likes
 * 2. Profile scraping of mega accounts (1M+ followers) to capture their flops
 * 3. Rotating across domains to get diverse viral content
 */

import { getBrainAuthPage, brainGoto, waitForTweets, scrollForMore } from './brainNavigator';
import {
  extractTweetsFromPage,
  ingestFeedResults,
  type FeedResult,
} from '../discoveryEngine';

const LOG_PREFIX = '[brain/feed/viral-hunter]';

// Rotate through these search queries to find massive tweets across domains.
// X deprecated min_faves/min_retweets operators. Instead we use "Top" tab
// (f=top) which surfaces high-engagement tweets, plus specific phrases
// and topics that tend to produce viral content.
const VIRAL_SEARCH_QUERIES = [
  // Broad viral phrases — these phrases correlate with high-engagement tweets
  { query: 'went viral', label: 'viral_self_report' },
  { query: '"this is insane"', label: 'viral_reaction' },
  { query: '"I can\'t believe"', label: 'viral_shock' },
  { query: '"thread" 🧵', label: 'viral_threads' },
  { query: '"game changer"', label: 'viral_game_changer' },

  // Domain-specific viral (Top tab finds the highest engagement)
  { query: 'health breakthrough', label: 'viral_health' },
  { query: 'AI artificial intelligence', label: 'viral_ai' },
  { query: 'investing money wealth', label: 'viral_finance' },
  { query: 'startup founder raised', label: 'viral_startup' },
  { query: 'psychology brain study', label: 'viral_psych' },
  { query: 'productivity morning routine', label: 'viral_productivity' },
  { query: 'hot take unpopular opinion', label: 'viral_hot_takes' },
  { query: 'new study research shows', label: 'viral_research' },
  { query: 'crypto bitcoin ethereum', label: 'viral_crypto' },
  { query: 'fitness workout gym', label: 'viral_fitness' },

  // Format-specific hunts (learning what FORMATS go viral)
  { query: '"here\'s what I learned"', label: 'format_learnings' },
  { query: '"most people don\'t"', label: 'format_bold_claims' },
  { query: '"nobody talks about"', label: 'format_contrarian' },
  { query: '"I spent" years studying', label: 'format_personal_story' },
  { query: '"stop doing this"', label: 'format_imperative' },
  { query: '"the truth about"', label: 'format_truth' },
  { query: '"unpopular opinion:"', label: 'format_unpopular' },
  { query: '"a thread on"', label: 'format_thread_intro' },
];

// Cursor tracks which query we're on
let queryRotationIndex = 0;
const QUERIES_PER_RUN = 3;
const MAX_TWEETS_PER_QUERY = 30;
const SCROLL_COUNT = 3;

export async function runViralHunter(): Promise<{ tweets_ingested: number; queries_searched: number }> {
  const feedRunId = `brain_viral_hunter_${Date.now()}`;
  const allResults: FeedResult[] = [];
  let queriesSearched = 0;

  // Pick next queries from rotation
  const queries: typeof VIRAL_SEARCH_QUERIES[number][] = [];
  for (let i = 0; i < QUERIES_PER_RUN; i++) {
    queries.push(VIRAL_SEARCH_QUERIES[queryRotationIndex % VIRAL_SEARCH_QUERIES.length]);
    queryRotationIndex++;
  }

  try {
    const page = await getBrainAuthPage(); // Search requires auth
    await (async () => {

      try {
        for (const q of queries) {
          // Use "Top" tab which surfaces highest-engagement tweets for the query
          const searchUrl = `https://x.com/search?q=${encodeURIComponent(q.query)}&src=typed_query&f=top`;

          const nav = await brainGoto(page, searchUrl);
          if (!nav.success) {
            if (nav.loginWall) {
              console.warn(`${LOG_PREFIX} Login wall for ${q.label}`);
            }
            continue;
          }

          // Wait for tweets
          const tweetCount = await waitForTweets(page, 12000);
          if (tweetCount === 0) {
            console.warn(`${LOG_PREFIX} No tweets for query: ${q.label}`);
            continue;
          }

          // Scroll to load more
          await scrollForMore(page, SCROLL_COUNT, 2000);

          // Extract tweets
          const tweets = await extractTweetsFromPage(page, {
            maxTweets: MAX_TWEETS_PER_QUERY,
            skipReplies: true,
          });

          if (tweets.length > 0) {
            allResults.push({
              source: 'viral_capture',
              keyword: q.label,
              feed_run_id: feedRunId,
              tweets,
            });
          }

          queriesSearched++;
          const topLikes = tweets.length > 0 ? Math.max(...tweets.map(t => t.likes ?? 0)) : 0;
          console.log(`${LOG_PREFIX} ${q.label}: ${tweets.length} tweets, top ${topLikes} likes`);

          // Delay between queries
          await page.waitForTimeout(2000);
        }
      } finally {
        await page.close();
      }
    })();

    // Ingest
    const ingested = await ingestFeedResults(allResults);

    return {
      tweets_ingested: ingested.total_ingested,
      queries_searched: queriesSearched,
    };
  } catch (err: any) {
    console.error(`${LOG_PREFIX} Error:`, err.message);
    return { tweets_ingested: 0, queries_searched: queriesSearched };
  }
}
