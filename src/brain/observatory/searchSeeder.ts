/**
 * Search Seeder
 *
 * Uses Twitter search to discover accounts matching specific niche + follower-range
 * criteria from active seed campaigns.
 *
 * Requires auth context (X.com requires login for search).
 * READ-ONLY: never posts, replies, or engages.
 *
 * Each run:
 * 1. Picks up to 3 active campaigns (highest priority first)
 * 2. For each campaign, picks a search query and runs it
 * 3. Extracts author usernames from search results
 * 4. Inserts new accounts into brain_accounts with campaign niche
 * 5. Updates campaign discovered_count
 *
 * Discovery rate: ~20-30 accounts per campaign per run, 3 campaigns/run = ~60-90/run
 * At 15-minute interval = ~5,000 accounts/day
 */

import { getSupabaseClient } from '../../db';
import { getBrainAuthPage, brainGoto } from '../feeds/brainNavigator';
import { extractTweetsFromPage, ingestFeedResults } from '../discoveryEngine';
import { getFollowerRange, FOLLOWER_RANGE_BOUNDS, type FollowerRange } from '../types';

const LOG_PREFIX = '[observatory/search-seeder]';
const MAX_CAMPAIGNS_PER_RUN = 3;
const TWEETS_PER_SEARCH = 30;

// Default search queries per niche (seeds — the keyword pool auto-expands these)
const NICHE_SEED_QUERIES: Record<string, string[]> = {
  health: ['"health tip"', '"nutrition science"', '"sleep quality"', '"mental health"', '"exercise routine"'],
  tech: ['"AI breakthrough"', '"machine learning"', '"software engineer"', '"tech startup"', '"coding"'],
  crypto: ['"crypto alpha"', '"DeFi"', '"bitcoin analysis"', '"web3 builder"', '"blockchain"'],
  finance: ['"investing"', '"stock market"', '"financial freedom"', '"portfolio"', '"wealth building"'],
  politics: ['"political analysis"', '"policy debate"', '"election"', '"government"'],
  science: ['"research paper"', '"scientific discovery"', '"peer reviewed"', '"lab results"'],
  business: ['"entrepreneur"', '"startup founder"', '"business strategy"', '"growth hacking"'],
  personal_dev: ['"self improvement"', '"productivity hack"', '"morning routine"', '"mindset"'],
  fitness: ['"workout routine"', '"gym gains"', '"bodybuilding"', '"marathon training"'],
  humor: ['"comedy"', '"funny thread"', '"stand up"'],
  culture: ['"pop culture"', '"trending topic"', '"viral moment"'],
  sports: ['"sports analysis"', '"game recap"', '"athlete"'],
};

export async function runSearchSeeder(): Promise<{
  campaigns_processed: number;
  accounts_discovered: number;
}> {
  const supabase = getSupabaseClient();
  let campaignsProcessed = 0;
  let accountsDiscovered = 0;

  // Get active campaigns, highest priority first
  const { data: campaigns } = await supabase
    .from('brain_seed_campaigns')
    .select('*')
    .eq('status', 'active')
    .order('priority', { ascending: false })
    .limit(MAX_CAMPAIGNS_PER_RUN);

  if (!campaigns || campaigns.length === 0) {
    return { campaigns_processed: 0, accounts_discovered: 0 };
  }

  let page: any;
  try {
    page = await getBrainAuthPage();
  } catch (err: any) {
    console.error(`${LOG_PREFIX} Failed to get auth page: ${err.message}`);
    return { campaigns_processed: 0, accounts_discovered: 0 };
  }

  try {
    for (const campaign of campaigns) {
      try {
        const discovered = await processCampaignSearch(supabase, page, campaign);
        accountsDiscovered += discovered;
        campaignsProcessed++;

        // Check if campaign is complete
        const newDiscoveredCount = (campaign.discovered_count ?? 0) + discovered;
        const updates: Record<string, any> = {
          discovered_count: newDiscoveredCount,
          updated_at: new Date().toISOString(),
        };

        if (newDiscoveredCount >= campaign.target_count) {
          updates.status = 'completed';
        }

        await supabase
          .from('brain_seed_campaigns')
          .update(updates)
          .eq('id', campaign.id);

      } catch (err: any) {
        console.error(`${LOG_PREFIX} Campaign ${campaign.niche}/${campaign.target_follower_range} error: ${err.message}`);
      }
    }
  } finally {
    try { await page.close(); } catch {}
  }

  if (accountsDiscovered > 0) {
    console.log(`${LOG_PREFIX} Seeded ${accountsDiscovered} accounts from ${campaignsProcessed} campaigns`);
  }

  return { campaigns_processed: campaignsProcessed, accounts_discovered: accountsDiscovered };
}

async function processCampaignSearch(
  supabase: any,
  page: any,
  campaign: any,
): Promise<number> {
  // Pick a search query — rotate through campaign's queries, or use niche defaults
  let queries: string[] = campaign.search_queries ?? [];
  if (queries.length === 0) {
    queries = NICHE_SEED_QUERIES[campaign.niche] ?? NICHE_SEED_QUERIES['tech'];
  }

  // Pick a random query to avoid always hitting the same one
  const query = queries[Math.floor(Math.random() * queries.length)];

  // Add min_faves filter to find accounts that actually post good content
  const searchUrl = `https://x.com/search?q=${encodeURIComponent(query + ' min_faves:20')}&src=typed_query&f=top`;

  const nav = await brainGoto(page, searchUrl, 20000);
  if (!nav.success) return 0;

  // Wait for tweets to load
  try {
    await page.waitForSelector('article[data-testid="tweet"]', { timeout: 8000 });
  } catch {
    return 0;
  }

  // Scroll a bit to get more results
  for (let i = 0; i < 3; i++) {
    await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
    await page.waitForTimeout(1500);
  }

  // Extract tweets (which contain author info)
  const tweets = await extractTweetsFromPage(page, {
    maxTweets: TWEETS_PER_SEARCH,
    skipReplies: false,
  });

  if (tweets.length === 0) return 0;

  // Extract unique authors
  const authors = new Map<string, { followers: number | null }>();
  for (const tweet of tweets) {
    if (!tweet.author_username) continue;
    const username = tweet.author_username.toLowerCase();
    if (!authors.has(username)) {
      authors.set(username, { followers: tweet.author_followers ?? null });
    }
  }

  // Filter by target follower range
  const rangeBounds = FOLLOWER_RANGE_BOUNDS[campaign.target_follower_range as FollowerRange];
  let discovered = 0;

  for (const [username, info] of authors) {
    // If we know the follower count, filter by range
    if (info.followers !== null && rangeBounds) {
      if (info.followers < rangeBounds.min || info.followers >= rangeBounds.max) {
        continue; // Outside target range
      }
    }

    // Check if account already exists
    const { data: existing } = await supabase
      .from('brain_accounts')
      .select('username')
      .eq('username', username)
      .single();

    if (existing) continue; // Already tracked

    // Insert new account
    const followerRange = info.followers !== null ? getFollowerRange(info.followers) : null;

    await supabase.from('brain_accounts').upsert({
      username,
      followers_count: info.followers,
      follower_range: followerRange,
      follower_range_at_first_snapshot: followerRange,
      primary_domain: campaign.niche,
      niche_cached: campaign.niche,
      discovery_method: 'seed',
      discovered_from_username: null,
      tier: 'C',
      scrape_priority: 0.3,
      is_active: true,
      next_census_at: new Date(Date.now() + Math.random() * 48 * 60 * 60 * 1000).toISOString(),
    }, { onConflict: 'username' });

    discovered++;
  }

  // Also ingest the tweets we found into the brain
  if (tweets.length > 0) {
    await ingestFeedResults([{
      source: 'keyword' as any,
      keyword: `seed:${campaign.niche}:${query}`,
      feed_run_id: `seed_${campaign.id}_${Date.now()}`,
      tweets,
    }]);
  }

  return discovered;
}
